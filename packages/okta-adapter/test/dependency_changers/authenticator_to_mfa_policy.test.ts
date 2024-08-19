/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import {
  ObjectType,
  ElemID,
  InstanceElement,
  toChange,
  DependencyChange,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { OKTA, AUTHENTICATOR_TYPE_NAME, MFA_POLICY_TYPE_NAME } from '../../src/constants'
import { addAuthenticatorToMfaPolicyDependency } from '../../src/dependency_changers/authenticator_to_mfa_policy'

describe('addAuthenticatorToMfaPolicyDependency', () => {
  let dependencyChanges: DependencyChange[]
  const authenticatorType = new ObjectType({ elemID: new ElemID(OKTA, AUTHENTICATOR_TYPE_NAME) })
  const mfaPolicyType = new ObjectType({ elemID: new ElemID(OKTA, MFA_POLICY_TYPE_NAME) })

  const authenticator1 = new InstanceElement('authenticator1', authenticatorType, {
    id: '1',
    label: 'authenticator1',
    status: 'INACTIVE',
  })
  const authenticator2 = new InstanceElement('authenticator2', authenticatorType, {
    id: '2',
    label: 'authenticator2',
    status: 'ACTIVE',
  })
  const mfaPolicy = new InstanceElement('mfaPolicy', mfaPolicyType, {
    id: 'ab',
    priority: 1,
    settings: {
      type: 'AUTHENTICATOR',
      authenticators: [
        { key: new ReferenceExpression(authenticator1.elemID, authenticator1), enroll: { self: 'OPTIONAL' } },
      ],
    },
  })
  it('should add dependency from MultifactorEnrollmentPolicy addition to its used Authenticator modification changes', async () => {
    const inputChanges = new Map([
      ['mfaPolicy', toChange({ after: mfaPolicy })],
      ['authenticator1', toChange({ before: authenticator1, after: authenticator1 })],
      ['authenticator2', toChange({ before: authenticator2, after: authenticator2 })],
    ])
    dependencyChanges = [...(await addAuthenticatorToMfaPolicyDependency(inputChanges, new Map()))]
    expect(dependencyChanges).toHaveLength(1)
    expect(dependencyChanges[0].action).toEqual('add')
    expect(dependencyChanges[0].dependency.source).toEqual('mfaPolicy')
    expect(dependencyChanges[0].dependency.target).toEqual('authenticator1')
  })

  it('should add dependency from MultifactorEnrollmentPolicy modification to its used Authenticator modification changes', async () => {
    const beforeMfa = new InstanceElement('mfaPolicy', mfaPolicyType, {
      id: 'ab',
      priority: 1,
      settings: {
        type: 'AUTHENTICATOR',
        authenticators: [
          { key: new ReferenceExpression(authenticator1.elemID, authenticator1), enroll: { self: 'OPTIONAL' } },
          // this authenticator is removed from the policy, so no dependency should be added
          { key: new ReferenceExpression(authenticator2.elemID, authenticator2), enroll: { self: 'REQUIRED' } },
        ],
      },
    })
    const inputChanges = new Map([
      ['mfaPolicy', toChange({ before: beforeMfa, after: mfaPolicy })],
      ['authenticator1', toChange({ before: authenticator1, after: authenticator1 })],
      ['authenticator2', toChange({ before: authenticator2, after: authenticator2 })],
    ])
    dependencyChanges = [...(await addAuthenticatorToMfaPolicyDependency(inputChanges, new Map()))]
    expect(dependencyChanges).toHaveLength(1)
    expect(dependencyChanges[0].action).toEqual('add')
    expect(dependencyChanges[0].dependency.source).toEqual('mfaPolicy')
    expect(dependencyChanges[0].dependency.target).toEqual('authenticator1')
  })

  it('should not add dependency from MultifactorEnrollmentPolicy to Authenticator that is not in used by the policy', async () => {
    const inputChanges = new Map([
      ['mfaPolicy', toChange({ after: mfaPolicy })],
      ['authenticator2', toChange({ before: authenticator2, after: authenticator2 })],
    ])
    dependencyChanges = [...(await addAuthenticatorToMfaPolicyDependency(inputChanges, new Map()))]
    expect(dependencyChanges).toHaveLength(0)
  })
})
