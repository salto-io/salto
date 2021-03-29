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
import _ from 'lodash'
import { NetsuiteQuery } from '../query'
import { getChangedFiles, getChangedFolders } from './changes_detectors/file_cabinet'
import { customRecordTypeDetector, customFieldDetector, customListDetector } from './changes_detectors/custom_type'
import scriptDetector from './changes_detectors/script'
import roleDetector from './changes_detectors/role'
import workflowDetector from './changes_detectors/workflow'
import savedSearchDetector from './changes_detectors/savedsearch'
import { ChangedObject, ChangedType, DateRange } from './types'
import NetsuiteClient from '../client/client'
import { convertSavedSearchStringToDate } from './date_formats'
import { ElementsSourceValue, LazyElementsSourceIndex } from '../elements_source_index/types'
import { fileCabinetTopLevelFolders } from '../client/constants'

const log = logger(module)

export const DETECTORS = [
  customRecordTypeDetector,
  customFieldDetector,
  roleDetector,
  scriptDetector,
  workflowDetector,
  customListDetector,
  savedSearchDetector,
]

const SUPPORTED_TYPES = new Set(DETECTORS.flatMap(detector => detector.getTypes()))

const getSystemNoteChanges = async (client: NetsuiteClient, dateRange: DateRange):
Promise<Record<number, Date | undefined> | undefined> => {
  // Note that the internal id is NOT unique cross types and different instances
  // of different type might have the same internal id. Due the a bug in the saved
  // search api in Netsuite we can't get the type of the record from SystemNote.
  // This might results fetching an instance that was not modified (but supposed to be pretty rare).
  const results = await client.runSavedSearchQuery({
    type: 'systemnote',
    filters: [
      ['date', 'within', ...dateRange.toSavedSearchRange()],
    ],
    columns: ['recordid', 'date'],
  })

  if (results === undefined) {
    log.warn('file changes query failed')
    return undefined
  }

  return _(results)
    .filter((res): res is { recordid: string; date: string } => {
      if ([res.recordid, res.date].some(val => typeof val !== 'string')) {
        log.warn('Got invalid result from system note query, %o', res)
        return false
      }
      return true
    })
    .map(res => ({
      id: parseInt(res.recordid, 10),
      time: convertSavedSearchStringToDate(res.date),
    }))
    .groupBy(res => res.id)
    .entries()
    .map(([id, group]) => [id, _.max(group.map(res => res.time))])
    .fromPairs()
    .value()
}

const getIdTime = (
  changes: ChangedObject[],
  systemNoteChanges: Record<string, Date | undefined> | undefined,
): Date | undefined => {
  if (changes[0].internalId !== undefined
    && systemNoteChanges !== undefined
    && systemNoteChanges[changes[0].internalId] !== undefined) {
    return systemNoteChanges[changes[0].internalId]
  }
  return _.maxBy(changes, change => change.time)?.time
}


const getChangedIds = (
  changes: ChangedObject[],
  idToLastFetchDate: Record<string, ElementsSourceValue>,
  systemNoteChanges?: Record<number, Date | undefined>
): Set<string> =>
  new Set(_(changes)
    .filter(change => (change.internalId === undefined
      || systemNoteChanges === undefined
      || change.internalId in systemNoteChanges))
    .groupBy(changedObject => changedObject.externalId)
    .entries()
    .map(([externalId, changesGroup]): [string, Date | undefined] =>
      [externalId, getIdTime(changesGroup, systemNoteChanges)])
    .filter(([id, time]) => {
      const lastFetchDate = idToLastFetchDate[id]?.lastFetchTime
      return time === undefined
      || lastFetchDate === undefined
      || time > lastFetchDate
    })
    .map(([id]) => id)
    .value())

export const getChangedObjects = async (
  client: NetsuiteClient,
  query: NetsuiteQuery,
  dateRange: DateRange,
  elementsSourceIndex: LazyElementsSourceIndex,
): Promise<NetsuiteQuery> => {
  log.debug('Starting to look for changed objects')

  const instancesChangesPromise = Promise.all(
    DETECTORS
      .filter(detector => detector.getTypes().some(query.isTypeMatch))
      .map(detector => detector.getChanges(client, dateRange))
  ).then(output => output.flat())

  const fileChangesPromise = Promise.all([
    getChangedFiles(client, dateRange),
    getChangedFolders(client, dateRange),
  ]).then(output => output.flat())

  const idToLastFetchDate = await elementsSourceIndex.getIndex()

  const [
    systemNoteChanges,
    changedInstances,
    changedFiles,
  ] = await Promise.all([
    getSystemNoteChanges(client, dateRange),
    instancesChangesPromise,
    fileChangesPromise,
  ])

  const [changedTypes, changedObjects] = _.partition(changedInstances, (change): change is ChangedType => change.type === 'type')

  const scriptIds = getChangedIds(
    changedObjects.map(change => ({ ...change, externalId: change.externalId.toLowerCase() })),
    idToLastFetchDate,
    systemNoteChanges
  )
  const paths = new Set([...getChangedIds(changedFiles, idToLastFetchDate, systemNoteChanges)]
    .filter(path =>
      fileCabinetTopLevelFolders.some(
        topLevelPath => path.startsWith(topLevelPath) && query.isFileMatch(path)
      )))

  const types = new Set(changedTypes.map(type => type.name))

  log.debug('Finished to look for changed objects')
  log.debug(`${scriptIds.size} script ids changes were detected`)
  log.debug(`${types.size} types changes were detected`)
  log.debug(`${paths.size} paths changes were detected`)

  return {
    isTypeMatch: () => scriptIds.size !== 0,
    isObjectMatch: objectID => !SUPPORTED_TYPES.has(objectID.type)
      || scriptIds.has(objectID.scriptId)
      || types.has(objectID.type),
    isFileMatch: filePath => paths.has(filePath),
    areSomeFilesMatch: () => paths.size !== 0,
  }
}
