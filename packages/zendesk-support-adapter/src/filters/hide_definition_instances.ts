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
  CORE_ANNOTATIONS, isObjectType,
} from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'

const DEFINITION_TYPE_NAMES = [
  'macro_definition',
  'macros_actions',
  'trigger_definition',
  'sla_policy_definition',
  'routing_attribute_definition',
]

/**
 * Hides the definition instances
 */
const filterCreator: FilterCreator = () => ({
  onFetch: async elements => {
    elements
      .filter(isObjectType)
      .filter(objType => DEFINITION_TYPE_NAMES.includes(objType.elemID.typeName))
      .forEach(objType => {
        objType.annotations[CORE_ANNOTATIONS.HIDDEN_VALUE] = true
      })
  },
})

export default filterCreator
