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
import { BuiltinTypes, Change, CORE_ANNOTATIONS, ElemID, InstanceElement, ObjectType, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import _ from 'lodash'
import { resolveChangeElement } from '@salto-io/adapter-utils'
import { deployment, filterUtils, client as clientUtils } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import { getFilterParams, mockClient } from '../../utils'
import gadgetFilter from '../../../src/filters/dashboard/gadget'
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


  beforeEach(async () => {
    const { client: cli, paginator, connection: conn } = mockClient()
    client = cli
    connection = conn

    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    filter = gadgetFilter(getFilterParams({
      client,
      paginator,
      config,
    })) as filterUtils.FilterWith<'onFetch' | 'deploy'>

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
      }
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
  })

  describe('onFetch', () => {
    it('should add deployment annotations to properties field', async () => {
      await filter.onFetch?.([dashboardGadgetType])
      expect(dashboardGadgetType.fields.properties.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })
    })

    it('should add properties values', async () => {
      await filter.onFetch?.([instance])

      expect(connection.get).toHaveBeenCalledWith(
        '/rest/api/3/dashboard/0/items/1/properties',
        undefined,
      )

      expect(connection.get).toHaveBeenCalledWith(
        '/rest/api/3/dashboard/0/items/1/properties/key1',
        undefined,
      )

      expect(connection.get).toHaveBeenCalledWith(
        '/rest/api/3/dashboard/0/items/1/properties/key2',
        undefined,
      )

      expect(instance.value.properties).toEqual({
        key1: 'value1',
        key2: 'value2',
      })
    })

    it('should not add properties when got invalid response from keys request', async () => {
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
      await filter.onFetch?.([instance])

      expect(connection.get).not.toHaveBeenCalledWith(
        '/rest/api/3/dashboard/0/items/1/properties/key1',
        undefined,
      )

      expect(connection.get).not.toHaveBeenCalledWith(
        '/rest/api/3/dashboard/0/items/1/properties/key2',
        undefined,
      )

      expect(instance.value.properties).toEqual({})
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
      await filter.onFetch?.([instance])

      expect(instance.value.properties).toEqual({
        key2: 'value2',
      })
    })
  })

  describe('deploy', () => {
    const deployChangeMock = deployment.deployChange as jest.MockedFunction<
      typeof deployment.deployChange
    >

    let change: Change<InstanceElement>

    beforeEach(async () => {
      deployChangeMock.mockReset()

      instance.value.properties = {
        key1: 'value1',
        key2: 'value2',
      }

      change = toChange({ after: instance })
    })

    it('should call the default deploy', async () => {
      await filter.deploy([change])
      expect(deployChangeMock).toHaveBeenCalledWith({
        change: await resolveChangeElement(change, getLookUpName),
        client,
        endpointDetails: getDefaultConfig({ isDataCenter: false })
          .apiDefinitions.types[DASHBOARD_GADGET_TYPE].deployRequests,
        fieldsToIgnore: ['properties'],
      })
    })

    it('should do nothing if removal throws 404', async () => {
      deployChangeMock.mockRejectedValue(new clientUtils.HTTPError('message', {
        status: 404,
        data: {},
      }))
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
      expect(connection.put).toHaveBeenCalledWith(
        '/rest/api/3/dashboard/0/items/1/properties/key1',
        '"value1"',
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },

      )

      expect(connection.put).toHaveBeenCalledWith(
        '/rest/api/3/dashboard/0/items/1/properties/key2',
        '"value2"',
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },

      )
    })

    it('should not call update when there are not properties', async () => {
      delete instance.value.properties
      await filter.deploy([change])
      expect(connection.put).not.toHaveBeenCalled()
    })
  })
})
