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
import { BuiltinTypes, Change, CORE_ANNOTATIONS, ElemID, getChangeData, InstanceElement, ObjectType, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import _ from 'lodash'
import { resolveChangeElement } from '@salto-io/adapter-utils'
import { deployment, filterUtils, client as clientUtils } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import { PRIVATE_API_HEADERS } from '../../../src/client/headers'
import { getFilterParams, mockClient } from '../../utils'
import dashboardDeploymentFilter from '../../../src/filters/dashboard/dashboard_deployment'
import { getDefaultConfig, JiraConfig } from '../../../src/config/config'
import { DASHBOARD_GADGET_POSITION_TYPE, DASHBOARD_GADGET_TYPE, DASHBOARD_TYPE, JIRA } from '../../../src/constants'
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

describe('dashboardDeploymentFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch' | 'deploy'>
  let dashboardType: ObjectType
  let positionType: ObjectType
  let config: JiraConfig
  let client: JiraClient
  let connection: MockInterface<clientUtils.APIConnection>


  beforeEach(async () => {
    const { client: cli, paginator, connection: conn } = mockClient()
    client = cli
    connection = conn

    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    filter = dashboardDeploymentFilter(getFilterParams({
      client,
      paginator,
      config,
    })) as filterUtils.FilterWith<'onFetch' | 'deploy'>

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

    positionType = new ObjectType({
      elemID: new ElemID(JIRA, DASHBOARD_GADGET_POSITION_TYPE),
      fields: {
        row: {
          refType: BuiltinTypes.NUMBER,
        },
        column: {
          refType: BuiltinTypes.NUMBER,
        },
      },
    })
  })

  describe('onFetch', () => {
    it('should add deployment annotations to position type', async () => {
      await filter.onFetch?.([positionType])
      expect(positionType.fields.row.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })

      expect(positionType.fields.column.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })
    })

    it('should add deployment annotations to dashboard type', async () => {
      await filter.onFetch?.([dashboardType])
      expect(dashboardType.fields.gadgets.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })

      expect(dashboardType.fields.layout.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })
    })

    it('should not add deployment annotations to layout if usePrivateAPI is false', async () => {
      config.client.usePrivateAPI = false

      await filter.onFetch?.([dashboardType])

      expect(dashboardType.fields.layout.annotations).toEqual({})
    })
  })

  describe('deploy', () => {
    const deployChangeMock = deployment.deployChange as jest.MockedFunction<
      typeof deployment.deployChange
    >

    let change: Change<InstanceElement>

    beforeEach(async () => {
      deployChangeMock.mockClear()
      const instance = new InstanceElement(
        'instance',
        dashboardType,
        {
          id: '0',
          layout: 'AAA',
          gadgets: [
            new ReferenceExpression(new ElemID(JIRA, DASHBOARD_GADGET_TYPE, 'instance', 'gadget1'), {
              value: {
                id: '1',
                position: {
                  column: 0,
                  row: 0,
                },
              },
            }),

            new ReferenceExpression(new ElemID(JIRA, DASHBOARD_GADGET_TYPE, 'instance', 'gadget2'), {
              value: {
                id: '2',
                position: {
                  column: 1,
                  row: 0,
                },
              },
            }),

            new ReferenceExpression(new ElemID(JIRA, DASHBOARD_GADGET_TYPE, 'instance', 'gadget3'), {
              value: {
                id: '3',
                position: {
                  column: 2,
                  row: 0,
                },
              },
            }),
          ],
        }
      )

      change = toChange({ after: instance })
    })

    it('should call the default deploy', async () => {
      await filter.deploy([change])
      expect(deployChangeMock).toHaveBeenCalledWith({
        change: await resolveChangeElement(change, getLookUpName),
        client,
        endpointDetails: getDefaultConfig({ isDataCenter: false })
          .apiDefinitions.types[DASHBOARD_TYPE].deployRequests,
        fieldsToIgnore: [
          'layout',
          'gadgets',
        ],
      })
    })

    it('should call layout with the right parameters on addition', async () => {
      await filter.deploy([change])
      expect(connection.put).toHaveBeenCalledWith(
        '/rest/dashboards/1.0/0/layout',
        {
          layout: 'AAA',
          0: [],
          1: [],
          2: [],
        },
        {
          headers: PRIVATE_API_HEADERS,
        },
      )
    })

    it('should call layout with the right parameters on modification', async () => {
      const instanceBefore = getChangeData(change)
      const instanceAfter = getChangeData(change).clone()
      instanceAfter.value.layout = 'AA'

      await filter.deploy([toChange({ before: instanceBefore, after: instanceAfter })])
      expect(connection.put).toHaveBeenCalledWith(
        '/rest/dashboards/1.0/0/layout',
        {
          layout: 'AA',
          0: ['1'],
          1: ['2', '3'],
          2: [],
        },
        {
          headers: PRIVATE_API_HEADERS,
        },
      )
    })

    it('should call layout with the right parameters on modification without gadgets', async () => {
      const instanceBefore = getChangeData(change)
      const instanceAfter = getChangeData(change).clone()
      instanceBefore.value.layout = 'AA'
      delete instanceBefore.value.gadgets

      await filter.deploy([toChange({ before: instanceBefore, after: instanceAfter })])
      expect(connection.put).toHaveBeenCalledWith(
        '/rest/dashboards/1.0/0/layout',
        {
          layout: 'AAA',
          0: [],
          1: [],
          2: [],
        },
        {
          headers: PRIVATE_API_HEADERS,
        },
      )
    })

    it('should not call layout with if did not change', async () => {
      const instanceBefore = getChangeData(change)
      const instanceAfter = getChangeData(change).clone()

      await filter.deploy([toChange({ before: instanceBefore, after: instanceAfter })])
      expect(connection.put).not.toHaveBeenCalledWith()
    })
  })
})
