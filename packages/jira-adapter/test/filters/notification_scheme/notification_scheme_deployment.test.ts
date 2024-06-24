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
import {
  BuiltinTypes,
  CORE_ANNOTATIONS,
  ElemID,
  InstanceElement,
  ListType,
  ModificationChange,
  ObjectType,
  Value,
  getChangeData,
  isAdditionChange,
  isRemovalChange,
  toChange,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { filterUtils, client as clientUtils } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import { getFilterParams, mockClient } from '../../utils'
import notificationSchemeDeploymentFilter from '../../../src/filters/notification_scheme/notification_scheme_deployment'
import { getDefaultConfig, JiraConfig } from '../../../src/config/config'
import { JIRA, NOTIFICATION_SCHEME_TYPE_NAME, NOTIFICATION_EVENT_TYPE_NAME } from '../../../src/constants'
import JiraClient from '../../../src/client/client'
import { getEventChangesToDeploy } from '../../../src/filters/notification_scheme/notification_events'

describe('notificationSchemeDeploymentFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch' | 'deploy' | 'preDeploy' | 'onDeploy'>
  let notificationSchemeType: ObjectType
  let notificationEventType: ObjectType
  let instance: InstanceElement
  let config: JiraConfig
  let client: JiraClient
  let connection: MockInterface<clientUtils.APIConnection>

  beforeEach(async () => {
    const { client: cli, paginator, connection: conn } = mockClient()
    connection = conn
    client = cli

    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    filter = notificationSchemeDeploymentFilter(
      getFilterParams({
        client,
        paginator,
        config,
      }),
    ) as filterUtils.FilterWith<'onFetch' | 'deploy' | 'preDeploy' | 'onDeploy'>

    notificationEventType = new ObjectType({
      elemID: new ElemID(JIRA, NOTIFICATION_EVENT_TYPE_NAME),
      fields: {
        eventType: { refType: BuiltinTypes.STRING },
        notifications: { refType: new ListType(BuiltinTypes.STRING) },
      },
    })

    notificationSchemeType = new ObjectType({
      elemID: new ElemID(JIRA, NOTIFICATION_SCHEME_TYPE_NAME),
      fields: {
        id: { refType: BuiltinTypes.STRING },
        name: { refType: BuiltinTypes.STRING },
        description: { refType: BuiltinTypes.STRING },
        notificationSchemeEvents: { refType: new ListType(notificationEventType) },
      },
    })

    instance = new InstanceElement('instance', notificationSchemeType, {
      id: '1',
      name: 'name',
      description: 'description',
      notificationSchemeEvents: [
        {
          eventType: 2,
          notifications: [
            {
              type: 'EmailAddress',
              parameter: 'email',
            },
          ],
        },
      ],
    })
  })

  describe('onFetch', () => {
    it('should add deployment annotations to notification scheme type', async () => {
      await filter.onFetch([notificationSchemeType])
      expect(notificationSchemeType.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
        [CORE_ANNOTATIONS.DELETABLE]: true,
      })

      expect(notificationSchemeType.fields.id.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })

      expect(notificationSchemeType.fields.name.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })

      expect(notificationSchemeType.fields.description.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })

      expect(notificationSchemeType.fields.notificationSchemeEvents.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })
    })

    it('should add deployment annotations to notification event type', async () => {
      await filter.onFetch([notificationEventType])

      expect(notificationEventType.fields.eventType.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })

      expect(notificationEventType.fields.notifications.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })
    })
  })

  describe('preDeploy', () => {
    it('should convert change structure', async () => {
      const change = toChange({
        before: instance.clone(),
        after: instance.clone(),
      }) as ModificationChange<InstanceElement>
      const changes = [change]
      await filter.preDeploy(changes)
      expect(changes).toHaveLength(1)
      const beforeInstance = changes[0].data.before
      const afterInstance = changes[0].data.after
      expect(beforeInstance.value.notificationSchemeEvents[0].event.id).toEqual(2)
      expect(beforeInstance.value.notificationSchemeEvents[0].eventType).toBeUndefined()
      expect(beforeInstance.value.notificationSchemeEvents[0].notifications[0]?.notificationType).toEqual(
        'EmailAddress',
      )
      expect(beforeInstance.value.notificationSchemeEvents[0].notifications[0]?.type).toBeUndefined()
      expect(afterInstance.value.notificationSchemeEvents[0].event.id).toEqual(2)
      expect(afterInstance.value.notificationSchemeEvents[0].eventType).toBeUndefined()
      expect(afterInstance.value.notificationSchemeEvents[0].notifications[0]?.notificationType).toEqual('EmailAddress')
      expect(afterInstance.value.notificationSchemeEvents[0].notifications[0]?.type).toBeUndefined()
    })
    it('should do nothing when account is DC', async () => {
      const { client: cli, connection: conn } = mockClient(true)
      connection = conn
      client = cli
      const filterWithDc = notificationSchemeDeploymentFilter(getFilterParams({ client })) as filterUtils.FilterWith<
        'onFetch' | 'deploy' | 'preDeploy' | 'onDeploy'
      >
      const change = toChange({
        before: instance.clone(),
        after: instance.clone(),
      }) as ModificationChange<InstanceElement>
      const changes = [change]
      await filterWithDc.preDeploy(changes)
      expect(changes).toHaveLength(1)
      const beforeInstance = changes[0].data.before
      const afterInstance = changes[0].data.after
      expect(beforeInstance.value.notificationSchemeEvents[0].eventType).toEqual(2)
      expect(beforeInstance.value.notificationSchemeEvents[0].notifications[0]?.type).toEqual('EmailAddress')
      expect(afterInstance.value.notificationSchemeEvents[0].eventType).toEqual(2)
      expect(afterInstance.value.notificationSchemeEvents[0].notifications[0]?.type).toEqual('EmailAddress')
    })
  })

  describe('onDeploy', () => {
    it('should restore instance structure', async () => {
      const testInstance = instance.clone()
      const change = toChange({ before: testInstance, after: testInstance }) as ModificationChange<InstanceElement>
      const changes = [change]
      await filter.preDeploy(changes) // preDeploy sets the mappings
      await filter.onDeploy(changes)
      expect(changes).toHaveLength(1)
      const afterInstance = changes[0].data.after as InstanceElement
      expect(afterInstance.value.notificationSchemeEvents[0].event?.id).toBeUndefined()
      expect(afterInstance.value.notificationSchemeEvents[0].eventType).toEqual(2)
      expect(afterInstance.value.notificationSchemeEvents[0].notifications[0]?.notificationType).toBeUndefined()
      expect(afterInstance.value.notificationSchemeEvents[0].notifications[0]?.type).toEqual('EmailAddress')
    })
    it('should throw if change is not in the correct format', async () => {
      const testInstance = instance.clone()
      const change = toChange({ before: testInstance, after: testInstance }) as ModificationChange<InstanceElement>
      const changes = [change]
      await expect(filter.onDeploy(changes)).rejects.toThrow()
    })
    it('should do nothing when account is DC', async () => {
      const { client: cli, connection: conn } = mockClient(true)
      connection = conn
      client = cli
      const filterWithDc = notificationSchemeDeploymentFilter(getFilterParams({ client })) as filterUtils.FilterWith<
        'onFetch' | 'deploy' | 'preDeploy' | 'onDeploy'
      >
      const testInstance = instance.clone()
      const change = toChange({ before: testInstance, after: testInstance }) as ModificationChange<InstanceElement>
      const changes = [change]
      await filterWithDc.preDeploy(changes) // preDeploy sets the mappings
      await filterWithDc.onDeploy(changes)
      const afterInstance = changes[0].data.after as InstanceElement
      expect(afterInstance.value.notificationSchemeEvents[0].eventType).toEqual(2)
      expect(afterInstance.value.notificationSchemeEvents[0].notifications[0]?.type).toEqual('EmailAddress')
    })
  })

  describe('deploy', () => {
    let deployableInstance: InstanceElement
    let notificationSchemeEvents: Value
    beforeEach(() => {
      notificationSchemeEvents = [
        {
          event: { id: 3 },
          notifications: [
            {
              notificationType: 'EmailAddress',
              parameter: 'email',
            },
          ],
        },
      ]
      deployableInstance = new InstanceElement('test', notificationSchemeType, {
        name: 'test',
        description: 'description',
        notificationSchemeEvents,
      })
      jest.clearAllMocks()
      connection.post.mockImplementation(async url => {
        if (url === '/rest/api/3/notificationscheme') {
          return { status: 200, data: { id: '1' } }
        }
        throw new Error(`Unexpected url ${url}`)
      })
      connection.put.mockImplementation(async url => {
        if (url === '/rest/api/3/notificationscheme/1') {
          return { status: 200, data: { id: '1' } }
        }
        if (url === '/rest/api/3/notificationscheme/1/notification') {
          return { status: 200, data: { id: '1' } }
        }
        throw new Error(`Unexpected url ${url}`)
      })
      connection.delete.mockImplementation(async url => {
        if (url === '/rest/api/3/notificationscheme/1') {
          return { status: 200, data: {} }
        }
        if (url === '/rest/api/3/notificationscheme/1/notification/123') {
          return { status: 200, data: {} }
        }
        throw new Error(`Unexpected url ${url}`)
      })
    })
    describe('addition change', () => {
      beforeEach(() => {
        connection.get.mockResolvedValue({
          status: 200,
          data: {
            id: '1',
            name: 'test',
            description: 'description',
            notificationSchemeEvents: [
              {
                event: { id: 3 },
                notifications: [{ id: '123', notificationType: 'EmailAddress', parameter: 'email' }],
              },
            ],
          },
        })
      })
      it('should deploy notificationScheme and notificationSchemeEvent in same API request', async () => {
        const addition = toChange({ after: deployableInstance })
        const res = await filter.deploy([addition])
        expect(res.deployResult.appliedChanges).toHaveLength(1)
        expect(res.deployResult.errors).toHaveLength(0)
        expect(connection.post).toHaveBeenCalledWith(
          '/rest/api/3/notificationscheme',
          {
            name: 'test',
            description: 'description',
            notificationSchemeEvents: [
              {
                event: { id: 3 },
                notifications: [{ notificationType: 'EmailAddress', parameter: 'email' }],
              },
            ],
          },
          undefined,
        )
      })
      it('should assign ids to instance ad update notificationIds mapping', async () => {
        const addition = toChange({ after: deployableInstance })
        const { deployResult } = await filter.deploy([addition])
        expect(deployResult.appliedChanges).toHaveLength(1)
        expect(deployResult.errors).toHaveLength(0)
        const inst = getChangeData(deployResult.appliedChanges[0]) as InstanceElement
        expect(inst.value.id).toEqual('1')
        expect(inst.value.notificationIds['3-EmailAddress-email']).toEqual('123')
      })
      it('should throw if recived unexpected response when trying to set notificaitonIds', async () => {
        connection.get.mockResolvedValue({
          status: 200,
          data: {
            id: '1',
            name: 'test',
            description: 'description',
            notificationSchemeEvents: {},
          },
        })
        const addition = toChange({ after: deployableInstance })
        const res = await filter.deploy([addition])
        expect(res.deployResult.appliedChanges).toHaveLength(0)
        expect(res.deployResult.errors).toHaveLength(1)
      })
    })
    describe('modification change', () => {
      let beforeInstance: InstanceElement
      let afterInstance: InstanceElement
      beforeEach(() => {
        connection.get.mockResolvedValue({
          status: 200,
          data: {
            id: '1',
            name: 'test',
            description: 'updated',
            notificationSchemeEvents: [
              { event: { id: 3 }, notifications: [{ id: 234, notificationType: 'User', parameter: 'abc' }] },
              { event: { id: 4 }, notifications: [{ id: 345, notificationType: 'EmailAddress', parameter: 'email' }] },
            ],
          },
        })
        beforeInstance = new InstanceElement('before', notificationSchemeType, {
          id: '1',
          name: 'test',
          description: 'desc',
          notificationSchemeEvents: [
            { event: { id: 3 }, notifications: [{ notificationType: 'EmailAddress', parameter: 'email' }] },
          ],
          notificationIds: { '3-EmailAddress-email': 123 },
        })
        afterInstance = beforeInstance.clone()
        afterInstance.value.description = 'updated'
        afterInstance.value.notificationSchemeEvents = [
          { event: { id: 3 }, notifications: [{ notificationType: 'User', parameter: 'abc' }] },
          { event: { id: 4 }, notifications: [{ notificationType: 'EmailAddress', parameter: 'email' }] },
        ]
      })
      it('should make the correct API calls and deploy successfully modification changes', async () => {
        const changes = [toChange({ before: beforeInstance.clone(), after: afterInstance.clone() })]
        const res = await filter.deploy(changes)
        expect(res.deployResult.appliedChanges).toHaveLength(1)
        expect(res.deployResult.errors).toHaveLength(0)
        expect(connection.put).toHaveBeenCalledTimes(3)
        // update notification scheme name and description
        expect(connection.put).toHaveBeenNthCalledWith(
          1,
          '/rest/api/3/notificationscheme/1',
          { name: 'test', description: 'updated' },
          undefined,
        )
        // add the first notification scheme event
        expect(connection.put).toHaveBeenNthCalledWith(
          2,
          '/rest/api/3/notificationscheme/1/notification',
          {
            notificationSchemeEvents: [
              { event: { id: 3 }, notifications: [{ notificationType: 'User', parameter: 'abc' }] },
            ],
          },
          undefined,
        )
        // add the second notification scheme event
        expect(connection.put).toHaveBeenNthCalledWith(
          3,
          '/rest/api/3/notificationscheme/1/notification',
          {
            notificationSchemeEvents: [
              { event: { id: 4 }, notifications: [{ notificationType: 'EmailAddress', parameter: 'email' }] },
            ],
          },
          undefined,
        )
        expect(connection.delete).toHaveBeenCalledTimes(1)
        // delete notification scheme event
        expect(connection.delete).toHaveBeenCalledWith('/rest/api/3/notificationscheme/1/notification/123', {
          data: undefined,
        })
      })
      it('should update notificationIds mapping', async () => {
        const changes = [toChange({ before: beforeInstance.clone(), after: afterInstance.clone() })]
        const { deployResult } = await filter.deploy(changes)
        expect(deployResult.appliedChanges).toHaveLength(1)
        expect(deployResult.errors).toHaveLength(0)
        const inst = getChangeData(deployResult.appliedChanges[0]) as InstanceElement
        expect(inst.value.id).toEqual('1')
        expect(inst.value.notificationIds['3-User-abc']).toEqual(234)
        expect(inst.value.notificationIds['4-EmailAddress-email']).toEqual(345)
        expect(inst.value.notificationIds['3-EmailAddress-email']).toBeUndefined()
      })
      it('should throw if notificationSchemeEvents structure is invalid', async () => {
        const invalidAfterInstance = afterInstance.clone()
        invalidAfterInstance.value.notificationSchemeEvents = [
          {
            eventType: 2,
            notifications: [{ type: 'EmailAddress', parameter: 'email' }],
          },
        ]
        const changes = [toChange({ before: beforeInstance.clone(), after: invalidAfterInstance })]
        const res = await filter.deploy(changes)
        expect(res.deployResult.appliedChanges).toHaveLength(0)
        expect(res.deployResult.errors).toHaveLength(1)
        expect(res.deployResult.errors[0].message).toEqual(
          'Error: received invalid structure for notificationSchemeEvents in instance jira.NotificationScheme.instance.before',
        )
      })
    })
    describe('removal change', () => {
      it('should remove instance', async () => {
        const instanceClone = instance.clone()
        instanceClone.value.notificationSchemeEvents[0].notifications[0].parameter = { id: 'abc' }
        const removal = toChange({ before: instanceClone })
        const res = await filter.deploy([removal])
        expect(res.deployResult.appliedChanges).toHaveLength(1)
        expect(res.deployResult.errors).toHaveLength(0)
        expect(connection.delete).toHaveBeenCalledWith('/rest/api/3/notificationscheme/1', { data: undefined })
      })
    })
  })
  describe('using DC', () => {
    beforeEach(async () => {
      const { client: cli, paginator, connection: conn } = mockClient(true)
      connection = conn
      client = cli
      config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      filter = notificationSchemeDeploymentFilter(
        getFilterParams({
          client,
          paginator,
          config,
        }),
      ) as filterUtils.FilterWith<'onFetch' | 'deploy' | 'preDeploy' | 'onDeploy'>
    })
    it('should not deploy any change', async () => {
      const { deployResult, leftoverChanges } = await filter.deploy([toChange({ after: instance })])
      expect(deployResult.appliedChanges).toHaveLength(0)
      expect(deployResult.errors).toHaveLength(0)
      expect(leftoverChanges).toHaveLength(1)
    })
  })
  describe('getEventChangesToDeploy', () => {
    let deployableInstance: InstanceElement
    let notificationSchemeEvents: Value
    beforeEach(() => {
      notificationSchemeEvents = [
        {
          event: { id: 3 },
          notifications: [{ notificationType: 'EmailAddress', parameter: 'email' }, { notificationType: 'Reporter' }],
        },
      ]
      deployableInstance = new InstanceElement('test', notificationSchemeType, {
        name: 'test',
        description: 'description',
        notificationSchemeEvents,
      })
    })
    it('should return nothing if nothing has changed', () => {
      const change = toChange({
        before: deployableInstance,
        after: deployableInstance,
      }) as ModificationChange<InstanceElement>
      const eventChanges = getEventChangesToDeploy(change)
      expect(eventChanges).toHaveLength(0)
    })
    it('should create only removals if notificationSchemeEvents was deleted', () => {
      const after = deployableInstance.clone()
      delete after.value.notificationSchemeEvents
      const change = toChange({ before: deployableInstance, after }) as ModificationChange<InstanceElement>
      const eventChanges = getEventChangesToDeploy(change)
      expect(eventChanges.filter(isRemovalChange)).toHaveLength(2)
      expect(eventChanges.filter(isRemovalChange)[0].data.before.elemID.name).toEqual('3-EmailAddress-email')
      expect(eventChanges.filter(isRemovalChange)[1].data.before.elemID.name).toEqual('3-Reporter-undefined')
    })
    it('should create only additions if notificationSchemeEvents was added', () => {
      const before = deployableInstance.clone()
      delete before.value.notificationSchemeEvents
      const change = toChange({ before, after: deployableInstance }) as ModificationChange<InstanceElement>
      const eventChanges = getEventChangesToDeploy(change)
      expect(eventChanges.filter(isAdditionChange)).toHaveLength(2)
      expect(eventChanges.filter(isAdditionChange)[0].data.after.elemID.name).toEqual('3-EmailAddress-email')
      expect(eventChanges.filter(isAdditionChange)[1].data.after.elemID.name).toEqual('3-Reporter-undefined')
    })
  })
})
