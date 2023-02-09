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
import { CORE_ANNOTATIONS, isInstanceElement } from '@salto-io/adapter-api'
import { transformValues } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { FilterCreator } from '../filter'

const { awu } = collections.asynciterable

const isStringNumber = (value: string): boolean => !Number.isNaN(Number(value))

/**
 * Remove hidden value from lists, since core does not support it
 */
const filter: FilterCreator = () => ({
  name: 'hiddenValuesInListsFilter',
  onFetch: async elements => {
    await awu(elements)
      .filter(isInstanceElement)
      .forEach(async instance => {
        instance.value = await transformValues({
          values: instance.value,
          type: await instance.getType(),
          pathID: instance.elemID,
          allowEmpty: true,
          strict: false,
          transformFunc: ({ value, field, path }) => {
            const isInArray = path?.getFullNameParts().some(isStringNumber)
            if (isInArray && field?.annotations[CORE_ANNOTATIONS.HIDDEN_VALUE]) {
              return undefined
            }
            return value
          },
        }) ?? {}
      })
  },
})

export default filter
