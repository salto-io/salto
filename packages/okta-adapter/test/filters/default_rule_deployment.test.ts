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

import { MockInterface } from '@salto-io/test-utils'
import {
  ElemID,
  InstanceElement,
  ObjectType,
  toChange,
  getChangeData,
  CORE_ANNOTATIONS,
  isInstanceElement,
} from '@salto-io/adapter-api'
import { filterUtils, client as clientUtils } from '@salto-io/adapter-components'
import { createDefinitions, getFilterParams, mockClient } from '../utils'
import OktaClient from '../../src/client/client'
import defaultPolicyRuleDeployment from '../../src/filters/default_rule_deployment'
import {
  ACCESS_POLICY_RULE_TYPE_NAME,
  MFA_POLICY_TYPE_NAME,
  OKTA,
  PROFILE_ENROLLMENT_RULE_TYPE_NAME,
} from '../../src/constants'

describe('defaultPolicyRuleDeployment', () => {
  let mockConnection: MockInterface<clientUtils.APIConnection>
  let client: OktaClient
  type FilterType = filterUtils.FilterWith<'deploy' | 'preDeploy' | 'onDeploy'>
  let filter: FilterType
  const accessRuleType = new ObjectType({ elemID: new ElemID(OKTA, ACCESS_POLICY_RULE_TYPE_NAME) })
  const enrollmentRuleType = new ObjectType({ elemID: new ElemID(OKTA, PROFILE_ENROLLMENT_RULE_TYPE_NAME) })
  let accessRuleInstance: InstanceElement
  let enrollmentRuleInstance: InstanceElement
  beforeEach(() => {
    jest.clearAllMocks()
    const { client: cli, connection } = mockClient()
    mockConnection = connection
    client = cli
    const definitions = createDefinitions({ client })
    filter = defaultPolicyRuleDeployment(getFilterParams({ definitions })) as typeof filter
    accessRuleInstance = new InstanceElement(
      'accessPolicyRule',
      accessRuleType,
      {
        name: 'access',
        system: true,
        actions: {
          appSignOn: {
            access: 'ALLOW',
            verificationMethod: { factorMode: '1FA', type: 'ASSURANCE', reauthenticateIn: 'PT12H' },
          },
        },
        type: 'ACCESS_POLICY',
      },
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: [
          {
            id: '111',
          },
        ],
      },
    )
    enrollmentRuleInstance = new InstanceElement(
      'profileEnrollmentRule',
      enrollmentRuleType,
      {
        name: 'profile enrollment',
        system: true,
        actions: {
          profileEnrollment: {
            access: 'ALLOW',
            targetGroupIds: ['123'],
          },
        },
      },
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: [
          {
            id: '222',
          },
        ],
      },
    )
  })

  describe('deploy', () => {
    it('should successfully deploy changes as modification changes', async () => {
      mockConnection.get
        .mockResolvedValueOnce({
          status: 200,
          data: [
            {
              id: 'accessId',
              name: 'access',
              system: true,
              actions: {
                appSignOn: {
                  access: 'DENY',
                  verificationMethod: { factorMode: '1FA', type: 'ASSURANCE', reauthenticateIn: 'PT12H' },
                },
              },
              type: 'ACCESS_POLICY',
              createdBy: 'aaa',
            },
          ],
        })
        .mockResolvedValueOnce({
          status: 200,
          data: [
            {
              id: 'enrollmentId',
              name: 'profile enrollment',
              system: true,
              actions: {
                profileEnrollment: {
                  access: 'ALLOW',
                  targetGroupIds: ['123'],
                },
              },
              createdBy: 'bbb',
            },
          ],
        })
      const changes = [toChange({ after: accessRuleInstance }), toChange({ after: enrollmentRuleInstance })]
      const result = await filter.deploy(changes)
      const { appliedChanges } = result.deployResult
      expect(appliedChanges).toHaveLength(2)
      const instances = appliedChanges.map(change => getChangeData(change)) as InstanceElement[]
      expect(instances[0].value).toEqual({
        // validate id assigned to value
        id: 'accessId',
        name: 'access',
        system: true,
        actions: {
          appSignOn: {
            access: 'ALLOW',
            verificationMethod: { factorMode: '1FA', type: 'ASSURANCE', reauthenticateIn: 'PT12H' },
          },
        },
        type: 'ACCESS_POLICY',
      })
      expect(instances[1].value).toEqual({
        // validate id assigned to value
        id: 'enrollmentId',
        name: 'profile enrollment',
        system: true,
        actions: {
          profileEnrollment: {
            access: 'ALLOW',
            targetGroupIds: ['123'],
          },
        },
      })
      expect(mockConnection.get).toHaveBeenCalledWith('/api/v1/policies/111/rules', undefined)
      expect(mockConnection.get).toHaveBeenCalledWith('/api/v1/policies/222/rules', undefined)
    })

    it('should return error if there is no parent policy', async () => {
      const noParent = new InstanceElement('accessPolicyNoParent', accessRuleType, accessRuleInstance.value)
      const result = await filter.deploy([toChange({ after: noParent })])
      expect(result.deployResult.appliedChanges).toHaveLength(0)
      expect(result.deployResult.errors).toHaveLength(1)
      expect(result.deployResult.errors.map(e => e.message)).toEqual([
        'Could not find parent policy id for policy rule accessPolicyNoParent from type AccessPolicyRule',
      ])
    })

    it('should return error when policy rules request fails', async () => {
      mockConnection.get.mockRejectedValue({ status: 404, data: { errorSummary: 'resource not found' } })
      const result = await filter.deploy([toChange({ after: accessRuleInstance })])
      expect(result.deployResult.appliedChanges).toHaveLength(0)
      expect(mockConnection.get).toHaveBeenCalledWith('/api/v1/policies/111/rules', undefined)
      expect(result.deployResult.errors).toHaveLength(1)
      expect(result.deployResult.errors[0].message).toContain('Failed to get /api/v1/policies/111/rules')
    })
  })
  describe('preDeploy', () => {
    it('should assign priority field to addition changes of type ProfileEnrollmentPolicyRule or AccessPolicyRule', async () => {
      const changes = [toChange({ after: accessRuleInstance }), toChange({ after: enrollmentRuleInstance })]
      await filter.preDeploy(changes)
      const instances = changes.map(getChangeData).filter(isInstanceElement)
      expect(instances[0].value.priority).toEqual(99)
      expect(instances[1].value.priority).toEqual(99)
    })
    it('should add priority field for modifications', async () => {
      const accessRuleInstanceAfter = accessRuleInstance.clone()
      accessRuleInstanceAfter.value.actions.appSignOn.access = 'DENY'
      const enrollmentRuleInstanceAfter = enrollmentRuleInstance.clone()
      enrollmentRuleInstanceAfter.value.actions.profileEnrollment.access = 'DENY'
      const changes = [
        toChange({ before: accessRuleInstance, after: accessRuleInstanceAfter.clone() }),
        toChange({ before: enrollmentRuleInstance, after: enrollmentRuleInstanceAfter.clone() }),
      ]
      await filter.preDeploy(changes)
      const instances = changes.map(getChangeData).filter(isInstanceElement)
      expect(instances[0].value.priority).toEqual(99)
      expect(instances[1].value.priority).toEqual(99)
    })
    describe('MultifactorEnrollmentPolicy', () => {
      const MultifactorEnrollmentPolicyType = new ObjectType({ elemID: new ElemID(OKTA, MFA_POLICY_TYPE_NAME) })
      const MultifactorEnrollmentPolicyInstnace = new InstanceElement('mfaInstance', MultifactorEnrollmentPolicyType, {
        id: '1',
        name: 'mfaInstance',
        system: false,
      })
      const defaultMultifactorEnrollmentPolicyInstance = new InstanceElement(
        'defaultMfaInstance',
        MultifactorEnrollmentPolicyType,
        {
          id: '3',
          name: 'defaultMfaInstance',
          system: true,
        },
      )
      beforeEach(() => {
        mockConnection.get.mockResolvedValueOnce({
          status: 200,
          data: {
            priority: 1,
          },
        })
      })
      it('should assign priority field to modification changes of type MultifactorEnrollmentPolicy', async () => {
        const defaultMultifactorEnrollmentPolicyInstanceAfter = defaultMultifactorEnrollmentPolicyInstance.clone()
        defaultMultifactorEnrollmentPolicyInstanceAfter.value.name = 'defaultMfaInstanceAfter'
        const changes = [
          toChange({
            before: defaultMultifactorEnrollmentPolicyInstance,
            after: defaultMultifactorEnrollmentPolicyInstanceAfter.clone(),
          }),
        ]
        await filter.preDeploy(changes)
        const instances = changes.map(getChangeData).filter(isInstanceElement)
        expect(instances[0].value.priority).toEqual(1)
      })
      it('should not assign priority field to addition changes of type MultifactorEnrollmentPolicy', async () => {
        const changes = [toChange({ after: MultifactorEnrollmentPolicyInstnace })]
        await filter.preDeploy(changes)
        const instances = changes.map(getChangeData).filter(isInstanceElement)
        expect(instances[0].value.priority).toBeUndefined()
      })
      it('should not assign priority field to modification changes of type MultifactorEnrollmentPolicy if system is false', async () => {
        const defaultMultifactorEnrollmentPolicyInstanceAfter = defaultMultifactorEnrollmentPolicyInstance.clone()
        defaultMultifactorEnrollmentPolicyInstanceAfter.value.system = false
        const changes = [
          toChange({
            before: defaultMultifactorEnrollmentPolicyInstance,
            after: defaultMultifactorEnrollmentPolicyInstanceAfter.clone(),
          }),
        ]
        await filter.preDeploy(changes)
        const instances = changes.map(getChangeData).filter(isInstanceElement)
        expect(instances[0].value.priority).toBeUndefined()
      })
    })
  })
  describe('onDeploy', () => {
    it('should remove priority field from rules of type ProfileEnrollmentPolicyRule or AccessPolicyRule', async () => {
      const accessRuleInstanceWithPriority = accessRuleInstance.clone()
      accessRuleInstanceWithPriority.value.priority = 99
      const enrollmentRuleInstanceWithPriority = enrollmentRuleInstance.clone()
      enrollmentRuleInstanceWithPriority.value.priority = 99
      const changes = [
        toChange({ after: accessRuleInstanceWithPriority }),
        toChange({ after: enrollmentRuleInstanceWithPriority }),
      ]
      await filter.onDeploy(changes)
      const instances = changes.map(getChangeData).filter(isInstanceElement)
      expect(instances[0].value.priority).toBeUndefined()
      expect(instances[1].value.priority).toBeUndefined()
    })
  })
})
