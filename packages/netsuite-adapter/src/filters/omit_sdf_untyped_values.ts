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
import { isInstanceElement } from '@salto-io/adapter-api'
import { transformValues } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { isStandardType } from '../types'
import { FilterCreator, FilterWith } from '../filter'

const { awu } = collections.asynciterable

const filterCreator: FilterCreator = ({ config }): FilterWith<'onFetch'> => ({
  name: 'omitSdfUntypedValues',
  onFetch: async elements => {
    // the default behavior is strictInstanceStructure=false
    if (!config.fetch?.strictInstanceStructure) {
      return
    }
    await awu(elements)
      .filter(isInstanceElement)
      .filter(instance => isStandardType(instance.refType))
      .forEach(async instance => {
        // running transformValues with strict=true omits all untyped values
        instance.value = await transformValues({
          values: instance.value,
          type: await instance.getType(),
          transformFunc: ({ value }) => value,
          strict: true,
        }) ?? instance.value
      })
  },
})

export default filterCreator
