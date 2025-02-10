/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ChangeError,
  isModificationChange,
  isInstanceChange,
  ChangeValidator,
  InstanceElement,
  ModificationChange,
} from '@salto-io/adapter-api'
import { INSTANCE_FULL_NAME_FIELD } from '../constants'

const wasFullNameChanged = (change: ModificationChange<InstanceElement>): boolean => {
  const { before, after } = change.data
  return before.value[INSTANCE_FULL_NAME_FIELD] !== after.value[INSTANCE_FULL_NAME_FIELD]
}

const fullNameChangeError = (change: ModificationChange<InstanceElement>): ChangeError => {
  const { before, after } = change.data
  return {
    elemID: after.elemID,
    severity: 'Error',
    message: 'You cannot change the fullName property of an element.',
    detailedMessage:
      'You cannot change the fullName property of an element. ' +
      `The fullName property of '${after.elemID.getFullName()}' was changed from ` +
      `'${before.value[INSTANCE_FULL_NAME_FIELD]}' to '${after.value[INSTANCE_FULL_NAME_FIELD]}'`,
  }
}

/**
 * It is forbidden to modify the fullName property of objects - it is used as an identifier and
 * changing it is not supported.
 */
const changeValidator: ChangeValidator = async changes =>
  changes.filter(isModificationChange).filter(isInstanceChange).filter(wasFullNameChanged).map(fullNameChangeError)

export default changeValidator
