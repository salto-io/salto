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
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { ZENDESK, CUSTOM_ROLE_TYPE_NAME } from '../../src/constants'
import { customRoleRemovalValidator } from '../../src/change_validators/custom_role_removal'
import ZendeskClient from '../../src/client/client'

describe('customRoleRemovalValidator', () => {
  let client: ZendeskClient
  let mockGet: jest.SpyInstance
  const customRoleType = new ObjectType({
    elemID: new ElemID(ZENDESK, CUSTOM_ROLE_TYPE_NAME),
  })
  const customRole1 = new InstanceElement(
    'New Test',
    customRoleType,
    { name: 'test', id: '123' },
  )
  const customRole2 = new InstanceElement(
    'New Test2',
    customRoleType,
    { name: 'test2', id: '234' },
  )
  const customRole3 = new InstanceElement(
    'New Test3',
    customRoleType,
    { name: 'test3', id: '121' },
  )

  beforeAll(async () => {
    client = new ZendeskClient({
      credentials: { username: 'a', password: 'b', subdomain: 'ignore' },
    })
    mockGet = jest.spyOn(client, 'getSinglePage')
    mockGet.mockImplementation(() => (
      {
        status: 200,
        data: {
          users: [
            { id: 1, email: '1@1', role: 'agent', custom_role_id: 123, name: '1', locale: 'en-US' },
            { id: 2, email: '2@2', role: 'agent', custom_role_id: 234, name: '2', locale: 'en-US' },
            { id: 3, email: '3@3', role: 'admin', custom_role_id: 234, name: '2', locale: 'en-US' },
            { id: 4, email: '4@4', role: 'agent', name: '2', locale: 'en-US' },
            { id: 5, email: '5@5', role: 'agent', custom_role_id: 123, name: '2', locale: 'en-US' },
          ],
        },
      }
    ))
  })

  it('should return an error if the custom role is deleted and it has associated agents', async () => {
    const changes = [toChange({ before: customRole1 }), toChange({ before: customRole2 })]
    const changeValidator = customRoleRemovalValidator(client)
    const errors = await changeValidator(changes)
    expect(errors).toHaveLength(2)
    expect(errors).toEqual([
      {
        elemID: customRole1.elemID,
        severity: 'Error',
        message: 'Cannot remove a custom role with associated agents',
        detailedMessage: '2 agents are associated with this role (partial list): [1@1, 5@5].\nPlease disconnect the agents from the role in the Zendesk UI before deploying this change.',
      },
      {
        elemID: customRole2.elemID,
        severity: 'Error',
        message: 'Cannot remove a custom role with associated agents',
        detailedMessage: '1 agents are associated with this role (partial list): [2@2].\nPlease disconnect the agents from the role in the Zendesk UI before deploying this change.',
      },
    ])
  })
  it('should not return an error if custom role is deleted but it has no associated agents', async () => {
    const changes = [toChange({ before: customRole3 })]
    const changeValidator = customRoleRemovalValidator(client)
    const errors = await changeValidator(changes)
    expect(errors).toHaveLength(0)
  })
})
