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
  Field, getChangeElement, Values, isAdditionChange, isAdditionOrModificationChange,
  isObjectTypeChange, isModificationChange,
} from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'
import { CUSTOM_FIELD, FIELD_ANNOTATIONS } from '../constants'
import { CustomField } from '../client/types'
import { toCustomField, isCustomObject } from '../transformers/transformer'

const getLookupFilter = (field: Field): Values =>
  field.annotations[FIELD_ANNOTATIONS.LOOKUP_FILTER]

const hasLookupFilter = (field: Field): boolean =>
  getLookupFilter(field) !== undefined

const isLookupFilterChanged = (field: Field, beforeField?: Field): boolean => (
  hasLookupFilter(field)
  && (beforeField === undefined || !_.isEqual(getLookupFilter(field), getLookupFilter(beforeField)))
)

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
  onDeploy: async changes => {
    const customObjectChanges = changes
      .filter(isObjectTypeChange)
      .filter(isAdditionOrModificationChange)
      .filter(change => isCustomObject(getChangeElement(change)))

    const lookupFieldsInNewObjects = customObjectChanges
      .filter(isAdditionChange)
      .map(getChangeElement)
      .flatMap(obj => Object.values(obj.fields))
      .filter(hasLookupFilter)

    const changedLookupFields = customObjectChanges
      .filter(isModificationChange)
      .flatMap(
        change => Object.entries(change.data.after.fields)
          .filter(([name, field]) => isLookupFilterChanged(field, change.data.before.fields[name]))
          .map(([_name, field]) => field)
      )

    const fieldsToUpdate = [...lookupFieldsInNewObjects, ...changedLookupFields]

    if (fieldsToUpdate.length === 0) {
      return []
    }

    return client.update(CUSTOM_FIELD, fieldsToUpdate.map(createCustomFieldWithLookupFilter))
  },
})

export default filterCreator
