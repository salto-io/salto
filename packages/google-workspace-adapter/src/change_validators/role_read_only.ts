/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ChangeError,
  ChangeValidator,
  InstanceElement,
  ModificationChange,
  getChangeData,
  isAdditionChange,
  isInstanceChange,
  isInstanceElement,
  isModificationChange,
} from '@salto-io/adapter-api'
import { ROLE_TYPE_NAME } from '../constants'

const isRoleReadOnlyEdit = (change: ModificationChange<InstanceElement>): boolean => {
  const { before, after } = change.data
  return (
    before.value.isSuperAdminRole !== after.value.isSuperAdminRole ||
    before.value.isSystemRole !== after.value.isSystemRole
  )
}

export const roleReadOnlyValidator: ChangeValidator = async changes => {
  const additionChangeErrors: ChangeError[] = changes
    .filter(isAdditionChange)
    .map(getChangeData)
    .filter(isInstanceElement)
    .filter(instance => instance.elemID.typeName === ROLE_TYPE_NAME)
    .filter(instance => instance.value.isSuperAdminRole === true)
    .flatMap(instance => [
      {
        elemID: instance.elemID,
        severity: 'Info',
        message: 'Can not edit isSuperAdminRole trough the API',
        detailedMessage: `Role ${instance.value.roleName} will be deployed but not as super admin role`,
      },
    ])

  const modificationChangeErrors: ChangeError[] = changes
    .filter(isModificationChange)
    .filter(isInstanceChange)
    .filter(isRoleReadOnlyEdit)
    .map(getChangeData)
    .map(instance => ({
      elemID: instance.elemID,
      severity: 'Error',
      message: 'Can not edit isSuperAdminRole or isSystemRole trough the API',
      detailedMessage: `Can not edit isSuperAdminRole or isSystemRole for the ${instance.value.roleName} role trough the API`,
    }))

  return [...additionChangeErrors, ...modificationChangeErrors]
}
