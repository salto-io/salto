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
    .filter(item => !serviceIdsGroupByTypes[item.elemID.typeName]?.has(item.serviceID))
    .map(item => item.elemID)
}

const calculateDeletedDataElements = (
  currentDataElements: ElemID[],
  serviceDataElements: Set<string>
): ElemID[] => {
  if (currentDataElements.length === 0) {
    return []
  }

  return currentDataElements
    .filter(elemId => !serviceDataElements.has(elemId.getFullName()))
}

const calculateDeletedCustomRecordsFromFetchResult = (
  currentElements: ElemServiceID[],
  serviceCustomRecords: InstanceElement[],
  requestedCustomTypes: Set<string>,
): ElemID[] => {
  if (serviceCustomRecords.length === 0) {
    return []
  }

  const customRecordElemNames = new Set(serviceCustomRecords
    .map(instance => instance.elemID.getFullName()))

  return currentElements
    .filter(item => item.elemID.idType === 'instance')
    .filter(item => requestedCustomTypes.has(item.elemID.typeName))
    .filter(item => !customRecordElemNames.has(item.elemID.getFullName()))
    .map(item => item.elemID)
}

const calculateDeletedCustomRecordsFromService = async (
  client: NetsuiteClient,
  currentElements: ElemServiceID[],
  query: NetsuiteQuery,
  customRecordTypesToIgnore: Set<string>,
): Promise<ElemID[]> => {
  // We can ignore custom types that were already returned by the service, as the missing records there were
  // calculated in calculateDeletedCustomRecordsFromFetchResult
  const serviceCustomRecords = await getCustomRecords(
    client,
    query,
    customRecordTypesToIgnore,
  )

  return currentElements
    .filter(item => !customRecordTypesToIgnore.has(item.elemID.typeName))
    // TODO: maybe check first that the service returned this type, as some types not supported by SuiteQL
    // and only by SOAP.but understand how to support deleted types!
    .filter(item => !serviceCustomRecords.get(item.elemID.typeName)?.has(item.serviceID))
    .map(item => item.elemID)
}

const calculateDeletedCustomRecords = async (
  client: NetsuiteClient,
  currentCustomRecords: ElemServiceID[],
  currentCustomTypes: ElemServiceID[],
  query: NetsuiteQuery,
  serviceCustomRecords: InstanceElement[],
  requestedCustomRecordTypes: ObjectType[],
): Promise<ElemID[]> => {
  if (currentCustomRecords.length === 0 || currentCustomTypes.length === 0) {
    return []
  }

  const requestedCustomTypes = new Set(requestedCustomRecordTypes.map(item => item.elemID.typeName))
  // In order to calculate custom records deletions we can use the already returned serviceTargetedCustomRecords
  // as currently when we identify a change in a custom type we fetch all records, so missing records are easy to sop.
  // Then we need to query the rest of the custom types (that are matching the fetch query conditions, but excluding
  // the ones that had changes) and check whether there is any deletion there
  const deletedCustomRecordsFromTarget = calculateDeletedCustomRecordsFromFetchResult(
    currentCustomRecords,
    serviceCustomRecords,
    requestedCustomTypes,
  )
  const deletedCustomRecordsFromService = await calculateDeletedCustomRecordsFromService(
    client,
    currentCustomRecords,
    query,
    requestedCustomTypes,
  )

  return deletedCustomRecordsFromTarget.concat(deletedCustomRecordsFromService)
}

export const getDeletedElements = async (
  client: NetsuiteClient,
  elementsSource: ReadOnlyElementsSource,
  query: NetsuiteQuery,
  serviceInstancesIds: ObjectID[],
  serviceCustomRecords: InstanceElement[],
  requestedCustomRecordTypes: ObjectType[],
  serviceDataElements: InstanceElement[],
  requestedDataTypes: Set<string>,
): Promise<ElemID[]> => {
  try {
    const elements = await elementsSource.getAll()
    const currentStandardInstances = new Array<ElemServiceID>()
    const currentCustomRecords = new Array<ElemServiceID>()
    const currentCustomTypes = new Array<ElemServiceID>()
    const currentDataElements = new Array<ElemID>()

    await awu(elements)
      .filter(element => isInstanceElement(element) || (isObjectType(element) && isCustomRecordType(element)))
      .forEach(async element => {
        if (isInstanceElement(element)) {
          if (query.isTypeMatch(element.elemID.typeName)) {
            if (isStandardTypeName(element.elemID.typeName)) {
              currentStandardInstances.push({ elemID: element.elemID, serviceID: getServiceId(element) })
            } else if (requestedDataTypes.has(element.elemID.typeName)) {
              currentDataElements.push(element.elemID)
            }
          } else if (isCustomRecordTypeName(element.elemID.typeName)) {
            if (query.isCustomRecordTypeMatch(element.elemID.typeName)) {
              currentCustomRecords.push({ elemID: element.elemID, serviceID: getServiceId(element) })
            }
          }
        } else if (isObjectType(element) && isCustomRecordType(element)) {
          if (query.isCustomRecordTypeMatch(element.elemID.typeName)) {
            currentCustomTypes.push({ elemID: element.elemID, serviceID: getServiceId(element) })
          }
        }
      })

    const deletedInstances = calculateDeletedInstances(
      currentStandardInstances,
      serviceInstancesIds,
    )

    const deletedDataElements = calculateDeletedDataElements(
      currentDataElements,
      new Set(serviceDataElements.map(element => element.elemID.getFullName())),
    )

    const deletedCustomRecords = await calculateDeletedCustomRecords(
      client,
      currentCustomRecords,
      currentCustomTypes,
      query,
      serviceCustomRecords,
      requestedCustomRecordTypes,
    )

    return deletedInstances.concat(deletedDataElements).concat(deletedCustomRecords)
  } catch (e) {
    log.error(`Failed calculating deleted element: ${e}, stack: ${e.stack}`)
    return []
  }
}
