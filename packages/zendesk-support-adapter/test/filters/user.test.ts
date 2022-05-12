/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { client as clientUtils, filterUtils, elements as elementUtils } from '@salto-io/adapter-components'
import { mockFunction } from '@salto-io/test-utils'
import { DEFAULT_CONFIG } from '../../src/config'
import ZendeskClient from '../../src/client/client'
import { ZENDESK_SUPPORT } from '../../src/constants'
import filterCreator from '../../src/filters/user'

describe('user filter', () => {
  let client: ZendeskClient
  type FilterType = filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  let filter: FilterType
  const macroType = new ObjectType({ elemID: new ElemID(ZENDESK_SUPPORT, 'macro') })
  const slaPolicyType = new ObjectType({ elemID: new ElemID(ZENDESK_SUPPORT, 'sla_policy') })
  const triggerType = new ObjectType({ elemID: new ElemID(ZENDESK_SUPPORT, 'trigger') })
  const workspaceType = new ObjectType({ elemID: new ElemID(ZENDESK_SUPPORT, 'workspace') })
  const routingAttributeValueType = new ObjectType({ elemID: new ElemID(ZENDESK_SUPPORT, 'routing_attribute_value') })

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
  let mockPaginator: clientUtils.Paginator

  beforeEach(async () => {
    jest.clearAllMocks()
    client = new ZendeskClient({
      credentials: { username: 'a', password: 'b', subdomain: 'ignore' },
    })
    mockPaginator = mockFunction<clientUtils.Paginator>()
      .mockImplementationOnce(async function *get() {
        yield [
          { users: [
            { id: 1, email: 'a@a.com' },
            { id: 2, email: 'b@b.com' },
          ] },
          { users: [
            { id: 3, email: 'c@c.com' },
          ] },
        ]
      })
    filter = filterCreator({
      client,
      paginator: mockPaginator,
      config: DEFAULT_CONFIG,
      fetchQuery: elementUtils.query.createMockQuery(),
    }) as FilterType
  })

  describe('onFetch', () => {
    it('should change the user ids to emails', async () => {
      const elements = [
        macroType, slaPolicyType, triggerType, workspaceType, routingAttributeValueType,
        macroInstance, slaPolicyInstance, triggerInstance, workspaceInstance,
        routingAttributeValueInstance,
      ].map(e => e.clone())
      await filter.onFetch(elements)
      expect(elements.map(e => e.elemID.getFullName()).sort())
        .toEqual([
          'zendesk_support.macro',
          'zendesk_support.macro.instance.test',
          'zendesk_support.routing_attribute_value',
          'zendesk_support.routing_attribute_value.instance.test',
          'zendesk_support.sla_policy',
          'zendesk_support.sla_policy.instance.test',
          'zendesk_support.trigger',
          'zendesk_support.trigger.instance.test',
          'zendesk_support.workspace',
          'zendesk_support.workspace.instance.test',
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
    })
    it('should not replace anything if the field is not exist', async () => {
      const instance = new InstanceElement(
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
      const elements = [macroType.clone(), instance.clone()]
      await filter.onFetch(elements)
      expect(elements.map(e => e.elemID.getFullName()).sort())
        .toEqual([
          'zendesk_support.macro',
          'zendesk_support.macro.instance.test',
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
    })
    it('should not replace anything if the user does not exist', async () => {
      const elements = [macroType.clone(), macroInstance.clone()]
      const paginator = mockFunction<clientUtils.Paginator>()
        .mockImplementationOnce(async function *get() {
          yield [
            { users: [
              { id: 4, email: 'd@d.com' },
            ] },
          ]
        })
      const newFilter = filterCreator({
        client,
        paginator,
        config: DEFAULT_CONFIG,
        fetchQuery: elementUtils.query.createMockQuery(),
      }) as FilterType
      await newFilter.onFetch(elements)
      expect(elements.map(e => e.elemID.getFullName()).sort())
        .toEqual([
          'zendesk_support.macro',
          'zendesk_support.macro.instance.test',
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
    })
    it('should not replace anything if the users response is invalid', async () => {
      const elements = [macroType.clone(), macroInstance.clone()]
      const paginator = mockFunction<clientUtils.Paginator>()
        .mockImplementationOnce(async function *get() {
          yield [
            { users: [
              { test: 1, email: 'a@a.com' },
            ] },
          ]
        })
      const newFilter = filterCreator({
        client,
        paginator,
        config: DEFAULT_CONFIG,
        fetchQuery: elementUtils.query.createMockQuery(),
      }) as FilterType
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
    it('should change the emails to user ids ', async () => {
      const instances = [
        macroInstance, slaPolicyInstance, triggerInstance, workspaceInstance,
      ].map(e => e.clone())
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
        restriction: { type: 'User', id: 3 },
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
      })
    })
  })
  describe('onDeploy', () => {
    it('should change the user ids to emails', async () => {
      const instances = [
        macroInstance, slaPolicyInstance, triggerInstance, workspaceInstance,
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
    })
    it('should not replace anything if the users response is invalid', async () => {
      const instances = [macroInstance.clone()]
      const paginator = mockFunction<clientUtils.Paginator>()
        .mockImplementationOnce(async function *get() {
          yield [
            { users: [
              { test: 1, email: 'a@a.com' },
            ] },
          ]
        })
      const newFilter = filterCreator({
        client,
        paginator,
        config: DEFAULT_CONFIG,
        fetchQuery: elementUtils.query.createMockQuery(),
      }) as FilterType
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
