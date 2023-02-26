/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { ZENDESK, CUSTOM_ROLE_TYPE_NAME } from '../../src/constants'
import { customRoleNameValidator } from '../../src/change_validators/custom_role'

describe('customRoleNameValidator', () => {
  const customRoleType = new ObjectType({
    elemID: new ElemID(ZENDESK, CUSTOM_ROLE_TYPE_NAME),
  })
  const customRole = new InstanceElement(
    'New Test',
    customRoleType,
    { name: 'test', description: 'desc' },
  )
  const systemCustomRole = new InstanceElement(
    'Administrator',
    customRoleType,
    { name: 'Administrator', description: 'desc' },
  )
  it('should return an error if the custom role name is a reserved for system role', async () => {
    const errors = await customRoleNameValidator(
      [toChange({ after: systemCustomRole })],
      buildElementsSourceFromElements([systemCustomRole])
    )
    expect(errors).toEqual([{
      elemID: systemCustomRole.elemID,
      severity: 'Error',
      message: 'Cannot change this custom_role since its name is reserved for a system role',
      detailedMessage: `The name (${systemCustomRole.value.name}) is reserved for a system role, please use another name`,
    }])
  })
  it('should return an error if the custom role name is already in use', async () => {
    const testCustomRole = new InstanceElement(
      'Test',
      customRoleType,
      { name: customRole.value.name, description: 'desc' },
    )
    const clonedCustomRole = customRole.clone()
    const errors = await customRoleNameValidator(
      [toChange({ after: clonedCustomRole })],
      buildElementsSourceFromElements([clonedCustomRole, testCustomRole])
    )
    expect(errors).toEqual([{
      elemID: clonedCustomRole.elemID,
      severity: 'Error',
      message: 'Cannot change this custom_role since its name is already in use',
      detailedMessage: `This name is already in use by ${testCustomRole.elemID.getFullName()}.
Please use another name`,
    }])
  })
  it('should not return an error if custom role name is not in use', async () => {
    const clonedCustomRole = customRole.clone()
    const anotherCustomRole = new InstanceElement(
      'another',
      customRoleType,
      { name: 'Another', description: 'desc' },
    )
    const errors = await customRoleNameValidator(
      [toChange({ after: clonedCustomRole })],
      buildElementsSourceFromElements([clonedCustomRole, anotherCustomRole])
    )
    expect(errors).toHaveLength(0)
  })
  it('should not return an error if the custom role name was not changed', async () => {
    const clonedBeforeCustomRole = systemCustomRole.clone()
    const clonedAfterCustomRole = systemCustomRole.clone()
    clonedAfterCustomRole.value.description = 'edited'
    const errors = await customRoleNameValidator(
      [toChange({ before: clonedBeforeCustomRole, after: clonedAfterCustomRole })],
      buildElementsSourceFromElements([clonedAfterCustomRole])
    )
    expect(errors).toHaveLength(0)
  })
})
