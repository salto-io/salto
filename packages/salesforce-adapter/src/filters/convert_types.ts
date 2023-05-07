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
import {
  Element, isObjectType, isInstanceElement,
} from '@salto-io/adapter-api'
import {
  transformValues,
} from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { LocalFilterCreator } from '../filter'
import { transformPrimitive } from '../transformers/transformer'

const { awu } = collections.asynciterable


/**
 * Convert types of values in instance elements to match the expected types according to the
 * instance type definition.
 */
const filterCreator: LocalFilterCreator = () => ({
  name: 'convertTypeFilter',
  /**
   * Upon fetch, convert all instance values to their correct type according to the
   * type definitions
   *
   * @param elements the already fetched elements
   */
  onFetch: async (elements: Element[]) => {
    await awu(elements)
      .filter(isInstanceElement)
      .filter(async instance => isObjectType(await instance.getType()))
      .forEach(async instance => {
        instance.value = await transformValues(
          {
            values: instance.value,
            type: await instance.getType(),
            transformFunc: transformPrimitive,
            strict: false,
            allowEmpty: true,
          }
        ) || {}
      })
  },
})

export default filterCreator
