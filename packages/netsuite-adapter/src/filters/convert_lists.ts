/*
*                      Copyright 2020 Salto Labs Ltd.
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
/* eslint-disable @typescript-eslint/camelcase */
import {
  Element, Field, isInstanceElement, isListType, ObjectType, Values, Value,
} from '@salto-io/adapter-api'
import { applyRecursive } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { FilterCreator } from '../filter'
import { dataset_dependencies } from '../types/custom_types/dataset'
import { savedcsvimport_filemappings } from '../types/custom_types/savedcsvimport'

type FieldFullNameToOrderBy = Map<string, string | undefined>

const unorderedListFields: FieldFullNameToOrderBy = new Map([
  [dataset_dependencies.fields.dependency.elemID.getFullName(), undefined],
  [savedcsvimport_filemappings.fields.filemapping.elemID.getFullName(), 'file'],
])

const castAndOrderListsRecursively = (
  type: ObjectType,
  values: Values,
): void => {
  // Cast all values of list type to list and order lists according to unorderedListFields
  const castAndOrderLists = (field: Field, value: Value): Value => {
    if (!isListType(field.type)) {
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
  applyRecursive(type, values, castAndOrderLists)
}


const filterCreator: FilterCreator = () => ({
  /**
   * Upon fetch, mark values of list type as list and order lists that are fetched unordered
   *
   * @param elements the already fetched elements
   */
  onFetch: async (elements: Element[]) => {
    elements
      .filter(isInstanceElement)
      .forEach(inst => castAndOrderListsRecursively(inst.type, inst.value))
  },
})

export default filterCreator
