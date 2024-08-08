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
import _ from 'lodash'
import { MFA_POLICY_TYPE_NAME } from '../../../../src/constants'
import { createMfaFactorsAdjustFunc } from '../../../../src/definitions/fetch/types/mfa_policy'

describe('createMfaFactorsAdjustFunc', () => {
  const identityEngineMfa = {
    id: '111',
    name: 'test',
    settings: {
      type: 'AUTHENTICATORS',
      authenticators: [
        {
          key: 'okta_otp',
          enroll: { self: 'OPTIONAL' },
        },
        {
          key: 'password',
          enroll: { self: 'REQUIRED' },
        },
      ],
    },
  }
  const classicEngineMfa = {
    id: '111',
    name: 'test',
    settings: {
      factors: {
        okta_otp: {
          enroll: { self: 'OPTIONAL' },
        },
        password: {
          enroll: { self: 'REQUIRED' },
        },
      },
    },
  }
  it('should do nothing if org is classic engine', async () => {
    const func = createMfaFactorsAdjustFunc({ isClassicEngine: true })
    const result = await func({ typeName: MFA_POLICY_TYPE_NAME, value: _.cloneDeep(classicEngineMfa), context: {} })
    expect(result.value).toEqual(classicEngineMfa)
  })
  it('should convert MFA policy structure when okta is identity engine but the MFA format contains "factors"', async () => {
    const func = createMfaFactorsAdjustFunc({ isClassicEngine: false })
    const result = await func({ typeName: MFA_POLICY_TYPE_NAME, value: _.cloneDeep(classicEngineMfa), context: {} })
    expect(result.value).toEqual(identityEngineMfa)
  })
  it('should do nothing when the MFA policy structure is already in the correct format', async () => {
    const func = createMfaFactorsAdjustFunc({ isClassicEngine: false })
    const result = await func({ typeName: MFA_POLICY_TYPE_NAME, value: _.cloneDeep(identityEngineMfa), context: {} })
    expect(result.value).toEqual(identityEngineMfa)
  })
})
