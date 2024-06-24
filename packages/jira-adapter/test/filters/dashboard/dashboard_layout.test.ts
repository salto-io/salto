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
import { BuiltinTypes, ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import _ from 'lodash'
import { filterUtils, client as clientUtils } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import { getFilterParams, mockClient } from '../../utils'
import dashboardLayoutFilter from '../../../src/filters/dashboard/dashboard_layout'
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

  beforeEach(async () => {
    const { client: cli, paginator, connection: conn } = mockClient()
    client = cli
    connection = conn

    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    filter = dashboardLayoutFilter(
      getFilterParams({
        client,
        paginator,
        config,
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
  })

  describe('onFetch', () => {
    it('should add layout to the instance', async () => {
      await filter.onFetch([instance])

      expect(instance.value.layout).toBe('AAA')
      expect(connection.get).toHaveBeenCalledWith('/rest/dashboards/1.0/1', undefined)
    })

    it('should not add layout to the instance if usePrivateAPI is false', async () => {
      config.client.usePrivateAPI = false
      await filter.onFetch([instance])

      expect(instance.value.layout).toBeUndefined()
      expect(connection.get).not.toHaveBeenCalled()
    })

    it('should not add layout if response is invalid', async () => {
      connection.get.mockResolvedValue({
        status: 200,
        data: [],
      })
      await filter.onFetch([instance])

      expect(instance.value.layout).toBeUndefined()
    })

    it('should not add layout if request threw an error', async () => {
      connection.get.mockRejectedValue(new Error('error'))
      await filter.onFetch([instance])

      expect(instance.value.layout).toBeUndefined()
    })
  })
})
