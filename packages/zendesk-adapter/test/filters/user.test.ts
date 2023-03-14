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
import { getIdByEmail, getUsers } from '../../src/user_utils'
import { DEFAULT_CONFIG } from '../../src/config'

jest.mock('../../src/user_utils', () => ({
  ...jest.requireActual<{}>('../../src/user_utils'),
  getIdByEmail: jest.fn(),
  getUsers: jest.fn(),
}))

describe('user filter', () => {
  type FilterType = filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  let getIdByEmailMock: jest.MockedFunction<typeof getIdByEmail>
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
    getIdByEmailMock = getIdByEmail as jest.MockedFunction<typeof getIdByEmail>
    getUsersMock = getUsers as jest.MockedFunction<typeof getUsers>
  })

  describe('onFetch', () => {
    const filter = filterCreator(
      createFilterCreatorParams({ paginator: mockPaginator })
    ) as FilterType
    it('should change the user ids to emails', async () => {
      getIdByEmailMock
        .mockResolvedValueOnce({
          1: 'a@a.com',
          2: 'b@b.com',
          3: 'c@c.com',
        },)
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
      getIdByEmailMock
        .mockResolvedValueOnce(
          { 4: 'd@d.com' },
        )
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
      getIdByEmailMock.mockResolvedValueOnce({})
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
    let filter: FilterType

    beforeEach(async () => {
      jest.clearAllMocks()
      getUsersMock = getUsers as jest.MockedFunction<typeof getUsers>
    })
    it('should change the emails to user ids', async () => {
      filter = filterCreator(
        createFilterCreatorParams({ paginator: mockPaginator })
      ) as FilterType
      getUsersMock
        .mockResolvedValue([
          { id: 1, email: 'a@a.com', role: 'admin', custom_role_id: 123, name: 'a', locale: 'en-US' },
          { id: 2, email: 'b@b.com', role: 'admin', custom_role_id: 123, name: 'b', locale: 'en-US' },
          { id: 3, email: 'c@c.com', role: 'admin', custom_role_id: 123, name: 'c', locale: 'en-US' },
        ])
      getIdByEmailMock
        .mockResolvedValue({ 1: 'a@a.com',
          2: 'b@b.com',
          3: 'c@c.com' },)
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
    it('should replace missing user values with user from deploy config if provided', async () => {
      filter = filterCreator(createFilterCreatorParams({
        paginator: mockPaginator,
        config: {
          ...DEFAULT_CONFIG,
          deploy: { defaultMissingUserFallback: 'fallback@.com' },
        },
      })) as FilterType
      getUsersMock
        .mockResolvedValue([
          { id: 2, email: 'b@b.com', role: 'admin', custom_role_id: 123, name: 'b', locale: 'en-US' },
          { id: 3, email: 'c@c.com', role: 'admin', custom_role_id: 123, name: 'c', locale: 'en-US' },
          { id: 4, email: 'fallback@.com', role: 'agent', custom_role_id: 12, name: 'fallback', locale: 'en-US' },
        ])
      const instances2 = [macroInstance, articleInstance].map(e => e.clone())
      await filter.onFetch(instances2)
      const changes2 = instances2.map(instance => toChange({ after: instance }))
      await filter.preDeploy(changes2)
      const macro = instances2.find(inst => inst.elemID.typeName === 'macro')
      expect(macro?.value).toEqual({
        title: 'test',
        actions: [
          { field: 'status', value: 'closed' },
          { field: 'assignee_id', value: '2' },
          { field: 'follower', value: '4' },
        ],
        restriction: { type: 'User', id: '3' },
      })
      const article = instances2.find(e => e.elemID.typeName === 'article')
      expect(article?.value).toEqual({
        title: 'test',
        author_id: 4,
      })
    })
  })
  describe('onDeploy', () => {
    const filter = filterCreator(
      createFilterCreatorParams({ paginator: mockPaginator })
    ) as FilterType
    it('should change the user ids to emails', async () => {
      getUsersMock
        .mockResolvedValue([
          { id: 1, email: 'a@a.com', role: 'admin', custom_role_id: 123, name: 'a', locale: 'en-US' },
          { id: 2, email: 'b@b.com', role: 'admin', custom_role_id: 123, name: 'b', locale: 'en-US' },
          { id: 3, email: 'c@c.com', role: 'admin', custom_role_id: 123, name: 'c', locale: 'en-US' },
        ])
      getIdByEmailMock
        .mockResolvedValue({ 1: 'a@a.com',
          2: 'b@b.com',
          3: 'c@c.com' },)
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
      getIdByEmailMock.mockResolvedValueOnce({

      })
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
