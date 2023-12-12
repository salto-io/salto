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
import { BuiltinTypes, CORE_ANNOTATIONS, ElemID, InstanceElement, ListType, ModificationChange, ObjectType, Value, getChangeData, toChange } from '@salto-io/adapter-api'
import _ from 'lodash'
import { filterUtils, client as clientUtils } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import { getFilterParams, mockClient } from '../../utils'
import notificationSchemeDeploymentFilter from '../../../src/filters/notification_scheme/notification_scheme_deployment'
import { getDefaultConfig, JiraConfig } from '../../../src/config/config'
import { JIRA, NOTIFICATION_SCHEME_TYPE_NAME, NOTIFICATION_EVENT_TYPE_NAME } from '../../../src/constants'
import JiraClient from '../../../src/client/client'

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
    filter = notificationSchemeDeploymentFilter(getFilterParams({
      client,
      paginator,
      config,
    })) as filterUtils.FilterWith<'onFetch' | 'deploy' | 'preDeploy' | 'onDeploy'>

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

    instance = new InstanceElement(
      'instance',
      notificationSchemeType,
      {
        id: '1',
        name: 'name',
        description: 'description',
        notificationSchemeEvents: [
          {
            eventType: 2,
            notifications: [{
              type: 'EmailAddress',
              parameter: 'email',
            }],
          },
        ],
      },
    )
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
      const change = toChange(
        { before: instance.clone(), after: instance.clone() }
      ) as ModificationChange<InstanceElement>
      const changes = [change]
      await filter.preDeploy(changes)
      expect(changes).toHaveLength(1)
      const beforeInstance = changes[0].data.before
      const afterInstance = changes[0].data.after
      expect(beforeInstance.value.notificationSchemeEvents[0].event.id).toEqual(2)
      expect(beforeInstance.value.notificationSchemeEvents[0].eventType).toBeUndefined()
      expect(beforeInstance.value.notificationSchemeEvents[0].notifications[0]?.notificationType).toEqual('EmailAddress')
      expect(beforeInstance.value.notificationSchemeEvents[0].notifications[0]?.type).toBeUndefined()
      expect(afterInstance.value.notificationSchemeEvents[0].event.id).toEqual(2)
      expect(afterInstance.value.notificationSchemeEvents[0].eventType).toBeUndefined()
      expect(afterInstance.value.notificationSchemeEvents[0].notifications[0]?.notificationType).toEqual('EmailAddress')
      expect(afterInstance.value.notificationSchemeEvents[0].notifications[0]?.type).toBeUndefined()
    })
  })

  describe('onDeploy', () => {
    it('should restore instance structure', async () => {
      const testInstance = instance.clone()
      const change = toChange(
        { before: testInstance, after: testInstance }
      ) as ModificationChange<InstanceElement>
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
  })

  describe('deploy', () => {
    let deployableInstance: InstanceElement
    let notificationSchemeEvents: Value
    beforeEach(() => {
      notificationSchemeEvents = [
        {
          event: { id: 3 },
          notifications: [{
            notificationType: 'EmailAddress',
            parameter: 'email',
          }],
        },
      ]
      deployableInstance = new InstanceElement(
        'test',
        notificationSchemeType,
        {
          name: 'test',
          description: 'description',
          notificationSchemeEvents,
        },
      )
      jest.clearAllMocks()
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
      connection.post.mockImplementation(async url => {
        if (url === '/rest/api/3/notificationscheme') {
          return { status: 200, data: { id: '1' } }
        }
        throw new Error(`Unexpected url ${url}`)
      })

      connection.delete.mockImplementation(async url => {
        if (url === '/rest/api/3/notificationscheme/1') {
          return { status: 200, data: {} }
        }
        if (url === '/rest/api/3/notificationscheme/{notificationSchemeId}/notification/{notificationId}') {
          return { status: 200, data: {} }
        }
        throw new Error(`Unexpected url ${url}`)
      })
    })
    describe('addition change', () => {
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
    })
    // describe('modification change', () => {

    // it('should update notificationIds mapping', async () => {

    // })
    // })
    describe('removal change', () => {
      it('should remove instance', async () => {
        const removal = toChange({ before: instance })
        const res = await filter.deploy([removal])
        expect(res.deployResult.appliedChanges).toHaveLength(1)
        expect(res.deployResult.errors).toHaveLength(0)
        expect(connection.delete).toHaveBeenCalledWith(
          '/rest/api/3/notificationscheme/1',
          { data: undefined },
        )
      })
    })

    // it('should create the right event changes on modification', async () => {
    //   instance.value.notificationIds = {}
    //   instance.value.notificationIds['2-EmailAddress-email'] = '3'

    //   const instanceAfter = instance.clone()

    //   instance.value.notificationSchemeEvents.push({
    //     eventType: '3',
    //     notifications: [{
    //       type: 'EmailAddress',
    //       parameter: 'email2',
    //     }],
    //   })

    //   instance.value.notificationIds['3-EmailAddress-email2'] = '4'

    //   instanceAfter.value.notificationSchemeEvents.push({
    //     eventType: '3',
    //     notifications: [{
    //       type: 'otherType',
    //     }],
    //   })
    //   const { deployResult } = await filter.deploy([
    //     toChange({ before: instance, after: instanceAfter }),
    //   ])

    //   expect(deployResult.errors).toHaveLength(0)
    //   expect(deployResult.appliedChanges).toHaveLength(1)

    //   const eventRemoval = toChange({
    //     before: new InstanceElement(
    //       '3-EmailAddress-email2',
    //       notificationEventType,
    //       {
    //         name: '3-EmailAddress-email2',
    //         schemeId: '1',
    //         id: '4',
    //         eventTypeIds: '3',
    //         type: 'Single_Email_Address',
    //         Single_Email_Address: 'email2',
    //       },
    //     ),
    //   })

    //   const eventAddition = toChange({
    //     after: new InstanceElement(
    //       '3-otherType-undefined',
    //       notificationEventType,
    //       {
    //         name: '3-otherType-undefined',
    //         schemeId: '1',
    //         eventTypeIds: '3',
    //         type: 'otherType',
    //       },
    //     ),
    //   })

    //   expect(deployWithJspEndpointsMock).toHaveBeenNthCalledWith(2, {
    //     changes: [eventRemoval, eventAddition],
    //     client,
    //     urls: {
    //       add: '/secure/admin/AddNotification.jspa',
    //       remove: '/secure/admin/DeleteNotification.jspa',
    //       query: '/rest/api/3/notificationscheme/1?expand=all',
    //     },
    //     queryFunction: expect.toBeFunction(),
    //   })
    // })

    // it('should throw if notificationSchemeEvents inner type is not an object type', async () => {
    //   notificationSchemeType.fields.notificationSchemeEvents = new Field(
    //     notificationEventType,
    //     'notificationSchemeEvents',
    //     BuiltinTypes.STRING,
    //   )

    //   const { deployResult } = await filter.deploy([
    //     toChange({ after: instance }),
    //   ])

    //   expect(deployResult.errors).toHaveLength(1)
    // })
  })
  describe('using DC', () => {
    beforeEach(async () => {
      const { client: cli, paginator, connection: conn } = mockClient(true)
      connection = conn
      client = cli
      config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      filter = notificationSchemeDeploymentFilter(getFilterParams({
        client,
        paginator,
        config,
      })) as filterUtils.FilterWith<'onFetch' | 'deploy' | 'preDeploy' | 'onDeploy'>
    })
    it('should not deploy any change', async () => {
      const { deployResult, leftoverChanges } = await filter.deploy([
        toChange({ after: instance }),
      ])
      expect(deployResult.appliedChanges).toHaveLength(0)
      expect(deployResult.errors).toHaveLength(0)
      expect(leftoverChanges).toHaveLength(1)
    })
  })
})
