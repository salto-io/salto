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
import { toChange, ObjectType, ElemID, InstanceElement } from '@salto-io/adapter-api'
import { DEFAULT_CONFIG } from '../../src/config'
import { usersValidator } from '../../src/change_validators/user'
import { OKTA, GROUP_RULE_TYPE_NAME, ACCESS_POLICY_RULE_TYPE_NAME } from '../../src/constants'
import OktaClient from '../../src/client/client'
import { OMIT_MISSING_USERS_CONFIGURATION_LINK } from '../../src/user_utils'

describe('usersValidator', () => {
  const client = new OktaClient({
    credentials: { baseUrl: 'a.okta.com', token: 'token' },
  })
  const mockGet = jest.spyOn(client, 'get')
  const ruleType = new ObjectType({ elemID: new ElemID(OKTA, GROUP_RULE_TYPE_NAME) })
  const accessRuleType = new ObjectType({ elemID: new ElemID(OKTA, ACCESS_POLICY_RULE_TYPE_NAME) })
  const policyInstance = new InstanceElement('somePolicy', accessRuleType, {
    name: 'policy',
    conditions: { people: { users: { exclude: ['a@a', 'e@e'], include: ['z@z'] } } },
  })
  const ruleInstance = new InstanceElement('groupRule', ruleType, {
    name: 'rule',
    conditions: { people: { users: { exclude: ['e@e', 'b@b'] } }, expression: { value: 'something' } },
  })
  const message = "Instance references users which don't exist in target environment"

  beforeEach(async () => {
    jest.clearAllMocks()
  })

  it('should return error when change include users that does not exist', async () => {
    mockGet.mockResolvedValue({
      status: 200,
      data: [
        { id: '1', profile: { login: 'a@a' } },
        { id: '2', profile: { login: 'b@b' } },
        { id: '3', profile: { login: 'c@c' } },
        { id: '4', profile: { login: 'd@d' } },
      ],
    })
    const changeValidator = usersValidator(client, DEFAULT_CONFIG)
    const changeErrors = await changeValidator([
      toChange({ before: policyInstance, after: policyInstance }),
      toChange({ after: ruleInstance }),
    ])
    expect(changeErrors).toHaveLength(2)
    expect(changeErrors).toEqual([
      {
        elemID: policyInstance.elemID,
        severity: 'Error',
        message,
        detailedMessage: `The following users are referenced by this instance, but do not exist in the target environment: e@e, z@z.\nIn order to deploy this instance, add these users to your target environment, edit this instance to use valid usernames or configure omitMissingUsers: ${OMIT_MISSING_USERS_CONFIGURATION_LINK}`,
      },
      {
        elemID: ruleInstance.elemID,
        severity: 'Error',
        message,
        detailedMessage: `The following users are referenced by this instance, but do not exist in the target environment: e@e.\nIn order to deploy this instance, add these users to your target environment, edit this instance to use valid usernames or configure omitMissingUsers: ${OMIT_MISSING_USERS_CONFIGURATION_LINK}`,
      },
    ])
  })
  it('should not return errors if all users in instance exists', async () => {
    mockGet.mockResolvedValue({
      status: 200,
      data: [
        { id: '1', profile: { login: 'a@a' } },
        { id: '2', profile: { login: 'b@b' } },
        { id: '3', profile: { login: 'c@c' } },
        { id: '4', profile: { login: 'd@d' } },
        { id: '5', profile: { login: 'e@e' } },
        { id: '6', profile: { login: 'z@z' } },
      ],
    })
    const changeValidator = usersValidator(client, DEFAULT_CONFIG)
    const changeErrors = await changeValidator([
      toChange({ before: policyInstance, after: policyInstance }),
      toChange({ after: ruleInstance }),
    ])
    expect(changeErrors).toHaveLength(0)
  })
  it('should do nothing if convertUsersIds config flag is disabled', async () => {
    const changeValidator = usersValidator(client, {
      ...DEFAULT_CONFIG,
      fetch: { include: [], exclude: [], convertUsersIds: false },
    })
    const changeErrors = await changeValidator([
      toChange({ before: policyInstance, after: policyInstance }),
      toChange({ after: ruleInstance }),
    ])
    expect(changeErrors).toHaveLength(0)
  })
  it('should not return error if users path does not exist', async () => {
    mockGet.mockResolvedValue({
      status: 200,
      data: [{ id: '1', profile: { login: 'a@a' } }],
    })
    const changeValidator = usersValidator(client, DEFAULT_CONFIG)
    const instance = new InstanceElement('no users', accessRuleType, {
      name: 'policy',
      conditions: { people: { groups: { include: ['groupId'] } } },
    })
    const changeErrors = await changeValidator([toChange({ after: instance })])
    expect(changeErrors).toEqual([])
  })
})
