/*
*                      Copyright 2022 Salto Labs Ltd.
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
  Element, isInstanceElement, ElemID, ReferenceExpression, InstanceElement, CORE_ANNOTATIONS,
} from '@salto-io/adapter-api'
import { extendGeneratedDependencies, transformElement, TransformFunc } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import { SCRIPT_ID, PATH } from '../constants'
import { serviceId } from '../transformer'
import { FilterCreator, FilterWith } from '../filter'
import { isCustomType } from '../types'
import { LazyElementsSourceIndexes, ServiceIdRecords } from '../elements_source_index/types'
import {
  CAPTURED_APPID, CAPTURED_BUNDLEID, CAPTURED_SERVICE_ID, CAPTURED_TYPE,
  captureServiceIdInfo, ServiceIdInfo,
} from '../service_id_info'

const { awu } = collections.asynciterable

const customTypeServiceIdsToElemIds = async (
  instance: InstanceElement,
): Promise<ServiceIdRecords> => {
  const serviceIdsToElemIds: ServiceIdRecords = {}
  const parentElemIdFullNameToServiceId: Record<string, string> = {}

  const getClosestParentServiceId = (elemID: ElemID): string | undefined => {
    const parentElemId = elemID.createParentID()
    if (parentElemId.isTopLevel()) {
      return parentElemIdFullNameToServiceId[parentElemId.getFullName()]
    }
    if (Object.keys(parentElemIdFullNameToServiceId).includes(parentElemId.getFullName())) {
      return parentElemIdFullNameToServiceId[parentElemId.getFullName()]
    }
    return getClosestParentServiceId(parentElemId)
  }

  const addFullServiceIdsCallback: TransformFunc = ({ value, path, field }) => {
    if (field?.name === SCRIPT_ID && !_.isUndefined(path)) {
      const parentServiceId = getClosestParentServiceId(path)
      const resolvedServiceId = _.isUndefined(parentServiceId) ? value : `${parentServiceId}.${value}`
      parentElemIdFullNameToServiceId[path.createParentID().getFullName()] = resolvedServiceId
      serviceIdsToElemIds[resolvedServiceId] = { elemID: path, serviceID: value }
    }
    return value
  }

  await transformElement({
    element: instance,
    transformFunc: addFullServiceIdsCallback,
    strict: true,
  })
  return serviceIdsToElemIds
}

const shouldExtractToGenereatedDependency = (serviceIdInfoRecord: ServiceIdInfo): boolean =>
  serviceIdInfoRecord[CAPTURED_APPID] != null
  || serviceIdInfoRecord[CAPTURED_BUNDLEID] != null
  || !serviceIdInfoRecord.isFullMatch

export const getInstanceServiceIdRecords = async (
  instance: InstanceElement,
): Promise<ServiceIdRecords> => (
  isCustomType(instance.refType)
    ? customTypeServiceIdsToElemIds(instance)
    : { [serviceId(instance)]: {
      elemID: instance.elemID.createNestedID(PATH),
      serviceID: serviceId(instance),
    } }
)

const generateServiceIdToElemID = async (
  elements: Element[],
): Promise<ServiceIdRecords> =>
  _.assign(
    {},
    ...await awu(elements).filter(isInstanceElement)
      .map(getInstanceServiceIdRecords).toArray()
  )

const replaceReferenceValues = async (
  instance: InstanceElement,
  fetchedElementsServiceIdToElemID: ServiceIdRecords,
  elementsSourceServiceIdToElemID: ServiceIdRecords,
): Promise<InstanceElement> => {
  const dependenciesToAdd: Array<ElemID> = []
  const replacePrimitive: TransformFunc = ({ path, value }) => {
    if (!_.isString(value)) {
      return value
    }
    const serviceIdInfo = captureServiceIdInfo(value)
    let returnValue: ReferenceExpression | string = value
    serviceIdInfo.forEach(serviceIdInfoRecord => {
      const capturedServiceId = serviceIdInfoRecord[CAPTURED_SERVICE_ID]
      const serviceIdRecord = fetchedElementsServiceIdToElemID[capturedServiceId]
      ?? elementsSourceServiceIdToElemID[capturedServiceId]

      if (serviceIdRecord === undefined) {
        return
      }

      const { elemID, serviceID } = serviceIdRecord
      const type = serviceIdInfoRecord[CAPTURED_TYPE]
      if (type && type !== elemID.typeName) {
        dependenciesToAdd.push(elemID)
        return
      }

      if (path?.isAttrID() && path.createParentID().name === CORE_ANNOTATIONS.PARENT) {
        if (!shouldExtractToGenereatedDependency(serviceIdInfoRecord)) {
          returnValue = new ReferenceExpression(elemID.createBaseID().parent)
          return
        }
        dependenciesToAdd.push(elemID.createBaseID().parent)
        return
      }
      if (!shouldExtractToGenereatedDependency(serviceIdInfoRecord)) {
        returnValue = new ReferenceExpression(elemID, serviceID)
        return
      }
      dependenciesToAdd.push(elemID)
    })

    return returnValue
  }

  const newInstance = await transformElement({
    element: instance,
    transformFunc: replacePrimitive,
    strict: false,
  })

  extendGeneratedDependencies(
    newInstance,
    dependenciesToAdd.map(elemID => ({ reference: new ReferenceExpression(elemID) }))
  )

  return newInstance
}

const createElementsSourceServiceIdToElemID = async (
  elementsSourceIndex: LazyElementsSourceIndexes,
  isPartial: boolean,
): Promise<ServiceIdRecords> => (
  isPartial
    ? (await elementsSourceIndex.getIndexes()).serviceIdRecordsIndex
    : {}
)

const filterCreator: FilterCreator = ({
  elementsSourceIndex,
  isPartial,
}): FilterWith<'onFetch'> => ({
  onFetch: async elements => {
    const fetchedElementsServiceIdToElemID = await generateServiceIdToElemID(elements)
    const elementsSourceServiceIdToElemID = await createElementsSourceServiceIdToElemID(
      elementsSourceIndex,
      isPartial
    )
    await awu(elements).filter(isInstanceElement).forEach(async instance => {
      const newInstance = await replaceReferenceValues(
        instance,
        fetchedElementsServiceIdToElemID,
        elementsSourceServiceIdToElemID
      )
      instance.value = newInstance.value
      instance.annotations = newInstance.annotations
    })
  },
})

export default filterCreator
