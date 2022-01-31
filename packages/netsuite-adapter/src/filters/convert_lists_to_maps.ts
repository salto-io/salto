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
  isInstanceElement, isObjectType,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { convertFieldsTypesFromListToMap, convertInstanceListsToMaps, validateTypesFieldMapping } from '../mapped_lists/utils'
import { FilterWith } from '../filter'
import { isCustomType, getInnerCustomTypes } from '../types'
import { getCustomTypes } from '../autogen/types'

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
    const innerCustomTypesNames = new Set(
      getInnerCustomTypes(getCustomTypes())
        .map(element => element.elemID.name)
    )

    const customTypes = elements.filter(isObjectType).filter(
      type => isCustomType(type) || innerCustomTypesNames.has(type.elemID.name)
    )

    validateTypesFieldMapping(customTypes)

    await awu(customTypes)
      .forEach(convertFieldsTypesFromListToMap)

    await awu(elements)
      .filter(isInstanceElement)
      .filter(inst => isCustomType(inst.refType))
      .forEach(
        async inst => {
          inst.value = await convertInstanceListsToMaps(inst) ?? inst.value
        }
      )
  },
})

export default filterCreator
