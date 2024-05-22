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
  CORE_ANNOTATIONS,
  ElemID,
  InstanceElement,
  ListType,
  ObjectType,
  Values,
  Element,
} from '@salto-io/adapter-api'
import { filterUtils, client as clientUtils } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import _ from 'lodash'
import { getDefaultConfig, JiraConfig } from '../../../src/config/config'
import { BOARD_COLUMN_CONFIG_TYPE, BOARD_TYPE_NAME, JIRA } from '../../../src/constants'
import boardColumnsFilter, { COLUMNS_CONFIG_FIELD, filterBoardColumns } from '../../../src/filters/board/board_columns'
import { getFilterParams, mockClient } from '../../utils'
import JiraClient from '../../../src/client/client'

describe('boardColumnsFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch'>
  let instance: InstanceElement
  let type: ObjectType
  let columnConfigType: ObjectType
  let config: JiraConfig
  let client: JiraClient
  let connection: MockInterface<clientUtils.APIConnection>
  let elements: Element[]
  const adapterContext: Values = {}
  let paginator: clientUtils.Paginator

  beforeEach(async () => {
    const mockCli = mockClient()
    client = mockCli.client
    connection = mockCli.connection
    paginator = mockCli.paginator
    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))

    columnConfigType = new ObjectType({
      elemID: new ElemID(JIRA, BOARD_COLUMN_CONFIG_TYPE),
      fields: {
        columns: {
          refType: new ListType(BuiltinTypes.STRING),
        },
      },
    })
    type = new ObjectType({
      elemID: new ElemID(JIRA, BOARD_TYPE_NAME),
      fields: {
        [COLUMNS_CONFIG_FIELD]: {
          refType: columnConfigType,
        },
      },
    })

    instance = new InstanceElement('instance', type, {
      type: 'kanban',
      config: {
        [COLUMNS_CONFIG_FIELD]: {
          columns: [
            {
              name: 'Backlog',
            },
            {
              name: 'someColumn',
              statuses: [
                {
                  id: '1',
                },
              ],
            },
          ],
          constraintType: 'issueCount',
        },
      },
    })
    elements = [instance]
    filter = boardColumnsFilter(
      getFilterParams({
        client,
        paginator,
        config,
        adapterContext,
      }),
    ) as typeof filter
  })

  describe('async get', () => {
    it('should move column config out of config', async () => {
      filterBoardColumns(client, elements)
      expect(instance.value[COLUMNS_CONFIG_FIELD]).toBeDefined()
      expect(instance.value.config[COLUMNS_CONFIG_FIELD]).toBeUndefined()
    })

    it('should remove first column if kanban', async () => {
      filterBoardColumns(client, elements)
      expect(instance.value[COLUMNS_CONFIG_FIELD]).toEqual({
        columns: [
          {
            name: 'someColumn',
            statuses: ['1'],
          },
        ],
        constraintType: 'issueCount',
      })
    })

    it('should not remove first column if scrum', async () => {
      instance.value.type = 'scrum'
      filterBoardColumns(client, elements)
      expect(instance.value[COLUMNS_CONFIG_FIELD]).toEqual({
        columns: [
          {
            name: 'Backlog',
          },
          {
            name: 'someColumn',
            statuses: ['1'],
          },
        ],
        constraintType: 'issueCount',
      })
    })

    it('should not remove second redundant backlog column', async () => {
      instance.value.config[COLUMNS_CONFIG_FIELD].columns.splice(1, 0, { name: 'Backlog' })
      connection.get.mockResolvedValue({
        status: 200,
        data: {
          [COLUMNS_CONFIG_FIELD]: {
            columns: [
              {
                name: 'Backlog',
              },
              {
                name: 'someColumn',
              },
            ],
          },
        },
      })
      filterBoardColumns(client, elements)
      expect(instance.value[COLUMNS_CONFIG_FIELD]).toEqual({
        columns: [
          {
            name: 'Backlog',
          },
          {
            name: 'someColumn',
            statuses: ['1'],
          },
        ],
        constraintType: 'issueCount',
      })
    })

    it('should not remove second backlog column if it is returned from the config request', async () => {
      instance.value.config[COLUMNS_CONFIG_FIELD].columns.splice(1, 0, { name: 'Backlog' })
      connection.get.mockResolvedValue({
        status: 200,
        data: {
          [COLUMNS_CONFIG_FIELD]: {
            columns: [
              {
                name: 'Backlog',
              },
              {
                name: 'Backlog',
              },
              {
                name: 'someColumn',
              },
            ],
          },
        },
      })
      filterBoardColumns(client, elements)
      expect(instance.value[COLUMNS_CONFIG_FIELD]).toEqual({
        columns: [
          {
            name: 'Backlog',
          },
          {
            name: 'someColumn',
            statuses: ['1'],
          },
        ],
        constraintType: 'issueCount',
      })
    })

    it('should do nothing if board does not have config', async () => {
      delete instance.value.config
      filterBoardColumns(client, elements)
      expect(instance.value[COLUMNS_CONFIG_FIELD]).toBeUndefined()
    })
    it('should not add deployment annotations when usePrivateApi is false', async () => {
      config.client.usePrivateAPI = false
      elements = [type, columnConfigType]
      filterBoardColumns(client, elements)
      expect(type.fields[COLUMNS_CONFIG_FIELD].annotations).toEqual({})
      expect(columnConfigType.fields.columns.annotations).toEqual({})
    })
  })
  describe('onFetch', () => {
    it('should remove second redundant backlog column', async () => {
      instance.value.config[COLUMNS_CONFIG_FIELD].columns.splice(1, 0, { name: 'Backlog' })
      instance.value[COLUMNS_CONFIG_FIELD] = instance.value.config[COLUMNS_CONFIG_FIELD]
      delete instance.value.config[COLUMNS_CONFIG_FIELD]
      instance.value[COLUMNS_CONFIG_FIELD].columns.forEach((column: Values) => {
        if (column.statuses !== undefined) {
          column.statuses = column.statuses.map((status: Values) => status.id)
        }
      })
      instance.value[COLUMNS_CONFIG_FIELD].columns.shift()

      adapterContext.boardsPromise = [
        {
          instance,
          promiseResponse: {
            status: 200,
            data: {
              [COLUMNS_CONFIG_FIELD]: {
                columns: [
                  {
                    name: 'Backlog',
                  },
                  {
                    name: 'someColumn',
                  },
                ],
              },
            },
          },
        },
      ]
      await filter.onFetch(elements)
      expect(instance.value[COLUMNS_CONFIG_FIELD]).toEqual({
        columns: [
          {
            name: 'someColumn',
            statuses: ['1'],
          },
        ],
        constraintType: 'issueCount',
      })
    })
    it('should not remove second backlog column if it is returned from the config request', async () => {
      instance.value.config[COLUMNS_CONFIG_FIELD].columns.splice(1, 0, { name: 'Backlog' })
      instance.value[COLUMNS_CONFIG_FIELD] = instance.value.config[COLUMNS_CONFIG_FIELD]
      delete instance.value.config[COLUMNS_CONFIG_FIELD]
      instance.value[COLUMNS_CONFIG_FIELD].columns.forEach((column: Values) => {
        if (column.statuses !== undefined) {
          column.statuses = column.statuses.map((status: Values) => status.id)
        }
      })
      instance.value[COLUMNS_CONFIG_FIELD].columns.shift()
      adapterContext.boardsPromise = [
        {
          instance,
          promiseResponse: {
            status: 200,
            data: {
              [COLUMNS_CONFIG_FIELD]: {
                columns: [
                  {
                    name: 'Backlog',
                  },
                  {
                    name: 'Backlog',
                  },
                  {
                    name: 'someColumn',
                  },
                ],
              },
            },
          },
        },
      ]

      await filter.onFetch(elements)
      expect(instance.value[COLUMNS_CONFIG_FIELD]).toEqual({
        columns: [
          {
            name: 'Backlog',
          },
          {
            name: 'someColumn',
            statuses: ['1'],
          },
        ],
        constraintType: 'issueCount',
      })
    })

    it('should do nothing if the boardsPromise return empty list', async () => {
      delete instance.value.config
      adapterContext.boardsPromise = []
      await filter.onFetch(elements)
      expect(instance.value[COLUMNS_CONFIG_FIELD]).toBeUndefined()
    })

    it('should add deployment annotations', async () => {
      elements = [type, columnConfigType]
      adapterContext.boardsPromise = []
      await filter.onFetch(elements)
      expect(type.fields[COLUMNS_CONFIG_FIELD].annotations).toEqual({
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })

      expect(columnConfigType.fields.columns.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })
    })

    it('should not add deployment annotations when usePrivateApi is false', async () => {
      config.client.usePrivateAPI = false
      elements = [type, columnConfigType]
      adapterContext.boardsPromise = []
      await filter.onFetch(elements)

      expect(type.fields[COLUMNS_CONFIG_FIELD].annotations).toEqual({})
      expect(columnConfigType.fields.columns.annotations).toEqual({})
    })
  })
})
