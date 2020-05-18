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
  CORE_ANNOTATIONS, Element, InstanceElement,
  isInstanceElement, isObjectType,
} from '@salto-io/adapter-api'
import {
  transformElement, TransformFunc,
} from '@salto-io/adapter-utils'
import _ from 'lodash'
import {
  createElementsMap,
} from '../core/search'

export const addHiddenValues = (
  workspaceElements: ReadonlyArray<Element>,
  stateElements: Element[],
): Element[] => {
  const stateElementsMap = createElementsMap(stateElements)

  const injectHiddenTypeToInstance = (instance: InstanceElement): void => {
    const stateType = stateElementsMap[instance.type.elemID.getFullName()]
    if (stateType !== undefined
          && stateType.annotations[CORE_ANNOTATIONS.HIDDEN] === true
              && isObjectType(stateType)) {
      // Inject to instance the appropriate type
      instance.type = stateType
    }
  }

  const addValuesForHiddenFields = (instance: InstanceElement): void => {
    const stateElement = stateElementsMap[instance.elemID.getFullName()]
    if (stateElement !== undefined) {
      const createHiddenMapCallback: TransformFunc = ({ value, field }) => {
        if (field?.annotations[CORE_ANNOTATIONS.HIDDEN] === true) {
          return value
        }
        return undefined
      }

      const hiddenValuesInstance = transformElement({
        element: stateElement,
        transformFunc: createHiddenMapCallback,
        strict: true,
      }) as InstanceElement

      // Adding (fields) hidden values
      instance.value = _.merge(instance.value, hiddenValuesInstance.value)
    }
  }

  // Addition (hidden) types from state
  const hiddenTypes = stateElements.filter(e => !isInstanceElement(e))
    .filter(e => e.annotations[CORE_ANNOTATIONS.HIDDEN] === true)

  // Workspace instances after completing:
  // 1. values for hidden fields. (addition)
  // 2. hidden types. (override)
  const instancesWithHiddenValues = workspaceElements.map(elem => {
    if (isInstanceElement(elem)) {
      addValuesForHiddenFields(elem)
      injectHiddenTypeToInstance(elem)
    }
    return elem
  })

  return instancesWithHiddenValues.concat(hiddenTypes)
}

export const removeHiddenValues = (elem: Element):
  Element => {
  if (isInstanceElement(elem)) {
    const removeHiddenValue: TransformFunc = ({ value, field }) => {
      if (field?.annotations[CORE_ANNOTATIONS.HIDDEN] === true) {
        return undefined
      }
      return value
    }

    return transformElement({
      element: elem,
      transformFunc: removeHiddenValue,
      strict: false,
    }) || {}
  }
  return elem
}
