/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { isInstanceElement, isListType, isObjectType } from '@salto-io/adapter-api'
import { transformElementAnnotations, TransformFunc, transformValues } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { LocalFilterCreator } from '../filter'
import { datasetType } from '../autogen/types/standard_types/dataset'
import { workbookType } from '../autogen/types/standard_types/workbook'
import { isCustomRecordType, isFileCabinetInstance } from '../types'
import { typeNameToParser } from '../change_validators/report_types_move_environment'

const { awu } = collections.asynciterable

type FieldFullNameToOrderBy = Map<string, string | undefined>

const unorderedListFields: FieldFullNameToOrderBy = new Map([
  [datasetType().innerTypes.dataset_dependencies.fields.dependency.elemID.getFullName(), undefined],
  [workbookType().innerTypes.workbook_dependencies.fields.dependency.elemID.getFullName(), undefined],
])

const castAndOrderLists: TransformFunc = async ({ value, field }) => {
  if (!field) {
    return value
  }
  if (!isListType(await field.getType())) {
    return value
  }
  if (!_.isArray(value)) {
    return [value]
  }
  // order lists
  return unorderedListFields.has(field.elemID.getFullName())
    ? _.orderBy(value, unorderedListFields.get(field.elemID.getFullName()))
    : value
}

const filterCreator: LocalFilterCreator = () => ({
  name: 'convertLists',
  /**
   * Upon fetch, mark values of list type as list and order lists that are fetched unordered
   *
   * @param elements the already fetched elements
   */
  onFetch: async elements => {
    await awu(elements)
      .filter(isInstanceElement)
      // lists in report types instances are handled in parseReportTypes filter
      // file&folder instances have no list fields so we can skip them
      .filter(inst => !(inst.elemID.typeName in typeNameToParser) && !isFileCabinetInstance(inst))
      .forEach(async inst => {
        inst.value =
          (await transformValues({
            values: inst.value,
            type: await inst.getType(),
            pathID: inst.elemID,
            transformFunc: castAndOrderLists,
            strict: false,
          })) ?? {}
      })

    await awu(elements)
      .filter(isObjectType)
      .filter(isCustomRecordType)
      .forEach(async type => {
        type.annotations = await transformElementAnnotations({
          element: type,
          transformFunc: castAndOrderLists,
          strict: false,
        })
      })
  },
})

export default filterCreator
