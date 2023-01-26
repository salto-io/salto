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
import { filterUtils, client as clientUtils } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import _ from 'lodash'
import { getDefaultConfig, JiraConfig } from '../../../src/config/config'
import { BOARD_ESTIMATION_TYPE, BOARD_TYPE_NAME, JIRA } from '../../../src/constants'
import boardEstimationFilter from '../../../src/filters/board/board_estimation'
import { getFilterParams, mockClient } from '../../utils'

describe('boardEstimationFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch'>
  let instance: InstanceElement
  let type: ObjectType
  let estimationType: ObjectType
  let connection: MockInterface<clientUtils.APIConnection>
  let config: JiraConfig

  beforeEach(async () => {
    const { client, paginator, connection: conn } = mockClient()
    connection = conn

    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))

    filter = boardEstimationFilter(getFilterParams({
      client,
      paginator,
      config,
    })) as typeof filter

    estimationType = new ObjectType({
      elemID: new ElemID(JIRA, BOARD_ESTIMATION_TYPE),
      fields: {
        field: {
          refType: BuiltinTypes.STRING,
        },
        timeTracking: {
          refType: BuiltinTypes.STRING,
        },
      },
    })
    type = new ObjectType({
      elemID: new ElemID(JIRA, BOARD_TYPE_NAME),
      fields: {
        estimation: {
          refType: estimationType,
        },
      },
    })

    instance = new InstanceElement(
      'instance',
      type,
      {
        id: '1',
        config: {
          estimation: {
            field: {
              fieldId: 'someFieldId',
            },
          },
        },
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
    it('should move estimation out of config', async () => {
      await filter.onFetch([instance])
      expect(instance.value.estimation).toBeDefined()
      expect(instance.value.config.estimation).toBeUndefined()
    })

    it('should set the estimation ids', async () => {
      await filter.onFetch([instance])
      expect(instance.value.estimation).toEqual({
        field: 'someFieldId',
        timeTracking: 'someOtherFieldId',
      })

      expect(connection.get).toHaveBeenCalledWith(
        '/rest/greenhopper/1.0/rapidviewconfig/estimation?rapidViewId=1',
        undefined,
      )
    })

    it('should do nothing if there is no config', async () => {
      delete instance.value.config
      await filter.onFetch([instance])
      expect(instance.value.estimation).toBeUndefined()
    })

    it('should add deployment annotations', async () => {
      await filter.onFetch([type, estimationType])

      expect(type.fields.estimation.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })

      expect(estimationType.fields.field.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })

      expect(estimationType.fields.timeTracking.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })
    })

    it('should not add deployment annotations when usePrivateApi is false', async () => {
      config.client.usePrivateAPI = false
      await filter.onFetch([type, estimationType])

      expect(type.fields.estimation.annotations).toEqual({})
      expect(estimationType.fields.field.annotations).toEqual({})
      expect(estimationType.fields.timeTracking.annotations).toEqual({})
    })

    it('should not add time tracking field when usePrivateApi is false', async () => {
      config.client.usePrivateAPI = false
      await filter.onFetch([instance])

      expect(instance.value.estimation).toEqual({
        field: 'someFieldId',
      })
    })

    it('should not add time tracking when received invalid response', async () => {
      connection.get.mockResolvedValue({
        status: 200,
        data: {},
      })

      await filter.onFetch([instance])

      expect(instance.value.estimation).toEqual({
        field: 'someFieldId',
      })
    })
  })
})
