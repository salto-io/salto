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
import { SECTION_TRANSLATION_TYPE_NAME, ZENDESK } from '../../src/constants'
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
  const slaPolicyType = new ObjectType({ elemID: new ElemID(ZENDESK, 'sla_policy') })
  const triggerType = new ObjectType({ elemID: new ElemID(ZENDESK, 'trigger') })
  const workspaceType = new ObjectType({ elemID: new ElemID(ZENDESK, 'workspace') })
  const ticketFieldType = new ObjectType({ elemID: new ElemID(ZENDESK, 'ticket_field') })
  const routingAttributeValueType = new ObjectType({ elemID: new ElemID(ZENDESK, 'routing_attribute_value') })
  const userSegmentType = new ObjectType({ elemID: new ElemID(ZENDESK, 'user_segment') })
  const articleType = new ObjectType({ elemID: new ElemID(ZENDESK, 'article') })
  const sectionTranslationType = new ObjectType(
    { elemID: new ElemID(ZENDESK, SECTION_TRANSLATION_TYPE_NAME) }
  )

  const sectionTranslationInstance = new InstanceElement(
    'test',
    sectionTranslationType,
    {
      updated_by_id: 1,
      created_by_id: 2,
    }
  )

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

  const triggerInstance = new InstanceElement(
    'test',
    triggerType,
    {
      title: 'test',
      actions: [
        {
          field: 'status',
          value: 'closed',
        },
        {
          field: 'assignee_id',
          value: '1',
        },
        {
          field: 'follower',
          value: '2',
        },
        {
          field: 'notification_user',
          value: [
            '1',
            'test',
            'test',
          ],
        },
        {
          field: 'notification_sms_user',
          value: [
            '2',
            123,
            'test',
          ],
        },
      ],
      conditions: {
        all: [
          {
            field: 'assignee_id',
            operator: 'is',
            value: '3',
          },
          {
            field: 'status',
            operator: 'is',
            value: 'solved',
          },
          {
            field: 'requester_id',
            operator: 'is',
            value: '2',
          },
        ],
        any: [
          {
            field: 'assignee_id',
            operator: 'is',
            value: '1',
          },
          {
            field: 'requester_id',
            operator: 'is',
            value: '1',
          },
          {
            field: 'SOLVED',
            operator: 'greater_than',
            value: '96',
          },
        ],
      },
    },
  )
  const routingAttributeValueInstance = new InstanceElement(
    'test',
    routingAttributeValueType,
    {
      title: 'test',
      conditions: {
        all: [
          {
            subject: 'status',
            operator: 'is',
            value: 'solved',
          },
          {
            subject: 'requester_id',
            operator: 'is',
            value: '2',
          },
        ],
        any: [
          {
            subject: 'requester_id',
            operator: 'is',
            value: '1',
          },
          {
            subject: 'SOLVED',
            operator: 'greater_than',
            value: '96',
          },
        ],
      },
    },
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
  const slaPolicyInstance = new InstanceElement(
    'test',
    slaPolicyType,
    {
      title: 'test',
      filter: {
        all: [
          {
            field: 'assignee_id',
            operator: 'is',
            value: 3,
          },
          {
            field: 'requester_id',
            operator: 'is',
            value: 2,
          },
        ],
        any: [
          {
            field: 'assignee_id',
            operator: 'is',
            value: 1,
          },
          {
            field: 'requester_id',
            operator: 'is',
            value: 1,
          },
        ],
      },
      policy_metrics: [
        {
          priority: 'low',
          metric: 'first_reply_time',
          target: 480,
          business_hours: false,
        },
      ],
    },
  )
  const workspaceInstance = new InstanceElement(
    'test',
    workspaceType,
    {
      title: 'test',
      conditions: {
        all: [
          {
            field: 'assignee_id',
            operator: 'is',
            value: '2',
          },
        ],
        any: [
          {
            field: 'assignee_id',
            operator: 'is not',
            value: '2',
          },
        ],
      },
      selected_macros: [
        {
          id: 1234,
          title: 'test',
          active: true,
          usage_7d: 0,
          restriction: {
            type: 'User',
            id: 3,
          },
        },
      ],
    },
  )
  const ticketFieldInstance = new InstanceElement(
    'test',
    ticketFieldType,
    {
      type: 'bla',
      relationship_filter: {
        all: [
          {
            field: 'assignee_id',
            operator: 'is',
            value: '2',
          },
        ],
        any: [
          {
            field: 'requester_id',
            operator: 'is',
            value: '1',
          },
        ],
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
        macroType, slaPolicyType, triggerType, workspaceType, routingAttributeValueType,
        macroInstance, slaPolicyInstance, triggerInstance, workspaceInstance,
        routingAttributeValueInstance, userSegmentType, userSegmentInstance,
        articleType, articleInstance, sectionTranslationInstance, sectionTranslationType,
        ticketFieldInstance, ticketFieldType,
      ].map(e => e.clone())
      await filter.onFetch(elements)
      expect(elements.map(e => e.elemID.getFullName()).sort())
        .toEqual([
          'zendesk.article',
          'zendesk.article.instance.test',
          'zendesk.macro',
          'zendesk.macro.instance.test',
          'zendesk.routing_attribute_value',
          'zendesk.routing_attribute_value.instance.test',
          'zendesk.section_translation',
          'zendesk.section_translation.instance.test',
          'zendesk.sla_policy',
          'zendesk.sla_policy.instance.test',
          'zendesk.ticket_field',
          'zendesk.ticket_field.instance.test',
          'zendesk.trigger',
          'zendesk.trigger.instance.test',
          'zendesk.user_segment',
          'zendesk.user_segment.instance.test',
          'zendesk.workspace',
          'zendesk.workspace.instance.test',
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
      const sla = instances.find(e => e.elemID.typeName === 'sla_policy')
      expect(sla?.value).toEqual({
        title: 'test',
        filter: {
          all: [
            { field: 'assignee_id', operator: 'is', value: 'c@c.com' },
            { field: 'requester_id', operator: 'is', value: 'b@b.com' },
          ],
          any: [
            { field: 'assignee_id', operator: 'is', value: 'a@a.com' },
            { field: 'requester_id', operator: 'is', value: 'a@a.com' },
          ],
        },
        policy_metrics: [
          {
            priority: 'low',
            metric: 'first_reply_time',
            target: 480,
            business_hours: false,
          },
        ],
      })
      const trigger = instances.find(e => e.elemID.typeName === 'trigger')
      expect(trigger?.value).toEqual({
        title: 'test',
        actions: [
          { field: 'status', value: 'closed' },
          { field: 'assignee_id', value: 'a@a.com' },
          { field: 'follower', value: 'b@b.com' },
          { field: 'notification_user', value: ['a@a.com', 'test', 'test'] },
          { field: 'notification_sms_user', value: ['b@b.com', 123, 'test'] },
        ],
        conditions: {
          all: [
            { field: 'assignee_id', operator: 'is', value: 'c@c.com' },
            { field: 'status', operator: 'is', value: 'solved' },
            { field: 'requester_id', operator: 'is', value: 'b@b.com' },
          ],
          any: [
            { field: 'assignee_id', operator: 'is', value: 'a@a.com' },
            { field: 'requester_id', operator: 'is', value: 'a@a.com' },
            { field: 'SOLVED', operator: 'greater_than', value: '96' },
          ],
        },
      })
      const workspace = instances.find(e => e.elemID.typeName === 'workspace')
      expect(workspace?.value).toEqual({
        title: 'test',
        conditions: {
          all: [
            {
              field: 'assignee_id',
              operator: 'is',
              value: 'b@b.com',
            },
          ],
          any: [
            {
              field: 'assignee_id',
              operator: 'is not',
              value: 'b@b.com',
            },
          ],
        },
        selected_macros: [
          {
            id: 1234,
            title: 'test',
            active: true,
            usage_7d: 0,
            restriction: {
              type: 'User',
              id: 'c@c.com',
            },
          },
        ],
      })
      const ticketField = instances.find(e => e.elemID.typeName === 'ticket_field')
      expect(ticketField?.value).toEqual({
        type: 'bla',
        relationship_filter: {
          all: [
            {
              field: 'assignee_id',
              operator: 'is',
              value: 'b@b.com',
            },
          ],
          any: [
            {
              field: 'requester_id',
              operator: 'is',
              value: 'a@a.com',
            },
          ],
        },
      },)
      const routingAttributeValue = instances.find(e => e.elemID.typeName === 'routing_attribute_value')
      expect(routingAttributeValue?.value).toEqual({
        title: 'test',
        conditions: {
          all: [
            { subject: 'status', operator: 'is', value: 'solved' },
            { subject: 'requester_id', operator: 'is', value: 'b@b.com' },
          ],
          any: [
            { subject: 'requester_id', operator: 'is', value: 'a@a.com' },
            { subject: 'SOLVED', operator: 'greater_than', value: '96' },
          ],
        },
      })
      const sectionTranslation = instances
        .find(e => e.elemID.typeName === SECTION_TRANSLATION_TYPE_NAME)
      expect(sectionTranslation?.value).toEqual({
        updated_by_id: 'a@a.com',
        created_by_id: 'b@b.com',
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
    it('should not replace anything if the field is not exist', async () => {
      getUsersMock
        .mockResolvedValueOnce([
          { id: 1, email: 'a@a.com', role: 'admin', custom_role_id: 123 },
          { id: 2, email: 'b@b.com', role: 'admin', custom_role_id: 123 },
          { id: 3, email: 'c@c.com', role: 'admin', custom_role_id: 123 },
        ])
      const macroInstanceNoField = new InstanceElement(
        'test',
        macroType,
        {
          title: 'test',
          test1: [
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
          test2: {
            type: 'User',
            id: 3,
          },
        },
      )
      const userSegmentInstanceNoField = new InstanceElement(
        'test',
        userSegmentType,
        {
          title: 'test',
        },
      )
      const elements = [macroType.clone(), macroInstanceNoField.clone(),
        userSegmentType.clone(), userSegmentInstanceNoField.clone()]
      await filter.onFetch(elements)
      expect(elements.map(e => e.elemID.getFullName()).sort())
        .toEqual([
          'zendesk.macro',
          'zendesk.macro.instance.test',
          'zendesk.user_segment',
          'zendesk.user_segment.instance.test',
        ])
      const macro = elements.filter(isInstanceElement).find(e => e.elemID.typeName === 'macro')
      expect(macro?.value).toEqual({
        title: 'test',
        test1: [
          { field: 'status', value: 'closed' },
          { field: 'assignee_id', value: '2' },
          { field: 'follower', value: '1' },
        ],
        test2: { type: 'User', id: 3 },
      })
      const userSegment = elements.filter(isInstanceElement).find(e => e.elemID.typeName === 'user_segment')
      expect(userSegment?.value).toEqual({
        title: 'test',
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
      const instances = [
        macroInstance, slaPolicyInstance, triggerInstance, workspaceInstance, userSegmentInstance,
        articleInstance, sectionTranslationInstance, ticketFieldInstance,
      ].map(e => e.clone())
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
      const sla = changedInstances.find(e => e.elemID.typeName === 'sla_policy')
      expect(sla?.value).toEqual({
        title: 'test',
        filter: {
          all: [
            { field: 'assignee_id', operator: 'is', value: 3 },
            { field: 'requester_id', operator: 'is', value: 2 },
          ],
          any: [
            { field: 'assignee_id', operator: 'is', value: 1 },
            { field: 'requester_id', operator: 'is', value: 1 },
          ],
        },
        policy_metrics: [
          {
            priority: 'low',
            metric: 'first_reply_time',
            target: 480,
            business_hours: false,
          },
        ],
      })
      const trigger = instances.find(e => e.elemID.typeName === 'trigger')
      expect(trigger?.value).toEqual({
        title: 'test',
        actions: [
          { field: 'status', value: 'closed' },
          { field: 'assignee_id', value: '1' },
          { field: 'follower', value: '2' },
          { field: 'notification_user', value: ['1', 'test', 'test'] },
          { field: 'notification_sms_user', value: ['2', 123, 'test'] },
        ],
        conditions: {
          all: [
            { field: 'assignee_id', operator: 'is', value: '3' },
            { field: 'status', operator: 'is', value: 'solved' },
            { field: 'requester_id', operator: 'is', value: '2' },
          ],
          any: [
            { field: 'assignee_id', operator: 'is', value: '1' },
            { field: 'requester_id', operator: 'is', value: '1' },
            { field: 'SOLVED', operator: 'greater_than', value: '96' },
          ],
        },
      })
      const newWorkspace = instances.find(e => e.elemID.typeName === 'workspace')
      expect(newWorkspace?.value).toEqual({
        title: 'test',
        conditions: {
          all: [
            {
              field: 'assignee_id',
              operator: 'is',
              value: '2',
            },
          ],
          any: [
            {
              field: 'assignee_id',
              operator: 'is not',
              value: '2',
            },
          ],
        },
        selected_macros: [
          {
            id: 1234,
            title: 'test',
            active: true,
            usage_7d: 0,
            restriction: {
              type: 'User',
              id: '3',
            },
          },
        ],
      })
      const newTicketField = instances.find(e => e.elemID.typeName === 'ticket_field')
      expect(newTicketField?.value).toEqual({
        type: 'bla',
        relationship_filter: {
          all: [
            {
              field: 'assignee_id',
              operator: 'is',
              value: '2',
            },
          ],
          any: [
            {
              field: 'requester_id',
              operator: 'is',
              value: '1',
            },
          ],
        },
      })
      const sectionTranslation = instances
        .find(e => e.elemID.typeName === SECTION_TRANSLATION_TYPE_NAME)
      expect(sectionTranslation?.value).toEqual({
        updated_by_id: 1,
        created_by_id: 2,
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
      const instances = [
        macroInstance, slaPolicyInstance, triggerInstance, workspaceInstance, userSegmentInstance,
        articleInstance, sectionTranslationInstance, ticketFieldInstance,
      ].map(e => e.clone())
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
      const sla = changedInstances.find(inst => inst.elemID.typeName === 'sla_policy')
      expect(sla?.value).toEqual({
        title: 'test',
        filter: {
          all: [
            { field: 'assignee_id', operator: 'is', value: 'c@c.com' },
            { field: 'requester_id', operator: 'is', value: 'b@b.com' },
          ],
          any: [
            { field: 'assignee_id', operator: 'is', value: 'a@a.com' },
            { field: 'requester_id', operator: 'is', value: 'a@a.com' },
          ],
        },
        policy_metrics: [
          {
            priority: 'low',
            metric: 'first_reply_time',
            target: 480,
            business_hours: false,
          },
        ],
      })
      const trigger = changedInstances.find(inst => inst.elemID.typeName === 'trigger')
      expect(trigger?.value).toEqual({
        title: 'test',
        actions: [
          { field: 'status', value: 'closed' },
          { field: 'assignee_id', value: 'a@a.com' },
          { field: 'follower', value: 'b@b.com' },
          { field: 'notification_user', value: ['a@a.com', 'test', 'test'] },
          { field: 'notification_sms_user', value: ['b@b.com', 123, 'test'] },
        ],
        conditions: {
          all: [
            { field: 'assignee_id', operator: 'is', value: 'c@c.com' },
            { field: 'status', operator: 'is', value: 'solved' },
            { field: 'requester_id', operator: 'is', value: 'b@b.com' },
          ],
          any: [
            { field: 'assignee_id', operator: 'is', value: 'a@a.com' },
            { field: 'requester_id', operator: 'is', value: 'a@a.com' },
            { field: 'SOLVED', operator: 'greater_than', value: '96' },
          ],
        },
      })
      const workspace = changedInstances.find(e => e.elemID.typeName === 'workspace')
      expect(workspace?.value).toEqual({
        title: 'test',
        conditions: {
          all: [
            {
              field: 'assignee_id',
              operator: 'is',
              value: 'b@b.com',
            },
          ],
          any: [
            {
              field: 'assignee_id',
              operator: 'is not',
              value: 'b@b.com',
            },
          ],
        },
        selected_macros: [
          {
            id: 1234,
            title: 'test',
            active: true,
            usage_7d: 0,
            restriction: {
              type: 'User',
              id: 'c@c.com',
            },
          },
        ],
      })
      const ticketField = changedInstances.find(e => e.elemID.typeName === 'ticket_field')
      expect(ticketField?.value).toEqual({
        type: 'bla',
        relationship_filter: {
          all: [
            {
              field: 'assignee_id',
              operator: 'is',
              value: 'b@b.com',
            },
          ],
          any: [
            {
              field: 'requester_id',
              operator: 'is',
              value: 'a@a.com',
            },
          ],
        },
      },)
      const userSegment = instances.find(e => e.elemID.typeName === 'user_segment')
      expect(userSegment?.value).toEqual({
        title: 'test',
        added_user_ids: 'a@a.com',
      })
      const sectionTranslation = instances
        .find(e => e.elemID.typeName === SECTION_TRANSLATION_TYPE_NAME)
      expect(sectionTranslation?.value).toEqual({
        updated_by_id: 'a@a.com',
        created_by_id: 'b@b.com',
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
