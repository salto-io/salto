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
import { ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { client as clientUtils } from '@salto-io/adapter-components'
import { resolvePath } from '@salto-io/adapter-utils'
import { mockFunction } from '@salto-io/test-utils'
import { SECTION_TRANSLATION_TYPE_NAME, ZENDESK } from '../src/constants'
import * as usersUtilsModule from '../src/user_utils'

describe('userUtils', () => {
  describe('getUsers', () => {
    let userUtils: typeof usersUtilsModule

    beforeEach(() => {
      jest.isolateModules(() => {
        // eslint-disable-next-line global-require
        userUtils = require('../src/user_utils')
      })
    })

    it('should return valid users when called', async () => {
      const mockPaginator = mockFunction<clientUtils.Paginator>()
        .mockImplementation(async function *get() {
          yield [
            { users: [
              { id: 1, email: 'a@a.com' },
              { id: 2, email: 'b@b.com' },
              { id: 2, email: 'c@c.com', role: 'agent', custom_role_id: '123' },
            ] },
          ]
        })

      const users = await userUtils.getUsers(mockPaginator)
      expect(users).toEqual(
        [
          { id: 1, email: 'a@a.com' },
          { id: 2, email: 'b@b.com' },
          { id: 2, email: 'c@c.com', role: 'agent', custom_role_id: '123' },
        ]
      )
    })
    it('should cache results when between getUsers calls', async () => {
      const mockPaginator = mockFunction<clientUtils.Paginator>()
        .mockImplementation(async function *get() {
          yield [
            { users: [
              { id: 1, email: 'a@a.com' },
              { id: 2, email: 'b@b.com' },
            ] },
          ]
        })
      const users = await userUtils.getUsers(mockPaginator)
      expect(users).toEqual(
        [
          { id: 1, email: 'a@a.com' },
          { id: 2, email: 'b@b.com' },
        ]
      )
      const getUsersAfterCache = await userUtils.getUsers(mockPaginator)
      expect(getUsersAfterCache).toEqual(
        [
          { id: 1, email: 'a@a.com' },
          { id: 2, email: 'b@b.com' },
        ]
      )
      await userUtils.getUsers(mockPaginator)
      expect(mockPaginator).toHaveBeenCalledTimes(1)
    })
    it('should return empty list if users are in invalid format', async () => {
      const mockPaginator = mockFunction<clientUtils.Paginator>()
        .mockImplementation(async function *get() {
          yield [
            { users: [
              { id: 1 },
              { id: 2, email: 'b@b.com' },
              { email: 'c@c.com', role: 'agent', custom_role_id: '123' },
            ] },
          ]
        })
      const users = await userUtils.getUsers(mockPaginator)
      expect(users).toEqual([])
      expect(mockPaginator).toHaveBeenCalledTimes(1)
    })
  })

  describe('UserReplacers', () => {
    const macroType = new ObjectType({ elemID: new ElemID(ZENDESK, 'macro') })
    const slaPolicyType = new ObjectType({ elemID: new ElemID(ZENDESK, 'sla_policy') })
    const triggerType = new ObjectType({ elemID: new ElemID(ZENDESK, 'trigger') })
    const workspaceType = new ObjectType({ elemID: new ElemID(ZENDESK, 'workspace') })
    const automationType = new ObjectType({ elemID: new ElemID(ZENDESK, 'automation') })
    const viewType = new ObjectType({ elemID: new ElemID(ZENDESK, 'view') })
    const routingAttributeValueType = new ObjectType({ elemID: new ElemID(ZENDESK, 'routing_attribute_value') })
    const userSegmentType = new ObjectType({ elemID: new ElemID(ZENDESK, 'user_segment') })
    const articleType = new ObjectType({ elemID: new ElemID(ZENDESK, 'article') })
    const sectionTranslationType = new ObjectType(
      { elemID: new ElemID(ZENDESK, SECTION_TRANSLATION_TYPE_NAME) }
    )
    const ticketFieldType = new ObjectType({ elemID: new ElemID(ZENDESK, 'ticket_field') })

    const sectionTranslationInstance = new InstanceElement(
      'test',
      sectionTranslationType,
      { updated_by_id: 1, created_by_id: 2 }
    )

    const userSegmentInstance = new InstanceElement(
      'test',
      userSegmentType,
      { title: 'test', added_user_ids: 1 }
    )

    const articleInstance = new InstanceElement(
      'test',
      articleType,
      { title: 'test', author_id: 1 }
    )

    const triggerInstance = new InstanceElement(
      'test',
      triggerType,
      {
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
              type: 'Group',
              id: 1241241,
            },
          },
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

    const automationInstance = new InstanceElement(
      'test',
      automationType,
      {
        title: 'test',
        actions: [
          {
            field: 'assignee_id',
            value: 'current_user',
          },
          {
            field: 'follower',
            value: '1',
          },
          {
            field: 'status',
            value: 'open',
          },
        ],
        conditions: {
          all: [
            {
              field: 'assignee_id',
              operator: 'is',
              value: '1',
            },
          ],
          any: [
            {
              field: 'requester_id',
              operator: 'is',
              value: '10',
            },
          ],
        },
      },
    )

    const viewInstance = new InstanceElement(
      'test',
      viewType,
      {
        title: 'test',
        conditions: {
          all: [
            {
              field: 'assignee_id',
              operator: 'is',
              value: '1',
            },
          ],
          any: [
            {
              field: 'requester_id',
              operator: 'is',
              value: '10',
            },
          ],
        },
        restriction: {
          type: 'User',
          id: 3,
        },
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

    const sectionTransUserPaths = [
      new ElemID(ZENDESK, sectionTranslationInstance.elemID.typeName, 'instance', 'test', 'created_by_id'),
      new ElemID(ZENDESK, sectionTranslationInstance.elemID.typeName, 'instance', 'test', 'updated_by_id'),
    ]
    const articleUserPaths = [
      new ElemID(ZENDESK, articleInstance.elemID.typeName, 'instance', 'test', 'author_id'),
    ]
    const userSegmentUserPaths = [
      new ElemID(ZENDESK, userSegmentType.elemID.typeName, 'instance', 'test', 'added_user_ids'),
    ]
    const triggerUserPaths = [
      triggerInstance.elemID.createNestedID('actions', '1', 'value'),
      triggerInstance.elemID.createNestedID('actions', '2', 'value'),
      triggerInstance.elemID.createNestedID('actions', '3', 'value', '0'),
      triggerInstance.elemID.createNestedID('actions', '4', 'value', '0'),
      triggerInstance.elemID.createNestedID('conditions', 'all', '0', 'value'),
      triggerInstance.elemID.createNestedID('conditions', 'all', '2', 'value'),
      triggerInstance.elemID.createNestedID('conditions', 'any', '0', 'value'),
      triggerInstance.elemID.createNestedID('conditions', 'any', '1', 'value'),
    ]
    const routingAttUserPaths = [
      routingAttributeValueInstance.elemID.createNestedID('conditions', 'all', '1', 'value'),
      routingAttributeValueInstance.elemID.createNestedID('conditions', 'any', '0', 'value'),
    ]
    const macroUserPaths = [
      macroInstance.elemID.createNestedID('actions', '1', 'value'),
      macroInstance.elemID.createNestedID('actions', '2', 'value'),
      macroInstance.elemID.createNestedID('restriction', 'id'),
    ]
    const slaPolicyUserPaths = [
      slaPolicyInstance.elemID.createNestedID('filter', 'all', '0', 'value'),
      slaPolicyInstance.elemID.createNestedID('filter', 'all', '1', 'value'),
      slaPolicyInstance.elemID.createNestedID('filter', 'any', '0', 'value'),
      slaPolicyInstance.elemID.createNestedID('filter', 'any', '1', 'value'),
    ]
    const workspaceUserPaths = [
      workspaceInstance.elemID.createNestedID('conditions', 'all', '0', 'value'),
      workspaceInstance.elemID.createNestedID('conditions', 'any', '0', 'value'),
      workspaceInstance.elemID.createNestedID('selected_macros', '1', 'restriction', 'id'),
    ]
    const automationUserPaths = [
      automationInstance.elemID.createNestedID('actions', '0', 'value'),
      automationInstance.elemID.createNestedID('actions', '1', 'value'),
      automationInstance.elemID.createNestedID('conditions', 'all', '0', 'value'),
      automationInstance.elemID.createNestedID('conditions', 'any', '0', 'value'),
    ]
    const viewUserPaths = [
      viewInstance.elemID.createNestedID('conditions', 'all', '0', 'value'),
      viewInstance.elemID.createNestedID('conditions', 'any', '0', 'value'),
      viewInstance.elemID.createNestedID('restriction', 'id'),
    ]
    const ticketFieldUserPaths = [
      ticketFieldInstance.elemID.createNestedID('relationship_filter', 'all', '0', 'value'),
      ticketFieldInstance.elemID.createNestedID('relationship_filter', 'any', '0', 'value'),
    ]

    it('should return the correct ElemIds', () => {
      expect(
        usersUtilsModule.TYPE_NAME_TO_REPLACER[sectionTranslationInstance.elemID.typeName]?.(sectionTranslationInstance)
      ).toEqual(sectionTransUserPaths)
      expect(usersUtilsModule.TYPE_NAME_TO_REPLACER[articleInstance.elemID.typeName]?.(articleInstance))
        .toEqual(articleUserPaths)
      expect(usersUtilsModule.TYPE_NAME_TO_REPLACER[userSegmentInstance.elemID.typeName]?.(userSegmentInstance))
        .toEqual(userSegmentUserPaths)
      expect(usersUtilsModule.TYPE_NAME_TO_REPLACER[triggerInstance.elemID.typeName]?.(triggerInstance))
        .toEqual(triggerUserPaths)
      expect(
        usersUtilsModule.TYPE_NAME_TO_REPLACER[
          routingAttributeValueInstance.elemID.typeName
        ]?.(routingAttributeValueInstance)
      ).toEqual(routingAttUserPaths)
      expect(usersUtilsModule.TYPE_NAME_TO_REPLACER[macroInstance.elemID.typeName]?.(macroInstance))
        .toEqual(macroUserPaths)
      expect(usersUtilsModule.TYPE_NAME_TO_REPLACER[slaPolicyInstance.elemID.typeName]?.(slaPolicyInstance))
        .toEqual(slaPolicyUserPaths)
      expect(usersUtilsModule.TYPE_NAME_TO_REPLACER[workspaceInstance.elemID.typeName]?.(workspaceInstance))
        .toEqual(workspaceUserPaths)
      expect(usersUtilsModule.TYPE_NAME_TO_REPLACER[automationInstance.elemID.typeName]?.(automationInstance))
        .toEqual(automationUserPaths)
      expect(usersUtilsModule.TYPE_NAME_TO_REPLACER[viewInstance.elemID.typeName]?.(viewInstance))
        .toEqual(viewUserPaths)
      expect(usersUtilsModule.TYPE_NAME_TO_REPLACER[ticketFieldInstance.elemID.typeName]?.(ticketFieldInstance))
        .toEqual(ticketFieldUserPaths)
    })

    it('should replace values based on mapping', () => {
      const usersMapping = Object.fromEntries([
        ['1', 'a'],
        ['2', 'b'],
        ['3', 'c'],
        ['4', 'd'],
        ['5', 'e'],
      ])
      usersUtilsModule
        .TYPE_NAME_TO_REPLACER[sectionTranslationInstance.elemID.typeName]?.(sectionTranslationInstance, usersMapping)
      expect(sectionTransUserPaths.map(path => resolvePath(sectionTranslationInstance, path))).toEqual(['b', 'a'])
      usersUtilsModule.TYPE_NAME_TO_REPLACER[articleInstance.elemID.typeName]?.(articleInstance, usersMapping)
      expect(articleUserPaths.map(path => resolvePath(articleInstance, path))).toEqual(['a'])
      usersUtilsModule.TYPE_NAME_TO_REPLACER[userSegmentInstance.elemID.typeName]?.(userSegmentInstance, usersMapping)
      expect(userSegmentUserPaths.map(path => resolvePath(userSegmentInstance, path))).toEqual(['a'])
      usersUtilsModule.TYPE_NAME_TO_REPLACER[triggerInstance.elemID.typeName]?.(triggerInstance, usersMapping)
      expect(triggerUserPaths.map(path => resolvePath(triggerInstance, path))).toEqual(['a', 'b', 'a', 'b', 'c', 'b', 'a', 'a'])
      usersUtilsModule.TYPE_NAME_TO_REPLACER[
        routingAttributeValueInstance.elemID.typeName
      ]?.(routingAttributeValueInstance, usersMapping)
      expect(routingAttUserPaths.map(path => resolvePath(routingAttributeValueInstance, path))).toEqual(['b', 'a'])
      usersUtilsModule.TYPE_NAME_TO_REPLACER[macroInstance.elemID.typeName]?.(macroInstance, usersMapping)
      expect(macroUserPaths.map(path => resolvePath(macroInstance, path))).toEqual(['b', 'a', 'c'])
      usersUtilsModule.TYPE_NAME_TO_REPLACER[slaPolicyInstance.elemID.typeName]?.(slaPolicyInstance, usersMapping)
      expect(slaPolicyUserPaths.map(path => resolvePath(slaPolicyInstance, path))).toEqual(['c', 'b', 'a', 'a'])
      usersUtilsModule.TYPE_NAME_TO_REPLACER[workspaceInstance.elemID.typeName]?.(workspaceInstance, usersMapping)
      expect(workspaceUserPaths.map(path => resolvePath(workspaceInstance, path))).toEqual(['b', 'b', 'c'])
      usersUtilsModule.TYPE_NAME_TO_REPLACER[automationInstance.elemID.typeName]?.(automationInstance, usersMapping)
      expect(automationUserPaths.map(path => resolvePath(automationInstance, path))).toEqual(['current_user', 'a', 'a', '10'])
      usersUtilsModule.TYPE_NAME_TO_REPLACER[viewInstance.elemID.typeName]?.(viewInstance, usersMapping)
      expect(viewUserPaths.map(path => resolvePath(viewInstance, path))).toEqual(['a', '10', 'c'])
      usersUtilsModule.TYPE_NAME_TO_REPLACER[ticketFieldInstance.elemID.typeName]?.(ticketFieldInstance, usersMapping)
      expect(ticketFieldUserPaths.map(path => resolvePath(ticketFieldInstance, path))).toEqual(['b', 'a'])
    })

    it('should not replace anything if the field does not exist', () => {
      const usersMapping = Object.fromEntries([
        ['1', 'a'],
        ['2', 'b'],
        ['3', 'c'],
      ])
      const macroNoFields = new InstanceElement(
        'test',
        macroType,
        {
          title: 'test',
          test1: [
            { field: 'status', value: 'closed' },
            { field: 'assignee_id', value: '2' },
            { field: 'follower', value: '1' },
          ],
          test2: { type: 'User', id: 3 },
          restriction: { type: 'User', id: 3 },
        },
      )
      const userSegmentNoFields = new InstanceElement(
        'test',
        userSegmentType,
        {
          title: 'test',
        },
      )
      usersUtilsModule.TYPE_NAME_TO_REPLACER[macroNoFields.elemID.typeName]?.(macroNoFields, usersMapping)
      expect(macroNoFields?.value).toEqual({
        title: 'test',
        test1: [
          { field: 'status', value: 'closed' },
          { field: 'assignee_id', value: '2' },
          { field: 'follower', value: '1' },
        ],
        test2: { type: 'User', id: 3 },
        restriction: { type: 'User', id: 'c' },
      })

      usersUtilsModule
        .TYPE_NAME_TO_REPLACER[userSegmentNoFields.elemID.typeName]?.(userSegmentNoFields, usersMapping)
      expect(userSegmentNoFields?.value).toEqual({
        title: 'test',
      })
    })

    it('should not replace values that are missing from mapping', () => {
      const usersMapping = Object.fromEntries([
        ['2', 'b'],
        ['4', 'd'],
      ])
      const slaPolicyMissingValues = new InstanceElement(
        'test',
        slaPolicyType,
        {
          title: 'sla',
          filter: {
            all: [
              { field: 'assignee_id', operator: 'is', value: 3 },
              { field: 'requester_id', operator: 'is', value: 2 },
            ],
            any: [
              { field: 'assignee_id', operator: 'is', value: 1 },
            ],
          },
          policy_metrics: [],
        },
      )
      usersUtilsModule
        .TYPE_NAME_TO_REPLACER[slaPolicyMissingValues.elemID.typeName]?.(slaPolicyMissingValues, usersMapping)
      expect(slaPolicyMissingValues.value).toEqual(
        {
          title: 'sla',
          filter: {
            all: [
              { field: 'assignee_id', operator: 'is', value: 3 },
              { field: 'requester_id', operator: 'is', value: 'b' },
            ],
            any: [
              { field: 'assignee_id', operator: 'is', value: 1 },
            ],
          },
          policy_metrics: [],
        },
      )
    })
  })
})
