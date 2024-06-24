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
import {
  toChange,
  ObjectType,
  ElemID,
  InstanceElement,
  ReferenceExpression,
  CORE_ANNOTATIONS,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { groupPushToApplicationUniquenessValidator } from '../../src/change_validators/group_push_to_application_uniqueness'
import { OKTA, GROUP_PUSH_TYPE_NAME } from '../../src/constants'

describe('groupPushToApplicationUniquenessValidator', () => {
  const GROUP_NAME = 'group'
  const APPLICATION_NAME = 'application'
  const groupPushType = new ObjectType({ elemID: new ElemID(OKTA, GROUP_PUSH_TYPE_NAME) })
  const groupPush1 = new InstanceElement(
    'groupPush1',
    groupPushType,
    {
      userGroupId: new ReferenceExpression(new ElemID(GROUP_NAME)),
    },
    undefined,
    {
      [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(new ElemID(APPLICATION_NAME))],
      [CORE_ANNOTATIONS.ALIAS]: 'groupPush1_alias',
    },
  )
  const groupPush2 = new InstanceElement(
    'groupPush2',
    groupPushType,
    {
      userGroupId: [new ReferenceExpression(new ElemID(GROUP_NAME))],
    },
    undefined,
    {
      [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(new ElemID(`${APPLICATION_NAME}2`))],
      [CORE_ANNOTATIONS.ALIAS]: 'groupPush2_alias',
    },
  )
  const groupPush3 = new InstanceElement(
    'groupPush3',
    groupPushType,
    {
      userGroupId: new ReferenceExpression(new ElemID(`${GROUP_NAME}2`)),
    },
    undefined,
    {
      [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(new ElemID(APPLICATION_NAME))],
      [CORE_ANNOTATIONS.ALIAS]: 'groupPush3_alias',
    },
  )
  const groupPushInElementSource = new InstanceElement(
    'groupPushInElementSource',
    groupPushType,
    {
      userGroupId: new ReferenceExpression(new ElemID(GROUP_NAME)),
    },
    undefined,
    {
      [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(new ElemID(APPLICATION_NAME))],
      [CORE_ANNOTATIONS.ALIAS]: 'groupPushInElementSource_alias',
    },
  )

  it('should return empty list when elementSource is not provided', async () => {
    const changeErrors = await groupPushToApplicationUniquenessValidator([toChange({ after: groupPush1 })])
    expect(changeErrors).toHaveLength(0)
  })
  it('should return empty list when there are no addition changes', async () => {
    const elementSource = buildElementsSourceFromElements([
      groupPushInElementSource,
      groupPush1,
      groupPush2,
      groupPush3,
    ])
    const changeErrors = await groupPushToApplicationUniquenessValidator(
      [toChange({ before: groupPush1 }), toChange({ before: groupPush2, after: groupPush3 })],
      elementSource,
    )
    expect(changeErrors).toHaveLength(0)
  })
  it('should return empty list when addition change is on existing instance', async () => {
    const elementSource = buildElementsSourceFromElements([groupPushInElementSource])
    const changeErrors = await groupPushToApplicationUniquenessValidator(
      [toChange({ after: groupPushInElementSource })],
      elementSource,
    )
    expect(changeErrors).toHaveLength(0)
  })
  it('should return errors only when group to application are defined in element source', async () => {
    const elementSource = buildElementsSourceFromElements([
      groupPushInElementSource,
      groupPush1,
      groupPush2,
      groupPush3,
    ])
    const changeErrors = await groupPushToApplicationUniquenessValidator(
      [toChange({ after: groupPush1 }), toChange({ after: groupPush2 }), toChange({ after: groupPush3 })],
      elementSource,
    )
    expect(changeErrors).toEqual([
      {
        elemID: groupPush1.elemID,
        detailedMessage: `GroupPush groupPushInElementSource_alias already maps group ${GROUP_NAME} to application ${APPLICATION_NAME}`,
        message: `Group ${GROUP_NAME} is already mapped to ${APPLICATION_NAME}`,
        severity: 'Error',
      },
    ])
  })
})
