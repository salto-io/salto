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
import { BuiltinTypes, Change, CORE_ANNOTATIONS, ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { filterUtils, client as clientUtils, deployment } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import _ from 'lodash'
import { COLUMNS_CONFIG_FIELD } from '../../../src/filters/board/board_columns'
import { PRIVATE_API_HEADERS } from '../../../src/client/headers'
import JiraClient from '../../../src/client/client'
import { getDefaultConfig, JiraConfig } from '../../../src/config/config'
import { BOARD_LOCATION_TYPE, BOARD_TYPE_NAME, JIRA } from '../../../src/constants'
import boardDeploymentFilter from '../../../src/filters/board/board_deployment'
import { getFilterParams, mockClient } from '../../utils'

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

describe('boardDeploymentFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch' | 'deploy'>
  let instance: InstanceElement
  let type: ObjectType
  let locationType: ObjectType
  let connection: MockInterface<clientUtils.APIConnection>
  let client: JiraClient
  let config: JiraConfig

  beforeEach(async () => {
    const { client: cli, paginator, connection: conn } = mockClient()
    connection = conn
    client = cli

    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))

    filter = boardDeploymentFilter(getFilterParams({
      client,
      paginator,
      config,
    })) as typeof filter

    locationType = new ObjectType({
      elemID: new ElemID(JIRA, BOARD_LOCATION_TYPE),
      fields: {
        projectId: {
          refType: BuiltinTypes.STRING,
        },
      },
    })
    type = new ObjectType({
      elemID: new ElemID(JIRA, BOARD_TYPE_NAME),
      fields: {
        location: { refType: locationType },
        name: { refType: BuiltinTypes.STRING },
        filterId: { refType: BuiltinTypes.STRING },
      },
    })

    instance = new InstanceElement(
      'instance',
      type,
      {
        id: '1',
        name: 'someName',
        filterId: '2',
        location: {
          projectKeyOrId: '3',
          type: 'project',
        },
        [COLUMNS_CONFIG_FIELD]: {
          columns: [
            {
              name: 'someColumn',
              statuses: ['4'],
              min: 2,
              max: 4,
            },
          ],
          constraintType: 'issueCount',
        },
        estimation: {
          field: '5',
          timeTracking: '6',
        },
        subQuery: 'someQuery',
      }
    )

    connection.get.mockResolvedValue({
      status: 200,
      data: {
        currentTrackingStatistic: {
          fieldId: 'someOtherFieldId',
        },
      },
    })
  })

  describe('onFetch', () => {
    it('should add deployment annotations', async () => {
      await filter.onFetch([type, locationType])

      expect(type.annotations).toEqual({
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })

      expect(type.fields.name.annotations).toEqual({
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })

      expect(type.fields.filterId.annotations).toEqual({
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })

      expect(type.fields.location.annotations).toEqual({
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })

      expect(locationType.fields.projectId.annotations).toEqual({
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })
    })

    it('should not add deployment annotations when usePrivateApi is false', async () => {
      config.client.usePrivateAPI = false
      await filter.onFetch([type, locationType])

      expect(type.annotations).toEqual({})
      expect(type.fields.name.annotations).toEqual({})
      expect(type.fields.filterId.annotations).toEqual({})
      expect(type.fields.location.annotations).toEqual({})
      expect(locationType.fields.projectId.annotations).toEqual({})
    })

    it('should not add deployment annotations when types not found', async () => {
      await filter.onFetch([])

      expect(type.annotations).toEqual({})
      expect(type.fields.name.annotations).toEqual({})
      expect(type.fields.filterId.annotations).toEqual({})
      expect(type.fields.location.annotations).toEqual({})
      expect(locationType.fields.projectId.annotations).toEqual({})
    })
  })

  describe('deploy', () => {
    let change: Change<InstanceElement>
    const deployChangeMock = deployment.deployChange as jest.MockedFunction<
        typeof deployment.deployChange
      >

    beforeEach(() => {
      deployChangeMock.mockReset()

      connection.get.mockResolvedValue({
        status: 200,
        data: {
          [COLUMNS_CONFIG_FIELD]: {
            columns: [
              {
                name: 'someColumn',
              },
            ],
          },
        },
      })
    })

    describe('creation', () => {
      beforeEach(() => {
        change = toChange({ after: instance })
      })
      it('deploy should call the right endpoints', async () => {
        await filter.deploy([change])

        expect(deployChangeMock).toHaveBeenCalledWith({
          change,
          client,
          endpointDetails: getDefaultConfig({ isDataCenter: false })
            .apiDefinitions.types[BOARD_TYPE_NAME].deployRequests,
          fieldsToIgnore: [COLUMNS_CONFIG_FIELD, 'subQuery', 'estimation'],
        })

        expect(connection.put).toHaveBeenCalledWith(
          '/rest/greenhopper/1.0/rapidviewconfig/columns',
          {
            currentStatisticsField: {
              id: 'issueCount_',
            },
            rapidViewId: '1',
            mappedColumns: [
              {
                name: 'someColumn',
                mappedStatuses: [{ id: '4' }],
                min: 2,
                max: 4,
              },
            ],
          },
          {
            headers: PRIVATE_API_HEADERS,
          }
        )

        expect(connection.put).toHaveBeenCalledWith(
          '/rest/greenhopper/1.0/subqueries/1',
          {
            query: 'someQuery',
          },
          {
            headers: PRIVATE_API_HEADERS,
          }
        )

        expect(connection.put).toHaveBeenCalledWith(
          '/rest/greenhopper/1.0/rapidviewconfig/estimation',
          {
            rapidViewId: '1',
            estimateStatisticId: 'field_5',
            trackingStatisticId: 'field_6',
          },
          {
            headers: PRIVATE_API_HEADERS,
          }
        )
      })

      it('deploy should not call config endpoints if config not defined', async () => {
        delete instance.value[COLUMNS_CONFIG_FIELD]
        delete instance.value.estimation
        delete instance.value.subQuery

        await filter.deploy([change])

        expect(deployChangeMock).toHaveBeenCalledWith({
          change,
          client,
          endpointDetails: getDefaultConfig({ isDataCenter: false })
            .apiDefinitions.types[BOARD_TYPE_NAME].deployRequests,
          fieldsToIgnore: [COLUMNS_CONFIG_FIELD, 'subQuery', 'estimation'],
        })

        expect(connection.put).not.toHaveBeenCalledWith(
          '/rest/greenhopper/1.0/rapidviewconfig/columns',
          expect.anything(),
          expect.anything(),
        )

        expect(connection.put).not.toHaveBeenCalledWith(
          '/rest/greenhopper/1.0/rapidviewconfig/estimation',
          expect.anything(),
          expect.anything(),
        )
      })
    })

    describe('modification', () => {
      let instanceBefore: InstanceElement
      beforeEach(() => {
        instanceBefore = instance.clone()
        change = toChange({ before: instanceBefore, after: instance })
      })
      it('should deploy name when changed', async () => {
        instance.value.name = 'newName'
        await filter.deploy([change])

        expect(connection.put).toHaveBeenCalledWith(
          '/rest/greenhopper/1.0/rapidviewconfig/name',
          {
            id: '1',
            name: 'newName',
          },
          {
            headers: PRIVATE_API_HEADERS,
          }
        )

        expect(connection.put).toHaveBeenCalledOnce()
      })

      it('should deploy location when changed', async () => {
        instance.value.location.projectKeyOrId = '7'
        await filter.deploy([change])

        expect(connection.put).toHaveBeenCalledWith(
          '/rest/greenhopper/1.0/rapidviewconfig/boardLocation',
          {
            locationId: '7',
            locationType: 'project',
            rapidViewId: '1',
          },
          {
            headers: PRIVATE_API_HEADERS,
          }
        )

        expect(connection.put).toHaveBeenCalledOnce()
      })

      it('should deploy filter when changed', async () => {
        instance.value.filterId = '8'
        await filter.deploy([change])

        expect(connection.put).toHaveBeenCalledWith(
          '/rest/greenhopper/1.0/rapidviewconfig/filter',
          {
            savedFilterId: '8',
            id: '1',
          },
          {
            headers: PRIVATE_API_HEADERS,
          }
        )

        expect(connection.put).toHaveBeenCalledOnce()
      })

      it('should deploy columns when changed', async () => {
        connection.get.mockResolvedValue({
          status: 200,
          data: {
            [COLUMNS_CONFIG_FIELD]: {
              columns: [
                {
                  name: 'someColumn2',
                },
              ],
            },
          },
        })

        instance.value[COLUMNS_CONFIG_FIELD] = {
          columns: [
            {
              name: 'someColumn2',
            },
          ],
        }
        await filter.deploy([change])

        expect(connection.put).toHaveBeenCalledWith(
          '/rest/greenhopper/1.0/rapidviewconfig/columns',
          {
            currentStatisticsField: {
              id: 'none_',
            },
            rapidViewId: '1',
            mappedColumns: [
              {
                name: 'someColumn2',
                mappedStatuses: [],
                min: '',
                max: '',
              },
            ],
          },
          {
            headers: PRIVATE_API_HEADERS,
          }
        )

        expect(connection.put).toHaveBeenCalledOnce()
      })

      it('should deploy columns of a kanban when changed', async () => {
        connection.get.mockResolvedValue({
          status: 200,
          data: {
            [COLUMNS_CONFIG_FIELD]: {
              columns: [
                {
                  name: 'backlog',
                },
                {
                  name: 'someColumn2',
                },
              ],
            },
          },
        })

        instance.value[COLUMNS_CONFIG_FIELD] = {
          columns: [
            {
              name: 'someColumn2',
            },
          ],
        }

        instance.value.type = 'kanban'

        await filter.deploy([change])

        expect(connection.put).toHaveBeenCalledWith(
          '/rest/greenhopper/1.0/rapidviewconfig/columns',
          {
            currentStatisticsField: {
              id: 'none_',
            },
            rapidViewId: '1',
            mappedColumns: [
              {
                name: 'someColumn2',
                mappedStatuses: [],
                min: '',
                max: '',
              },
            ],
          },
          {
            headers: PRIVATE_API_HEADERS,
          }
        )

        expect(connection.put).toHaveBeenCalledOnce()
      })

      it('should retry deploy columns', async () => {
        connection.get.mockResolvedValueOnce({
          status: 200,
          data: {
            [COLUMNS_CONFIG_FIELD]: {
              columns: [
                {
                  name: 'someColumn',
                },
              ],
            },
          },
        })

        connection.get.mockResolvedValueOnce({
          status: 200,
          data: {
            [COLUMNS_CONFIG_FIELD]: {
              columns: [
                {
                  name: 'someColumn',
                },
              ],
            },
          },
        })

        connection.get.mockResolvedValueOnce({
          status: 200,
          data: {
            [COLUMNS_CONFIG_FIELD]: {
              columns: [
                {
                  name: 'someColumn2',
                },
              ],
            },
          },
        })

        instance.value[COLUMNS_CONFIG_FIELD] = {
          columns: [
            {
              name: 'someColumn2',
            },
          ],
        }
        await filter.deploy([change])

        expect(connection.put).toHaveBeenCalledWith(
          '/rest/greenhopper/1.0/rapidviewconfig/columns',
          {
            currentStatisticsField: {
              id: 'none_',
            },
            rapidViewId: '1',
            mappedColumns: [
              {
                name: 'someColumn2',
                mappedStatuses: [],
                min: '',
                max: '',
              },
            ],
          },
          {
            headers: PRIVATE_API_HEADERS,
          }
        )

        expect(connection.put).toHaveBeenCalledTimes(3)
      })

      it('should throw if deploy columns does not change the columns', async () => {
        connection.get.mockResolvedValue({
          status: 200,
          data: {
            [COLUMNS_CONFIG_FIELD]: {
              columns: [
                {
                  name: 'someColumn',
                },
              ],
            },
          },
        })

        instance.value[COLUMNS_CONFIG_FIELD] = {
          columns: [
            {
              name: 'someColumn2',
            },
          ],
        }
        const { deployResult } = await filter.deploy([change])

        expect(connection.put).toHaveBeenCalledTimes(6)
        expect(deployResult.errors).toHaveLength(1)
      })

      it('should do nothing if get columns response is invalid', async () => {
        connection.get.mockResolvedValue({
          status: 200,
          data: {
          },
        })

        instance.value[COLUMNS_CONFIG_FIELD] = {
          columns: [
            {
              name: 'someColumn2',
            },
          ],
        }
        await filter.deploy([change])
      })

      it('should deploy sub query when changed', async () => {
        delete instance.value.subQuery
        await filter.deploy([change])

        expect(connection.put).toHaveBeenCalledWith(
          '/rest/greenhopper/1.0/subqueries/1',
          {
            query: '',
          },
          {
            headers: PRIVATE_API_HEADERS,
          }
        )

        expect(connection.put).toHaveBeenCalledOnce()
      })

      it('should deploy estimation when changed', async () => {
        instance.value.estimation = {
          field: '9',
        }
        await filter.deploy([change])

        expect(connection.put).toHaveBeenCalledWith(
          '/rest/greenhopper/1.0/rapidviewconfig/estimation',
          {
            rapidViewId: '1',
            estimateStatisticId: 'field_9',
            trackingStatisticId: 'none_',
          },
          {
            headers: PRIVATE_API_HEADERS,
          }
        )

        expect(connection.put).toHaveBeenCalledOnce()
      })

      it('should not call config endpoints if config not defined', async () => {
        delete instance.value[COLUMNS_CONFIG_FIELD]
        delete instance.value.estimation
        delete instance.value.subQuery

        delete instanceBefore.value[COLUMNS_CONFIG_FIELD]
        delete instanceBefore.value.estimation
        delete instanceBefore.value.subQuery

        await filter.deploy([change])

        expect(connection.put).not.toHaveBeenCalledWith(
          '/rest/greenhopper/1.0/rapidviewconfig/columns',
          expect.anything(),
          expect.anything(),
        )

        expect(connection.put).not.toHaveBeenCalledWith(
          expect.stringContaining('/rest/greenhopper/1.0/subqueries'),
          expect.anything(),
          expect.anything(),
        )

        expect(connection.put).not.toHaveBeenCalledWith(
          '/rest/greenhopper/1.0/rapidviewconfig/estimation',
          expect.anything(),
          expect.anything(),
        )
      })
    })
  })
})
