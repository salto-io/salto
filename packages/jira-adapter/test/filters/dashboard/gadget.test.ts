/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
  Values,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { deployment, filterUtils, client as clientUtils, resolveChangeElement } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import { getFilterParams, mockClient } from '../../utils'
import gadgetFilter, {
  getDashboardPropertiesAsync,
  InstantToPropertiesResponse,
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
  let adapterContext: Values = {}

  beforeEach(async () => {
    const { client: cli, paginator, connection: conn } = mockClient()
    client = cli
    connection = conn

    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))

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
    adapterContext = {
      dashboardPropertiesPromise: [
        {
          instance,
          promisePropertyValues: { key1: 'value1', key2: 'value2', key3: [{ id: 1, field: 'cf[1]', value: null }] },
        },
      ],
    }
    filter = gadgetFilter(
      getFilterParams({
        client,
        paginator,
        config,
        adapterContext,
      }),
    ) as filterUtils.FilterWith<'onFetch' | 'deploy'>
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
    let responsePromise: InstantToPropertiesResponse[]
    beforeEach(async () => {
      responsePromise = getDashboardPropertiesAsync(client, elements)
    })
    it('should return the dashboard properties', async () => {
      expect(responsePromise).toHaveLength(1)
      expect(responsePromise[0].instance.value.id).toEqual('1')
      expect(await (await responsePromise[0].promisePropertyValues).key1).toEqual('value1')
      expect(await (await responsePromise[0].promisePropertyValues).key2).toEqual('value2')
    })

    it('should return empty list if the elements are not instances', async () => {
      responsePromise = getDashboardPropertiesAsync(client, [dashboardGadgetType])
      expect(responsePromise).toHaveLength(0)
    })

    it('should return empty list if the request threw an error', async () => {
      connection.get.mockRejectedValue(new Error('error'))
      expect(responsePromise).toHaveLength(1)
      expect(responsePromise[0].instance.value.id).toEqual('1')
      expect(await responsePromise[0].promisePropertyValues).toEqual({})
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

      expect(connection.get).not.toHaveBeenCalledWith('/rest/api/3/dashboard/0/items/1/properties/key1', undefined)

      expect(connection.get).not.toHaveBeenCalledWith('/rest/api/3/dashboard/0/items/1/properties/key2', undefined)

      expect(responsePromise).toHaveLength(1)
      expect(responsePromise[0].instance.value.id).toEqual('1')
      expect(await responsePromise[0].promisePropertyValues).toEqual({})
    })
    it('should not add properties when keys request failed', async () => {
      connection.get.mockRejectedValue(new Error('Failed to get keys'))
      expect(responsePromise).toHaveLength(1)
      expect(responsePromise[0].instance.value.id).toEqual('1')
      expect(await responsePromise[0].promisePropertyValues).toEqual({})
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

      expect(responsePromise).toHaveLength(1)
      expect(responsePromise[0].instance.value.id).toEqual('1')
      expect(await (await responsePromise[0].promisePropertyValues).key1).toEqual(undefined)
      expect(await (await responsePromise[0].promisePropertyValues).key2).toEqual('value2')
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

      expect(responsePromise).toHaveLength(1)
      expect(responsePromise[0].instance.value.id).toEqual('1')
      expect(await (await responsePromise[0].promisePropertyValues).key1).toEqual(undefined)
      expect(await (await responsePromise[0].promisePropertyValues).key2).toEqual('value2')
    })
  })
  describe('onFetch', () => {
    describe('properties', () => {
      beforeEach(async () => {
        await filter.onFetch?.(elements)
      })
      it('should add dashboard properties to the instance', () => {
        expect(instance.value.properties).toMatchObject({
          key1: 'value1',
          key2: 'value2',
          key3: expect.anything(),
        })
      })
      it('should omit null values from properties', () => {
        expect(instance.value.properties).toHaveProperty('key3', [{ id: 1, field: 'cf[1]' }])
      })
    })

    it('should add deployment annotations to properties field', async () => {
      elements = [dashboardGadgetType]
      await filter.onFetch?.(elements)
      expect(dashboardGadgetType.fields.properties.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
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
