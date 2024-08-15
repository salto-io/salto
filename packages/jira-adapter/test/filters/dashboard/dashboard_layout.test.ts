/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { BuiltinTypes, ElemID, InstanceElement, ObjectType, Element, Values } from '@salto-io/adapter-api'
import _ from 'lodash'
import { filterUtils, client as clientUtils } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import { getFilterParams, mockClient } from '../../utils'
import dashboardLayoutFilter, {
  getDashboardLayoutsAsync,
  InstanceToResponse,
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
  let adapterContext: Values = {}

  beforeEach(async () => {
    const { client: cli, paginator, connection: conn } = mockClient()
    client = cli
    connection = conn
    adapterContext = { dashboardLayoutPromise: [] }
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
  })

  describe('async get', () => {
    it('should return the dashboard layout', async () => {
      const response = getDashboardLayoutsAsync(client, config, elements) as InstanceToResponse[]

      expect(response).toHaveLength(1)
      expect(response[0].instance).toBe(instance)
      expect(await response[0].PromiseResponse).toEqual({
        status: 200,
        data: {
          layout: 'AAA',
        },
      })
    })

    it('should return empty list if the config usePrivateAPI is false', async () => {
      config.client.usePrivateAPI = false
      const response = getDashboardLayoutsAsync(client, config, elements)
      expect(response).toHaveLength(0)
    })

    it('should return empty list if there is no Dashboard instances in the elements', async () => {
      const response = getDashboardLayoutsAsync(client, config, [dashboardType]) as InstanceToResponse[]
      expect(response).toHaveLength(0)
    })
    it('should return undefined if the request threw an error', async () => {
      connection.get.mockRejectedValue(new Error('error'))
      const response = getDashboardLayoutsAsync(client, config, elements) as InstanceToResponse[]
      expect(response).toHaveLength(1)
      expect(await response[0].PromiseResponse).toBeUndefined()
    })
  })
  describe('onFetch', () => {
    it('should add layout to the instance', async () => {
      const Apiresponse = {
        status: 200,
        data: {
          layout: 'AAA',
        },
      }
      adapterContext.dashboardLayoutPromise = [{ instance, PromiseResponse: Apiresponse }]
      await filter.onFetch(elements)
      expect(instance.value.layout).toBe('AAA')
    })
    it('should add layout to the instance with Promise', async () => {
      const Apiresponse = new Promise<clientUtils.Response<clientUtils.ResponseValue>>(resolve =>
        resolve({
          status: 200,
          data: {
            layout: 'AAA',
          },
        }),
      )
      adapterContext.dashboardLayoutPromise = [{ instance, PromiseResponse: Apiresponse }]
      await filter.onFetch(elements)
      expect(instance.value.layout).toBe('AAA')
    })

    it('should not add layout when dashboardLayoutPromise is undefined', async () => {
      const Errorresponse = undefined
      adapterContext.dashboardLayoutPromise = [{ instance, PromiseResponse: Errorresponse }]
      await filter.onFetch(elements)

      expect(instance.value.layout).toBeUndefined()
      expect(connection.get).not.toHaveBeenCalled()
    })
    it('should not add layout if response is invalid', async () => {
      const Apiresponse = {
        status: 200,
        data: [],
      }
      adapterContext.dashboardLayoutPromise = [{ instance, PromiseResponse: Apiresponse }]
      await filter.onFetch(elements)
      expect(instance.value.layout).toBeUndefined()
    })
  })
})
