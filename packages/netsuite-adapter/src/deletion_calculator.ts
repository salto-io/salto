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
import {
  ElemID,
  InstanceElement,
  ObjectType,
  ReadOnlyElementsSource,
  SaltoError,
  isInstanceElement,
  isObjectType,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { NetsuiteQuery } from './config/query'
import { ObjectID } from './config/types'
import { getCustomRecords } from './changes_detector/changes_detectors/custom_records'
import NetsuiteClient from './client/client'
import { ElemServiceID } from './elements_source_index/types'
import { getServiceId, isCustomRecordType } from './types'
import { isStandardTypeName } from './autogen/types'
import { CUSTOM_RECORD_TYPE, SCRIPT_ID } from './constants'

const { awu } = collections.asynciterable
const log = logger(module)

const calculateDeletedStandardInstances = (
  currentStandardInstances: ElemServiceID[],
  serviceInstancesIds: ObjectID[],
): ElemID[] => {
  if (currentStandardInstances.length === 0) {
    return []
  }

  const serviceIdsGroupByTypes = _(serviceInstancesIds)
    .groupBy(objectId => objectId.type)
    .mapValues(objectIds => new Set(objectIds.map(({ instanceId }) => instanceId)))
    .value()

  return currentStandardInstances
    .filter(instanceId => !serviceIdsGroupByTypes[instanceId.elemID.typeName]?.has(instanceId.serviceID))
    .map(instanceId => instanceId.elemID)
}

const calculateDeletedDataElements = (
  currentDataElements: ElemID[],
  serviceDataElements: InstanceElement[],
): ElemID[] => {
  if (currentDataElements.length === 0) {
    return []
  }

  const serviceDataElementsSet = new Set(serviceDataElements.map(element => element.elemID.getFullName()))

  return currentDataElements.filter(elemId => !serviceDataElementsSet.has(elemId.getFullName()))
}

const calculateDeletedCustomRecordsFromFetchResult = (
  currentCustomRecords: ElemServiceID[],
  serviceCustomRecords: InstanceElement[],
  requestedCustomRecordTypes: Set<string>,
): ElemID[] => {
  if (currentCustomRecords.length === 0 || requestedCustomRecordTypes.size === 0) {
    return []
  }

  const customRecordElemNames = new Set(serviceCustomRecords.map(instance => instance.elemID.getFullName()))

  return currentCustomRecords
    .filter(customRecord => requestedCustomRecordTypes.has(customRecord.elemID.typeName))
    .filter(customRecord => !customRecordElemNames.has(customRecord.elemID.getFullName()))
    .map(customRecord => customRecord.elemID)
}

const isCustomRecordDeleted = (
  customRecord: ElemServiceID,
  serviceCustomRecordTypes: Set<string>,
  serviceCustomRecordsByType: Map<string, Set<string>>,
  customRecordTypesToIgnore: Set<string>,
): boolean => {
  const type = customRecord.elemID.typeName
  if (customRecordTypesToIgnore.has(type)) {
    return false // we already dealt with this record in calculateDeletedCustomRecordsFromFetchResult
  }
  if (!serviceCustomRecordTypes.has(type)) {
    return true // the whole type was deleted
  }
  // some custom types are not returned by SuiteQL queries, so we delete only ones that have SuiteQL results
  if (serviceCustomRecordsByType.has(type) && !serviceCustomRecordsByType.get(type)?.has(customRecord.serviceID)) {
    return true
  }
  return false
}

const calculateDeletedCustomRecordsFromService = async ({
  client,
  currentCustomRecords,
  query,
  requestedCustomRecordTypes,
  requestedCustomRecordTypeScriptIds,
  serviceCustomRecordTypes,
}: {
  client: NetsuiteClient
  currentCustomRecords: ElemServiceID[]
  query: NetsuiteQuery
  requestedCustomRecordTypes: Set<string>
  requestedCustomRecordTypeScriptIds: Set<string>
  serviceCustomRecordTypes: Set<string>
}): Promise<ElemID[]> => {
  // We can ignore custom types that were already returned by the service, as the missing records there were
  // calculated in calculateDeletedCustomRecordsFromFetchResult
  const serviceCustomRecordsByType = await getCustomRecords(client, query, requestedCustomRecordTypeScriptIds)

  const deletedCustomRecords = currentCustomRecords
    .filter(customRecord =>
      isCustomRecordDeleted(
        customRecord,
        serviceCustomRecordTypes,
        serviceCustomRecordsByType,
        requestedCustomRecordTypes,
      ),
    )
    .map(item => item.elemID)

  return deletedCustomRecords
}

const calculateDeletedCustomRecords = async ({
  client,
  currentCustomRecords,
  currentCustomRecordTypes,
  query,
  serviceCustomRecords,
  requestedCustomRecordTypeList,
  serviceCustomRecordTypeList,
}: {
  client: NetsuiteClient
  currentCustomRecords: ElemServiceID[]
  currentCustomRecordTypes: ElemServiceID[]
  query: NetsuiteQuery
  serviceCustomRecords: InstanceElement[]
  requestedCustomRecordTypeList: ObjectType[]
  serviceCustomRecordTypeList: ObjectID[]
}): Promise<ElemID[]> => {
  if (currentCustomRecordTypes.length === 0) {
    return []
  }

  // In order to calculate custom record deletions we can use the already returned serviceCustomRecords,
  // as currently when we identify a change in a custom type we fetch all records, so missing records are easy to spot.
  // Then we need to query the rest of the custom types (that are matching the fetch query conditions, but excluding
  // the ones already covered) and check whether there is any deletion there
  const requestedCustomRecordTypes = new Set(requestedCustomRecordTypeList.map(type => type.elemID.typeName))
  const requestedCustomRecordTypeScriptIds = new Set(
    requestedCustomRecordTypeList.map(type => type.annotations[SCRIPT_ID] as string),
  )
  const serviceCustomRecordTypes = new Set(serviceCustomRecordTypeList.map(item => item.instanceId))

  const deletedCustomRecordsFromFetchResult = calculateDeletedCustomRecordsFromFetchResult(
    currentCustomRecords,
    serviceCustomRecords,
    requestedCustomRecordTypes,
  )
  const deletedCustomRecordsFromService = await calculateDeletedCustomRecordsFromService({
    client,
    currentCustomRecords,
    query,
    requestedCustomRecordTypes,
    requestedCustomRecordTypeScriptIds,
    serviceCustomRecordTypes,
  })

  const deletedCustomRecordTypes = currentCustomRecordTypes
    .filter(customType => !serviceCustomRecordTypes.has(customType.serviceID))
    .map(customType => customType.elemID)

  return deletedCustomRecordTypes.concat(deletedCustomRecordsFromFetchResult).concat(deletedCustomRecordsFromService)
}

type CurrentElements = {
  currentStandardInstances: Array<ElemServiceID>
  currentCustomRecords: Array<ElemServiceID>
  currentCustomRecordTypes: Array<ElemServiceID>
  currentDataElements: Array<ElemID>
}

const getCurrentElements = async (
  elementsSource: ReadOnlyElementsSource,
  fetchQuery: NetsuiteQuery,
  requestedDataTypes: string[],
): Promise<CurrentElements> => {
  const elements = await elementsSource.getAll()
  const currentStandardInstances: Array<ElemServiceID> = []
  const currentCustomRecords: Array<ElemServiceID> = []
  const currentCustomRecordTypes: Array<ElemServiceID> = []
  const currentDataElements: Array<ElemID> = []

  const requestedDataTypesSet = new Set(requestedDataTypes)
  await awu(elements)
    .filter(element => isInstanceElement(element) || (isObjectType(element) && isCustomRecordType(element)))
    .forEach(async element => {
      if (isInstanceElement(element)) {
        if (isCustomRecordType(await element.getType(elementsSource))) {
          if (fetchQuery.isCustomRecordMatch({ type: element.elemID.typeName, instanceId: element.value[SCRIPT_ID] })) {
            currentCustomRecords.push({ elemID: element.elemID, serviceID: getServiceId(element) })
          }
        } else if (fetchQuery.isTypeMatch(element.elemID.typeName)) {
          if (isStandardTypeName(element.elemID.typeName)) {
            currentStandardInstances.push({ elemID: element.elemID, serviceID: getServiceId(element) })
          } else if (requestedDataTypesSet.has(element.elemID.typeName)) {
            currentDataElements.push(element.elemID)
          }
        }
      } else if (isObjectType(element) && isCustomRecordType(element)) {
        if (fetchQuery.isObjectMatch({ type: CUSTOM_RECORD_TYPE, instanceId: element.annotations[SCRIPT_ID] })) {
          currentCustomRecordTypes.push({ elemID: element.elemID, serviceID: getServiceId(element) })
        }
      }
    })

  return {
    currentStandardInstances,
    currentCustomRecords,
    currentCustomRecordTypes,
    currentDataElements,
  }
}

export type FetchDeletionResult = {
  deletedElements?: ElemID[]
  errors?: SaltoError[]
}

export const getDeletedElements = async ({
  client,
  elementsSource,
  fetchQuery,
  serviceInstanceIds,
  requestedCustomRecordTypes,
  serviceCustomRecords,
  requestedDataTypes,
  serviceDataElements,
}: {
  client: NetsuiteClient
  elementsSource: ReadOnlyElementsSource
  fetchQuery: NetsuiteQuery
  serviceInstanceIds: ObjectID[]
  requestedCustomRecordTypes: ObjectType[]
  serviceCustomRecords: InstanceElement[]
  requestedDataTypes: string[]
  serviceDataElements: InstanceElement[]
}): Promise<FetchDeletionResult> => {
  try {
    const { currentStandardInstances, currentCustomRecords, currentCustomRecordTypes, currentDataElements } =
      await getCurrentElements(elementsSource, fetchQuery, requestedDataTypes)

    const [serviceCustomRecordTypeList, serviceStandardInstanceList] = _.partition(
      serviceInstanceIds,
      objectId => objectId.type === CUSTOM_RECORD_TYPE,
    )

    const deletedCustomRecords = calculateDeletedCustomRecords({
      client,
      currentCustomRecords,
      currentCustomRecordTypes,
      query: fetchQuery,
      serviceCustomRecords,
      requestedCustomRecordTypeList: requestedCustomRecordTypes,
      serviceCustomRecordTypeList,
    })

    const deletedInstances = calculateDeletedStandardInstances(currentStandardInstances, serviceStandardInstanceList)

    const deletedDataElements = calculateDeletedDataElements(currentDataElements, serviceDataElements)

    return { deletedElements: deletedInstances.concat(deletedDataElements).concat(await deletedCustomRecords) }
  } catch (e) {
    const errorMessage = 'Failed calculating deleted elements'
    log.error(`${errorMessage}: %o`, e)
    return { errors: [{ message: errorMessage, severity: 'Error' }] }
  }
}
