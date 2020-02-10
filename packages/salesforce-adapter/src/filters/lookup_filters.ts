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
import _ from 'lodash'
import {
  Element, Field, isObjectType, ObjectType, Change, getChangeElement,
  isField, Values,
} from 'adapter-api'
import { SaveResult } from 'jsforce'
import { FilterCreator } from '../filter'
import { CUSTOM_FIELD, FIELD_ANNOTATIONS } from '../constants'
import { CustomField } from '../client/types'
import { toCustomField } from '../transformers/transformer'

const getLookupFilter = (field: Field): Values =>
  field.annotations[FIELD_ANNOTATIONS.LOOKUP_FILTER]

const hasLookupFilter = (field: Field): boolean =>
  getLookupFilter(field) !== undefined

const getFieldsWithLookupFilter = (obj: ObjectType): Field[] =>
  Object.values(obj.fields).filter(hasLookupFilter)

const createCustomFieldWithLookupFilter = (fieldWithLookupFilter: Field):
  CustomField => {
  const customField = toCustomField(fieldWithLookupFilter, true)
  _.assign(
    customField,
    _.pick(fieldWithLookupFilter.annotations, FIELD_ANNOTATIONS.LOOKUP_FILTER),
  )
  return customField
}

/**
 * Declare the lookupFilters filter, this filter adds the lookupFilter annotation to the
 * lookup & masterDetail fields if needed
 * */
const filterCreator: FilterCreator = ({ client }) => ({
  /**
   * In Salesforce you can't add a lookup/masterdetail relationship with a lookupFilter upon
   * the field's creation (and thus also upon an object creation).
   * Thus, we need to first create the field and then update it using filter
   */
  onAdd: async (after: Element): Promise<SaveResult[]> => {
    if (!isObjectType(after)) {
      return []
    }
    const customFieldsWithLookupFilter = getFieldsWithLookupFilter(after)
      .map(fieldWithLookupFilter =>
        createCustomFieldWithLookupFilter(fieldWithLookupFilter))
    if (customFieldsWithLookupFilter && customFieldsWithLookupFilter.length > 0) {
      return client.update(CUSTOM_FIELD, customFieldsWithLookupFilter)
    }
    return []
  },

  /**
   * In Salesforce you can't add a lookup/masterdetail relationship with a lookupFilter upon
   * the field's creation. Thus, we need to first create the field and then update it using filter
   */
  onUpdate: async (before: Element, after: Element, changes: ReadonlyArray<Change>):
    Promise<SaveResult[]> => {
    if (!(isObjectType(before) && isObjectType(after))) {
      return []
    }

    const fieldsToUpdate = changes
      .filter(c => isField(getChangeElement(c)))
      .map(c => [_.get(c.data, 'before'), _.get(c.data, 'after')])
      .filter(([b, a]) => !_.isEqual(b ? getLookupFilter(b) : undefined,
        a ? getLookupFilter(a) : undefined))
      .map(([_b, a]) => a)
      .filter(f => f)

    if (fieldsToUpdate.length > 0) {
      return client.update(CUSTOM_FIELD, fieldsToUpdate
        .map(field => createCustomFieldWithLookupFilter(field)))
    }

    return []
  },
})

export default filterCreator
