/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { ADAPTER_NAME, GROUP_MEMBER_TYPE_NAME } from '../../src/constants'
import { groupMemberRoleValidator } from '../../src/change_validators'

describe('groupMemberRoleValidator', () => {
  const groupMemberInstance = new InstanceElement(
    'testMember',
    new ObjectType({ elemID: new ElemID(ADAPTER_NAME, GROUP_MEMBER_TYPE_NAME) }),
    {
      role: 'MEMBER',
      type: 'GROUP',
    },
  )
  it('should return a Error if changing a group role', async () => {
    const clonedMember = groupMemberInstance.clone()
    clonedMember.value.role = 'OWNER'
    const errors = await groupMemberRoleValidator([toChange({ before: groupMemberInstance, after: clonedMember })])
    expect(errors).toEqual([
      {
        elemID: groupMemberInstance.elemID,
        severity: 'Error',
        message: 'Can not edit group member role for groups',
        detailedMessage: 'Can not edit group member role for groups',
      },
    ])
  })
  it('should not return an error if changing a user role', async () => {
    const cloneUserMember = groupMemberInstance.clone()
    cloneUserMember.value.type = 'USER'
    const clonedMember = cloneUserMember.clone()
    clonedMember.value.role = 'OWNER'
    const errors = await groupMemberRoleValidator([toChange({ before: cloneUserMember, after: clonedMember })])
    expect(errors).toHaveLength(0)
  })
})
