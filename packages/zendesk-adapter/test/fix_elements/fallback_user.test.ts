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
import { ChangeError, ElemID, InstanceElement, ObjectType, Element } from '@salto-io/adapter-api'
import ZendeskClient from '../../src/client/client'
import {
  ARTICLE_TYPE_NAME,
  MACRO_TYPE_NAME,
  TRIGGER_CATEGORY_TYPE_NAME,
  TRIGGER_TYPE_NAME,
  ZENDESK,
} from '../../src/constants'
import { fallbackUsersHandler } from '../../src/fix_elements/fallback_user'
import * as userUtils from '../../src/user_utils'
import { DEPLOY_CONFIG, FETCH_CONFIG } from '../../src/config'
import { FixElementsArgs } from '../../src/fix_elements/types'

describe('fallbackUsersHandler', () => {
  let client: ZendeskClient
  const mockGetUsers = jest.spyOn(userUtils, 'getUsers')
  const macroType = new ObjectType({ elemID: new ElemID(ZENDESK, MACRO_TYPE_NAME) })
  const articleType = new ObjectType({ elemID: new ElemID(ZENDESK, ARTICLE_TYPE_NAME) })

  const articleInstance = new InstanceElement('test', articleType, {
    title: 'test',
    author_id: 'a@a.com',
  })
  const macroInstance = new InstanceElement('test', macroType, {
    title: 'test',
    actions: [
      { field: 'status', value: 'closed' },
      { field: 'assignee_id', value: 'a@a.com' },
      { field: 'follower', value: 3 },
    ],
    restriction: { type: 'User', id: 'c@c.com' },
  })

  const triggerInstance = new InstanceElement(
    'trigger',
    new ObjectType({ elemID: new ElemID(ZENDESK, TRIGGER_TYPE_NAME) }),
    {
      conditions: {
        all: [
          {
            field: 'lookup:ticket.ticket_field_11.custom_fields.33',
            operator: 'is',
            value: 'non',
            is_user_value: true,
          },
          {
            field: 'lookup:ticket.ticket_field_12.custom_fields.34',
            operator: 'is',
            value: 'should not change',
          },
        ],
      },
    },
  )

  beforeEach(() => {
    jest.clearAllMocks()
    mockGetUsers.mockResolvedValue({
      users: [
        { id: 3, email: 'c@c.com', role: 'admin', custom_role_id: 123, name: 'c', locale: 'en-US' },
        { id: 4, email: 'fallback@.com', role: 'agent', custom_role_id: 12, name: 'fallback', locale: 'en-US' },
      ],
    })

    client = new ZendeskClient({
      credentials: { username: 'a', password: 'b', subdomain: 'ignore' },
    })
  })

  describe('valid fallback user provided', () => {
    let fallbackResponse: { fixedElements: Element[]; errors: ChangeError[] }

    beforeEach(async () => {
      const instances = [macroInstance, articleInstance, triggerInstance].map(e => e.clone())
      fallbackResponse = await fallbackUsersHandler({
        client,
        config: {
          [DEPLOY_CONFIG]: { defaultMissingUserFallback: 'fallback@.com' },
          [FETCH_CONFIG]: { resolveUserIDs: true },
        },
      } as FixElementsArgs)(instances)
    })
    it('should replace missing user emails or ids', () => {
      const fallbackMacro = macroInstance.clone()
      fallbackMacro.value.actions[1].value = 'fallback@.com'
      fallbackMacro.value.actions[2].value = 'fallback@.com'
      const fallbackArticle = articleInstance.clone()
      fallbackArticle.value.author_id = 'fallback@.com'
      const fallbackTrigger = triggerInstance.clone()
      fallbackTrigger.value.conditions.all[0].value = 'fallback@.com'
      expect(fallbackResponse.fixedElements).toEqual([fallbackMacro, fallbackArticle, fallbackTrigger])
    })

    it('should create warning severity errors', () => {
      expect(fallbackResponse.errors).toEqual([
        {
          elemID: macroInstance.elemID,
          message: 'Usernames will be overridden',
          severity: 'Warning',
          detailedMessage:
            'The following users are referenced by this instance, but do not exist in the target environment: a@a.com, 3.\n' +
            "If you continue, they will be set to fallback@.com according to the environment's user fallback options.\n" +
            'Learn more: https://help.salto.io/en/articles/6955302-element-references-users-which-don-t-exist-in-target-environment-zendesk',
        },
        {
          elemID: articleInstance.elemID,
          message: 'Usernames will be overridden',
          severity: 'Warning',
          detailedMessage:
            'The following users are referenced by this instance, but do not exist in the target environment: a@a.com.\n' +
            "If you continue, they will be set to fallback@.com according to the environment's user fallback options.\n" +
            'Learn more: https://help.salto.io/en/articles/6955302-element-references-users-which-don-t-exist-in-target-environment-zendesk',
        },
        {
          elemID: triggerInstance.elemID,
          message: 'Usernames will be overridden',
          severity: 'Warning',
          detailedMessage:
            'The following users are referenced by this instance, but do not exist in the target environment: non.\n' +
            "If you continue, they will be set to fallback@.com according to the environment's user fallback options.\n" +
            'Learn more: https://help.salto.io/en/articles/6955302-element-references-users-which-don-t-exist-in-target-environment-zendesk',
        },
      ])
    })
  })

  describe('fallback user does not appear in service users', () => {
    let fallbackResponse: { fixedElements: Element[]; errors: ChangeError[] }

    beforeEach(async () => {
      const triggerCategoryInstance = new InstanceElement(
        // Test that we don't check in types that don't need replacement
        'triggerCategory',
        new ObjectType({ elemID: new ElemID(ZENDESK, TRIGGER_CATEGORY_TYPE_NAME) }),
        {},
      )
      const instances = [macroInstance, articleInstance, triggerCategoryInstance].map(e => e.clone())
      fallbackResponse = await fallbackUsersHandler({
        client,
        config: {
          [DEPLOY_CONFIG]: { defaultMissingUserFallback: 'non-existing-user@.com' },
          [FETCH_CONFIG]: { resolveUserIDs: true },
        },
      } as FixElementsArgs)(instances)
    })
    it('should not replace missing user emails or ids', () => {
      expect(fallbackResponse.fixedElements).toEqual([])
    })
    it('should create error severity errors', () => {
      expect(fallbackResponse.errors).toEqual([
        {
          elemID: macroInstance.elemID,
          severity: 'Error',
          message: "Instance references users which don't exist in target environment",
          detailedMessage:
            "The following users are referenced by this instance, but do not exist in the target environment: a@a.com, 3.\nIn addition, we could not get the defined fallback user non-existing-user@.com. In order to deploy this instance, add these users to your target environment, edit this instance to use valid usernames, or set the target environment's user fallback options.\nLearn more: https://help.salto.io/en/articles/6955302-element-references-users-which-don-t-exist-in-target-environment-zendesk",
        },
        {
          elemID: articleInstance.elemID,
          severity: 'Error',
          message: "Instance references users which don't exist in target environment",
          detailedMessage:
            "The following users are referenced by this instance, but do not exist in the target environment: a@a.com.\nIn addition, we could not get the defined fallback user non-existing-user@.com. In order to deploy this instance, add these users to your target environment, edit this instance to use valid usernames, or set the target environment's user fallback options.\nLearn more: https://help.salto.io/en/articles/6955302-element-references-users-which-don-t-exist-in-target-environment-zendesk",
        },
      ])
    })
  })

  describe('fallback user not provided', () => {
    it('should not replace missing users and should not report errors', async () => {
      const instances = [macroInstance, articleInstance].map(e => e.clone())
      const { fixedElements, errors } = await fallbackUsersHandler({
        client,
        config: {
          [DEPLOY_CONFIG]: { defaultMissingUserFallback: undefined },
          [FETCH_CONFIG]: { resolveUserIDs: true },
        },
      } as FixElementsArgs)(instances)
      expect(fixedElements).toEqual([])
      expect(errors).toEqual([])
    })
  })

  describe('resolveUserIDs is false and fallback is not deployer', () => {
    let fallbackResponse: { fixedElements: Element[]; errors: ChangeError[] }

    beforeEach(async () => {
      mockGetUsers.mockResolvedValue({ users: [], errors: [{ message: 'No users here!', severity: 'Warning' }] })
      const instances = [macroInstance, articleInstance].map(e => e.clone())
      fallbackResponse = await fallbackUsersHandler({
        client,
        config: {
          [DEPLOY_CONFIG]: { defaultMissingUserFallback: 'notDeployer@.com' },
          [FETCH_CONFIG]: { resolveUserIDs: false },
        },
      } as FixElementsArgs)(instances)
    })

    it('should not replace missing users and should not report errors', () => {
      expect(fallbackResponse.fixedElements).toEqual([])
      expect(fallbackResponse.errors).toEqual([])
    })
  })

  describe('resolveUserIDs is false and fallback is deployer', () => {
    let fallbackResponse: { fixedElements: Element[]; errors: ChangeError[] }

    beforeEach(async () => {
      mockGetUsers.mockResolvedValue({ users: [], errors: [{ message: 'No users here!', severity: 'Warning' }] })
      const instances = [macroInstance, articleInstance].map(e => e.clone())
      jest.spyOn(client, 'get').mockImplementation(({ url }) => {
        if (url === '/api/v2/users/me') {
          return Promise.resolve({
            data: { user: { id: 1, name: 'name', locale: 'l', email: 'deployer@.com' } },
            status: 202,
          })
        }
        return Promise.resolve({ data: {}, status: 202 })
      })
      fallbackResponse = await fallbackUsersHandler({
        client,
        config: {
          [DEPLOY_CONFIG]: { defaultMissingUserFallback: '##DEPLOYER##' },
          [FETCH_CONFIG]: { resolveUserIDs: false },
        },
      } as FixElementsArgs)(instances)
    })

    it('should replace all users as fallback', () => {
      const fallbackMacro = macroInstance.clone()
      fallbackMacro.value.actions[1].value = 'deployer@.com'
      fallbackMacro.value.actions[2].value = 'deployer@.com'
      fallbackMacro.value.restriction.id = 'deployer@.com'
      const fallbackArticle = articleInstance.clone()
      fallbackArticle.value.author_id = 'deployer@.com'

      expect(fallbackResponse.fixedElements).toEqual([fallbackMacro, fallbackArticle])
    })
  })

  it('does not replace types that do not need replacement', async () => {
    const triggerCategoryInstance = new InstanceElement(
      'triggerCategory',
      new ObjectType({ elemID: new ElemID(ZENDESK, TRIGGER_CATEGORY_TYPE_NAME) }),
      {},
    )
    const instances = [triggerCategoryInstance].map(e => e.clone())
    const fallbackResponse = await fallbackUsersHandler({
      client,
      config: {
        [DEPLOY_CONFIG]: { defaultMissingUserFallback: 'fallback@.com' },
        [FETCH_CONFIG]: { resolveUserIDs: true },
      },
    } as FixElementsArgs)(instances)
    expect(fallbackResponse.fixedElements).toEqual([])
  })
})
