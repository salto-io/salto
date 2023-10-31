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

import { MockInterface } from '@salto-io/test-utils'
import { ElemID, InstanceElement, ObjectType, toChange, getChangeData, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { filterUtils, client as clientUtils } from '@salto-io/adapter-components'
import { getFilterParams, mockClient } from '../utils'
import OktaClient from '../../src/client/client'
import defaultPolicyRuleDeployment from '../../src/filters/default_rule_deployment'
import { ACCESS_POLICY_RULE_TYPE_NAME, OKTA, PROFILE_ENROLLMENT_RULE_TYPE_NAME } from '../../src/constants'

describe('defaultPolicyRuleDeployment', () => {
  let mockConnection: MockInterface<clientUtils.APIConnection>
  let client: OktaClient
  type FilterType = filterUtils.FilterWith<'deploy'>
  let filter: FilterType
  const accessRuleType = new ObjectType({ elemID: new ElemID(OKTA, ACCESS_POLICY_RULE_TYPE_NAME) })
  const enrollmentRuleType = new ObjectType({ elemID: new ElemID(OKTA, PROFILE_ENROLLMENT_RULE_TYPE_NAME) })
  const accessRuleInstance = new InstanceElement(
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
  const enrollmentRuleInstance = new InstanceElement(
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

  beforeEach(() => {
    jest.clearAllMocks()
    const { client: cli, connection } = mockClient()
    mockConnection = connection
    client = cli
    filter = defaultPolicyRuleDeployment(getFilterParams({ client })) as typeof filter
  })

  describe('deploy', () => {
    it('should successfully deploy changes as modification changes', async () => {
      mockConnection.get
        .mockResolvedValueOnce({
          status: 200,
          data: [{
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
          }],
        })
        .mockResolvedValueOnce({
          status: 200,
          data: [{
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
          }],
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
      const noParent = new InstanceElement(
        'accessPolicyNoParent',
        accessRuleType,
        accessRuleInstance.value,
      )
      const result = await filter.deploy([toChange({ after: noParent })])
      expect(result.deployResult.appliedChanges).toHaveLength(0)
      expect(result.deployResult.errors).toHaveLength(1)
      expect(result.deployResult.errors.map(e => e.message)).toEqual(['Could not find parent policy id for policy rule accessPolicyNoParent from type AccessPolicyRule'])
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
})
