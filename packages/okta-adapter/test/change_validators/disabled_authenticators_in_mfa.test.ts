/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
import { disabledAuthenticatorsInMfaPolicyValidator } from '../../src/change_validators/disabled_authenticators_in_mfa'
import { OKTA, MFA_POLICY_TYPE_NAME, AUTHENTICATOR_TYPE_NAME } from '../../src/constants'

describe('disabledAuthenticatorsInMfaPolicyValidator', () => {
  const message = 'Cannot use disabled authenticators in authenticator enrollment policy.'
  const policyType = new ObjectType({ elemID: new ElemID(OKTA, MFA_POLICY_TYPE_NAME) })
  const authType = new ObjectType({ elemID: new ElemID(OKTA, AUTHENTICATOR_TYPE_NAME) })
  const auth1 = new InstanceElement('a', authType, { key: 'google_otp', status: 'INACTIVE' }, undefined, {
    [CORE_ANNOTATIONS.ALIAS]: 'aa',
  })
  const auth2 = new InstanceElement('b', authType, { key: 'security_question', status: 'ACTIVE' })
  const MFA1 = new InstanceElement('mfa1', policyType, {
    name: 'policy',
    status: 'ACTIVE',
    system: false,
    type: 'MFA_POLICY',
    settings: {
      authenticators: [
        { key: new ReferenceExpression(auth1.elemID, auth1), enroll: { self: 'OPTIONAL' } },
        { key: new ReferenceExpression(auth2.elemID, auth2), enroll: { self: 'NOT_ALLOWED' }, extraField: 'field' },
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
  const elementSource = buildElementsSourceFromElements([policyType, authType, MFA1, MFA2, auth1, auth2])

  it('should return error when disabled authenticator is used in MFA policy', async () => {
    const changeErrors = await disabledAuthenticatorsInMfaPolicyValidator(
      [toChange({ after: MFA1 }), toChange({ before: MFA2, after: MFA2 })],
      elementSource,
    )
    expect(changeErrors).toHaveLength(2)
    expect(changeErrors).toEqual([
      {
        elemID: MFA1.elemID,
        severity: 'Error',
        message,
        detailedMessage:
          'The following authenticators are disabled and can not be used in the configured policy: aa. To continue with this deployment, enabled those authenticators.',
      },
      {
        elemID: MFA2.elemID,
        severity: 'Error',
        message,
        detailedMessage:
          'The following authenticators are disabled and can not be used in the configured policy: aa. To continue with this deployment, enabled those authenticators.',
      },
    ])
  })
  it('should not return error when all used authenticators are enabled', async () => {
    auth1.value.status = 'ACTIVE'
    const changeErrors = await disabledAuthenticatorsInMfaPolicyValidator(
      [toChange({ after: MFA1 }), toChange({ after: auth1 })],
      elementSource,
    )
    expect(changeErrors).toHaveLength(0)
  })
  it('should not return error on MFA removals even when using disabled authenticators', async () => {
    const changeErrors = await disabledAuthenticatorsInMfaPolicyValidator([toChange({ before: MFA1 })], elementSource)
    expect(changeErrors).toHaveLength(0)
  })
  it('should do nothing when element source is missing', async () => {
    const changeErrors = await disabledAuthenticatorsInMfaPolicyValidator([toChange({ after: MFA1 })], undefined)
    expect(changeErrors).toHaveLength(0)
  })
})
