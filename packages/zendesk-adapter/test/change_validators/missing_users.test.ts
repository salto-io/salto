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
import { ZedneskDeployConfig } from '../../src/config'

describe('missingUsersValidator', () => {
  let client: ZendeskClient
  let mockGet: jest.SpyInstance
  let deployConfig: ZedneskDeployConfig
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
    deployConfig = {}
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

  it('should return errors if users are missing and there is no deploy config', async () => {
    const changes = [toChange({ after: articleInstance }), toChange({ after: macroInstance })]
    const changeValidator = missingUsersValidator(client)
    const errors = await changeValidator(changes)
    expect(errors).toHaveLength(2)
    expect(errors).toEqual([
      {
        elemID: articleInstance.elemID,
        severity: 'Error',
        message: 'Element references users which don\'t exist in target environment',
        detailedMessage: 'The following users are referenced by this element, but do not exist in the target environment: article@salto.com.\nIn order to deploy this element, add these users to your target environment, edit this element to use valid usernames, or set the target environment\'s user fallback options. Learn more: https://docs.salto.io/docs/username-not-found-in-target-environment',
      },
      {
        elemID: macroInstance.elemID,
        severity: 'Error',
        message: 'Element references users which don\'t exist in target environment',
        detailedMessage: 'The following users are referenced by this element, but do not exist in the target environment: thisuserismissing@salto.com, thisuserismissing2@salto.com.\nIn order to deploy this element, add these users to your target environment, edit this element to use valid usernames, or set the target environment\'s user fallback options. Learn more: https://docs.salto.io/docs/username-not-found-in-target-environment',
      },
    ])
  })
  it('should return warning in case of overriding missing users with user from deploy config', async () => {
    const changes = [toChange({ after: articleInstance }), toChange({ after: macroInstance })]
    deployConfig = { defaultMissingUserFallback: '4@4' }
    const changeValidator = missingUsersValidator(client, deployConfig)
    const errors = await changeValidator(changes)
    expect(errors).toHaveLength(2)
    expect(errors).toEqual([
      {
        elemID: articleInstance.elemID,
        severity: 'Warning',
        message: '1 usernames will be overridden to 4@4',
        detailedMessage: 'The following users are referenced by this element, but do not exist in the target environment: article@salto.com.\nIf you continue, they will be set to 4@4 according to the environment\'s user fallback options. Learn more: https://docs.salto.io/docs/username-not-found-in-target-environment',
      },
      {
        elemID: macroInstance.elemID,
        severity: 'Warning',
        message: '2 usernames will be overridden to 4@4',
        detailedMessage: 'The following users are referenced by this element, but do not exist in the target environment: thisuserismissing@salto.com, thisuserismissing2@salto.com.\nIf you continue, they will be set to 4@4 according to the environment\'s user fallback options. Learn more: https://docs.salto.io/docs/username-not-found-in-target-environment',
      },
    ])
  })
  it('should return error in case of user provided in deploy config does not exist', async () => {
    const changes = [toChange({ after: articleInstance }), toChange({ after: macroInstance })]
    deployConfig = { defaultMissingUserFallback: '9@9' }
    const changeValidator = missingUsersValidator(client, deployConfig)
    const errors = await changeValidator(changes)
    expect(errors).toHaveLength(2)
    expect(errors).toEqual([
      {
        elemID: articleInstance.elemID,
        severity: 'Error',
        message: 'Element references users which don\'t exist in target environment',
        detailedMessage: 'The following users are referenced by this element, but do not exist in the target environment: article@salto.com.\nIn addition, the defined fallback user 9@9 was not found in the target environment. In order to deploy this element, add these users to your target environment, edit this element to use valid usernames, or set the target environment\'s user fallback options. Learn more: https://docs.salto.io/docs/username-not-found-in-target-environment',
      },
      {
        elemID: macroInstance.elemID,
        severity: 'Error',
        message: 'Element references users which don\'t exist in target environment',
        detailedMessage: 'The following users are referenced by this element, but do not exist in the target environment: thisuserismissing@salto.com, thisuserismissing2@salto.com.\nIn addition, the defined fallback user 9@9 was not found in the target environment. In order to deploy this element, add these users to your target environment, edit this element to use valid usernames, or set the target environment\'s user fallback options. Learn more: https://docs.salto.io/docs/username-not-found-in-target-environment',
      },
    ])
  })
  it('should not return an error if user exists', async () => {
    const articleWithValidUser = new InstanceElement(
      'article',
      articleType,
      { author_id: '1@1', draft: false },
    )
    const changes = [toChange({ after: articleWithValidUser })]
    const changeValidator = missingUsersValidator(client, deployConfig)
    const errors = await changeValidator(changes)
    expect(errors).toHaveLength(0)
  })
  it('should not return an error if user values are valid', async () => {
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
    const triggerInstance = new InstanceElement(
      'trigger',
      new ObjectType({ elemID: new ElemID(ZENDESK, 'trigger') }),
      {
        conditions: {
          all: [
            {
              field: 'assignee_id',
              operator: 'is',
              value: '',
            },
            {
              field: 'role',
              operator: 'is',
              value: 'end_user',
            },
          ],
        },
      }
    )
    const changes = [toChange({ after: macroWithValidUserFields }), toChange({ after: triggerInstance })]
    const changeValidator = missingUsersValidator(client, deployConfig)
    const errors = await changeValidator(changes)
    expect(errors).toHaveLength(0)
  })
})
