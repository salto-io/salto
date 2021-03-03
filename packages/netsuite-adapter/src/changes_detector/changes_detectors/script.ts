/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { formatSuiteQLDateRange } from '../formats'
import { ChangedObject, TypeChangesDetector } from '../types'

const log = logger(module)

export const SCRIPT_TYPES = [
  'bundleinstallationscript',
  'clientscript',
  'scheduledscript',
  'workflowactionscript',
  'suitelet',
  'mapreducescript',
  'massupdatescript',
  'usereventscript',
  'restlet',
  'sdfinstallationscript',
  'portlet',
  'emailcaptureplugin',
  'plugintype',
  'customglplugin',
  'customrecordactionscript',
  'promotionsplugin',
  'workbookbuilderplugin',
  'bankstatementparserplugin',
  'ficonnectivityplugin',
  'fiparserplugin',
  'datasetbuilderplugin',
  'pluginimplementation',
]

const parseChanges = (queryName: string, changes?: Record<string, unknown>[]): ChangedObject[] => {
  if (changes === undefined) {
    log.warn(`${queryName} changes query failed`)
    return []
  }
  return changes.filter((res): res is { scriptid: string; id: string } => {
    if ([res.scriptid, res.id].some(val => typeof val !== 'string')) {
      log.warn(`Got invalid result from ${queryName} changes query, %o`, res)
      return false
    }
    return true
  }).map(res => ({
    type: 'object',
    externalId: res.scriptid,
    internalId: parseInt(res.id, 10),
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
    const [startDate, endDate] = formatSuiteQLDateRange(dateRange)

    const scriptChangesPromise = client.runSuiteQL(`
      SELECT script.scriptid, script.id
      FROM script
      JOIN systemnote ON systemnote.recordid = script.id
      WHERE systemnote.date BETWEEN '${startDate}' AND '${endDate}' AND systemnote.recordtypeid = -417
    `)

    const scriptDeploymentChangesPromise = client.runSuiteQL(`
      SELECT script.scriptid, script.id
      FROM scriptdeployment 
      JOIN systemnote ON systemnote.recordid = scriptdeployment.primarykey
      JOIN script ON scriptdeployment.script = script.id
      WHERE systemnote.date BETWEEN '${startDate}' AND '${endDate}' AND systemnote.recordtypeid = -418
    `)

    const scriptFieldsChangesPromise = client.runSuiteQL(`
      SELECT internalid
      FROM customfield
      WHERE fieldtype = 'SCRIPT' AND lastmodifieddate BETWEEN '${startDate}' AND '${endDate}'
    `)

    const [
      scriptChanges,
      scriptDeploymentChanges,
      scriptFieldsChanges,
    ] = await Promise.all([
      scriptChangesPromise,
      scriptDeploymentChangesPromise,
      scriptFieldsChangesPromise,
    ])

    if (hasFieldChanges(scriptFieldsChanges)) {
      return SCRIPT_TYPES.map(type => ({ type: 'type', name: type }))
    }

    return [
      ...parseChanges('script', scriptChanges),
      ...parseChanges('script deployment', scriptDeploymentChanges),
    ]
  },
  getTypes: () => SCRIPT_TYPES,
}

export default changesDetector
