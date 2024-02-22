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
import _ from 'lodash'
import { NetsuiteQuery } from '../config/query'
import { getChangedFiles, getChangedFolders } from './changes_detectors/file_cabinet'
import { customFieldDetector, customListDetector } from './changes_detectors/custom_type'
import customRecordTypeDetector from './changes_detectors/custom_record_type'
import scriptDetector from './changes_detectors/script'
import roleDetector from './changes_detectors/role'
import workflowDetector from './changes_detectors/workflow'
import savedSearchDetector from './changes_detectors/savedsearch'
import { ChangedObject, ChangedType, DateRange, FileCabinetChangesDetector } from './types'
import NetsuiteClient from '../client/client'
import { getChangedCustomRecords } from './changes_detectors/custom_records'
import { CUSTOM_RECORD_TYPE, CUSTOM_SEGMENT, FILE_CABINET_PATH_SEPARATOR } from '../constants'
import { addCustomRecordTypePrefix } from '../types'

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

const getChangedIds = (
  changes: ChangedObject[],
  idToLastFetchDate: Record<string, Date>,
  filterFunc: (id: string) => boolean = () => true,
): Set<string> =>
  new Set(
    changes
      .map(item => ({ ...item, lastFetchDate: idToLastFetchDate[item.objectId] }))
      .filter(({ time, lastFetchDate }) => lastFetchDate === undefined || time > lastFetchDate)
      .map(change => change.objectId)
      .filter(filterFunc),
  )

export const getChangedObjects = async (
  client: NetsuiteClient,
  query: NetsuiteQuery,
  dateRange: DateRange,
  serviceIdToLastFetchDate: Record<string, Date>,
): Promise<NetsuiteQuery> => {
  log.debug('Starting to look for changed objects')

  const { isTypeMatch, isFileMatch, areSomeFilesMatch, isParentFolderMatch, isCustomRecordTypeMatch } = query

  const instancesChangesPromise = Promise.all(
    DETECTORS.filter(detector => detector.getTypes().some(isTypeMatch)).map(detector =>
      detector.getChanges(client, dateRange),
    ),
  ).then(output => output.flat())

  const changedFileCabinetPromises: [ReturnType<FileCabinetChangesDetector>, ReturnType<FileCabinetChangesDetector>] =
    areSomeFilesMatch()
      ? [getChangedFiles(client, dateRange), getChangedFolders(client, dateRange)]
      : [Promise.resolve([]), Promise.resolve([])]

  const [changedInstances, changedFiles, changedFolders, changedCustomRecords] = await Promise.all([
    instancesChangesPromise,
    ...changedFileCabinetPromises,
    getChangedCustomRecords(client, dateRange, { isCustomRecordTypeMatch }),
  ])

  const [changedTypes, changedObjects] = _.partition(
    changedInstances,
    (change): change is ChangedType => change.type === 'type',
  )

  const scriptIds = getChangedIds(
    changedObjects.map(({ objectId, ...change }) => ({ ...change, objectId: objectId.toLowerCase() })),
    serviceIdToLastFetchDate,
  )

  const filePaths = getChangedIds(changedFiles, serviceIdToLastFetchDate, isFileMatch)
  Array.from(filePaths)
    .map(path => path.substring(0, path.lastIndexOf(FILE_CABINET_PATH_SEPARATOR) + 1))
    .forEach(item => filePaths.add(item))
  const folderPaths = Array.from(getChangedIds(changedFolders, serviceIdToLastFetchDate, isFileMatch))
  const unresolvedFolderPaths = folderPaths
    .map(folder => `${folder}/`)
    .filter(folder => Array.from(filePaths).every(file => !file.startsWith(folder)))

  const types = new Set(changedTypes.map(type => type.name))

  const shouldFetchCustomRecordTypes = changedCustomRecords.length > 0
  const customRecordsByType = _(changedCustomRecords)
    .groupBy(record => record.typeId)
    .mapValues(records => new Set(records.map(record => record.objectId)))
    .value()

  log.debug('Finished to look for changed objects')
  log.debug(`${scriptIds.size} script ids changes were detected`)
  log.debug(`${types.size} types changes were detected`)
  log.debug(`${filePaths.size} file paths changes were detected`)
  log.debug(`${folderPaths.length} folder paths changes were detected`)
  log.debug(`${changedCustomRecords.length} custom records changes were detected`)

  return {
    isTypeMatch: type =>
      !SUPPORTED_TYPES.has(type) ||
      scriptIds.size !== 0 ||
      types.size !== 0 ||
      ([CUSTOM_RECORD_TYPE, CUSTOM_SEGMENT].includes(type) && shouldFetchCustomRecordTypes),
    areAllObjectsMatch: () => false,
    isObjectMatch: ({ type, instanceId }) =>
      !SUPPORTED_TYPES.has(type) ||
      scriptIds.has(instanceId) ||
      types.has(type) ||
      (type === CUSTOM_RECORD_TYPE && instanceId in customRecordsByType) ||
      (type === CUSTOM_SEGMENT && addCustomRecordTypePrefix(instanceId) in customRecordsByType),
    isFileMatch: filePath => filePaths.has(filePath) || unresolvedFolderPaths.some(path => filePath.startsWith(path)),
    isParentFolderMatch,
    areSomeFilesMatch: () => filePaths.size !== 0 || folderPaths.length !== 0,
    isCustomRecordTypeMatch: type => type in customRecordsByType,
    areAllCustomRecordsMatch: () => false,
    isCustomRecordMatch: ({ type, instanceId }) =>
      type in customRecordsByType && customRecordsByType[type].has(instanceId),
  }
}
