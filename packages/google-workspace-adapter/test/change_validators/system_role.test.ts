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
