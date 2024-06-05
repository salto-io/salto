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

import { MockInterface } from '@salto-io/test-utils'
import {
  ElemID,
  InstanceElement,
  ObjectType,
  toChange,
  getChangeData,
  CORE_ANNOTATIONS,
  SaltoElementError,
} from '@salto-io/adapter-api'
import { filterUtils, client as clientUtils } from '@salto-io/adapter-components'
import { createDefinitions, getFilterParams, mockClient } from '../utils'
import OktaClient from '../../src/client/client'
import appUserSchemaDeployment from '../../src/filters/app_user_schema_deployment'
import { APP_USER_SCHEMA_TYPE_NAME, OKTA } from '../../src/constants'

type FilterType = filterUtils.FilterWith<'deploy'>

describe('appUserSchemaDeployment', () => {
  let mockConnection: MockInterface<clientUtils.APIConnection>
  let client: OktaClient
  let filter: FilterType
  let appUserSchemaInstance: InstanceElement
  const appUserSchemaType = new ObjectType({ elemID: new ElemID(OKTA, APP_USER_SCHEMA_TYPE_NAME) })
  const appUserSchema = new InstanceElement(
    'appUserSchema',
    appUserSchemaType,
    {
      title: 'user schema test',
      definitions: {
        custom: {
          id: '#custom',
          type: 'object',
          properties: {
            customProp: {
              title: 'custom prop',
            },
          },
        },
        base: {
          id: '#base',
          type: 'object',
          properties: {
            baseProp: {
              title: 'base prop',
            },
            notDefaultProp: {
              title: 'not default prop',
            },
          },
          required: ['baseProp'],
        },
      },
    },
    undefined,
    {
      [CORE_ANNOTATIONS.PARENT]: [
        {
          id: '1',
        },
      ],
    },
  )

  const notFoundError = new clientUtils.HTTPError('message', {
    status: 404,
    data: {},
  })

  const otherError = new clientUtils.HTTPError('message', {
    status: 505,
    data: {},
  })

  const successResponse = { status: 200, data: '' }

  const resolvedAppUserSchema = {
    status: 200,
    data: {
      id: 'appUserSchemaId',
      name: 'app user shcema test 2',
      title: 'user schema test 2',
      definitions: {
        custom: {
          id: '#custom 2',
          type: 'object 2',
          properties: {},
        },
        base: {
          id: '#base',
          type: 'object',
          properties: {
            baseProp: {
              title: 'base prop',
            },
          },
          required: ['baseProp'],
        },
      },
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
    const { client: cli, connection } = mockClient()
    mockConnection = connection
    client = cli
    const definitions = createDefinitions({ client })
    filter = appUserSchemaDeployment(getFilterParams({ definitions })) as typeof filter
    appUserSchemaInstance = appUserSchema.clone()
  })

  describe('addition deploy', () => {
    it('should successfully deploy addition changes as modification changes', async () => {
      mockConnection.get.mockResolvedValueOnce(resolvedAppUserSchema)
      const changes = [toChange({ after: appUserSchemaInstance })]
      const result = await filter.deploy(changes)
      const { appliedChanges } = result.deployResult
      expect(appliedChanges).toHaveLength(1)
      const instance = getChangeData(appliedChanges[0]) as InstanceElement
      expect(instance.value).toEqual({
        // validate id assigned to value
        // TODO make sure with Shir that I want the id to chagne but everything else don't
        id: 'appUserSchemaId',
        title: 'user schema test',
        definitions: {
          custom: {
            id: '#custom',
            type: 'object',
            properties: {
              customProp: {
                title: 'custom prop',
              },
            },
          },
          base: {
            id: '#base',
            type: 'object',
            properties: {
              baseProp: {
                title: 'base prop',
              },
              notDefaultProp: {
                title: 'not default prop',
              },
            },
            required: ['baseProp'],
          },
        },
      })
      expect(mockConnection.get).toHaveBeenCalledWith('/api/v1/meta/schemas/apps/1/default', undefined)
    })

    it('should return error if there is no parent application', async () => {
      const noParentName = 'appUserSchemaNoParent'
      const noParent = new InstanceElement(noParentName, appUserSchemaType, appUserSchemaInstance.value)
      const result = await filter.deploy([toChange({ after: noParent })])
      expect(result.deployResult.appliedChanges).toHaveLength(0)
      expect(result.deployResult.errors).toHaveLength(1)
      expect(result.deployResult.errors.map(e => e.message)).toEqual([
        `Could not find parent application id for AppUserSchema ${noParentName} from type ${APP_USER_SCHEMA_TYPE_NAME}`,
      ])
    })
    it('should return error when app user schema request fails', async () => {
      mockConnection.get.mockRejectedValueOnce(notFoundError)
      const result = await filter.deploy([toChange({ after: appUserSchemaInstance })])
      expect(result.deployResult.appliedChanges).toHaveLength(0)
      expect(mockConnection.get).toHaveBeenCalledWith('/api/v1/meta/schemas/apps/1/default', undefined)
      expect(result.deployResult.errors).toHaveLength(1)
      expect(result.deployResult.errors[0].message).toEqual('Invalid app user schema response')
    })
    it('should succeed when there are no properties in custom', async () => {
      mockConnection.get.mockResolvedValueOnce(resolvedAppUserSchema)
      mockConnection.get.mockResolvedValueOnce(resolvedAppUserSchema)
      mockConnection.get.mockResolvedValueOnce(resolvedAppUserSchema)
      mockConnection.get.mockResolvedValueOnce(resolvedAppUserSchema)

      const withoutProperties = appUserSchemaInstance.clone()
      delete withoutProperties.value.definitions.custom.properties
      const withEmptyProperties = appUserSchemaInstance.clone()
      withEmptyProperties.value.definitions.custom.properties = {}
      const withoutCustom = appUserSchemaInstance.clone()
      delete withoutCustom.value.definitions.custom
      const withoutDefinitions = appUserSchemaInstance.clone()
      delete withoutDefinitions.value.definitions

      const instancesWithId = [withoutProperties, withEmptyProperties, withoutCustom, withoutDefinitions].map(
        instance => {
          const res = instance.clone()
          res.value.id = 'appUserSchemaId'
          return res
        },
      )
      const result = await filter.deploy([
        toChange({ after: withoutProperties.clone() }),
        toChange({ after: withEmptyProperties.clone() }),
        toChange({ after: withoutCustom.clone() }),
        toChange({ after: withoutDefinitions.clone() }),
      ])
      const { appliedChanges } = result.deployResult
      expect(appliedChanges).toHaveLength(4)
      expect(appliedChanges.map(getChangeData)).toEqual(instancesWithId)
      expect(mockConnection.get).toHaveBeenCalledWith('/api/v1/meta/schemas/apps/1/default', undefined)
      expect(mockConnection.get).toHaveBeenCalledTimes(4)
      expect(result.deployResult.errors).toHaveLength(0)
    })
  })
  describe('modification deploy', () => {
    it('should successfully deploy modification changes', async () => {
      mockConnection.get.mockResolvedValueOnce(resolvedAppUserSchema)

      const after = appUserSchemaInstance.clone()
      after.value.definitions.custom.properties.customProp.title = 'new custom prop'
      after.value.definitions.base.properties.baseProp.title = 'new base prop'

      const changes = [toChange({ before: appUserSchemaInstance, after: after.clone() })]
      const result = await filter.deploy(changes)
      const { appliedChanges } = result.deployResult
      expect(appliedChanges).toHaveLength(1)
      const instance = getChangeData(appliedChanges[0])
      expect(instance).toEqual(after)
    })
    it('should handle empty base in the before', async () => {
      mockConnection.get.mockResolvedValueOnce(resolvedAppUserSchema)
      mockConnection.get.mockResolvedValueOnce(resolvedAppUserSchema)

      const after = appUserSchemaInstance.clone()
      after.value.definitions.custom.properties.customProp.title = 'new custom prop'
      after.value.definitions.base.properties.baseProp.title = 'new base prop'

      const before1 = appUserSchemaInstance.clone()
      delete before1.value.definitions.base

      const before2 = appUserSchemaInstance.clone()
      delete before2.value.definitions

      const changes = [
        toChange({ before: before1, after: after.clone() }),
        toChange({ before: before2, after: after.clone() }),
      ]
      const result = await filter.deploy(changes)
      const { appliedChanges } = result.deployResult
      expect(appliedChanges).toHaveLength(2)
      expect(getChangeData(appliedChanges[0])).toEqual(after)
      expect(getChangeData(appliedChanges[1])).toEqual(after)
    })
  })
  describe('removal deploy', () => {
    it('should successfully deploy removal of app user schema as a verification when application is not found in the service', async () => {
      mockConnection.get.mockRejectedValue(notFoundError)
      const changes = [toChange({ before: appUserSchemaInstance })]
      const result = await filter.deploy(changes)
      const { appliedChanges, errors } = result.deployResult

      expect(mockConnection.get).toHaveBeenCalledWith('/api/v1/apps/1', undefined)
      expect(errors).toHaveLength(0)
      expect(appliedChanges).toHaveLength(1)
      expect(appliedChanges.map(change => getChangeData(change))[0]).toEqual(appUserSchemaInstance)
    })
    it('should fail when the parent application exists', async () => {
      mockConnection.get.mockResolvedValue(successResponse)
      const changes = [toChange({ before: appUserSchemaInstance })]
      const result = await filter.deploy(changes)
      const { appliedChanges, errors } = result.deployResult

      expect(mockConnection.get).toHaveBeenCalledWith('/api/v1/apps/1', undefined)
      expect(errors).toHaveLength(1)
      expect(errors[0].message).toEqual('Expected the parent Application to be deleted')
      expect(appliedChanges).toHaveLength(0)
    })
    it('should fail when there is no parent applicaton', async () => {
      delete appUserSchemaInstance.annotations[CORE_ANNOTATIONS.PARENT]
      const changes = [toChange({ before: appUserSchemaInstance })]
      const result = await filter.deploy(changes)
      const { appliedChanges, errors } = result.deployResult

      expect(errors).toHaveLength(1)
      expect(errors[0].message).toEqual('Expected the parent Application to be deleted')
      expect(appliedChanges).toHaveLength(0)
    })
    it('should fail when the client returns another error', async () => {
      mockConnection.get.mockRejectedValue(otherError)
      const changes = [toChange({ before: appUserSchemaInstance })]
      const result = await filter.deploy(changes)
      const { appliedChanges, errors } = result.deployResult

      expect(errors).toHaveLength(1)
      expect(errors[0].message).toEqual('Failed to get /api/v1/apps/1 with error: Error: message')
      expect(appliedChanges).toHaveLength(0)
    })
    it('should handle multiple changes', async () => {
      mockConnection.get.mockRejectedValueOnce(notFoundError) // first app is deleted
      mockConnection.get.mockResolvedValueOnce(successResponse) // second app exists

      const otherAppUserSchemaType = new ObjectType({
        elemID: new ElemID(OKTA, APP_USER_SCHEMA_TYPE_NAME, 'instance', 'other'),
      })
      const otherAppUserSchemaInstance = new InstanceElement(
        'appUserSchema',
        otherAppUserSchemaType,
        {
          name: 'C',
        },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: {
            id: '2',
          },
        },
      )

      const changes = [toChange({ before: appUserSchemaInstance }), toChange({ before: otherAppUserSchemaInstance })]
      const result = await filter.deploy(changes)
      const { appliedChanges, errors } = result.deployResult

      expect(mockConnection.get).toHaveBeenCalledTimes(2)
      expect(mockConnection.get).toHaveBeenCalledWith('/api/v1/apps/1', undefined)
      expect(appliedChanges).toHaveLength(1)
      expect(getChangeData(appliedChanges[0]).elemID.isEqual(appUserSchemaInstance.elemID)).toBeTruthy()
      expect(errors).toHaveLength(1)
      expect(errors[0].message).toEqual('Expected the parent Application to be deleted')
      expect((errors[0] as SaltoElementError).elemID.isEqual(otherAppUserSchemaInstance.elemID)).toBeTruthy()
    })
  })
})
