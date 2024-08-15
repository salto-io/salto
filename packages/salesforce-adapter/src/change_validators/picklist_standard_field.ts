/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ChangeError,
  ChangeValidator,
  Field,
  getChangeData,
  isFieldChange,
  isModificationChange,
} from '@salto-io/adapter-api'
import { FIELD_ANNOTATIONS } from '../constants'
import { isPicklistField, isStandardField } from '../filters/utils'

const isStandardPicklistFieldWithValueSet = (field: Field): boolean =>
  isStandardField(field) && isPicklistField(field) && field.annotations[FIELD_ANNOTATIONS.VALUE_SET] !== undefined

const createChangeError = (field: Field): ChangeError => ({
  elemID: field.elemID,
  severity: 'Error',
  message: 'Standard fields cannot have a defined valueSet',
  detailedMessage: `Standard field ‘${field.name}’ cannot have a defined valueSet.\nYou can edit the field in Salto and use a StandardValueSet instead`,
})

/**
 * It is forbidden to modify a picklist on a standard field. Only StandardValueSet is allowed.
 */
const changeValidator: ChangeValidator = async changes =>
  changes
    .filter(isFieldChange)
    .filter(isModificationChange)
    .map(getChangeData)
    .filter(isStandardPicklistFieldWithValueSet)
    .map(field => createChangeError(field))

export default changeValidator
