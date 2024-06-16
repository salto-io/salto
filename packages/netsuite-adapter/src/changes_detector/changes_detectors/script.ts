/*
 *                      Copyright 2024 Salto Labs Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { logger } from '@salto-io/logging'
import { PLUGIN_IMPLEMENTATION_TYPES, SCRIPT_TYPES } from '../../types'
import { convertSuiteQLStringToDate, toSuiteQLSelectDateString } from '../date_formats'
import { ChangedObject, DateRange, TypeChangesDetector } from '../types'

const log = logger(module)

export const SUPPORTED_TYPES = [...SCRIPT_TYPES, ...PLUGIN_IMPLEMENTATION_TYPES, 'plugintype']

const parseChanges = (
  queryName: string,
  changes: Record<string, unknown>[] | undefined,
  dateRange: DateRange,
): ChangedObject[] => {
  if (changes === undefined) {
    log.warn(`${queryName} changes query failed`)
    return []
  }
  return changes
    .filter((res): res is { scriptscriptid: string; time: string } => {
      if ([res.scriptscriptid, res.time].some(val => typeof val !== 'string')) {
        log.warn(`Got invalid result from ${queryName} changes query, %o`, res)
        return false
      }
      return true
    })
    .map(res => ({
      type: 'object',
      objectId: res.scriptscriptid,
      time: convertSuiteQLStringToDate(res.time, dateRange.end),
    }))
}

const hasFieldChanges = (changes?: Record<string, unknown>[]): boolean => {
  if (changes === undefined) {
    log.warn('script field changes query failed')
    return false
  }
  return changes.length > 0
}

const changesDetector: TypeChangesDetector = {
  getChanges: async (client, dateRange) => {
    const [startDate, endDate] = dateRange.toSuiteQLRange()

    const scriptChangesPromise = client.runSuiteQL({
      select: `script.scriptid as scriptscriptid, ${toSuiteQLSelectDateString('MAX(systemnote.date)')} as time`,
      from: 'script',
      join: 'systemnote ON systemnote.recordid = script.id',
      where: `systemnote.date BETWEEN ${startDate} AND ${endDate} AND systemnote.recordtypeid = -417`,
      groupBy: 'script.scriptid',
      orderBy: 'scriptscriptid',
    })

    const scriptDeploymentChangesPromise = client.runSuiteQL({
      select: `script.scriptid as scriptscriptid, ${toSuiteQLSelectDateString('MAX(systemnote.date)')} as time`,
      from: 'scriptdeployment',
      join: 'systemnote ON systemnote.recordid = scriptdeployment.primarykey JOIN script ON scriptdeployment.script = script.id',
      where: `systemnote.date BETWEEN ${startDate} AND ${endDate} AND systemnote.recordtypeid = -418`,
      groupBy: 'script.scriptid',
      orderBy: 'scriptscriptid',
    })

    const scriptFieldsChangesPromise = client.runSuiteQL({
      select: 'internalid',
      from: 'customfield',
      where: `fieldtype = 'SCRIPT' AND lastmodifieddate BETWEEN ${startDate} AND ${endDate}`,
      orderBy: 'internalid',
    })

    const [scriptChanges, scriptDeploymentChanges, scriptFieldsChanges] = await Promise.all([
      scriptChangesPromise,
      scriptDeploymentChangesPromise,
      scriptFieldsChangesPromise,
    ])

    if (hasFieldChanges(scriptFieldsChanges)) {
      return SUPPORTED_TYPES.map(type => ({ type: 'type', name: type }))
    }

    return [
      ...parseChanges('script', scriptChanges, dateRange),
      ...parseChanges('script deployment', scriptDeploymentChanges, dateRange),
    ]
  },
  getTypes: () => SUPPORTED_TYPES,
}

export default changesDetector
