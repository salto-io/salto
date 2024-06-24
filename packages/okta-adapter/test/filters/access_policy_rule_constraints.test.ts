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
import { ElemID, InstanceElement, ObjectType, toChange, getChangeData, isInstanceElement } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { applyFunctionToChangeData } from '@salto-io/adapter-utils'
import { getFilterParams } from '../utils'
import accessPolicyRuleConstraintsFilter from '../../src/filters/access_policy_rule_constraints'
import { ACCESS_POLICY_RULE_TYPE_NAME, OKTA } from '../../src/constants'

describe('accessPolicyRuleConstraintsFilter', () => {
  type FilterType = filterUtils.FilterWith<'preDeploy' | 'onDeploy'>
  let filter: FilterType
  const ruleType = new ObjectType({
    elemID: new ElemID(OKTA, ACCESS_POLICY_RULE_TYPE_NAME),
  })
  const baseRuleInstace = new InstanceElement('rule', ruleType, {
    name: 'rule',
    status: 'ACTIVE',
    actions: {
      appSignOn: {
        verificationMethod: {},
      },
    },
  })
  describe('preDeploy', () => {
    it('should remove "required" field from the constraints if it is true and "excludedAuthenticationMethods" is not configured (with additional properties)', async () => {
      const rule = baseRuleInstace.clone()
      rule.value.actions.appSignOn.verificationMethod.constraints = [
        {
          knowledge: { reauthenticateIn: 'PT0S', additionalProperties: { required: true } },
          possession: { deviceBound: 'REQUIRED', additionalProperties: { required: true } },
        },
        { possession: { additionalProperties: { required: true }, type: ['password'] } },
      ]
      const changes = [toChange({ after: rule })]
      filter = accessPolicyRuleConstraintsFilter(getFilterParams()) as typeof filter
      await filter.preDeploy(changes)
      const inst = changes.map(getChangeData).filter(isInstanceElement)
      expect(inst[0].value).toEqual({
        name: 'rule',
        status: 'ACTIVE',
        actions: {
          appSignOn: {
            verificationMethod: {
              constraints: [
                {
                  knowledge: { reauthenticateIn: 'PT0S', additionalProperties: {} },
                  possession: { deviceBound: 'REQUIRED', additionalProperties: {} },
                },
                { possession: { additionalProperties: {}, type: ['password'] } },
              ],
            },
          },
        },
      })
    })
    it('should remove "required" field from the constraints if it is true and "excludedAuthenticationMethods" is not configured', async () => {
      const rule = baseRuleInstace.clone()
      rule.value.actions.appSignOn.verificationMethod.constraints = [
        {
          knowledge: { reauthenticateIn: 'PT0S', required: true },
          possession: { deviceBound: 'REQUIRED', required: true },
        },
        { possession: { required: true, type: ['password'] } },
      ]
      const changes = [toChange({ after: rule })]
      filter = accessPolicyRuleConstraintsFilter(getFilterParams()) as typeof filter
      await filter.preDeploy(changes)
      const inst = changes.map(getChangeData).filter(isInstanceElement)
      expect(inst[0].value).toEqual({
        name: 'rule',
        status: 'ACTIVE',
        actions: {
          appSignOn: {
            verificationMethod: {
              constraints: [
                {
                  knowledge: { reauthenticateIn: 'PT0S' },
                  possession: { deviceBound: 'REQUIRED' },
                },
                { possession: { type: ['password'] } },
              ],
            },
          },
        },
      })
    })
    it('should not remove "required" field from the constraints if it is true but "excludedAuthenticationMethods" is configured', async () => {
      const rule = baseRuleInstace.clone()
      rule.value.actions.appSignOn.verificationMethod.constraints = [
        {
          knowledge: {
            reauthenticateIn: 'PT0S',
            additionalProperties: { required: true },
            excludedAuthenticationMethods: [],
          },
          possession: { deviceBound: 'REQUIRED', additionalProperties: { required: true } },
        },
        {
          possession: {
            additionalProperties: { required: true },
            type: ['password'],
            excludedAuthenticationMethods: [{ key: 'google_otp' }],
          },
        },
      ]
      const changes = [toChange({ after: rule })]
      filter = accessPolicyRuleConstraintsFilter(getFilterParams()) as typeof filter
      await filter.preDeploy(changes)
      const inst = changes.map(getChangeData).filter(isInstanceElement)
      expect(inst[0].value).toEqual({
        name: 'rule',
        status: 'ACTIVE',
        actions: {
          appSignOn: {
            verificationMethod: {
              constraints: [
                {
                  knowledge: {
                    reauthenticateIn: 'PT0S',
                    additionalProperties: { required: true },
                    excludedAuthenticationMethods: [],
                  },
                  possession: { deviceBound: 'REQUIRED', additionalProperties: {} },
                },
                {
                  possession: {
                    additionalProperties: { required: true },
                    type: ['password'],
                    excludedAuthenticationMethods: [{ key: 'google_otp' }],
                  },
                },
              ],
            },
          },
        },
      })
    })
    it('should not remove "required" field from the constraints if it is set to false (with additional properties)', async () => {
      const rule = baseRuleInstace.clone()
      rule.value.actions.appSignOn.verificationMethod.constraints = [
        {
          knowledge: { reauthenticateIn: 'PT0S', additionalProperties: { required: false } },
          possession: { deviceBound: 'REQUIRED', additionalProperties: { required: false } },
        },
      ]
      const changes = [toChange({ after: rule })]
      filter = accessPolicyRuleConstraintsFilter(getFilterParams()) as typeof filter
      await filter.preDeploy(changes)
      const inst = changes.map(getChangeData).filter(isInstanceElement)
      expect(inst[0].value).toEqual({
        name: 'rule',
        status: 'ACTIVE',
        actions: {
          appSignOn: {
            verificationMethod: {
              constraints: [
                {
                  knowledge: { reauthenticateIn: 'PT0S', additionalProperties: { required: false } },
                  possession: { deviceBound: 'REQUIRED', additionalProperties: { required: false } },
                },
              ],
            },
          },
        },
      })
    })
    it('should not remove "required" field from the constraints if it is set to false', async () => {
      const rule = baseRuleInstace.clone()
      rule.value.actions.appSignOn.verificationMethod.constraints = [
        {
          knowledge: { reauthenticateIn: 'PT0S', required: false },
          possession: { deviceBound: 'REQUIRED', required: false },
        },
      ]
      const changes = [toChange({ after: rule })]
      filter = accessPolicyRuleConstraintsFilter(getFilterParams()) as typeof filter
      await filter.preDeploy(changes)
      const inst = changes.map(getChangeData).filter(isInstanceElement)
      expect(inst[0].value).toEqual({
        name: 'rule',
        status: 'ACTIVE',
        actions: {
          appSignOn: {
            verificationMethod: {
              constraints: [
                {
                  knowledge: { reauthenticateIn: 'PT0S', required: false },
                  possession: { deviceBound: 'REQUIRED', required: false },
                },
              ],
            },
          },
        },
      })
    })
    it('should do nothing if "required" field is missing', async () => {
      const rule = baseRuleInstace.clone()
      rule.value.actions.appSignOn.verificationMethod.constraints = [
        { knowledge: { reauthenticateIn: 'PT0S' } },
        { possession: { deviceBound: 'REQUIRED' } },
      ]
      const changes = [toChange({ after: rule })]
      filter = accessPolicyRuleConstraintsFilter(getFilterParams()) as typeof filter
      await filter.preDeploy(changes)
      const inst = changes.map(getChangeData).filter(isInstanceElement)
      expect(inst[0].value).toEqual({
        name: 'rule',
        status: 'ACTIVE',
        actions: {
          appSignOn: {
            verificationMethod: {
              constraints: [{ knowledge: { reauthenticateIn: 'PT0S' } }, { possession: { deviceBound: 'REQUIRED' } }],
            },
          },
        },
      })
    })
  })

  describe('onDeploy', () => {
    it('should restore instance values (with additionalProperties)', async () => {
      const rule = baseRuleInstace.clone()
      rule.value.actions.appSignOn.verificationMethod.constraints = [
        {
          knowledge: { reauthenticateIn: 'PT0S', additionalProperties: { required: true } },
          possession: { deviceBound: 'REQUIRED', additionalProperties: { required: true } },
        },
        { possession: { additionalProperties: { required: true }, type: ['password'] } },
      ]
      const changes = [toChange({ after: rule })]
      await filter.preDeploy(changes) // pre deploy sets the mappings
      await Promise.all(
        changes.map(change => applyFunctionToChangeData(change, inst => _.set(inst, 'value.id', 'ruleId'))),
      ) // update ids by deployment
      await filter.onDeploy(changes)
      const instances = changes.map(getChangeData).filter(isInstanceElement)
      expect(instances[0].value).toEqual({
        ...rule.value,
        id: 'ruleId',
      })
    })
    it('should restore instance values', async () => {
      const rule = baseRuleInstace.clone()
      rule.value.actions.appSignOn.verificationMethod.constraints = [
        {
          knowledge: { reauthenticateIn: 'PT0S', required: true },
          possession: { deviceBound: 'REQUIRED', required: true },
        },
        { possession: { required: true, type: ['password'] } },
      ]
      const changes = [toChange({ after: rule })]
      await filter.preDeploy(changes) // pre deploy sets the mappings
      await Promise.all(
        changes.map(change => applyFunctionToChangeData(change, inst => _.set(inst, 'value.id', 'ruleId'))),
      ) // update ids by deployment
      await filter.onDeploy(changes)
      const instances = changes.map(getChangeData).filter(isInstanceElement)
      expect(instances[0].value).toEqual({
        ...rule.value,
        id: 'ruleId',
      })
    })
  })
})
