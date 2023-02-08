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

import _ from 'lodash'
import { Change, Element, isField } from '@salto-io/adapter-api'
import { walkOnElement, WALK_NEXT_STEP } from '@salto-io/adapter-utils'

export const isElementContainsStringValue = (
  element: Element,
  expectedValue: string
): boolean => {
  let foundValue = false
  walkOnElement({
    element,
    func: ({ value }) => {
      if (_.isString(value) && value.includes(expectedValue)) {
        foundValue = true
        return WALK_NEXT_STEP.EXIT
      }
      return WALK_NEXT_STEP.RECURSE
    },
  })
  return foundValue
}

export const cloneChange = <T extends Change>(change: T): T => ({
  action: change.action,
  data: _.mapValues(change.data, (element: Element) => (
    isField(element)
      ? element.parent.clone().fields[element.name]
      : element.clone()
  )),
}) as T
