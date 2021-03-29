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
import {
  Element, isInstanceElement, ElemID, ReferenceExpression, InstanceElement,
  CORE_ANNOTATIONS,
} from '@salto-io/adapter-api'
import {
  transformElement,
  TransformFunc,
} from '@salto-io/adapter-utils'
import _ from 'lodash'
import { values as lowerdashValues, collections } from '@salto-io/lowerdash'
import {
  SCRIPT_ID,
  PATH,
  CAPTURE,
  scriptIdReferenceRegex,
} from '../constants'
import { serviceId } from '../transformer'
import { FilterCreator } from '../filter'
import { isCustomType, typesElementSourceWrapper } from '../types'
import { LazyElementsSourceIndex } from '../elements_source_index/types'

const { awu } = collections.asynciterable
// e.g. '[/Templates/filename.html]' & '[/SuiteScripts/script.js]'
const pathReferenceRegex = new RegExp(`^\\[(?<${CAPTURE}>\\/.+)]$`)

/**
 * This method tries to capture the serviceId from Netsuite references format. For example:
 * '[scriptid=customworkflow1]' => 'customworkflow1'
 * '[/SuiteScripts/script.js]' => '/SuiteScripts/script.js'
 * 'Some string' => undefined
 */
const captureServiceId = (value: string): string | undefined =>
  value.match(pathReferenceRegex)?.groups?.[CAPTURE]
    ?? value.match(scriptIdReferenceRegex)?.groups?.[CAPTURE]

const customTypeServiceIdsToElemIds = async (
  instance: InstanceElement,
): Promise<Record<string, ElemID>> => {
  const serviceIdsToElemIds: Record<string, ElemID> = {}
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
      serviceIdsToElemIds[resolvedServiceId] = path
    }
    return value
  }

  await transformElement({
    element: instance,
    transformFunc: addFullServiceIdsCallback,
    strict: true,
    elementsSource: typesElementSourceWrapper(),
  })
  return serviceIdsToElemIds
}

export const getInstanceServiceIdRecords = async (
  instance: InstanceElement,
): Promise<Record<string, ElemID>> => (
  isCustomType(instance.refType.elemID)
    ? customTypeServiceIdsToElemIds(instance)
    : { [serviceId(instance)]: instance.elemID.createNestedID(PATH) }
)

const generateServiceIdToElemID = async (
  elements: Element[],
): Promise<Record<string, ElemID>> =>
  _.assign(
    {},
    ...await awu(elements).filter(isInstanceElement)
      .map(getInstanceServiceIdRecords).toArray()
  )

const replaceReferenceValues = async (
  instance: InstanceElement,
  fetchedElementsServiceIdToElemID: Record<string, ElemID>,
  elementsSourceServiceIdToElemID: Record<string, ElemID>,
): Promise<InstanceElement> => {
  const replacePrimitive: TransformFunc = ({ path, value }) => {
    if (!_.isString(value)) {
      return value
    }
    const capturedServiceId = captureServiceId(value)
    if (_.isUndefined(capturedServiceId)) {
      return value
    }
    const elemID = fetchedElementsServiceIdToElemID[capturedServiceId]
      ?? elementsSourceServiceIdToElemID[capturedServiceId]

    if (_.isUndefined(elemID)) {
      return value
    }

    if (path?.isAttrID() && path.createParentID().name === CORE_ANNOTATIONS.PARENT) {
      return new ReferenceExpression(elemID.createBaseID().parent)
    }

    return new ReferenceExpression(elemID)
  }

  return transformElement({
    element: instance,
    transformFunc: replacePrimitive,
    strict: false,
  })
}

const createElementsSourceServiceIdToElemID = async (
  elementsSourceIndex: LazyElementsSourceIndex,
  isPartial: boolean,
): Promise<Record<string, ElemID>> => {
  if (!isPartial) {
    return {}
  }

  return _(await elementsSourceIndex.getIndex())
    .mapValues(val => val.elemID)
    .pickBy(lowerdashValues.isDefined)
    .value()
}

const filterCreator: FilterCreator = () => ({
  onFetch: async ({
    elements,
    elementsSourceIndex,
    isPartial,
  }): Promise<void> => {
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
