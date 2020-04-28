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
  CORE_ANNOTATIONS, Element, InstanceElement, isInstanceElement,
} from '@salto-io/adapter-api'
import {
  transformElement, TransformPrimitiveFunc,
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

  return workspaceElements.map(elem => {
    const stateElement = stateElementsMap[elem.elemID.getFullName()]
    if (isInstanceElement(elem) && stateElement !== undefined) {
      const createHiddenMapCallback: TransformPrimitiveFunc = (val, _pathID, field) => {
        if (field?.annotations[CORE_ANNOTATIONS.HIDDEN] === true) {
          return val
        }
        return undefined
      }

      const hiddenValuesInstance = transformElement({
        element: stateElement,
        transformPrimitives: createHiddenMapCallback,
        strict: true,
      }) as InstanceElement

      elem.value = _.merge(elem.value, hiddenValuesInstance.value)
    }
    return elem
  })
}

export const removeHiddenValues = (elem: Element):
  Element => {
  if (isInstanceElement(elem)) {
    const removeHiddenValue: TransformPrimitiveFunc = (val, _pathID, field) => {
      if (field?.annotations[CORE_ANNOTATIONS.HIDDEN] === true) {
        return undefined
      }
      return val
    }

    return transformElement({
      element: elem,
      transformPrimitives: removeHiddenValue,
      strict: false,
    }) || {}
  }
  return elem
}
