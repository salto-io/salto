/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ChangeDataType,
  ChangeError,
  Field,
  getChangeData,
  isAdditionOrModificationChange,
  ChangeValidator,
  isField,
} from '@salto-io/adapter-api'
import { Types } from '../transformers/transformer'

const isUnknownField = (changedElement: ChangeDataType): changedElement is Field =>
  isField(changedElement) && changedElement.refType.elemID.isEqual(Types.primitiveDataTypes.Unknown.elemID)

const createChangeError = (field: Field): ChangeError => ({
  elemID: field.elemID,
  severity: 'Error',
  message: 'Cannot create or modify a field with unknown type',
  detailedMessage: `You cannot create or modify the field ${field.name} of type ‘unknown’.\nIn Salto, fields are set with an unknown type in case the credentials used for fetch provides limited access rights to that field in salesforce.\nCheck your profile permissions on Salesforce to make sure you have access to the field.`,
})

/**
 * It is forbidden to add or modify a field with unknown type.
 * A missing type means this field is not accessible on Salesforce.
 */
const changeValidator: ChangeValidator = async changes =>
  changes.filter(isAdditionOrModificationChange).map(getChangeData).filter(isUnknownField).map(createChangeError)

export default changeValidator
