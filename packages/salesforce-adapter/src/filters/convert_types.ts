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
  Element, isObjectType, ObjectType, isInstanceElement,
} from '@salto-io/adapter-api'
import {
  transformValues,
} from '@salto-io/adapter-utils'
import { FilterCreator } from '../filter'
import { transformPrimitive } from '../transformers/transformer'


/**
 * Convert types of values in instance elements to match the expected types according to the
 * instance type definition.
 */
const filterCreator: FilterCreator = () => ({
  /**
   * Upon fetch, convert all instance values to their correct type according to the
   * type definitions
   *
   * @param elements the already fetched elements
   */
  onFetch: async (elements: Element[]) => {
    elements
      .filter(isInstanceElement)
      .filter(instance => isObjectType(instance.type))
      .forEach(instance => {
        instance.value = transformValues(
          {
            values: instance.value,
            type: instance.type as ObjectType,
            transformFunc: transformPrimitive,
            strict: false,
          }
        ) || {}
      })
  },
})

export default filterCreator
