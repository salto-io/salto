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
import { BuiltinTypes, CORE_ANNOTATIONS, ElemID, InstanceElement, ListType, ObjectType } from '@salto-io/adapter-api'
import { filterUtils, client as clientUtils } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import _ from 'lodash'
import { getDefaultConfig, JiraConfig } from '../../../src/config/config'
import { BOARD_COLUMN_CONFIG_TYPE, BOARD_TYPE_NAME, JIRA } from '../../../src/constants'
import boardColumnsFilter, { COLUMNS_CONFIG_FIELD } from '../../../src/filters/board/board_columns'
import { getFilterParams, mockClient } from '../../utils'

describe('boardColumnsFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch'>
  let instance: InstanceElement
  let type: ObjectType
  let columnConfigType: ObjectType
  let config: JiraConfig
  let connection: MockInterface<clientUtils.APIConnection>

  beforeEach(async () => {
    const { client, paginator, connection: conn } = mockClient()
    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    connection = conn

    filter = boardColumnsFilter(getFilterParams({
      client,
      paginator,
      config,
    })) as typeof filter

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

    instance = new InstanceElement(
      'instance',
      type,
      {
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
      }
    )
  })

  describe('onFetch', () => {
    it('should move column config out of config', async () => {
      await filter.onFetch([instance])
      expect(instance.value[COLUMNS_CONFIG_FIELD]).toBeDefined()
      expect(instance.value.config[COLUMNS_CONFIG_FIELD]).toBeUndefined()
    })

    it('should remove first column if kanban', async () => {
      await filter.onFetch([instance])
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
      await filter.onFetch([instance])
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

    it('should remove second redundant backlog column', async () => {
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

      await filter.onFetch([instance])
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

      await filter.onFetch([instance])
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

      await filter.onFetch([instance])
      expect(instance.value[COLUMNS_CONFIG_FIELD]).toBeUndefined()
    })

    it('should add deployment annotations', async () => {
      await filter.onFetch([type, columnConfigType])
      expect(type.fields[COLUMNS_CONFIG_FIELD].annotations).toEqual({
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
      await filter.onFetch([type, columnConfigType])

      expect(type.fields[COLUMNS_CONFIG_FIELD].annotations).toEqual({})
      expect(columnConfigType.fields.columns.annotations).toEqual({})
    })
  })
})
