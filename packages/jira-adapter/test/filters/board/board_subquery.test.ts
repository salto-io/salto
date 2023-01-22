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
import { BuiltinTypes, CORE_ANNOTATIONS, ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { getDefaultConfig, JiraConfig } from '../../../src/config/config'
import { BOARD_TYPE_NAME, JIRA } from '../../../src/constants'
import boardSubqueryFilter from '../../../src/filters/board/board_subquery'
import { getFilterParams, mockClient } from '../../utils'

describe('boardSubqueryFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch'>
  let instance: InstanceElement
  let type: ObjectType
  let config: JiraConfig

  beforeEach(async () => {
    const { client, paginator } = mockClient()

    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))

    filter = boardSubqueryFilter(getFilterParams({
      client,
      paginator,
      config,
    })) as typeof filter

    type = new ObjectType({
      elemID: new ElemID(JIRA, BOARD_TYPE_NAME),
      fields: {
        subQuery: {
          refType: BuiltinTypes.STRING,
        },
      },
    })

    instance = new InstanceElement(
      'instance',
      type,
      {
        id: '1',
        config: {
          subQuery: {
            query: 'someQuery',
          },
        },
      }
    )
  })

  describe('onFetch', () => {
    it('should move subQuery out of config', async () => {
      await filter.onFetch([instance])
      expect(instance.value.subQuery).toBe('someQuery')
      expect(instance.value.config.subQuery).toBeUndefined()
    })

    it('should do nothing when there is no subQuery', async () => {
      delete instance.value.config.subQuery
      await filter.onFetch([instance])
      expect(instance.value.subQuery).toBeUndefined()
    })

    it('should do nothing when there is no config', async () => {
      delete instance.value.config
      await filter.onFetch([instance])
      expect(instance.value.subQuery).toBeUndefined()
    })

    it('should add deployment annotations', async () => {
      await filter.onFetch([type])

      expect(type.fields.subQuery.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })
    })

    it('should not add deployment annotations when usePrivateApi is false', async () => {
      config.client.usePrivateAPI = false
      await filter.onFetch([type])

      expect(type.fields.subQuery.annotations).toEqual({})
    })
  })
})
