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
import { toChange, ObjectType, ElemID, InstanceElement } from '@salto-io/adapter-api'
import { readOnlyProjectRoleChangeValidator, RoleName } from '../../src/change_validators/read_only_project_role'
import { JIRA } from '../../src/constants'

describe('read only project role change validator test', () => {
  let type: ObjectType
  let readOnlyInstance: InstanceElement
  let normalInstance: InstanceElement

  beforeEach(() => {
    type = new ObjectType({ elemID: new ElemID(JIRA, 'ProjectRole') })
    readOnlyInstance = new InstanceElement('instance', type, { name: RoleName })
    normalInstance = new InstanceElement('instance', type, { name: 'normal' })
  })

  it('should return an error if the instance that changed was read only', async () => {
    expect(
      await readOnlyProjectRoleChangeValidator([
        toChange({
          before: readOnlyInstance,
          after: readOnlyInstance,
        }),
      ]),
    ).toEqual([
      {
        elemID: readOnlyInstance.elemID,
        severity: 'Error',
        message: 'Changes to the “atlassian-addons-project-access” Project Role won’t be deployed.',
        detailedMessage:
          'Changes to the “atlassian-addons-project-access” Project Role won’t be deployed, as it’s only used by addons that are not installed on the target environment. See https://confluence.atlassian.com/servicedeskcloud/blog/2017/02/add-on-permissions-update to learn more about this role.',
      },
    ])
  })
  it('should return an error if the instance that was removed was read only', async () => {
    expect(
      await readOnlyProjectRoleChangeValidator([
        toChange({
          before: readOnlyInstance,
        }),
      ]),
    ).toEqual([
      {
        elemID: readOnlyInstance.elemID,
        severity: 'Error',
        message: 'Changes to the “atlassian-addons-project-access” Project Role won’t be deployed.',
        detailedMessage:
          'Changes to the “atlassian-addons-project-access” Project Role won’t be deployed, as it’s only used by addons that are not installed on the target environment. See https://confluence.atlassian.com/servicedeskcloud/blog/2017/02/add-on-permissions-update to learn more about this role.',
      },
    ])
  })
  it('should not return an error if the instance that changed was not read only', async () => {
    expect(
      await readOnlyProjectRoleChangeValidator([
        toChange({
          before: normalInstance,
          after: normalInstance,
        }),
      ]),
    ).toBeEmpty()
  })
})
