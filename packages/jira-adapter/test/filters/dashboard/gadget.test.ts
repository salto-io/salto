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
  Change,
  CORE_ANNOTATIONS,
  ElemID,
  InstanceElement,
  Element,
  ObjectType,
  ReferenceExpression,
  toChange,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { deployment, filterUtils, client as clientUtils, resolveChangeElement } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import { getFilterParams, mockClient } from '../../utils'
import gadgetFilter, {
  getDashboardPropertiesAsync,
  promiseInstantToPropertiesResponse,
} from '../../../src/filters/dashboard/gadget'
import { getDefaultConfig, JiraConfig } from '../../../src/config/config'
import { DASHBOARD_GADGET_TYPE, DASHBOARD_TYPE, JIRA } from '../../../src/constants'
import JiraClient from '../../../src/client/client'
import { getLookUpName } from '../../../src/reference_mapping'

jest.mock('@salto-io/adapter-components', () => {
  const actual = jest.requireActual('@salto-io/adapter-components')
  return {
    ...actual,
    deployment: {
      ...actual.deployment,
      deployChange: jest.fn(),
    },
  }
})

describe('gadgetFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch' | 'deploy'>
  let dashboardGadgetType: ObjectType
  let instance: InstanceElement
  let config: JiraConfig
  let client: JiraClient
  let connection: MockInterface<clientUtils.APIConnection>
  let elements: Element[]
  let adapterContext: { dashboardPropertiesPromise: Promise<promiseInstantToPropertiesResponse> }

  beforeEach(async () => {
    const { client: cli, paginator, connection: conn } = mockClient()
    client = cli
    connection = conn
    adapterContext = {
      dashboardPropertiesPromise: Promise.resolve([]),
    }
    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    filter = gadgetFilter(
      getFilterParams({
        client,
        paginator,
        config,
        adapterContext,
      }),
    ) as filterUtils.FilterWith<'onFetch' | 'deploy'>

    dashboardGadgetType = new ObjectType({
      elemID: new ElemID(JIRA, DASHBOARD_GADGET_TYPE),
      fields: {
        properties: {
          refType: BuiltinTypes.STRING,
        },
      },
    })

    instance = new InstanceElement(
      'instance',
      dashboardGadgetType,
      {
        id: '1',
      },
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: [
          new ReferenceExpression(new ElemID(JIRA, DASHBOARD_TYPE, 'instance', 'parent'), {
            value: {
              id: '0',
            },
          }),
        ],
      },
    )

    connection.get.mockImplementation(async (url: string) => {
      if (url.endsWith('/properties')) {
        return {
          status: 200,
          data: {
            keys: [
              {
                key: 'key1',
              },
              {
                key: 'key2',
              },
            ],
          },
        }
      }

      if (url.endsWith('/key1')) {
        return {
          status: 200,
          data: {
            value: 'value1',
          },
        }
      }

      if (url.endsWith('/key2')) {
        return {
          status: 200,
          data: {
            value: 'value2',
          },
        }
      }

      throw new Error('Unexpected url')
    })
    elements = [instance]
  })

  describe('async get', () => {
    it('should return the dashboard properties', async () => {
      const response = await Promise.all(
        (await getDashboardPropertiesAsync(client, elements)) as promiseInstantToPropertiesResponse,
      )
      expect(response).toHaveLength(1)
      expect(response[0][0]).toBe(instance)
      expect(await response[0][1]).toEqual([
        ['key1', 'value1'],
        ['key2', 'value2'],
      ])
    })

    it('should return empty list if the elements are not instances', async () => {
      const response = await getDashboardPropertiesAsync(client, [dashboardGadgetType])
      expect(response).toHaveLength(0)
    })

    it('should return empty list if the request threw an error', async () => {
      connection.get.mockRejectedValue(new Error('error'))
      const response = await Promise.all(
        (await getDashboardPropertiesAsync(client, elements)) as promiseInstantToPropertiesResponse,
      )
      expect(response).toHaveLength(1)
      expect(response[0][0]).toBe(instance)
      expect(await response[0][1]).toEqual([])
    })
    it('should return empty list when got invalid response from keys request', async () => {
      connection.get.mockImplementation(async (url: string) => {
        if (url.endsWith('/properties')) {
          return {
            status: 200,
            data: [],
          }
        }

        if (url.endsWith('/key1')) {
          return {
            status: 200,
            data: {
              value: 'value1',
            },
          }
        }

        if (url.endsWith('/key2')) {
          return {
            status: 200,
            data: {
              value: 'value2',
            },
          }
        }

        throw new Error('Unexpected url')
      })
      const response = await Promise.all(
        (await getDashboardPropertiesAsync(client, elements)) as promiseInstantToPropertiesResponse,
      )

      expect(connection.get).not.toHaveBeenCalledWith('/rest/api/3/dashboard/0/items/1/properties/key1', undefined)

      expect(connection.get).not.toHaveBeenCalledWith('/rest/api/3/dashboard/0/items/1/properties/key2', undefined)

      expect(response[0][0]).toBe(instance)
      expect(await response[0][1]).toEqual([])
    })
    it('should not add properties when keys request failed', async () => {
      connection.get.mockRejectedValue(new Error('Failed to get keys'))

      const response = await Promise.all(
        (await getDashboardPropertiesAsync(client, elements)) as promiseInstantToPropertiesResponse,
      )

      expect(response[0][0]).toBe(instance)
      expect(await response[0][1]).toEqual([])
    })

    it('should not add properties when got invalid response from values request', async () => {
      connection.get.mockImplementation(async (url: string) => {
        if (url.endsWith('/properties')) {
          return {
            status: 200,
            data: {
              keys: [
                {
                  key: 'key1',
                },
                {
                  key: 'key2',
                },
              ],
            },
          }
        }

        if (url.endsWith('/key1')) {
          return {
            status: 200,
            data: [],
          }
        }

        if (url.endsWith('/key2')) {
          return {
            status: 200,
            data: {
              value: 'value2',
            },
          }
        }

        throw new Error('Unexpected url')
      })

      const response = await Promise.all(
        (await getDashboardPropertiesAsync(client, elements)) as promiseInstantToPropertiesResponse,
      )

      expect(response[0][0]).toBe(instance)
      expect(await response[0][1]).toEqual([
        ['key1', undefined],
        ['key2', 'value2'],
      ])
    })

    it('should not add properties when values request failed', async () => {
      connection.get.mockImplementation(async (url: string) => {
        if (url.endsWith('/properties')) {
          return {
            status: 200,
            data: {
              keys: [
                {
                  key: 'key1',
                },
                {
                  key: 'key2',
                },
              ],
            },
          }
        }

        if (url.endsWith('/key1')) {
          throw new Error('Failed to get value')
        }

        if (url.endsWith('/key2')) {
          return {
            status: 200,
            data: {
              value: 'value2',
            },
          }
        }

        throw new Error('Unexpected url')
      })

      const response = await Promise.all(
        (await getDashboardPropertiesAsync(client, elements)) as promiseInstantToPropertiesResponse,
      )

      expect(response[0][0]).toBe(instance)
      expect(await response[0][1]).toEqual([
        ['key1', undefined],
        ['key2', 'value2'],
      ])
    })
  })
  describe('onFetch', () => {
    it('should add deployment annotations to properties field', async () => {
      elements = [dashboardGadgetType]
      adapterContext.dashboardPropertiesPromise = new Promise<[]>(res => res([]))
      await filter.onFetch?.(elements)
      expect(dashboardGadgetType.fields.properties.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })
    })
  })

  describe('fetch + async get', () => {
    it('should add properties values', async () => {
      adapterContext.dashboardPropertiesPromise = getDashboardPropertiesAsync(client, elements)

      await filter.onFetch?.(elements)

      expect(connection.get).toHaveBeenCalledWith('/rest/api/3/dashboard/0/items/1/properties', undefined)

      expect(connection.get).toHaveBeenCalledWith('/rest/api/3/dashboard/0/items/1/properties/key1', undefined)

      expect(connection.get).toHaveBeenCalledWith('/rest/api/3/dashboard/0/items/1/properties/key2', undefined)

      expect(instance.value.properties).toEqual({
        key1: 'value1',
        key2: 'value2',
      })
    })
  })
  describe('deploy', () => {
    const deployChangeMock = deployment.deployChange as jest.MockedFunction<typeof deployment.deployChange>

    let change: Change<InstanceElement>

    beforeEach(async () => {
      deployChangeMock.mockReset()

      instance = new InstanceElement(
        'instance',
        dashboardGadgetType,
        {
          id: '1',
        },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: [
            new ReferenceExpression(new ElemID(JIRA, DASHBOARD_TYPE, 'instance', 'parent'), {
              value: {
                id: '0',
              },
            }),
          ],
        },
      )

      instance.value.properties = {
        key1: 'value1',
        key2: 'value2',
      }
      // references are resolved in pre deploy
      instance.annotations[CORE_ANNOTATIONS.PARENT][0] = { id: '0' }

      change = toChange({ after: instance })
    })

    it('should call the default deploy', async () => {
      await filter.deploy([change])
      expect(deployChangeMock).toHaveBeenCalledWith({
        change: await resolveChangeElement(change, getLookUpName),
        client,
        endpointDetails: getDefaultConfig({ isDataCenter: false }).apiDefinitions.types[DASHBOARD_GADGET_TYPE]
          .deployRequests,
        fieldsToIgnore: ['properties'],
      })
    })

    it('should do nothing if removal throws 404', async () => {
      deployChangeMock.mockRejectedValue(
        new clientUtils.HTTPError('message', {
          status: 404,
          data: {},
        }),
      )
      const { deployResult } = await filter.deploy([toChange({ before: instance })])

      expect(deployResult.appliedChanges).toHaveLength(1)
      expect(deployResult.errors).toHaveLength(0)
    })

    it('should return the error if removal throws other errors', async () => {
      deployChangeMock.mockRejectedValue(new Error('message'))
      const { deployResult } = await filter.deploy([toChange({ before: instance })])

      expect(deployResult.appliedChanges).toHaveLength(0)
      expect(deployResult.errors).toHaveLength(1)
    })

    it('should call update the properties', async () => {
      await filter.deploy([change])
      expect(connection.put).toHaveBeenCalledWith('/rest/api/3/dashboard/0/items/1/properties/key1', '"value1"', {
        headers: {
          'Content-Type': 'application/json',
        },
      })

      expect(connection.put).toHaveBeenCalledWith('/rest/api/3/dashboard/0/items/1/properties/key2', '"value2"', {
        headers: {
          'Content-Type': 'application/json',
        },
      })
    })

    it('should not call update when there are not properties', async () => {
      delete instance.value.properties
      await filter.deploy([change])
      expect(connection.put).not.toHaveBeenCalled()
    })
  })
})
