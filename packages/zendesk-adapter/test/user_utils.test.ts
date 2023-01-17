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

    it('should return the correct ElemIds', () => {
      expect(
        usersUtilsModule.TYPE_NAME_TO_REPLACER[sectionTranslationInstance.elemID.typeName]?.(sectionTranslationInstance)
      ).toEqual([
        new ElemID(ZENDESK, sectionTranslationInstance.elemID.typeName, 'instance', 'test', 'created_by_id'),
        new ElemID(ZENDESK, sectionTranslationInstance.elemID.typeName, 'instance', 'test', 'updated_by_id'),
      ])
      expect(usersUtilsModule.TYPE_NAME_TO_REPLACER[articleInstance.elemID.typeName]?.(articleInstance))
        .toEqual(
          [
            new ElemID(ZENDESK, articleInstance.elemID.typeName, 'instance', 'test', 'author_id'),
          ]
        )
      expect(usersUtilsModule.TYPE_NAME_TO_REPLACER[userSegmentInstance.elemID.typeName]?.(userSegmentInstance))
        .toEqual([
          new ElemID(ZENDESK, userSegmentType.elemID.typeName, 'instance', 'test', 'added_user_ids'),
        ])
      expect(usersUtilsModule.TYPE_NAME_TO_REPLACER[triggerInstance.elemID.typeName]?.(triggerInstance))
        .toEqual([
          triggerInstance.elemID.createNestedID('actions', '1', 'value'),
          triggerInstance.elemID.createNestedID('actions', '2', 'value'),
          triggerInstance.elemID.createNestedID('actions', '3', 'value', '0'),
          triggerInstance.elemID.createNestedID('actions', '4', 'value', '0'),
          triggerInstance.elemID.createNestedID('conditions', 'all', '0', 'value'),
          triggerInstance.elemID.createNestedID('conditions', 'all', '2', 'value'),
          triggerInstance.elemID.createNestedID('conditions', 'any', '0', 'value'),
          triggerInstance.elemID.createNestedID('conditions', 'any', '1', 'value'),
        ])
      expect(
        usersUtilsModule.TYPE_NAME_TO_REPLACER[
          routingAttributeValueInstance.elemID.typeName
        ]?.(routingAttributeValueInstance)
      ).toEqual([
        routingAttributeValueInstance.elemID.createNestedID('conditions', 'all', '1', 'value'),
        routingAttributeValueInstance.elemID.createNestedID('conditions', 'any', '0', 'value'),
      ])
      expect(usersUtilsModule.TYPE_NAME_TO_REPLACER[macroInstance.elemID.typeName]?.(macroInstance))
        .toEqual([
          macroInstance.elemID.createNestedID('actions', '1', 'value'),
          macroInstance.elemID.createNestedID('actions', '2', 'value'),
          macroInstance.elemID.createNestedID('restriction', 'id'),
        ])
      expect(usersUtilsModule.TYPE_NAME_TO_REPLACER[slaPolicyInstance.elemID.typeName]?.(slaPolicyInstance))
        .toEqual([
          slaPolicyInstance.elemID.createNestedID('filter', 'all', '0', 'value'),
          slaPolicyInstance.elemID.createNestedID('filter', 'all', '1', 'value'),
          slaPolicyInstance.elemID.createNestedID('filter', 'any', '0', 'value'),
          slaPolicyInstance.elemID.createNestedID('filter', 'any', '1', 'value'),
        ])
      expect(usersUtilsModule.TYPE_NAME_TO_REPLACER[workspaceInstance.elemID.typeName]?.(workspaceInstance))
        .toEqual([
          workspaceInstance.elemID.createNestedID('selected_macros', '1', 'restriction', 'id'),
        ])
      expect(usersUtilsModule.TYPE_NAME_TO_REPLACER[automationInstance.elemID.typeName]?.(automationInstance))
        .toEqual([
          automationInstance.elemID.createNestedID('actions', '0', 'value'),
          automationInstance.elemID.createNestedID('actions', '1', 'value'),
          automationInstance.elemID.createNestedID('conditions', 'all', '0', 'value'),
          automationInstance.elemID.createNestedID('conditions', 'any', '0', 'value'),
        ])
      expect(usersUtilsModule.TYPE_NAME_TO_REPLACER[viewInstance.elemID.typeName]?.(viewInstance))
        .toEqual([
          viewInstance.elemID.createNestedID('conditions', 'all', '0', 'value'),
          viewInstance.elemID.createNestedID('conditions', 'any', '0', 'value'),
          viewInstance.elemID.createNestedID('restriction', 'id'),
        ])
    })
  })
})
