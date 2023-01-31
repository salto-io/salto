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
import { ObjectType, ElemID, InstanceElement, isInstanceElement, toChange, getChangeData } from '@salto-io/adapter-api'
import { client as clientUtils, filterUtils } from '@salto-io/adapter-components'
import { mockFunction } from '@salto-io/test-utils'
import { ZENDESK } from '../../src/constants'
import filterCreator from '../../src/filters/user'
import { createFilterCreatorParams } from '../utils'
import { getUsers } from '../../src/user_utils'

jest.mock('../../src/user_utils', () => ({
  ...jest.requireActual<{}>('../../src/user_utils'),
  getUsers: jest.fn(),
}))

describe('user filter', () => {
  type FilterType = filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  let filter: FilterType
  let getUsersMock: jest.MockedFunction<typeof getUsers>
  const macroType = new ObjectType({ elemID: new ElemID(ZENDESK, 'macro') })
  const userSegmentType = new ObjectType({ elemID: new ElemID(ZENDESK, 'user_segment') })
  const articleType = new ObjectType({ elemID: new ElemID(ZENDESK, 'article') })

  const userSegmentInstance = new InstanceElement(
    'test',
    userSegmentType,
    {
      title: 'test',
      added_user_ids: 1,
    }
  )

  const articleInstance = new InstanceElement(
    'test',
    articleType,
    {
      title: 'test',
      author_id: 1,
    }
  )
  const macroInstance = new InstanceElement(
    'test',
    macroType,
    {
      title: 'test',
      actions: [
        {
          field: 'status',
          value: 'closed',
        },
        {
          field: 'assignee_id',
          value: '2',
        },
        {
          field: 'follower',
          value: '1',
        },
      ],
      restriction: {
        type: 'User',
        id: 3,
      },
    },
  )
  let mockPaginator: clientUtils.Paginator

  beforeEach(async () => {
    jest.clearAllMocks()
    getUsersMock = getUsers as jest.MockedFunction<typeof getUsers>
    filter = filterCreator(
      createFilterCreatorParams({ paginator: mockPaginator })
    ) as FilterType
  })

  describe('onFetch', () => {
    it('should change the user ids to emails', async () => {
      getUsersMock
        .mockResolvedValueOnce([
          { id: 1, email: 'a@a.com', role: 'admin', custom_role_id: 123 },
          { id: 2, email: 'b@b.com', role: 'admin', custom_role_id: 123 },
          { id: 3, email: 'c@c.com', role: 'admin', custom_role_id: 123 },
        ])
      const elements = [
        macroType, macroInstance, userSegmentType, userSegmentInstance,
        articleType, articleInstance,
      ].map(e => e.clone())
      await filter.onFetch(elements)
      expect(elements.map(e => e.elemID.getFullName()).sort())
        .toEqual([
          'zendesk.article',
          'zendesk.article.instance.test',
          'zendesk.macro',
          'zendesk.macro.instance.test',
          'zendesk.user_segment',
          'zendesk.user_segment.instance.test',
        ])
      const instances = elements.filter(isInstanceElement)
      const macro = instances.find(e => e.elemID.typeName === 'macro')
      expect(macro?.value).toEqual({
        title: 'test',
        actions: [
          { field: 'status', value: 'closed' },
          { field: 'assignee_id', value: 'b@b.com' },
          { field: 'follower', value: 'a@a.com' },
        ],
        restriction: { type: 'User', id: 'c@c.com' },
      })
      const userSegment = instances.find(e => e.elemID.typeName === 'user_segment')
      expect(userSegment?.value).toEqual({
        title: 'test',
        added_user_ids: 'a@a.com',
      })
      const article = instances.find(e => e.elemID.typeName === 'article')
      expect(article?.value).toEqual({
        title: 'test',
        author_id: 'a@a.com',
      })
    })
    it('should not replace anything if the user does not exist', async () => {
      const elements = [macroType.clone(), macroInstance.clone(),
        userSegmentType.clone(), userSegmentInstance.clone()]
      getUsersMock
        .mockResolvedValueOnce([
          { id: 4, email: 'd@d.com', role: 'admin', custom_role_id: 123 },
        ])
      const paginator = mockFunction<clientUtils.Paginator>()
      const newFilter = filterCreator(
        createFilterCreatorParams({ paginator })
      ) as FilterType
      await newFilter.onFetch(elements)
      expect(elements.map(e => e.elemID.getFullName()).sort())
        .toEqual([
          'zendesk.macro',
          'zendesk.macro.instance.test',
          'zendesk.user_segment',
          'zendesk.user_segment.instance.test',
        ])
      const instances = elements.filter(isInstanceElement)
      const macro = instances.find(e => e.elemID.typeName === 'macro')
      expect(macro?.value).toEqual({
        title: 'test',
        actions: [
          { field: 'status', value: 'closed' },
          { field: 'assignee_id', value: '2' },
          { field: 'follower', value: '1' },
        ],
        restriction: { type: 'User', id: 3 },
      })
      const userSegment = instances.find(e => e.elemID.typeName === 'user_segment')
      expect(userSegment?.value).toEqual({
        title: 'test',
        added_user_ids: 1,
      })
    })
    it('should not replace anything if the users response is invalid', async () => {
      const elements = [macroType.clone(), macroInstance.clone()]
      getUsersMock.mockResolvedValueOnce([])
      const paginator = mockFunction<clientUtils.Paginator>()
      const newFilter = filterCreator(
        createFilterCreatorParams({ paginator })
      ) as FilterType
      await newFilter.onFetch(elements)
      const instances = elements.filter(isInstanceElement)
      const macro = instances.find(e => e.elemID.typeName === 'macro')
      expect(macro?.value).toEqual({
        title: 'test',
        actions: [
          { field: 'status', value: 'closed' },
          { field: 'assignee_id', value: '2' },
          { field: 'follower', value: '1' },
        ],
        restriction: { type: 'User', id: 3 },
      })
    })
  })
  describe('preDeploy', () => {
    it('should change the emails to user ids', async () => {
      getUsersMock
        .mockResolvedValue([
          { id: 1, email: 'a@a.com', role: 'admin', custom_role_id: 123 },
          { id: 2, email: 'b@b.com', role: 'admin', custom_role_id: 123 },
          { id: 3, email: 'c@c.com', role: 'admin', custom_role_id: 123 },
        ])
      const instances = [macroInstance, userSegmentInstance, articleInstance].map(e => e.clone())
      await filter.onFetch(instances)
      const changes = instances.map(instance => toChange({ after: instance }))
      await filter.preDeploy(changes)
      const changedInstances = changes.map(getChangeData)
      const macro = changedInstances.find(inst => inst.elemID.typeName === 'macro')
      expect(macro?.value).toEqual({
        title: 'test',
        actions: [
          { field: 'status', value: 'closed' },
          { field: 'assignee_id', value: '2' },
          { field: 'follower', value: '1' },
        ],
        restriction: { type: 'User', id: '3' },
      })
      const userSegment = instances.find(e => e.elemID.typeName === 'user_segment')
      expect(userSegment?.value).toEqual({
        title: 'test',
        added_user_ids: 1,
      })
      const article = instances.find(e => e.elemID.typeName === 'article')
      expect(article?.value).toEqual({
        title: 'test',
        author_id: 1,
      })
    })
  })
  describe('onDeploy', () => {
    it('should change the user ids to emails', async () => {
      getUsersMock
        .mockResolvedValueOnce([
          { id: 1, email: 'a@a.com', role: 'admin', custom_role_id: 123 },
          { id: 2, email: 'b@b.com', role: 'admin', custom_role_id: 123 },
          { id: 3, email: 'c@c.com', role: 'admin', custom_role_id: 123 },
        ])
      const instances = [macroInstance, userSegmentInstance, articleInstance].map(e => e.clone())
      const changes = instances.map(instance => toChange({ after: instance }))
      // We call preDeploy here because it sets the mappings
      await filter.preDeploy(changes)
      await filter.onDeploy(changes)
      const changedInstances = changes.map(getChangeData)
      const macro = changedInstances.find(inst => inst.elemID.typeName === 'macro')
      expect(macro?.value).toEqual({
        title: 'test',
        actions: [
          { field: 'status', value: 'closed' },
          { field: 'assignee_id', value: 'b@b.com' },
          { field: 'follower', value: 'a@a.com' },
        ],
        restriction: { type: 'User', id: 'c@c.com' },
      })
      const userSegment = instances.find(e => e.elemID.typeName === 'user_segment')
      expect(userSegment?.value).toEqual({
        title: 'test',
        added_user_ids: 'a@a.com',
      })
      const article = instances.find(e => e.elemID.typeName === 'article')
      expect(article?.value).toEqual({
        title: 'test',
        author_id: 'a@a.com',
      })
    })
    it('should not replace anything if the users response is invalid', async () => {
      const instances = [macroInstance.clone()]
      const paginator = mockFunction<clientUtils.Paginator>()
      getUsersMock.mockResolvedValueOnce([])
      const newFilter = filterCreator(
        createFilterCreatorParams({ paginator })
      ) as FilterType
      const changes = instances.map(instance => toChange({ after: instance }))
      // We call preDeploy here because it sets the mappings
      await newFilter.preDeploy(changes)
      await newFilter.onDeploy(changes)
      const changedInstances = changes.map(getChangeData)
      const macro = changedInstances.find(e => e.elemID.typeName === 'macro')
      expect(macro?.value).toEqual({
        title: 'test',
        actions: [
          { field: 'status', value: 'closed' },
          { field: 'assignee_id', value: '2' },
          { field: 'follower', value: '1' },
        ],
        restriction: { type: 'User', id: 3 },
      })
    })
  })
})
