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
import { appWithGroupPushValidator } from '../../src/change_validators/app_with_group_push'
import { OKTA, APPLICATION_TYPE_NAME, GROUP_PUSH_TYPE_NAME, GROUP_PUSH_RULE_TYPE_NAME } from '../../src/constants'

describe('appWithGroupPushValidator', () => {
  const appType = new ObjectType({ elemID: new ElemID(OKTA, APPLICATION_TYPE_NAME) })
  const appWithGroupPushA = new InstanceElement('appA', appType, {
    id: 'abc',
    name: 'salesforce',
    signOnMode: 'SAML_2_0',
    features: ['IMPORT_USER_SCHEMA', 'GROUP_PUSH'],
  })
  const appWithNoGroupPushA = new InstanceElement('appB', appType, {
    id: 'abc',
    name: 'jira',
    signOnMode: 'SAML_2_0',
    features: ['IMPORT_USER_SCHEMA'],
  })
  const appWithNoGroupPushB = new InstanceElement('appC', appType, {
    id: 'bcd',
    name: 'zendesk',
    signOnMode: 'SAML_2_0',
  })
  const groupPushType = new ObjectType({ elemID: new ElemID(OKTA, GROUP_PUSH_TYPE_NAME) })
  const pushRuleType = new ObjectType({ elemID: new ElemID(OKTA, GROUP_PUSH_RULE_TYPE_NAME) })
  const validGroupPush = new InstanceElement(
    'g1',
    groupPushType,
    { mappingId: 'm1', status: 'ACTIVE', newAppGroupName: 'A1' },
    undefined,
    { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(appWithGroupPushA.elemID, appWithGroupPushA)] },
  )
  const invalidGroupPushA = new InstanceElement(
    'g2',
    groupPushType,
    { mappingId: 'm2', status: 'INACTIVE', newAppGroupName: 'B1' },
    undefined,
    { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(appWithNoGroupPushA.elemID, appWithNoGroupPushA)] },
  )
  const invalidGroupPushB = new InstanceElement(
    'g3',
    groupPushType,
    { mappingId: 'm3', status: 'ACTIVE', newAppGroupName: 'C1' },
    undefined,
    { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(appWithNoGroupPushB.elemID, appWithNoGroupPushB)] },
  )
  const validPushRule = new InstanceElement(
    'test rule',
    pushRuleType,
    {
      mappingRuleId: 'mr1',
      name: 'test rule',
      status: 'ACTIVE',
      searchExpression: 'sales',
      searchExpressionType: 'ENDS_WITH',
    },
    undefined,
    { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(appWithGroupPushA.elemID, appWithGroupPushA)] },
  )
  const invalidPushRule = new InstanceElement(
    'test rule',
    pushRuleType,
    {
      mappingRuleId: 'mr1',
      name: 'test rule',
      status: 'ACTIVE',
      searchExpression: 'sales',
      searchExpressionType: 'STARTS_WITH',
    },
    undefined,
    { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(appWithNoGroupPushA.elemID, appWithNoGroupPushA)] },
  )
  it('should return an error when group push is disabled for parent app', async () => {
    const changeErrors = await appWithGroupPushValidator([
      toChange({ after: invalidGroupPushA }),
      toChange({ after: invalidGroupPushB }),
      toChange({ after: invalidPushRule }),
    ])
    expect(changeErrors).toHaveLength(3)
    expect(changeErrors).toEqual([
      {
        elemID: invalidGroupPushA.elemID,
        severity: 'Error',
        message: 'Group Push is not supported for application',
        detailedMessage:
          'Group Push must be enabled for application appB, for more info see: https://help.okta.com/oie/en-us/content/topics/users-groups-profiles/usgp-group-push-prerequisites.htm',
      },
      {
        elemID: invalidGroupPushB.elemID,
        severity: 'Error',
        message: 'Group Push is not supported for application',
        detailedMessage:
          'Group Push must be enabled for application appC, for more info see: https://help.okta.com/oie/en-us/content/topics/users-groups-profiles/usgp-group-push-prerequisites.htm',
      },
      {
        elemID: invalidPushRule.elemID,
        severity: 'Error',
        message: 'Group Push is not supported for application',
        detailedMessage:
          'Group Push must be enabled for application appB, for more info see: https://help.okta.com/oie/en-us/content/topics/users-groups-profiles/usgp-group-push-prerequisites.htm',
      },
    ])
  })
  it('should not return error if parent app enabled group push', async () => {
    const changeErrors = await appWithGroupPushValidator([
      toChange({ after: validGroupPush }),
      toChange({ after: validPushRule }),
    ])
    expect(changeErrors).toEqual([])
  })
})
