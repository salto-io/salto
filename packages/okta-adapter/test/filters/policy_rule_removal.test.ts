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
import policyRuleRemoval from '../../src/filters/policy_rule_removal'
import { ACCESS_POLICY_RULE_TYPE_NAME, OKTA, PROFILE_ENROLLMENT_RULE_TYPE_NAME } from '../../src/constants'

describe('policyRuleRemoval', () => {
  let mockConnection: MockInterface<clientUtils.APIConnection>
  let client: OktaClient
  type FilterType = filterUtils.FilterWith<'deploy'>
  let filter: FilterType
  const accessRuleType = new ObjectType({ elemID: new ElemID(OKTA, ACCESS_POLICY_RULE_TYPE_NAME) })
  const enrollmentRuleType = new ObjectType({ elemID: new ElemID(OKTA, PROFILE_ENROLLMENT_RULE_TYPE_NAME) })
  const accessRuleInstance = new InstanceElement(
    'accessPolicyRule',
    accessRuleType,
    { id: '123', name: 'access', system: true, type: 'ACCESS_POLICY' },
    undefined,
    {
      [CORE_ANNOTATIONS.PARENT]: [
        { id: '111' },
      ],
    },
  )
  const enrollmentRuleInstance = new InstanceElement(
    'profileEnrollmentRule',
    enrollmentRuleType,
    { id: '234', name: 'profile enrollment', system: false, type: 'PROFILE_ENROLLMENT' },
    undefined,
    {
      [CORE_ANNOTATIONS.PARENT]: [
        { id: '222' },
      ],
    },
  )

  beforeEach(() => {
    jest.clearAllMocks()
    const { client: cli, connection } = mockClient()
    mockConnection = connection
    client = cli
    filter = policyRuleRemoval(getFilterParams({ client })) as typeof filter
  })

  describe('deploy', () => {
    it('should mark changes as deployed successfully if policy rules were removed already', async () => {
      const error = new clientUtils.HTTPError(
        'error',
        {
          status: 404,
          data: {
            errorSummary: 'Not found: Resource not found: 123 (RuleSetEntity)',
            errorCauses: [],
          },
        }
      )
      mockConnection.delete
        .mockRejectedValue(error)
      const changes = [toChange({ before: accessRuleInstance }), toChange({ before: enrollmentRuleInstance })]
      const result = await filter.deploy(changes)
      const { appliedChanges, errors } = result.deployResult
      expect(appliedChanges).toHaveLength(2)
      expect(errors).toHaveLength(0)
      const instances = appliedChanges.map(change => getChangeData(change)) as InstanceElement[]
      expect(instances[0].value).toEqual({
        id: '123',
        name: 'access',
        system: true,
        type: 'ACCESS_POLICY',
      })
      expect(instances[1].value).toEqual({
        id: '234',
        name: 'profile enrollment',
        system: false,
        type: 'PROFILE_ENROLLMENT',
      })
    })

    it('should throw if policy rules removals were not deployed due to another reason', async () => {
      const error = new clientUtils.HTTPError(
        'error',
        {
          status: 400,
          data: {
            errorSummary: 'cannot remove rule for some reason',
            errorCauses: [
              { errorSummary: 'reason 1' }, { errorSummary: 'reason 2' },
            ],
          },
        }
      )
      mockConnection.delete
        .mockRejectedValue(error)
      const result = await filter.deploy([toChange({ before: accessRuleInstance })])
      expect(result.deployResult.appliedChanges).toHaveLength(0)
      expect(result.deployResult.errors).toHaveLength(1)
      expect(result.deployResult.errors.map(e => e.message)).toEqual(['cannot remove rule for some reason. More info: reason 1,reason 2 (status code: 400)'])
    })

    it('should return changes if policy rule removal succeeded', async () => {
      mockConnection.delete.mockResolvedValue({ status: 200, data: '' })
      const result = await filter.deploy([toChange({ before: enrollmentRuleInstance })])
      const { appliedChanges, errors } = result.deployResult
      expect(appliedChanges).toHaveLength(1)
      expect((getChangeData(appliedChanges[0]) as InstanceElement).value).toEqual(
        { id: '234', name: 'profile enrollment', system: false, type: 'PROFILE_ENROLLMENT' }
      )
      expect(errors).toHaveLength(0)
    })
  })
})
