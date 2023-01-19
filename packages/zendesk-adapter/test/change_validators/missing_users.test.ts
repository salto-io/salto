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
import { ZENDESK, ARTICLE_TYPE_NAME } from '../../src/constants'
import { missingUsersValidator } from '../../src/change_validators/missing_users'
import ZendeskClient from '../../src/client/client'

describe('missingUsersValidator', () => {
  let client: ZendeskClient
  let mockGet: jest.SpyInstance
  const articleType = new ObjectType({
    elemID: new ElemID(ZENDESK, ARTICLE_TYPE_NAME),
  })
  const macroType = new ObjectType({
    elemID: new ElemID(ZENDESK, 'macro'),
  })
  const articleInstance = new InstanceElement(
    'article',
    articleType,
    { author_id: 'article@salto.com', draft: false },
  )
  const macroInstance = new InstanceElement(
    'macro',
    macroType,
    {
      actions: [
        {
          field: 'assignee_id',
          value: 'thisuserismissing@salto.com',
        },
        {
          field: 'requester_id',
          value: '1@1',
        },
      ],
      restriction: {
        type: 'User',
        id: 'thisuserismissing2@salto.com',
      },
    },
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
            { id: 1, email: '1@1', role: 'agent', custom_role_id: 123 },
            { id: 2, email: '2@2', role: 'agent', custom_role_id: 234 },
            { id: 3, email: '3@3', role: 'admin', custom_role_id: 234 },
            { id: 4, email: '4@4', role: 'agent' },
            { id: 5, email: '5@5', role: 'agent', custom_role_id: 123 },
          ],
        },
      }
    ))
  })

  it('should return a warning if user in user field does not exist', async () => {
    const changes = [toChange({ after: articleInstance }), toChange({ after: macroInstance })]
    const changeValidator = missingUsersValidator(client)
    const errors = await changeValidator(changes)
    expect(errors).toHaveLength(2)
    expect(errors).toEqual([
      {
        elemID: articleInstance.elemID,
        severity: 'Warning',
        message: 'Can not change instance with user emails of users that does not exist in the target environment',
        detailedMessage: `${articleInstance.elemID.typeName} ${articleInstance.elemID.name} includes references to users that does not exist in the target environment (partial list limited to 10): article@salto.com.\nPlease manually edit the element and set existing user emails or add users with this emails to the target environment.`,
      },
      {
        elemID: macroInstance.elemID,
        severity: 'Warning',
        message: 'Can not change instance with user emails of users that does not exist in the target environment',
        detailedMessage: `${macroInstance.elemID.typeName} ${macroInstance.elemID.name} includes references to users that does not exist in the target environment (partial list limited to 10): thisuserismissing@salto.com, thisuserismissing2@salto.com.\nPlease manually edit the element and set existing user emails or add users with this emails to the target environment.`,
      },
    ])
  })
  it('should not return a warning if user exists', async () => {
    const articleWithValidUser = new InstanceElement(
      'article',
      articleType,
      { author_id: '1@1', draft: false },
    )
    const changes = [toChange({ after: articleWithValidUser })]
    const changeValidator = missingUsersValidator(client)
    const errors = await changeValidator(changes)
    expect(errors).toHaveLength(0)
  })
  it('should not return a warning if user field value is valid', async () => {
    const macroWithValidUserFields = new InstanceElement(
      'macro',
      macroType,
      {
        actions: [
          {
            field: 'assignee_id',
            value: 'current_user',
          },
          {
            field: 'requester_id',
            value: 'requester_id',
          },
        ],
      },
    )
    const changes = [toChange({ after: macroWithValidUserFields })]
    const changeValidator = missingUsersValidator(client)
    const errors = await changeValidator(changes)
    expect(errors).toHaveLength(0)
  })
})
