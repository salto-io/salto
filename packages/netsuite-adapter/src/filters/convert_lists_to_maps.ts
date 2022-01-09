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
  isInstanceElement, isObjectType,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { convertFieldsTypesFromListToMap, convertInstanceListsToMaps } from '../mapped_lists/mapped_lists'
import { FilterWith } from '../filter'

const { awu } = collections.asynciterable

const filterCreator = (): FilterWith<'onFetch'> => ({
  /**
   * Upon fetch, convert values of list type to maps
   *
   * @param elements the already fetched elements
   */
  onFetch: async elements => {
    await awu(elements)
      .filter(isObjectType)
      .forEach(
        async type => convertFieldsTypesFromListToMap(type)
      )

    await awu(elements)
      .filter(isInstanceElement)
      .forEach(
        async inst => {
          const transformedInstance = await convertInstanceListsToMaps(inst)
          inst.value = transformedInstance.value
        }
      )
  },
})

export default filterCreator
