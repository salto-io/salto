/*
*                      Copyright 2020 Salto Labs Ltd.
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
} from '@salto-io/adapter-api'
import {
  transformElement,
  TransformFunc, transformValues,
} from '@salto-io/adapter-utils'
import _ from 'lodash'
import {
  SUITE_SCRIPTS_FOLDER_NAME, TEMPLATES_FOLDER_NAME, WEB_SITE_HOSTING_FILES_FOLDER_NAME, SCRIPT_ID,
  PATH,
} from '../constants'
import { serviceId } from '../transformer'
import { FilterCreator } from '../filter'
import { isCustomType } from '../types'

const CAPTURE = 'capture'
// e.g. '[/Templates/filename.html]' & '[/SuiteScripts/script.js]'
const pathReferenceRegex = new RegExp(`^\\[(?<${CAPTURE}>\\/(${TEMPLATES_FOLDER_NAME}|${SUITE_SCRIPTS_FOLDER_NAME}|${WEB_SITE_HOSTING_FILES_FOLDER_NAME})\\/.+)]$`)
// e.g. '[scriptid=customworkflow1]' & '[scriptid=customworkflow1.workflowstate17.workflowaction33]'
const scriptIdReferenceRegex = new RegExp(`^\\[${SCRIPT_ID}=(?<${CAPTURE}>[a-z0-9_]+(\\.[a-z0-9_]+)*)]$`)

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

const generateServiceIdToElemID = (elements: Element[]): Record<string, ElemID> =>
  _.assign({},
    ...elements.filter(isInstanceElement)
      .map(instance => (
        isCustomType(instance.type)
          ? customTypeServiceIdsToElemIds(instance)
          : { [serviceId(instance)]: instance.elemID.createNestedID(PATH) })))

const replaceReferenceValues = (
  values: Values,
  refElement: ObjectType,
  serviceIdToElemID: Record<string, ElemID>
): Values => {
  const replacePrimitive: TransformFunc = ({ value }) => {
    if (!_.isString(value)) {
      return value
    }
    const capturedServiceId = captureServiceId(value)
    if (_.isUndefined(capturedServiceId)) {
      return value
    }
    const elemID = serviceIdToElemID[capturedServiceId]
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

const filterCreator: FilterCreator = () => ({
  onFetch: async (elements: Element[]): Promise<void> => {
    const serviceIdToElemID = generateServiceIdToElemID(elements)
    elements.filter(isInstanceElement).forEach(instance => {
      instance.value = replaceReferenceValues(
        instance.value,
        instance.type,
        serviceIdToElemID
      )
    })
  },
})

export default filterCreator
