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
import { enabledAuthenticatorsValidator } from '../../src/change_validators/enabled_authenticators'
import { OKTA, MFA_POLICY_TYPE_NAME, AUTHENTICATOR_TYPE_NAME } from '../../src/constants'

describe('enabledAuthenticatorsValidator', () => {
  const message = 'Cannot deactivate authenticator because it is enabled in one or more MultifactorEnrollmentPolicy'
  const policyType = new ObjectType({ elemID: new ElemID(OKTA, MFA_POLICY_TYPE_NAME) })
  const authType = new ObjectType({ elemID: new ElemID(OKTA, AUTHENTICATOR_TYPE_NAME) })
  const auth1 = new InstanceElement('a', authType, { key: 'google_otp', status: 'ACTIVE' })
  const auth2 = new InstanceElement('b', authType, { key: 'security_question', status: 'ACTIVE' })
  const auth3 = new InstanceElement('c', authType, { key: 'okta_verify', status: 'ACTIVE' })
  const auth4 = new InstanceElement('d', authType, { key: 'phone_number', status: 'ACTIVE' })
  const MFA1 = new InstanceElement('mfa1', policyType, {
    name: 'policy',
    status: 'ACTIVE',
    system: false,
    type: 'MFA_POLICY',
    settings: {
      authenticators: [
        { key: new ReferenceExpression(auth1.elemID, auth1), enroll: { self: 'OPTIONAL' } },
        { key: new ReferenceExpression(auth2.elemID, auth2), enroll: { self: 'NOT_ALLOWED' }, extraField: 'field' },
        { key: new ReferenceExpression(auth3.elemID, auth3), enroll: { self: 'REQUIRED', something: 'some' } },
      ],
    },
  })
  const MFA2 = new InstanceElement('mfa2', policyType, {
    name: 'policy',
    status: 'ACTIVE',
    system: true,
    type: 'MFA_POLICY',
    settings: {
      authenticators: [
        { key: new ReferenceExpression(auth1.elemID, auth1), enroll: { self: 'REQUIRED' } },
        { key: new ReferenceExpression(auth2.elemID, auth2), enroll: { self: 'NOT_ALLOWED' } },
      ],
    },
  })
  const auth1After = auth1.clone()
  auth1After.value.status = 'INACTIVE'
  const auth2After = auth2.clone()
  auth2After.value.status = 'INACTIVE'
  const auth3After = auth3.clone()
  auth3After.value.status = 'INACTIVE'
  const elementSource = buildElementsSourceFromElements([policyType, authType, MFA1, MFA2, auth1, auth2, auth3, auth4])

  it('should return an error for enabled authenticators', async () => {
    const changeErrors = await enabledAuthenticatorsValidator(
      [
        toChange({ before: auth1, after: auth1After }),
        toChange({ before: auth2, after: auth2After }),
        toChange({ before: auth3, after: auth3After }),
      ],
      elementSource,
    )
    expect(changeErrors).toHaveLength(2)
    expect(changeErrors).toEqual([
      {
        elemID: auth1.elemID,
        severity: 'Error',
        message,
        detailedMessage:
          'This authenticator is enabled in the following MultifactorEnrollmentPolicy elements: mfa1, mfa2. Please disable the authenticator in these policies before deactivating it.',
      },
      {
        elemID: auth3.elemID,
        severity: 'Error',
        message,
        detailedMessage:
          'This authenticator is enabled in the following MultifactorEnrollmentPolicy elements: mfa1. Please disable the authenticator in these policies before deactivating it.',
      },
    ])
  })
  it('should not return an error if the authenticator is disabled in all policies', async () => {
    const auth4After = auth4.clone()
    auth4After.value.status = 'INACTIVE'
    const changeErrors = await enabledAuthenticatorsValidator(
      [toChange({ before: auth2, after: auth2After }), toChange({ before: auth4, after: auth4After })],
      elementSource,
    )
    expect(changeErrors).toHaveLength(0)
  })
  it('should do nothing if there are no MFA policies', async () => {
    const changeErrors = await enabledAuthenticatorsValidator(
      [toChange({ before: auth1, after: auth1After })],
      buildElementsSourceFromElements([policyType, authType, auth1, auth2, auth3, auth4]),
    )
    expect(changeErrors).toHaveLength(0)
  })
  it('should do nothing when element source is missing', async () => {
    const changeErrors = await enabledAuthenticatorsValidator(
      [toChange({ before: auth1, after: auth1After })],
      undefined,
    )
    expect(changeErrors).toHaveLength(0)
  })
})
