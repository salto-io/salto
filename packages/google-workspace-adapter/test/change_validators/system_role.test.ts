/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ChangeError, ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { ADAPTER_NAME, ROLE_TYPE_NAME } from '../../src/constants'
import { systemRoleValidator } from '../../src/change_validators'

const systemRoleError = (role: InstanceElement): ChangeError => ({
  elemID: role.elemID,
  severity: 'Error',
  message: 'Can not edit system roles trough the API',
  detailedMessage: 'Can not edit system roles trough the API',
})

describe('systemRoleValidator', () => {
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
  it('should return a Error if an system role is removed', async () => {
    const errors = await systemRoleValidator([toChange({ after: roleInstance })])
    expect(errors).toEqual([systemRoleError(roleInstance)])
  })
  it('should return a Error if an system role is edited', async () => {
    const clonedRole = roleInstance.clone()
    clonedRole.value.roleDescription = 'wow'
    const errors = await systemRoleValidator([toChange({ before: roleInstance, after: clonedRole })])
    expect(errors).toEqual([systemRoleError(roleInstance)])
  })
  it('should not return an error if the role is not a system role', async () => {
    const clonedRole = roleInstance.clone()
    clonedRole.value.isSystemRole = false
    const errors = await systemRoleValidator([toChange({ after: clonedRole })])
    expect(errors).toHaveLength(0)
  })
})
