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
import { convertFieldsTypesFromListToMap, convertInstanceListsToMaps } from '../mapped_lists/utils'
import { FilterWith } from '../filter'
import { isCustomType } from '../types'
import { innerCustomTypes } from '../autogen/types'

const { awu } = collections.asynciterable

const filterCreator = (): FilterWith<'onFetch'> => ({
  /**
   * Upon fetch, do the following:
   * - convert ListType fields to MapType
   * - adds an annotation to the fields mentioned above that indicates
   *   the inner field to use as mapping key
   * - convert instances' values in the fields mentioned above from lists to maps
   *   by the mapping key mentioned above
   *
   * NOTICE: This filter works on CustomType types & instances only.
   * The reverse conversion happens in sdfDeploy
   *
   * @param elements the already fetched elements
   */
  onFetch: async elements => {
    const innerCustomTypesSet = new Set(innerCustomTypes)

    await awu(elements)
      .filter(isObjectType)
      .filter(type => isCustomType(type.elemID) || innerCustomTypesSet.has(type))
      .forEach(convertFieldsTypesFromListToMap)

    await awu(elements)
      .filter(isInstanceElement)
      .filter(inst => isCustomType(inst.refType.elemID))
      .forEach(
        async inst => {
          inst.value = await convertInstanceListsToMaps(
            inst.value,
            await inst.getType()
          ) ?? inst.value
        }
      )
  },
})

export default filterCreator
