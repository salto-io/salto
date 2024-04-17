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
import { TRIGGER_CATEGORY_TYPE_NAME, USER_SEGMENT_TYPE_NAME, ZENDESK } from '../../src/constants'
import { removeDupUsersHandler } from '../../src/fix_elements/remove_dup_users'
import { FixElementsArgs } from '../../src/fix_elements/types'

describe('removeDupUsersHandler', () => {
  let client: ZendeskClient
  const userSegmentType = new ObjectType({ elemID: new ElemID(ZENDESK, USER_SEGMENT_TYPE_NAME) })

  const userSegmentWithDuplicatesInstance = new InstanceElement('test', userSegmentType, {
    title: 'test',
    author_id: 'a@a.com',
    added_user_ids: ['hi@hi.com', 'bye@bye.com', 'hi@hi.com', 'a@a.com', 'hi@hi.com', 123, 456, 123],
  })
  const userSegmentInstance = new InstanceElement('test', userSegmentType, {
    title: 'test',
    author_id: 'a@a.com',
    added_user_ids: ['hi@hi.com', 'bye@bye.com', 'a@a.com'],
  })

  beforeEach(() => {
    jest.clearAllMocks()
    client = new ZendeskClient({
      credentials: { username: 'a', password: 'b', subdomain: 'ignore' },
    })
  })

  describe('UserSegment with duplicates is correctly handled', () => {
    let handlerResponse: { fixedElements: Element[]; errors: ChangeError[] }

    beforeEach(async () => {
      const instances = [userSegmentWithDuplicatesInstance].map(e => e.clone())
      handlerResponse = await removeDupUsersHandler({
        client,
        config: {},
      } as FixElementsArgs)(instances)
    })
    it('Duplicates are removed', () => {
      const handledUserSegment = userSegmentWithDuplicatesInstance.clone()
      handledUserSegment.value.added_user_ids = ['hi@hi.com', 'bye@bye.com', 'a@a.com', 123, 456]
      expect(handlerResponse.fixedElements).toEqual([handledUserSegment])
    })

    it('should create warning severity error', () => {
      expect(handlerResponse.errors).toEqual([
        {
          elemID: userSegmentWithDuplicatesInstance.elemID,
          message: 'Duplicate usernames in instance fields',
          severity: 'Warning',
          detailedMessage:
            'The following usernames appear multiple times: hi@hi.com, 123.\n' +
            'If you continue, the duplicate entries will be removed from the list.\n',
        },
      ])
    })
  })

  describe('UserSegment with no duplicates is not fixed', () => {
    let handlerResponse: { fixedElements: Element[]; errors: ChangeError[] }

    beforeEach(async () => {
      const instances = [userSegmentInstance].map(e => e.clone())
      handlerResponse = await removeDupUsersHandler({
        client,
        config: {},
      } as FixElementsArgs)(instances)
    })
    it('Leave the instance unfixed', () => {
      expect(handlerResponse.fixedElements).toEqual([])
    })

    it('does not replace types that do not need replacement', async () => {
      const triggerCategoryInstance = new InstanceElement(
        'triggerCategory',
        new ObjectType({ elemID: new ElemID(ZENDESK, TRIGGER_CATEGORY_TYPE_NAME) }),
        {},
      )
      const instances = [triggerCategoryInstance].map(e => e.clone())
      const emptyHandlerResponse = await removeDupUsersHandler({
        client,
        config: {},
      } as FixElementsArgs)(instances)
      expect(emptyHandlerResponse.fixedElements).toEqual([])
    })
  })
})
