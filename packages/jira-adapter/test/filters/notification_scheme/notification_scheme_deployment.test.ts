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
import { BuiltinTypes, CORE_ANNOTATIONS, ElemID, Field, InstanceElement, ListType, ObjectType, toChange, Values } from '@salto-io/adapter-api'
import _ from 'lodash'
import { filterUtils, client as clientUtils } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import { getFilterParams, mockClient } from '../../utils'
import notificationSchemeDeploymentFilter from '../../../src/filters/notification_scheme/notification_scheme_deployment'
import { getDefaultConfig, JiraConfig } from '../../../src/config/config'
import { JIRA, NOTIFICATION_SCHEME_TYPE_NAME, NOTIFICATION_EVENT_TYPE_NAME } from '../../../src/constants'
import { deployWithJspEndpoints } from '../../../src/deployment/jsp_deployment'
import JiraClient from '../../../src/client/client'

jest.mock('../../../src/deployment/jsp_deployment', () => ({
  ...jest.requireActual<{}>('../../../src/deployment/jsp_deployment'),
  deployWithJspEndpoints: jest.fn(),
}))

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
            eventType: '2',
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

    it('should not add deployment annotations when usePrivateAPI config is off', async () => {
      config.client.usePrivateAPI = false

      await filter.onFetch([notificationEventType, notificationSchemeType])

      expect(notificationSchemeType.annotations).toEqual({})
      expect(notificationEventType.fields.eventType.annotations).toEqual({})
    })
  })

  describe('preDeploy', () => {
    it('should add schemeId to the instance', async () => {
      await filter.preDeploy([
        toChange({ before: instance, after: instance }),
      ])
      expect(instance.value.schemeId).toBe('1')
    })
  })

  describe('onDeploy', () => {
    it('should remove schemeId from the instance', async () => {
      instance.value.schemeId = '1'
      await filter.onDeploy([
        toChange({ before: instance, after: instance }),
      ])
      expect(instance.value.schemeId).toBeUndefined()
    })
  })

  describe('deploy', () => {
    let deployWithJspEndpointsMock: jest.MockedFunction<typeof deployWithJspEndpoints>
    beforeEach(() => {
      deployWithJspEndpointsMock = deployWithJspEndpoints as jest.MockedFunction<
        typeof deployWithJspEndpoints
      >

      deployWithJspEndpointsMock.mockClear()

      deployWithJspEndpointsMock.mockImplementation(async ({ changes }) => ({
        appliedChanges: changes,
        errors: [],
      }))
    })

    it('should call deployWithJspEndpoints in the right order on creation', async () => {
      const { deployResult } = await filter.deploy([
        toChange({ after: instance }),
      ])

      expect(deployResult.errors).toHaveLength(0)
      expect(deployResult.appliedChanges).toHaveLength(1)

      expect(deployWithJspEndpointsMock).toHaveBeenNthCalledWith(1, {
        changes: [toChange({ after: instance })],
        client,
        urls: {
          add: '/secure/admin/AddNotificationScheme.jspa',
          modify: '/secure/admin/EditNotificationScheme.jspa',
          remove: '/secure/admin/DeleteNotificationScheme.jspa',
        },
        serviceValuesTransformer: expect.toBeFunction(),
        fieldsToIgnore: ['notificationSchemeEvents'],
        queryFunction: expect.toBeFunction(),
      })

      const queryFunction = deployWithJspEndpointsMock.mock.calls[0][0]
        .queryFunction as () => Promise<clientUtils.ResponseValue[]>
      connection.get.mockResolvedValue({
        status: 200,
        data: {
          values: [{
            id: '1',
          }],
          startAt: 0,
          total: 1,
        },
      })

      expect(await queryFunction()).toEqual([{ id: '1' }])

      const serviceValuesTransformer = deployWithJspEndpointsMock.mock.calls[0][0]
        .serviceValuesTransformer as (serviceValues: Values) => Values

      expect(serviceValuesTransformer({ id: '1' })).toEqual({
        schemeId: '1',
        id: '1',
      })

      expect(await queryFunction()).toEqual([{ id: '1' }])

      const eventChange = toChange({
        after: new InstanceElement(
          '2-EmailAddress-email',
          notificationEventType,
          {
            name: '2-EmailAddress-email',
            schemeId: '1',
            eventTypeIds: '2',
            type: 'Single_Email_Address',
            Single_Email_Address: 'email',
          },
        ),
      })

      expect(deployWithJspEndpointsMock).toHaveBeenNthCalledWith(2, {
        changes: [eventChange],
        client,
        urls: {
          add: '/secure/admin/AddNotification.jspa',
          remove: '/secure/admin/DeleteNotification.jspa',
          query: '/rest/api/3/notificationscheme/1?expand=all',
        },
        queryFunction: expect.toBeFunction(),
      })

      const eventQueryFunction = deployWithJspEndpointsMock.mock.calls[1][0]
        .queryFunction as () => Promise<clientUtils.ResponseValue[]>

      connection.get.mockResolvedValue({
        status: 200,
        data: {
          notificationSchemeEvents: [{
            event: {
              id: '1',
            },
            notifications: [{
              id: '1',
              notificationType: 'type',
            }],
          }],
        },
      })

      expect(await eventQueryFunction()).toEqual([{
        eventTypeIds: '1',
        id: '1',
        name: '1-type-undefined',
        schemeId: '1',
      }])
    })

    it('should create the right event changes on modification', async () => {
      instance.value.notificationIds = {}
      instance.value.notificationIds['2-EmailAddress-email'] = '3'

      const instanceAfter = instance.clone()

      instance.value.notificationSchemeEvents.push({
        eventType: '3',
        notifications: [{
          type: 'EmailAddress',
          parameter: 'email2',
        }],
      })

      instance.value.notificationIds['3-EmailAddress-email2'] = '4'

      instanceAfter.value.notificationSchemeEvents.push({
        eventType: '3',
        notifications: [{
          type: 'otherType',
        }],
      })
      const { deployResult } = await filter.deploy([
        toChange({ before: instance, after: instanceAfter }),
      ])

      expect(deployResult.errors).toHaveLength(0)
      expect(deployResult.appliedChanges).toHaveLength(1)

      const eventRemoval = toChange({
        before: new InstanceElement(
          '3-EmailAddress-email2',
          notificationEventType,
          {
            name: '3-EmailAddress-email2',
            schemeId: '1',
            id: '4',
            eventTypeIds: '3',
            type: 'Single_Email_Address',
            Single_Email_Address: 'email2',
          },
        ),
      })

      const eventAddition = toChange({
        after: new InstanceElement(
          '3-otherType-undefined',
          notificationEventType,
          {
            name: '3-otherType-undefined',
            schemeId: '1',
            eventTypeIds: '3',
            type: 'otherType',
          },
        ),
      })

      expect(deployWithJspEndpointsMock).toHaveBeenNthCalledWith(2, {
        changes: [eventRemoval, eventAddition],
        client,
        urls: {
          add: '/secure/admin/AddNotification.jspa',
          remove: '/secure/admin/DeleteNotification.jspa',
          query: '/rest/api/3/notificationscheme/1?expand=all',
        },
        queryFunction: expect.toBeFunction(),
      })
    })

    it('event queryFunction should throw when there is no query url', async () => {
      delete config.apiDefinitions.types.NotificationSchemeEvent.jspRequests?.query
      await filter.deploy([
        toChange({ after: instance }),
      ])

      const eventQueryFunction = deployWithJspEndpointsMock.mock.calls[1][0]
        .queryFunction as () => Promise<clientUtils.ResponseValue[]>

      connection.get.mockResolvedValue({
        status: 200,
        data: {
          notificationSchemeEvents: [{
            event: {
              id: '1',
            },
            notifications: [{
              id: '1',
            }],
          }],
        },
      })

      await expect(eventQueryFunction()).rejects.toThrow()
    })

    it('event queryFunction should throw when response is an array', async () => {
      await filter.deploy([
        toChange({ after: instance }),
      ])

      const eventQueryFunction = deployWithJspEndpointsMock.mock.calls[1][0]
        .queryFunction as () => Promise<clientUtils.ResponseValue[]>

      connection.get.mockResolvedValue({
        status: 200,
        data: [],
      })

      await expect(eventQueryFunction()).rejects.toThrow()
    })

    it('should throw if notification scheme type does not have jsp requests', async () => {
      delete config.apiDefinitions.types[NOTIFICATION_SCHEME_TYPE_NAME]

      await expect(filter.deploy([
        toChange({ after: instance }),
      ])).rejects.toThrow()
    })

    it('should throw if NotificationSchemes does not request config', async () => {
      delete config.apiDefinitions.types.NotificationSchemes.request

      await expect(filter.deploy([
        toChange({ after: instance }),
      ])).rejects.toThrow()
    })

    it('should throw if notificationSchemeEvents inner type is not an object type', async () => {
      notificationSchemeType.fields.notificationSchemeEvents = new Field(
        notificationEventType,
        'notificationSchemeEvents',
        BuiltinTypes.STRING,
      )

      const { deployResult } = await filter.deploy([
        toChange({ after: instance }),
      ])

      expect(deployResult.errors).toHaveLength(1)
    })

    it('should throw if failed to deploy events', async () => {
      deployWithJspEndpointsMock.mockImplementationOnce(async ({ changes }) => ({
        appliedChanges: changes,
        errors: [],
      }))

      deployWithJspEndpointsMock.mockImplementationOnce(async () => ({
        appliedChanges: [],
        errors: [new Error('someError')],
      }))

      const { deployResult } = await filter.deploy([
        toChange({ after: instance }),
      ])

      expect(deployResult.errors).toHaveLength(1)
    })
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
    it('should not add schemeId in preDeploy', async () => {
      await filter.preDeploy([
        toChange({ before: instance, after: instance }),
      ])
      expect(instance.value.schemeId).toBeUndefined()
    })
    it('should not remove schemeId in onDeploy', async () => {
      instance.value.schemeId = '1'
      await filter.onDeploy([
        toChange({ before: instance, after: instance }),
      ])
      expect(instance.value.schemeId).toBe('1')
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
