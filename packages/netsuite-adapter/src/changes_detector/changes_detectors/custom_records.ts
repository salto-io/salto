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
import NetsuiteClient from '../../client/client'
import { NetsuiteQuery } from '../../config/query'
import { CUSTOM_RECORD_TYPE } from '../../constants'
import { ChangedCustomRecord, DateRange } from '../types'

const log = logger(module)

const hasScriptId = (res: Record<string, unknown>): res is { scriptid: string } => {
  if (typeof res.scriptid !== 'string') {
    log.warn('result has no scriptid string property: %o', res)
    return false
  }
  return true
}

const getMatchingCustomRecords = async (
  client: NetsuiteClient,
  isCustomRecordTypeMatch: NetsuiteQuery['isCustomRecordTypeMatch'],
): Promise<string[]> =>
  (await client.runSuiteQL({ select: 'internalid, scriptid', from: CUSTOM_RECORD_TYPE, orderBy: 'internalid' }))
    ?.filter(hasScriptId)
    .map(({ scriptid }) => scriptid.toLowerCase())
    .filter(isCustomRecordTypeMatch) ?? []

export const getChangedCustomRecords = async (
  client: NetsuiteClient,
  dateRange: DateRange,
  { isCustomRecordTypeMatch }: Pick<NetsuiteQuery, 'isCustomRecordTypeMatch'>,
): Promise<ChangedCustomRecord[]> => {
  const customRecordTypesScriptIds = await getMatchingCustomRecords(client, isCustomRecordTypeMatch)

  const [startDate, endDate] = dateRange.toSuiteQLRange()
  const changedObjects = await Promise.all(
    customRecordTypesScriptIds.map(
      async customRecordTypeScriptId =>
        (
          await client.runSuiteQL({
            select: 'id, scriptid',
            from: customRecordTypeScriptId,
            where: `lastmodified BETWEEN ${startDate} AND ${endDate}`,
            orderBy: 'id',
          })
        )
          ?.filter(hasScriptId)
          .map(({ scriptid }) => ({
            typeId: customRecordTypeScriptId,
            objectId: scriptid.toLowerCase(),
          })) ?? [],
    ),
  )

  return changedObjects.flat()
}

export const getCustomRecords = async (
  client: NetsuiteClient,
  { isCustomRecordTypeMatch }: Pick<NetsuiteQuery, 'isCustomRecordTypeMatch'>,
  customRecordTypesToIgnore: Set<string>,
): Promise<Map<string, Set<string>>> => {
  const customRecordTypesScriptIds = await getMatchingCustomRecords(client, isCustomRecordTypeMatch)

  const customTypeRecords = await Promise.all(
    customRecordTypesScriptIds
      .filter(customRecordTypesScriptId => !customRecordTypesToIgnore.has(customRecordTypesScriptId))
      .map(async customRecordTypeScriptId => {
        const scriptIds = (
          await client.runSuiteQL({ select: 'id, scriptid', from: customRecordTypeScriptId, orderBy: 'id' })
        )
          ?.filter(hasScriptId)
          .map(({ scriptid }) => scriptid.toLowerCase())
        return {
          typeId: customRecordTypeScriptId,
          recordIds: new Set(scriptIds),
        }
      }),
  )

  return new Map(customTypeRecords.map(customType => [customType.typeId, customType.recordIds]))
}
