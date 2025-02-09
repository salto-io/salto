/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ChangeError, ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { ADAPTER_NAME, ROLE_TYPE_NAME } from '../../src/constants'
import { roleReadOnlyValidator } from '../../src/change_validators'

const additionError = (role: InstanceElement): ChangeError => ({
  elemID: role.elemID,
  severity: 'Info',
  message: 'Can not edit isSuperAdminRole trough the API',
  detailedMessage: 'Role uri will be deployed but not as super admin role',
})

const modificationError = (role: InstanceElement): ChangeError => ({
  elemID: role.elemID,
  severity: 'Error',
  message: 'Can not edit isSuperAdminRole or isSystemRole trough the API',
  detailedMessage: 'Can not edit isSuperAdminRole or isSystemRole for the uri role trough the API',
})

describe('roleReadOnlyValidator', () => {
  const roleInstance = new InstanceElement(
    'testRole',
    new ObjectType({ elemID: new ElemID(ADAPTER_NAME, ROLE_TYPE_NAME) }),
    {
      roleName: 'uri',
      roleDescription: 'uri system role',
      isSuperAdminRole: true,
      isSystemRole: true,
    },
  )
  it('should return a Error if user is trying to create super admin role', async () => {
    const errors = await roleReadOnlyValidator([toChange({ after: roleInstance })])
    expect(errors).toEqual([additionError(roleInstance)])
  })
  it('should return a Error if an system role is edited', async () => {
    const clonedRole = roleInstance.clone()
    clonedRole.value.isSuperAdminRole = false
    const errors = await roleReadOnlyValidator([toChange({ before: clonedRole, after: roleInstance })])
    expect(errors).toEqual([modificationError(roleInstance)])
  })
  it('should not return an error for removal change', async () => {
    const errors = await roleReadOnlyValidator([toChange({ before: roleInstance })])
    expect(errors).toHaveLength(0)
  })
})
