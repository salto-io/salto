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
import {
  ChangeError, Field, getChangeElement, isAdditionOrModificationChange,
  ChangeValidator, Change, isAdditionChange, isFieldChange,
} from '@salto-io/adapter-api'
import { CUSTOM_FIELD_UPDATE_CREATE_ALLOWED_TYPES, FIELD_TYPE_NAMES, COMPOUND_FIELD_TYPE_NAMES } from '../constants'
import { isCustomField } from '../transformers/transformer'

const isInvalidTypeChange = (change: Change<Field>): boolean => {
  const afterFieldType = getChangeElement(change).type.elemID.typeName as
  FIELD_TYPE_NAMES | COMPOUND_FIELD_TYPE_NAMES
  const isAfterTypeAllowed = CUSTOM_FIELD_UPDATE_CREATE_ALLOWED_TYPES.includes(afterFieldType)
  if (isAfterTypeAllowed) {
    return false
  } if (isAdditionChange(change)) {
    return true
  }

  // it's a modification change and the target type is invalid
  return change.data.before.type.elemID.typeName !== afterFieldType
}

const createChangeError = (field: Field): ChangeError => ({
  elemID: field.elemID,
  severity: 'Error',
  message: `You cannot create or modify a custom field type to ${field.type.elemID.typeName}. Field: ${field.name}`,
  detailedMessage: `You cannot create or modify a custom field type to ${field.type.elemID.typeName}. Valid types can be found at:\nhttps://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_field_types.htm#meta_type_fieldtype`,
})

/**
 * Modification of a custom field type is restriced to certain types,
 * as well as the type of new custom fields.
 */
const changeValidator: ChangeValidator = async changes => changes
  .filter(isAdditionOrModificationChange)
  .filter(isFieldChange)
  .filter(change => isCustomField(getChangeElement(change)))
  .filter(isInvalidTypeChange)
  .map(getChangeElement)
  .map(createChangeError)

export default changeValidator
