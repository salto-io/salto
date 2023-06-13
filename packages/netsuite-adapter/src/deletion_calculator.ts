/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { ElemID, InstanceElement, ObjectType, ReadOnlyElementsSource, isInstanceElement, isObjectType } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { NetsuiteQuery, ObjectID } from './query'
import { getCustomRecords } from './changes_detector/changes_detectors/custom_records'
import NetsuiteClient from './client/client'
import { ElemServiceID } from './elements_source_index/types'
import { getServiceId, isCustomRecordType, isCustomRecordTypeName } from './types'
import { isStandardTypeName } from './autogen/types'
import { CUSTOM_RECORD_TYPE } from './constants'

const { awu } = collections.asynciterable
const log = logger(module)

const calculateDeletedInstances = (
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
  serviceDataElements: InstanceElement[]
): ElemID[] => {
  if (currentDataElements.length === 0) {
    return []
  }

  const serviceDataElementsSet = new Set(serviceDataElements.map(element => element.elemID.getFullName()))

  return currentDataElements
    .filter(elemId => !serviceDataElementsSet.has(elemId.getFullName()))
}

const calculateDeletedCustomRecordsFromFetchResult = (
  currentCustomRecords: ElemServiceID[],
  serviceCustomRecords: InstanceElement[],
  requestedCustomTypes: Set<string>,
): ElemID[] => {
  if (currentCustomRecords.length === 0 || serviceCustomRecords.length === 0) {
    return []
  }

  const customRecordElemNames = new Set(serviceCustomRecords
    .map(instance => instance.elemID.getFullName()))

  return currentCustomRecords
    .filter(customRecord => customRecord.elemID.idType === 'instance')
    .filter(customRecord => requestedCustomTypes.has(customRecord.elemID.typeName))
    .filter(customRecord => !customRecordElemNames.has(customRecord.elemID.getFullName()))
    .map(customRecord => customRecord.elemID)
}

const isCustomRecordDeleted = (
  customRecord: ElemServiceID,
  serviceCustomTypes: Set<string>,
  serviceCustomTypeRecords: Map<string, Set<string>>,
  customRecordTypesToIgnore: Set<string>,
): boolean => {
  const type = customRecord.elemID.typeName
  if (customRecordTypesToIgnore.has(type)) {
    return false // we already dealt with this record in calculateDeletedCustomRecordsFromFetchResult
  }
  if (!serviceCustomTypes.has(type)) {
    return true // the whole type was deleted
  }
  // some custom types are not returned by SuiteQL queries, so we delete only ones that have SuiteQL results
  if (serviceCustomTypeRecords.has(type)
    && !serviceCustomTypeRecords.get(type)?.has(customRecord.serviceID)) {
    return true
  }
  return false
}

const calculateDeletedCustomRecordsFromService = async (
  client: NetsuiteClient,
  currentCustomRecords: ElemServiceID[],
  currentCustomTypes: ElemServiceID[],
  query: NetsuiteQuery,
  customRecordTypesToIgnore: Set<string>,
  serviceCustomTypes: ObjectID[],
): Promise<ElemID[]> => {
  // We can ignore custom types that were already returned by the service, as the missing records there were
  // calculated in calculateDeletedCustomRecordsFromFetchResult
  const serviceCustomTypeRecords = await getCustomRecords(
    client,
    query,
    customRecordTypesToIgnore,
  )
  const serviceCustomTypesSet = new Set(
    serviceCustomTypes.map(item => item.instanceId).concat(...serviceCustomTypeRecords.keys())
  )

  const deletedCustomTypes = currentCustomTypes
    .filter(customType => !serviceCustomTypesSet.has(customType.serviceID))
    .map(customType => customType.elemID)

  const deletedCustomRecords = currentCustomRecords
    .filter(customRecord => isCustomRecordDeleted(
      customRecord, serviceCustomTypesSet, serviceCustomTypeRecords, customRecordTypesToIgnore
    ))
    .map(item => item.elemID)

  return deletedCustomTypes.concat(deletedCustomRecords)
}

const calculateDeletedCustomRecords = async (
  client: NetsuiteClient,
  currentCustomRecords: ElemServiceID[],
  currentCustomTypes: ElemServiceID[],
  query: NetsuiteQuery,
  serviceCustomRecords: InstanceElement[],
  requestedCustomTypes: ObjectType[],
  serviceCustomTypes: ObjectID[],
): Promise<ElemID[]> => {
  if (currentCustomTypes.length === 0) {
    return []
  }

  // In order to calculate custom record deletions we can use the already returned serviceCustomRecords,
  // as currently when we identify a change in a custom type we fetch all records, so missing records are easy to spot.
  // Then we need to query the rest of the custom types (that are matching the fetch query conditions, but excluding
  // the ones already covered) and check whether there is any deletion there
  const requestedCustomTypesSet = new Set(requestedCustomTypes.map(customType => customType.elemID.typeName))
  const deletedCustomRecordsFromFetchResult = calculateDeletedCustomRecordsFromFetchResult(
    currentCustomRecords,
    serviceCustomRecords,
    requestedCustomTypesSet,
  )
  const deletedCustomRecordsFromService = await calculateDeletedCustomRecordsFromService(
    client,
    currentCustomRecords,
    currentCustomTypes,
    query,
    requestedCustomTypesSet,
    serviceCustomTypes,
  )

  return deletedCustomRecordsFromFetchResult.concat(deletedCustomRecordsFromService)
}

type CurrentElements = {
  currentStandardInstances: Array<ElemServiceID>
  currentCustomRecords: Array<ElemServiceID>
  currentCustomTypes: Array<ElemServiceID>
  currentDataElements: Array<ElemID>
}

const getCurrentElements = async (
  elementsSource: ReadOnlyElementsSource,
  fetchQuery: NetsuiteQuery,
  requestedDataTypes: string[],
): Promise<CurrentElements> => {
  const elements = await elementsSource.getAll()
  const currentStandardInstances = new Array<ElemServiceID>()
  const currentCustomRecords = new Array<ElemServiceID>()
  const currentCustomTypes = new Array<ElemServiceID>()
  const currentDataElements = new Array<ElemID>()

  const requestedDataTypesSet = new Set(requestedDataTypes)
  await awu(elements)
    .filter(element => isInstanceElement(element) || (isObjectType(element) && isCustomRecordType(element)))
    .forEach(async element => {
      if (isInstanceElement(element)) {
        if (isCustomRecordTypeName(element.elemID.typeName)) {
          if (fetchQuery.isCustomRecordTypeMatch(element.elemID.typeName)) {
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
        if (fetchQuery.isCustomRecordTypeMatch(element.elemID.typeName)) {
          currentCustomTypes.push({ elemID: element.elemID, serviceID: getServiceId(element) })
        }
      }
    })

  return {
    currentStandardInstances,
    currentCustomRecords,
    currentCustomTypes,
    currentDataElements,
  }
}

export const getDeletedElements = async ({
  client,
  elementsSource,
  fetchQuery,
  serviceInstanceIds,
  requestedCustomTypes,
  serviceCustomRecords,
  requestedDataTypes,
  serviceDataElements,
} : {
  client: NetsuiteClient
  elementsSource: ReadOnlyElementsSource
  fetchQuery: NetsuiteQuery
  serviceInstanceIds: ObjectID[]
  requestedCustomTypes: ObjectType[]
  serviceCustomRecords: InstanceElement[]
  requestedDataTypes: string[]
  serviceDataElements: InstanceElement[]
}): Promise<ElemID[]> => {
  try {
    const {
      currentStandardInstances,
      currentCustomRecords,
      currentCustomTypes,
      currentDataElements,
    } = await getCurrentElements(elementsSource, fetchQuery, requestedDataTypes)

    const [serviceCustomTypes, serviceInstances] = _
      .partition(serviceInstanceIds, objectId => objectId.type === CUSTOM_RECORD_TYPE)

    const deletedCustomRecords = calculateDeletedCustomRecords(
      client,
      currentCustomRecords,
      currentCustomTypes,
      fetchQuery,
      serviceCustomRecords,
      requestedCustomTypes,
      serviceCustomTypes,
    )

    const deletedInstances = calculateDeletedInstances(
      currentStandardInstances,
      serviceInstances,
    )

    const deletedDataElements = calculateDeletedDataElements(
      currentDataElements,
      serviceDataElements,
    )

    return deletedInstances.concat(deletedDataElements).concat(await deletedCustomRecords)
  } catch (e) {
    log.error(`Failed calculating deleted element: ${e}, stack: ${e.stack}`)
    return []
  }
}
