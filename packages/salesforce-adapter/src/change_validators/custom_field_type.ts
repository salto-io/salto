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
  ChangeDataType, ChangeError, Field, getChangeElement, isAdditionOrModificationChange,
  ChangeValidator, isField, Change, isModificationChange,
} from '@salto-io/adapter-api'
import { CUSTOM_FIELD_UPDATE_CREATE_ALLOWED_TYPES, FIELD_TYPE_NAMES, COMPOUND_FIELD_TYPE_NAMES } from '../constants'
import { isCustomObject } from '../transformers/transformer'

export const isInvalidCustomFieldType = (change: Change<ChangeDataType>): boolean => {
  let isFieldTypeModification = true
  const afterElement = getChangeElement(change)
  if (isField(afterElement) && isCustomObject(afterElement.parent)) {
    const afterFieldType = afterElement.type.elemID.typeName as
     FIELD_TYPE_NAMES | COMPOUND_FIELD_TYPE_NAMES
    if (isModificationChange(change)) {
      const beforeFieldType = (change.data.before as Field).type.elemID.typeName as
      FIELD_TYPE_NAMES | COMPOUND_FIELD_TYPE_NAMES
      isFieldTypeModification = (afterFieldType !== beforeFieldType)
    }
    return isFieldTypeModification
     && !CUSTOM_FIELD_UPDATE_CREATE_ALLOWED_TYPES.includes(afterFieldType)
  }
  return false
}

const createChangeError = (change: Change<ChangeDataType>): ChangeError => {
  const field = getChangeElement(change) as Field
  return {
    elemID: field.elemID,
    severity: 'Error',
    message: `You cannot create or modify a custom field type to ${field.type.elemID.typeName}. Field: ${field.name}`,
    detailedMessage: `You cannot create or modify a custom field type to ${field.type.elemID.typeName}. Valid types can be found at:\nhttps://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_field_types.htm#meta_type_fieldtype`,
  }
}


/**
   * It is forbidden to add or modify a field with unknown type.
   * A missing type means this field is not accessible on Salesforce.
   */
const changeValidator: ChangeValidator = async changes => changes
  .filter(isAdditionOrModificationChange)
  .filter(isInvalidCustomFieldType)
  .map(createChangeError)

export default changeValidator
