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
import { isInstanceElement, Element, Values } from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'

export const RESTRICTION_FIELD_NAME = 'restriction'

const removeIdField = (instanceValue: Values): void => {
  if (!_.isEmpty(instanceValue[RESTRICTION_FIELD_NAME]?.ids)) {
    delete instanceValue[RESTRICTION_FIELD_NAME].id
  }
}

/**
 * Fix the restriction object on multiple types
 */
const filterCreator: FilterCreator = () => ({
  name: 'restrictionFilter',
  onFetch: async (elements: Element[]) => {
    const instances = elements.filter(isInstanceElement)
    instances
      .filter(inst => ['view', 'macro'].includes(inst.elemID.typeName))
      .map(inst => inst.value)
      .forEach(removeIdField)
    instances
      .filter(instance => instance.elemID.typeName === 'workspace')
      .forEach(instance => {
        ((instance.value.selected_macros as Values[]) ?? []).forEach(removeIdField)
      })
  },
})

export default filterCreator
