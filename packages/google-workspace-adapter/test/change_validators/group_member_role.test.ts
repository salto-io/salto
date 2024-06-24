/*
 *                      Copyright 2024 Salto Labs Ltd.
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
