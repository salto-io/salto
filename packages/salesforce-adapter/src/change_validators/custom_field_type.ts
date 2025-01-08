/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ChangeError,
  Field,
  getChangeData,
  isAdditionOrModificationChange,
  ChangeValidator,
  Change,
  isAdditionChange,
  isFieldChange,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { CUSTOM_FIELD_UPDATE_CREATE_ALLOWED_TYPES, SYSTEM_FIELDS } from '../constants'
import { isFieldOfCustomObject, fieldTypeName, Types } from '../transformers/transformer'

const { awu } = collections.asynciterable

const isInvalidTypeChange = async (change: Change<Field>): Promise<boolean> => {
  const changeData = getChangeData(change)
  const afterFieldType = fieldTypeName(changeData.refType.elemID.name)
  const isAfterTypeAllowed = CUSTOM_FIELD_UPDATE_CREATE_ALLOWED_TYPES.includes(afterFieldType)
  const isSystemField = SYSTEM_FIELDS.includes(changeData.name)
  if (isSystemField || isAfterTypeAllowed) {
    return false
  }
  if (isAdditionChange(change)) {
    return true
  }

  // it's a modification change and the target type is invalid
  return fieldTypeName(change.data.before.refType.elemID.name) !== afterFieldType
}

const createChangeError = (field: Field): ChangeError => {
  if (field.refType.elemID.isEqual(Types.primitiveDataTypes.Unknown.elemID)) {
    return {
      elemID: field.elemID,
      severity: 'Error',
      message: 'Cannot create or modify a field with unknown type',
      detailedMessage: `You cannot create or modify the field ${field.name} with type ‘unknown’.\nThe reason this field type is unknown could be that the credentials used for fetch provides limited access rights to that field in Salesforce.\nCheck your profile permissions on Salesforce to make sure you have access to the field.`,
    }
  }
  return {
    elemID: field.elemID,
    severity: 'Warning',
    message: 'Invalid custom field type',
    detailedMessage: `Custom field type ${field.refType.elemID.typeName} is not valid.\nYou can edit the type in Salto and use a valid type, per the list at:\nhttps://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_field_types.htm#meta_type_fieldtype`,
  }
}

/**
 * Modification of a custom field type is restricted to certain types,
 * as well as the type of new custom fields.
 */
const changeValidator: ChangeValidator = async changes =>
  awu(changes)
    .filter(isAdditionOrModificationChange)
    .filter(isFieldChange)
    .filter(change => isFieldOfCustomObject(getChangeData(change)))
    .filter(isInvalidTypeChange)
    .map(getChangeData)
    .map(createChangeError)
    .toArray()

export default changeValidator
