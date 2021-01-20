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
  Element, isInstanceElement, Values, ObjectType, ElemID, ReferenceExpression, InstanceElement,
  ReadOnlyElementsSource,
} from '@salto-io/adapter-api'
import {
  transformElement,
  TransformFunc, transformValues,
} from '@salto-io/adapter-utils'
import _ from 'lodash'
import {
  SUITE_SCRIPTS_FOLDER_NAME, TEMPLATES_FOLDER_NAME, WEB_SITE_HOSTING_FILES_FOLDER_NAME, SCRIPT_ID,
  PATH,
  CAPTURE,
  scriptIdReferenceRegex,
} from '../constants'
import { serviceId } from '../transformer'
import { FilterCreator } from '../filter'
import { isCustomType } from '../types'

// e.g. '[/Templates/filename.html]' & '[/SuiteScripts/script.js]'
const pathReferenceRegex = new RegExp(`^\\[(?<${CAPTURE}>\\/(${TEMPLATES_FOLDER_NAME}|${SUITE_SCRIPTS_FOLDER_NAME}|${WEB_SITE_HOSTING_FILES_FOLDER_NAME})\\/.+)]$`)

/**
 * This method tries to capture the serviceId from Netsuite references format. For example:
 * '[scriptid=customworkflow1]' => 'customworkflow1'
 * '[/SuiteScripts/script.js]' => '/SuiteScripts/script.js'
 * 'Some string' => undefined
 */
const captureServiceId = (value: string): string | undefined =>
  value.match(pathReferenceRegex)?.groups?.[CAPTURE]
    ?? value.match(scriptIdReferenceRegex)?.groups?.[CAPTURE]

const customTypeServiceIdsToElemIds = (instance: InstanceElement): Record<string, ElemID> => {
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

  transformElement({
    element: instance,
    transformFunc: addFullServiceIdsCallback,
    strict: true,
  })
  return serviceIdsToElemIds
}

const getInstanceServiceIdRecords = (element: InstanceElement): Record<string, ElemID> => (
  isCustomType(element.type)
    ? customTypeServiceIdsToElemIds(element)
    : { [serviceId(element)]: element.elemID.createNestedID(PATH) }
)

const generateServiceIdToElemID = (elements: Element[]): Record<string, ElemID> =>
  _.assign(
    {},
    ...elements.filter(isInstanceElement)
      .map(getInstanceServiceIdRecords)
  )

const replaceReferenceValues = (
  values: Values,
  refElement: ObjectType,
  fetchedElementsServiceIdToElemID: Record<string, ElemID>,
  elementsSourceServiceIdToElemID: Record<string, ElemID>,
): Values => {
  const replacePrimitive: TransformFunc = ({ value }) => {
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
    return new ReferenceExpression(elemID)
  }

  return transformValues({
    values,
    type: refElement,
    transformFunc: replacePrimitive,
    strict: false,
  }) || values
}

const createElementsSourceServiceIdToElemID = async (
  elementsSource: ReadOnlyElementsSource,
  isPartial: boolean,
): Promise<Record<string, ElemID>> => {
  let elementsSourceServiceIdToElemID: Record<string, ElemID> = {}

  if (!isPartial) {
    return elementsSourceServiceIdToElemID
  }

  for await (const element of await elementsSource.getAll()) {
    if (isInstanceElement(element)) {
      elementsSourceServiceIdToElemID = _.assign(
        elementsSourceServiceIdToElemID,
        getInstanceServiceIdRecords(element)
      )
    }
  }
  return elementsSourceServiceIdToElemID
}

const filterCreator: FilterCreator = () => ({
  onFetch: async ({
    elements,
    elementsSource,
    isPartial,
  }): Promise<void> => {
    const fetchedElemenentsServiceIdToElemID = generateServiceIdToElemID(elements)
    const elementsSourceServiceIdToElemID = await createElementsSourceServiceIdToElemID(
      elementsSource,
      isPartial
    )
    elements.filter(isInstanceElement).forEach(instance => {
      instance.value = replaceReferenceValues(
        instance.value,
        instance.type,
        fetchedElemenentsServiceIdToElemID,
        elementsSourceServiceIdToElemID
      )
    })
  },
})

export default filterCreator
