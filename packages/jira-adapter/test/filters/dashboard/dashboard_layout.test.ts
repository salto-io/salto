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
import { BuiltinTypes, ElemID, InstanceElement, ObjectType, Element } from '@salto-io/adapter-api'
import _ from 'lodash'
import { filterUtils, client as clientUtils } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import { getFilterParams, mockClient } from '../../utils'
import dashboardLayoutFilter, {
  getDashboardLayoutsAsync,
  PromiseInstanceNameToResponse,
} from '../../../src/filters/dashboard/dashboard_layout'
import { getDefaultConfig, JiraConfig } from '../../../src/config/config'
import { DASHBOARD_TYPE, JIRA } from '../../../src/constants'
import JiraClient from '../../../src/client/client'

describe('dashboardLayoutFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch'>
  let dashboardType: ObjectType
  let instance: InstanceElement
  let config: JiraConfig
  let client: JiraClient
  let connection: MockInterface<clientUtils.APIConnection>
  let elements: Element[]
  let adapterContext: { dashboardLayoutPromise: Promise<PromiseInstanceNameToResponse | undefined> }

  beforeEach(async () => {
    const { client: cli, paginator, connection: conn } = mockClient()
    client = cli
    connection = conn
    adapterContext = { dashboardLayoutPromise: Promise.resolve(undefined) }
    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    filter = dashboardLayoutFilter(
      getFilterParams({
        paginator,
        adapterContext,
      }),
    ) as filterUtils.FilterWith<'onFetch'>

    dashboardType = new ObjectType({
      elemID: new ElemID(JIRA, DASHBOARD_TYPE),
      fields: {
        gadgets: {
          refType: BuiltinTypes.STRING,
        },

        layout: {
          refType: BuiltinTypes.STRING,
        },
      },
    })

    instance = new InstanceElement('instance', dashboardType, {
      id: '1',
    })

    connection.get.mockResolvedValue({
      status: 200,
      data: {
        layout: 'AAA',
      },
    })
    elements = [instance]
    adapterContext.dashboardLayoutPromise = getDashboardLayoutsAsync(client, config, elements)
  })

  describe('async get', () => {
    it('should return the dashboard layout', async () => {
      const response = await Promise.all(
        (await getDashboardLayoutsAsync(client, config, elements)) as PromiseInstanceNameToResponse,
      )

      expect(response).toHaveLength(1)
      expect(response[0][0]).toBe(instance)
      expect(response[0][1]).toEqual({
        status: 200,
        data: {
          layout: 'AAA',
        },
      })
    })

    it('should return undefined if the config usePrivateAPI is false', async () => {
      config.client.usePrivateAPI = false
      const response = await getDashboardLayoutsAsync(client, config, elements)
      expect(response).toBeUndefined()
    })

    it('should return empty list if the elements are not instances', async () => {
      const response = await getDashboardLayoutsAsync(client, config, [dashboardType])
      expect(response).toHaveLength(0)
    })
    it('should return undefined if the request threw an error', async () => {
      connection.get.mockRejectedValue(new Error('error'))
      const response = await Promise.all(
        (await getDashboardLayoutsAsync(client, config, elements)) as PromiseInstanceNameToResponse,
      )
      expect(response).toHaveLength(1)
      expect(response[0][0]).toBe(instance)
      expect(response[0][1]).toBeUndefined()
    })
  })
  describe('onFetch', () => {
    it('should add layout to the instance', async () => {
      const p1 = new Promise<
        [InstanceElement, clientUtils.Response<clientUtils.ResponseValue | clientUtils.ResponseValue[]>]
      >(resolve =>
        resolve([
          instance,
          {
            status: 200,
            data: {
              layout: 'AAA',
            },
          },
        ]),
      )
      adapterContext.dashboardLayoutPromise = new Promise<PromiseInstanceNameToResponse>(resolve => resolve([p1]))
      await filter.onFetch(elements)
      expect(instance.value.layout).toBe('AAA')
    })
    it('should not add layout when dashboardLayoutPromise is undefined', async () => {
      adapterContext.dashboardLayoutPromise = Promise.resolve(undefined)
      await filter.onFetch(elements)

      expect(instance.value.layout).toBeUndefined()
      expect(connection.get).not.toHaveBeenCalled()
    })
    it('should not add layout if response is invalid', async () => {
      const p1 = new Promise<
        [InstanceElement, clientUtils.Response<clientUtils.ResponseValue | clientUtils.ResponseValue[]>]
      >(resolve =>
        resolve([
          instance,
          {
            status: 200,
            data: [],
          },
        ]),
      )
      adapterContext.dashboardLayoutPromise = new Promise<PromiseInstanceNameToResponse>(resolve => resolve([p1]))
      await filter.onFetch(elements)
      expect(instance.value.layout).toBeUndefined()
    })
  })
})
