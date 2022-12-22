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
/* eslint-disable camelcase */
import {
  isInstanceElement, isListType, isObjectType,
} from '@salto-io/adapter-api'
import { transformElementAnnotations, TransformFunc, transformValues } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { FilterWith } from '../filter'
import { datasetType } from '../autogen/types/standard_types/dataset'
import { isCustomRecordType } from '../types'

const { awu } = collections.asynciterable

type FieldFullNameToOrderBy = Map<string, string | undefined>

const unorderedListFields: FieldFullNameToOrderBy = new Map([
  [datasetType().innerTypes.dataset_dependencies.fields.dependency.elemID.getFullName(), undefined],
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

const filterCreator = (): FilterWith<'onFetch'> => ({
  /**
   * Upon fetch, mark values of list type as list and order lists that are fetched unordered
   *
   * @param elements the already fetched elements
   */
  onFetch: async elements => {
    await awu(elements)
      .filter(isInstanceElement)
      .forEach(async inst => {
        inst.value = await transformValues({
          values: inst.value,
          type: await inst.getType(),
          pathID: inst.elemID,
          transformFunc: castAndOrderLists,
          strict: false,
        }) ?? {}
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
