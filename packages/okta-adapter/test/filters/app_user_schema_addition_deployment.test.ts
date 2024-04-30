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
import { ElemID, InstanceElement, ObjectType, toChange, getChangeData, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { filterUtils, client as clientUtils } from '@salto-io/adapter-components'
import { getFilterParams, mockClient } from '../utils'
import OktaClient from '../../src/client/client'
import appUserSchemaAdditionDeployment from '../../src/filters/app_user_schema_addition_deployment'
import { APP_USER_SCHEMA_TYPE_NAME, OKTA } from '../../src/constants'

type FilterType = filterUtils.FilterWith<'deploy'>

describe('appUserSchemaAdditionDeployment', () => {
  let mockConnection: MockInterface<clientUtils.APIConnection>
  let client: OktaClient
  let filter: FilterType
  const appUserSchemaType = new ObjectType({ elemID: new ElemID(OKTA, APP_USER_SCHEMA_TYPE_NAME) })
  const appUserSchemaInstance = new InstanceElement(
    'appUserSchema',
    appUserSchemaType,
    {
      title: 'user schema test',
      definition: {
        custom: {
          id: '#custom',
          type: 'object',
          properties: {},
        },
        base: {
          id: '#base',
          type: 'object',
          properties: {
            userName: {
              title: 'title',
            },
          },
          required: ['userName'],
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

  beforeEach(() => {
    jest.clearAllMocks()
    const { client: cli, connection } = mockClient()
    mockConnection = connection
    client = cli
    filter = appUserSchemaAdditionDeployment(getFilterParams({ client })) as typeof filter
  })

  describe('deploy', () => {
    it('should successfully deploy changes as modification changes', async () => {
      mockConnection.get.mockResolvedValueOnce({
        status: 200,
        data: {
          id: 'appUserSchemaId',
          name: 'app user shcema test 2',
          title: 'user schema test 2',
          definition: {
            custom: {
              id: '#custom 2',
              type: 'object 2',
              properties: {},
            },
            base: {
              id: '#base 2',
              type: 'object 2',
              properties: {
                userName: {
                  title: 'title2',
                },
              },
              required: ['userName'],
            },
          },
        },
      })
      const changes = [toChange({ after: appUserSchemaInstance })]
      const result = await filter.deploy(changes)
      const { appliedChanges } = result.deployResult
      expect(appliedChanges).toHaveLength(1)
      const instance = getChangeData(appliedChanges[0]) as InstanceElement
      expect(instance.value).toEqual({
        // validate id assigned to value
        id: 'appUserSchemaId',
        title: 'user schema test',
        definition: {
          custom: {
            id: '#custom',
            type: 'object',
            properties: {},
          },
          base: {
            id: '#base',
            type: 'object',
            properties: {
              userName: {
                title: 'title',
              },
            },
            required: ['userName'],
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
        `Could not find parent application id for user schema ${noParentName} from type ${APP_USER_SCHEMA_TYPE_NAME}`,
      ])
    })

    it('should return error when application request fails', async () => {
      mockConnection.get.mockRejectedValue({ status: 404, data: { errorSummary: 'resource not found' } })
      const result = await filter.deploy([toChange({ after: appUserSchemaInstance })])
      expect(result.deployResult.appliedChanges).toHaveLength(0)
      expect(mockConnection.get).toHaveBeenCalledWith('/api/v1/meta/schemas/apps/1/default', undefined)
      expect(result.deployResult.errors).toHaveLength(1)
      expect(result.deployResult.errors[0].message).toContain('Failed to get /api/v1/meta/schemas/apps/1/default')
    })
  })
})
