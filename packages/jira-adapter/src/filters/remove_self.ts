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
import { Element, isInstanceElement, isObjectType } from '@salto-io/adapter-api'
import { transformValues } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { FilterCreator } from '../filter'

const { awu } = collections.asynciterable

/**
 * Removes 'self' values from types and instances
 */
const filter: FilterCreator = () => ({
  name: 'removeSelfFilter',
  onFetch: async (elements: Element[]) => {
    await awu(elements)
      .filter(isInstanceElement)
      .forEach(async instance => {
        instance.value = await transformValues({
          values: instance.value,
          type: await instance.getType(),
          pathID: instance.elemID,
          strict: false,
          allowEmpty: true,
          transformFunc: ({ value, path }) => {
            if (path?.name === 'self') {
              return undefined
            }
            return value
          },
        }) ?? {}
      })

    elements
      .filter(isObjectType)
      .forEach(async type => {
        delete type.fields.self
      })
  },
})

export default filter
