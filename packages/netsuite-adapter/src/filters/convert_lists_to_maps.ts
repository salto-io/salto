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
import { InstanceElement, isInstanceElement, isObjectType } from '@salto-io/adapter-api'
import { collections, promises } from '@salto-io/lowerdash'
import { convertAnnotationListsToMaps, convertFieldsTypesFromListToMap, convertInstanceListsToMaps, convertDataInstanceMapsToLists } from '../mapped_lists/utils'
import { FilterWith } from '../filter'
import { isStandardType, getInnerStandardTypes, isCustomRecordType } from '../types'
import { getStandardTypes } from '../autogen/types'
import { dataTypesToConvert } from '../mapped_lists/mapping'

const { mapValuesAsync } = promises.object

const { awu } = collections.asynciterable

const shouldTransformDataInstance = async (instance: InstanceElement): Promise<boolean> =>
  Object.values((await instance.getType()).fields)
    .some(field => dataTypesToConvert.has(field.refType.elemID.name))

const filterCreator = (): FilterWith<'onFetch' | 'preDeploy'> => ({
  /**
   * Upon fetch, do the following:
   * - convert ListType fields to MapType
   * - adds an annotation to the fields mentioned above that indicates
   *   the inner field to use as mapping key
   * - convert instances' values in the fields mentioned above from lists to maps
   *   by the mapping key mentioned above
   *
   * NOTICE: This filter works on:
   * - standard & data types
   * - standard & data instances
   * - custom record types
   *
   * @param elements the already fetched elements
   */
  onFetch: async elements => {
    const innerStandardTypesNames = new Set(
      getInnerStandardTypes(getStandardTypes())
        .map(element => element.elemID.name)
    )

    await awu(elements)
      .filter(isObjectType)
      .filter(type =>
        isStandardType(type)
        || innerStandardTypesNames.has(type.elemID.name)
        || dataTypesToConvert.has(type.elemID.name))
      .forEach(convertFieldsTypesFromListToMap)

    await awu(elements)
      .filter(isInstanceElement)
      .filter(inst => isStandardType(inst.refType) || shouldTransformDataInstance(inst))
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
  /**
   * Transform maps back to lists before deploy - in data instances.
   * Mapped lists' field types are transformed too (MapType -> ListType).
   *
   * The reverse conversion of standard instances & custom record types happens in sdfDeploy
   */
  preDeploy: async changes => {
    await awu(changes)
      .forEach(async change => {
        const transformedData = await mapValuesAsync(change.data, async changeData => (
          isInstanceElement(changeData) && await shouldTransformDataInstance(changeData)
            ? convertDataInstanceMapsToLists(changeData)
            : changeData
        ))
        Object.assign(change.data, transformedData)
      })
  },
})

export default filterCreator
