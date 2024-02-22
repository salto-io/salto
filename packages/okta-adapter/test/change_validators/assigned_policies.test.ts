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
import { toChange, ObjectType, ElemID, InstanceElement, ReferenceExpression } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { assignedAccessPoliciesValidator } from '../../src/change_validators/assigned_policies'
import { OKTA, ACCESS_POLICY_TYPE_NAME, APPLICATION_TYPE_NAME } from '../../src/constants'

describe('assignedAccessPoliciesValidator', () => {
  const policyType = new ObjectType({ elemID: new ElemID(OKTA, ACCESS_POLICY_TYPE_NAME) })
  const appType = new ObjectType({ elemID: new ElemID(OKTA, APPLICATION_TYPE_NAME) })
  const policyInstance = new InstanceElement('somePolicy', policyType, {
    name: 'policy',
    status: 'INACTIVE',
    system: false,
    type: 'ACCESS_POLICY',
  })
  const policyInstance2 = new InstanceElement('somePolicy2', policyType, {
    name: 'policy2',
    status: 'INACTIVE',
    system: false,
    type: 'ACCESS_POLICY',
  })
  const app = new InstanceElement('someApp', appType, {
    name: 'app',
    status: 'ACTIVE',
    accessPolicy: new ReferenceExpression(policyInstance.elemID, policyInstance),
  })
  const anotherApp = new InstanceElement('anotherApp', appType, {
    name: 'app2',
    status: 'INACTIVE',
    accessPolicy: new ReferenceExpression(policyInstance.elemID, policyInstance),
  })
  const anotherApp2 = new InstanceElement('anotherApp2', appType, {
    name: 'app3',
    status: 'ACTIVE',
    accessPolicy: new ReferenceExpression(policyInstance2.elemID, policyInstance2),
  })
  const elementSource = buildElementsSourceFromElements([
    appType,
    app,
    anotherApp,
    policyInstance,
    policyType,
    anotherApp2,
    policyInstance2,
  ])

  it('should return an error when deactivating access policy that is used by an app', async () => {
    const changeErrors = await assignedAccessPoliciesValidator(
      [toChange({ before: policyInstance, after: policyInstance }), toChange({ after: policyInstance2 })],
      elementSource,
    )
    expect(changeErrors).toHaveLength(2)
    expect(changeErrors).toEqual([
      {
        elemID: policyInstance.elemID,
        severity: 'Error',
        message: 'Cannot deactivate an access policy with assigned applications',
        detailedMessage: 'Access policy is used by the following applications: someApp, anotherApp.',
      },
      {
        elemID: policyInstance2.elemID,
        severity: 'Error',
        message: 'Cannot deactivate an access policy with assigned applications',
        detailedMessage: 'Access policy is used by the following applications: anotherApp2.',
      },
    ])
  })
  it('should not return an error if no app is using the deactivated policy', async () => {
    const newPolicy = new InstanceElement('newPolicy', policyType, {
      name: 'policy',
      status: 'INACTIVE',
      system: false,
      type: 'ACCESS_POLICY',
    })
    const changeErrors = await assignedAccessPoliciesValidator([toChange({ after: newPolicy })], elementSource)
    expect(changeErrors).toHaveLength(0)
  })
  it('should do nothing when element source is missing', async () => {
    const changeErrors = await assignedAccessPoliciesValidator([toChange({ after: policyInstance })], undefined)
    expect(changeErrors).toHaveLength(0)
  })
})
