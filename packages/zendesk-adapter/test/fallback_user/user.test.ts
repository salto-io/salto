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
import { ChangeError, ElemID, InstanceElement, ObjectType, Element } from '@salto-io/adapter-api'
import ZendeskClient from '../../src/client/client'
import { ZENDESK } from '../../src/constants'
import { usersHandler } from '../../src/fallback_user/user'
import * as userUtils from '../../src/user_utils'

describe('missingUsersToFallback', () => {
  let client: ZendeskClient
  const macroType = new ObjectType({ elemID: new ElemID(ZENDESK, 'macro') })
  const articleType = new ObjectType({ elemID: new ElemID(ZENDESK, 'article') })

  const articleInstance = new InstanceElement(
    'test',
    articleType,
    {
      title: 'test',
      author_id: 'a@a.com',
    }
  )
  const macroInstance = new InstanceElement(
    'test',
    macroType,
    {
      title: 'test',
      actions: [
        { field: 'status', value: 'closed' },
        { field: 'assignee_id', value: 'a@a.com' },
        { field: 'follower', value: 3 },
      ],
      restriction: { type: 'User', id: 'c@c.com' },
    },
  )

  beforeEach(() => {
    jest.clearAllMocks()
    const getUsersMock = jest.spyOn(userUtils, 'getUsers')
    getUsersMock.mockResolvedValue([
      { id: 3, email: 'c@c.com', role: 'admin', custom_role_id: 123, name: 'c', locale: 'en-US' },
      { id: 4, email: 'fallback@.com', role: 'agent', custom_role_id: 12, name: 'fallback', locale: 'en-US' },
    ])

    client = new ZendeskClient({
      credentials: { username: 'a', password: 'b', subdomain: 'ignore' },
    })
  })

  describe('valid fallback user provided', () => {
    let fallbackResponse: {fixedElements: Element[]; errors: ChangeError[]}

    beforeEach(async () => {
      const instances = [macroInstance, articleInstance].map(e => e.clone())
      fallbackResponse = await usersHandler.missingUsersToFallback(
        client,
        { defaultMissingUserFallback: 'fallback@.com' },
      )(instances)
    })
    it('should replace missing user emails or ids', () => {
      const fallbackMacro = macroInstance.clone()
      fallbackMacro.value.actions[1].value = 'fallback@.com'
      fallbackMacro.value.actions[2].value = 'fallback@.com'
      const fallbackArticle = articleInstance.clone()
      fallbackArticle.value.author_id = 'fallback@.com'
      expect(fallbackResponse.fixedElements).toEqual([
        fallbackMacro,
        fallbackArticle,
      ])
    })
    it('should create warning severity errors', () => {
      expect(fallbackResponse.errors).toEqual([
        {
          elemID: macroInstance.elemID,
          message: '2 usernames will be overridden to fallback@.com',
          severity: 'Warning',
          detailedMessage: 'The following users are referenced by this instance, but do not exist in the target environment: a@a.com, 3.\n'
          + "If you continue, they will be set to fallback@.com according to the environment's user fallback options.\n"
          + 'Learn more: https://help.salto.io/en/articles/6955302-element-references-users-which-don-t-exist-in-target-environment-zendesk',
        },
        {
          elemID: articleInstance.elemID,
          message: '1 usernames will be overridden to fallback@.com',
          severity: 'Warning',
          detailedMessage: 'The following users are referenced by this instance, but do not exist in the target environment: a@a.com.\n'
          + "If you continue, they will be set to fallback@.com according to the environment's user fallback options.\n"
          + 'Learn more: https://help.salto.io/en/articles/6955302-element-references-users-which-don-t-exist-in-target-environment-zendesk',
        }])
    })
  })

  describe('fallback user does not appear in service users', () => {
    let fallbackResponse: {fixedElements: Element[]; errors: ChangeError[]}

    beforeEach(async () => {
      const instances = [macroInstance, articleInstance].map(e => e.clone())
      fallbackResponse = await usersHandler.missingUsersToFallback(
        client,
        { defaultMissingUserFallback: 'non-existing-user@.com' },
      )(instances)
    })
    it('should not replace missing user emails or ids', () => {
      expect(fallbackResponse.fixedElements).toEqual([])
    })
    it('should create error severity errors', () => {
      expect(fallbackResponse.errors).toEqual([
        {
          elemID: macroInstance.elemID,
          severity: 'Error',
          message: 'Instance references users which don\'t exist in target environment',
          detailedMessage: 'The following users are referenced by this instance, but do not exist in the target environment: a@a.com, 3.\nIn addition, we could not get the defined fallback user non-existing-user@.com. In order to deploy this instance, add these users to your target environment, edit this instance to use valid usernames, or set the target environment\'s user fallback options.\nLearn more: https://help.salto.io/en/articles/6955302-element-references-users-which-don-t-exist-in-target-environment-zendesk',
        },
        {
          elemID: articleInstance.elemID,
          severity: 'Error',
          message: 'Instance references users which don\'t exist in target environment',
          detailedMessage: 'The following users are referenced by this instance, but do not exist in the target environment: a@a.com.\nIn addition, we could not get the defined fallback user non-existing-user@.com. In order to deploy this instance, add these users to your target environment, edit this instance to use valid usernames, or set the target environment\'s user fallback options.\nLearn more: https://help.salto.io/en/articles/6955302-element-references-users-which-don-t-exist-in-target-environment-zendesk',
        }])
    })
  })

  describe('fallback user not provided', () => {
    it('should not replace missing users and should not report errors', async () => {
      const instances = [macroInstance, articleInstance].map(e => e.clone())
      const { fixedElements, errors } = await usersHandler.missingUsersToFallback(
        client,
        { defaultMissingUserFallback: undefined },
      )(instances)
      const fallbackMacro = macroInstance.clone()
      fallbackMacro.value.actions[1].value = 'fallback@.com'
      fallbackMacro.value.actions[2].value = 'fallback@.com'
      const fallbackArticle = articleInstance.clone()
      fallbackArticle.value.author_id = 'fallback@.com'
      expect(fixedElements).toEqual([])
      expect(errors).toEqual([])
    })
  })
})
