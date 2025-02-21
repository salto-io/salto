/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { InstanceElement, getChangeData, isInstanceElement, isObjectType } from '@salto-io/adapter-api'
import { collections, promises } from '@salto-io/lowerdash'
import {
  convertAnnotationListsToMaps,
  convertFieldsTypesFromListToMap,
  convertInstanceListsToMaps,
  convertDataInstanceMapsToLists,
  createConvertStandardElementMapsToLists,
} from '../mapped_lists/utils'
import { LocalFilterCreator } from '../filter'
import { isStandardType, getInnerStandardTypes, isCustomRecordType } from '../types'
import { getStandardTypes } from '../autogen/types'
import { dataTypesToConvert } from '../mapped_lists/mapping'
import { isSdfCreateOrUpdateGroupId } from '../group_changes'
import { DATASET, WORKBOOK } from '../constants'

const { mapValuesAsync } = promises.object

const { awu } = collections.asynciterable

const shouldTransformDataInstance = async (instance: InstanceElement): Promise<boolean> =>
  Object.values((await instance.getType()).fields).some(field => dataTypesToConvert.has(field.refType.elemID.name))

const filterCreator: LocalFilterCreator = ({ changesGroupId }) => ({
  name: 'convertListsToMaps',
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
      getInnerStandardTypes(getStandardTypes()).map(element => element.elemID.name),
    )

    await awu(elements)
      .filter(isObjectType)
      .filter(
        type =>
          isStandardType(type) ||
          innerStandardTypesNames.has(type.elemID.name) ||
          dataTypesToConvert.has(type.elemID.name),
      )
      .forEach(convertFieldsTypesFromListToMap)

    await awu(elements)
      .filter(isInstanceElement)
      .filter(elem => elem.elemID.typeName !== DATASET && elem.elemID.typeName !== WORKBOOK)
      .filter(inst => isStandardType(inst.refType) || shouldTransformDataInstance(inst))
      .forEach(async inst => {
        inst.value = (await convertInstanceListsToMaps(inst)) ?? inst.value
      })

    await awu(elements)
      .filter(isObjectType)
      .filter(isCustomRecordType)
      .forEach(async type => {
        type.annotations = await convertAnnotationListsToMaps(type)
      })
  },
  /**
   * Transform maps back to lists before deploy - in data instances.
   * Mapped lists' field types are transformed too (MapType -> ListType).
   *
   * The reverse conversion of standard instances & custom record types happens in sdfDeploy
   */
  preDeploy: async changes => {
    const convertElementMapsToLists =
      changesGroupId && isSdfCreateOrUpdateGroupId(changesGroupId)
        ? await createConvertStandardElementMapsToLists()
        : undefined

    await awu(changes)
      .filter(
        change =>
          getChangeData(change).elemID.typeName !== DATASET && getChangeData(change).elemID.typeName !== WORKBOOK,
      )
      .forEach(async change => {
        const transformedData = await mapValuesAsync(change.data, async changeData => {
          if (convertElementMapsToLists) {
            return convertElementMapsToLists(changeData)
          }
          if (isInstanceElement(changeData) && (await shouldTransformDataInstance(changeData))) {
            return convertDataInstanceMapsToLists(changeData)
          }
          return changeData
        })
        Object.assign(change.data, transformedData)
      })
  },
})

export default filterCreator
