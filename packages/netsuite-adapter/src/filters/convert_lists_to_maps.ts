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
import { convertAnnotationListsToMaps, convertFieldsTypesFromListToMap, convertInstanceListsToMaps, validateTypesFieldMapping } from '../mapped_lists/utils'
import { FilterWith } from '../filter'
import { isStandardType, getInnerStandardTypes, isCustomRecordType } from '../types'
import { getStandardTypes } from '../autogen/types'

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
   * NOTICE: This filter works on:
   * - StandardType types
   * - StandardType instances
   * - CustomRecordType types
   *
   * The reverse conversion happens in sdfDeploy
   *
   * @param elements the already fetched elements
   */
  onFetch: async elements => {
    const innerStandardTypesNames = new Set(
      getInnerStandardTypes(getStandardTypes())
        .map(element => element.elemID.name)
    )

    const standardTypes = elements.filter(isObjectType).filter(
      type => isStandardType(type) || innerStandardTypesNames.has(type.elemID.name)
    )

    validateTypesFieldMapping(standardTypes)

    await awu(standardTypes)
      .forEach(convertFieldsTypesFromListToMap)

    await awu(elements)
      .filter(isInstanceElement)
      .filter(inst => isStandardType(inst.refType))
      .forEach(
        async inst => {
          inst.value = await convertInstanceListsToMaps(inst) ?? inst.value
        }
      )

    await awu(elements)
      .filter(isObjectType)
      .filter(isCustomRecordType)
      .forEach(
        async type => {
          type.annotations = await convertAnnotationListsToMaps(type)
        }
      )
  },
})

export default filterCreator
