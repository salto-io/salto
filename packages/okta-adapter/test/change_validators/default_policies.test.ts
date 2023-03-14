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
import { toChange, ObjectType, ElemID, InstanceElement } from '@salto-io/adapter-api'
import { defaultPoliciesValidator } from '../../src/change_validators/default_policies'
import { OKTA, ACCESS_POLICY_TYPE_NAME, ACCESS_POLICY_RULE_TYPE_NAME, INACTIVE_STATUS } from '../../src/constants'

describe('defaultPoliciesValidator', () => {
  const policyType = new ObjectType({ elemID: new ElemID(OKTA, ACCESS_POLICY_TYPE_NAME) })
  const policyRuleType = new ObjectType({ elemID: new ElemID(OKTA, ACCESS_POLICY_RULE_TYPE_NAME) })
  const policyInstance = new InstanceElement(
    'defaultPolicy',
    policyType,
    {
      name: 'policy',
      status: 'ACTIVE',
      system: true,
      type: 'ACCESS_POLICY',
    },
  )
  const policyRuleInstance = new InstanceElement(
    'defaultRule',
    policyRuleType,
    {
      name: 'rule',
      status: 'ACTIVE',
      system: true,
      conditions: {
        network: { connection: 'ANYWHERE' },
      },
    },
  )

  it('should return an error when removing a default policy or policy rule', async () => {
    const changeErrors = await defaultPoliciesValidator(
      [toChange({ before: policyInstance }), toChange({ before: policyRuleInstance })]
    )
    expect(changeErrors).toHaveLength(2)
    expect(changeErrors).toEqual([
      {
        elemID: policyInstance.elemID,
        severity: 'Error',
        message: 'Cannot remove or deactivate default AccessPolicy',
        detailedMessage: `Default ${policyInstance.elemID.typeName} cannot be removed and must be in status ACTIVE`,
      },
      {
        elemID: policyRuleInstance.elemID,
        severity: 'Error',
        message: 'Cannot remove or deactivate default AccessPolicyRule',
        detailedMessage: `Default ${policyRuleInstance.elemID.typeName} cannot be removed and must be in status ACTIVE`,
      },
    ])
  })
  it('should return an error when deactivating a default policy or policy rule', async () => {
    const policyInstanceAfter = policyInstance.clone()
    policyInstanceAfter.value.status = INACTIVE_STATUS
    const policyRuleInstanceAfter = policyRuleInstance.clone()
    policyRuleInstanceAfter.value.status = INACTIVE_STATUS
    const changeErrors = await defaultPoliciesValidator([
      toChange({ before: policyInstance, after: policyInstanceAfter }),
      toChange({ before: policyRuleInstance, after: policyRuleInstanceAfter }),
    ])
    expect(changeErrors).toHaveLength(2)
    expect(changeErrors).toEqual([
      {
        elemID: policyInstance.elemID,
        severity: 'Error',
        message: 'Cannot remove or deactivate default AccessPolicy',
        detailedMessage: `Default ${policyInstance.elemID.typeName} cannot be removed and must be in status ACTIVE`,
      },
      {
        elemID: policyRuleInstance.elemID,
        severity: 'Error',
        message: 'Cannot remove or deactivate default AccessPolicyRule',
        detailedMessage: `Default ${policyRuleInstance.elemID.typeName} cannot be removed and must be in status ACTIVE`,
      },
    ])
  })
  it('should not return an error when removing or deactivating a non default policy', async () => {
    const nonDefaultInstance = policyInstance.clone()
    nonDefaultInstance.value.system = false
    const nonDefaultRuleBefore = policyRuleInstance.clone()
    nonDefaultRuleBefore.value.system = false
    const nonDefaultRuleAfter = nonDefaultRuleBefore.clone()
    nonDefaultRuleAfter.value.status = INACTIVE_STATUS
    const changeErrors = await defaultPoliciesValidator([
      toChange({ before: nonDefaultInstance }),
      toChange({ before: nonDefaultRuleBefore, after: nonDefaultRuleAfter }),
    ])
    expect(changeErrors).toHaveLength(0)
  })
})
