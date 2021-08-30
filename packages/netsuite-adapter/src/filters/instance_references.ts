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
} from '../constants'
import { serviceId } from '../transformer'
import { FilterCreator, FilterWith } from '../filter'
import { isCustomType, typesElementSourceWrapper } from '../types'
import { LazyElementsSourceIndexes } from '../elements_source_index/types'

const { awu } = collections.asynciterable

const CAPTURED_SERVICE_ID = 'serviceId'
const CAPTURED_TYPE = 'type'
// e.g. '[scriptid=customworkflow1]' & '[scriptid=customworkflow1.workflowstate17.workflowaction33]'
//  & '[type=customsegment, scriptid=cseg1]'
const scriptIdReferenceRegex = new RegExp(`^\\[(type=(?<${CAPTURED_TYPE}>[a-z_]+), )?${SCRIPT_ID}=(?<${CAPTURED_SERVICE_ID}>[a-z0-9_]+(\\.[a-z0-9_]+)*)]$`)
// e.g. '[/Templates/filename.html]' & '[/SuiteScripts/script.js]'
const pathReferenceRegex = new RegExp(`^\\[(?<${CAPTURED_SERVICE_ID}>\\/.+)]$`)

type ServiceIdInfo = {
  [CAPTURED_SERVICE_ID]: string
  [CAPTURED_TYPE]?: string
}

/**
 * This method tries to capture the serviceId from Netsuite references format. For example:
 * '[scriptid=customworkflow1]' => 'customworkflow1'
 * '[/SuiteScripts/script.js]' => '/SuiteScripts/script.js'
 * 'Some string' => undefined
 */
const captureServiceIdInfo = (value: string): ServiceIdInfo | undefined => {
  const pathRefMatches = value.match(pathReferenceRegex)?.groups
  if (pathRefMatches !== undefined) {
    return { [CAPTURED_SERVICE_ID]: pathRefMatches[CAPTURED_SERVICE_ID] }
  }

  const scriptIdRefMatches = value.match(scriptIdReferenceRegex)?.groups
  if (scriptIdRefMatches !== undefined) {
    return {
      [CAPTURED_SERVICE_ID]: scriptIdRefMatches[CAPTURED_SERVICE_ID],
      [CAPTURED_TYPE]: scriptIdRefMatches[CAPTURED_TYPE],
    }
  }
  return undefined
}

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
    const serviceIdInfo = captureServiceIdInfo(value)
    if (_.isUndefined(serviceIdInfo)) {
      return value
    }
    const elemID = fetchedElementsServiceIdToElemID[serviceIdInfo[CAPTURED_SERVICE_ID]]
      ?? elementsSourceServiceIdToElemID[serviceIdInfo[CAPTURED_SERVICE_ID]]

    const type = serviceIdInfo[CAPTURED_TYPE]
    if (_.isUndefined(elemID) || (type && type !== elemID.typeName)) {
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
  elementsSourceIndex: LazyElementsSourceIndexes,
  isPartial: boolean,
): Promise<Record<string, ElemID>> => {
  if (!isPartial) {
    return {}
  }

  return _((await elementsSourceIndex.getIndexes()).serviceIdsIndex)
    .mapValues(val => val.elemID)
    .pickBy(lowerdashValues.isDefined)
    .value()
}

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
