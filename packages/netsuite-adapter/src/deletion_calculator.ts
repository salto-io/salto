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
import { ElemID, InstanceElement } from '@salto-io/adapter-api'
import _ from 'lodash'
import { NetsuiteQuery, ObjectID } from './query'
import { getCustomRecordCounters, getCustomRecordTypeInstances } from './changes_detector/changes_detectors/custom_records'
import NetsuiteClient from './client/client'
import { ElemServiceID, LazyElementsSourceIndexes } from './elements_source_index/types'
import { SCRIPT_ID } from './constants'

const getCurrentScriptIds = async (elementsSourceIndex: LazyElementsSourceIndexes): Promise<ElemServiceID[]> => {
  const serviceIdRecords = (await elementsSourceIndex.getIndexes()).serviceIdRecordsIndex
  return Object.values(serviceIdRecords)
    .filter(({ elemID }) => elemID.nestingLevel === 1 && elemID.name === SCRIPT_ID)
    .map(({ elemID, serviceID }) => ({ elemID: elemID.createParentID(), serviceID }))
}

const calculateDeletedInstances = (
  currentInstances: ElemServiceID[],
  serviceInstancesIds: ObjectID[],
): ElemID[] => {
  if (currentInstances.length === 0) {
    return []
  }

  const serviceIdsGroupByTypes = _(serviceInstancesIds)
    .groupBy(objectId => objectId.type)
    .mapValues(objectIds => objectIds.map(({ instanceId }) => instanceId))
    .value()

  return currentInstances
    .filter(item => !serviceIdsGroupByTypes[item.elemID.typeName]?.includes(item.serviceID))
    .map(item => item.elemID)
}

const calculateDeletedCustomRecordsFromTarget = (
  currentElements: ElemServiceID[],
  serviceTargetedCustomRecords: InstanceElement[],
): ElemID[] => {
  if (serviceTargetedCustomRecords.length === 0) {
    return []
  }

  const customRecordElemNames = new Set(serviceTargetedCustomRecords
    .map(instanceElement => instanceElement.elemID.getFullName()))

  return currentElements
    .filter(item => item.elemID.idType === 'instance')
    .filter(item => !customRecordElemNames.has(item.elemID.getFullName()))
    .map(item => item.elemID)
}

const calculateDeletedCustomRecordsFromService = async (
  client: NetsuiteClient,
  currentElements: ElemServiceID[],
  query: NetsuiteQuery,
  serviceTargetedCustomRecords: InstanceElement[],
): Promise<ElemID[]> => {
  const customRecordTypesToIgnore = new Set(serviceTargetedCustomRecords.map(item => item.elemID.typeName))
  const serviceCustomRecordCounters = await getCustomRecordCounters(
    client,
    { isCustomRecordTypeMatch: query.isCustomRecordTypeMatch },
    customRecordTypesToIgnore,
  )
  const currentCustomRecords = _(currentElements)
    .filter(item => !customRecordTypesToIgnore.has(item.elemID.typeName))
    .groupBy(item => item.elemID.typeName)
    .value()

  const customRecordTypesWithDeletions = Object.values(currentCustomRecords)
    .filter(instances => instances.length !== serviceCustomRecordCounters.get(instances[0].serviceID))
    .flat()

  const serviceCustomRecords = await Promise.all(
    customRecordTypesWithDeletions.map(async customRecordType => {
      const instancesScriptIds = await getCustomRecordTypeInstances(client, customRecordType.elemID.typeName)
      return {
        customRecordType: customRecordType.elemID.typeName,
        instancesScriptIds: new Set(instancesScriptIds),
      }
    })
  )
  const serviceCustomRecordInstancesMap = new Map(
    serviceCustomRecords.map(obj => [obj.customRecordType, obj.instancesScriptIds])
  )

  return Object.values(currentCustomRecords).flat()
    .filter(item => !serviceCustomRecordInstancesMap.get(item.elemID.typeName)?.has(item.serviceID))
    .map(item => item.elemID)
}

const calculateDeletedCustomRecords = async (
  client: NetsuiteClient,
  currentElements: ElemServiceID[],
  query: NetsuiteQuery,
  serviceTargetedCustomRecords: InstanceElement[],
): Promise<ElemID[]> => {
  if (currentElements.length === 0) {
    return []
  }

  const deletedCustomRecordsFromTarget = calculateDeletedCustomRecordsFromTarget(
    currentElements,
    serviceTargetedCustomRecords,
  )

  const deletedCustomRecordsFromService = await calculateDeletedCustomRecordsFromService(
    client,
    currentElements,
    query,
    serviceTargetedCustomRecords,
  )

  return deletedCustomRecordsFromTarget.concat(deletedCustomRecordsFromService)
}

export const getDeletedElements = async (
  client: NetsuiteClient,
  elementsSourceIndex: LazyElementsSourceIndexes,
  query: NetsuiteQuery,
  serviceInstancesIds: ObjectID[],
  serviceTargetedCustomRecords: InstanceElement[],
): Promise<ElemID[]> => {
  const currentElements = await getCurrentScriptIds(elementsSourceIndex)

  const deletedInstances = calculateDeletedInstances(
    currentElements.filter(item => query.isTypeMatch(item.elemID.typeName)),
    serviceInstancesIds,
  )

  const deletedCustomRecords = await calculateDeletedCustomRecords(
    client,
    currentElements.filter(item => query.isCustomRecordTypeMatch(item.elemID.typeName)),
    query,
    serviceTargetedCustomRecords,
  )

  return deletedInstances.concat(deletedCustomRecords)
}
