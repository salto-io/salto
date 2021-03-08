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
import { formatSavedSearchDate } from './formats'
import { ChangedType, DateRange } from './types'
import NetsuiteClient from '../client/client'

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

const getChangedInternalIds = async (client: NetsuiteClient, dateRange: DateRange):
Promise<Set<number> | undefined> => {
  // Note that the internal id is NOT unique cross types and different instances
  // of different type might have the same internal id. Due the a bug in the saved
  // search api in Netsuite we can't get the type of the record from SystemNote.
  // This might results fetching an instance that was not modified (but supposed to be pretty rare).
  const results = await client.runSavedSearchQuery({
    type: 'systemnote',
    filters: [
      ['date', 'within', formatSavedSearchDate(dateRange.start), formatSavedSearchDate(dateRange.end)],
    ],
    columns: ['recordid'],
  })

  if (results === undefined) {
    log.warn('file changes query failed')
    return undefined
  }

  return new Set(
    results
      .filter((res): res is { recordid: string } => {
        if (typeof res.recordid !== 'string') {
          log.warn('Got invalid result from system note query, %o', res)
          return false
        }
        return true
      })
      .map(res => parseInt(res.recordid, 10))
  )
}

export const getChangedObjects = async (
  client: NetsuiteClient,
  query: NetsuiteQuery,
  dateRange: DateRange
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

  const [
    changedInternalIds,
    changedInstances,
    changedFiles,
  ] = await Promise.all([
    getChangedInternalIds(client, dateRange),
    instancesChangesPromise,
    fileChangesPromise,
  ])

  const paths = new Set(
    changedFiles.filter(
      ({ internalId }) => changedInternalIds === undefined || changedInternalIds.has(internalId)
    ).map(({ externalId }) => externalId)
  )


  const [changedTypes, changedObjects] = _.partition(changedInstances, (change): change is ChangedType => change.type === 'type')

  const scriptIds = new Set(
    changedObjects.filter(
      ({ internalId }) => internalId === undefined
        || changedInternalIds === undefined
        || changedInternalIds.has(internalId)
    ).map(({ externalId }) => externalId.toLowerCase())
  )

  const types = new Set(changedTypes.map(type => type.name))

  log.debug('Finished to look for changed objects')

  return {
    isTypeMatch: () => true,
    isObjectMatch: objectID => scriptIds.has(objectID.scriptId) || types.has(objectID.type),
    isFileMatch: filePath => paths.has(filePath),
    areSomeFilesMatch: () => paths.size !== 0,
  }
}
