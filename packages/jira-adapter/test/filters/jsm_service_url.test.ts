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
import { filterUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { CORE_ANNOTATIONS, InstanceElement, ReferenceExpression } from '@salto-io/adapter-api'
import { getDefaultConfig } from '../../src/config/config'
import jsmServiceUrlFilter from '../../src/filters/jsm_service_url'
import { createEmptyType, getFilterParams, mockClient } from '../utils'
import { CALENDAR_TYPE, PROJECT_TYPE, QUEUE_TYPE } from '../../src/constants'
import JiraClient from '../../src/client/client'

describe('addJsmTypesAsFieldsFilter', () => {
    type FilterType = filterUtils.FilterWith<'onFetch'>
    let filter: FilterType
    let projectInstance: InstanceElement
    let queueInstance: InstanceElement
    let client: JiraClient

    beforeEach(() => {
      const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableJSM = true
      const { client: cli } = mockClient(false)
      client = cli
      filter = jsmServiceUrlFilter(getFilterParams({ config, client })) as typeof filter
      projectInstance = new InstanceElement(
        'project1',
        createEmptyType(PROJECT_TYPE),
        {
          id: 11111,
          name: 'project1',
          projectTypeKey: 'service_desk',
          key: 'project1Key',
        },
      )
    })
    describe('on fetch', () => {
      beforeEach(async () => {
        queueInstance = new InstanceElement(
          'queue1',
          createEmptyType(QUEUE_TYPE),
          {
            id: 11,
            name: 'queue1',
          },
          undefined,
          {
            [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(projectInstance.elemID, projectInstance)],
          },
        )
      })
      it('should add serviceUrl to queue instance', async () => {
        await filter.onFetch([projectInstance, queueInstance])
        expect(queueInstance.annotations[CORE_ANNOTATIONS.SERVICE_URL]).toEqual('https://ori-salto-test.atlassian.net/jira/servicedesk/projects/project1Key/queues/custom/11')
      })
      it('should not add serviceUrl to Calendar instance becuase it doesnt have serviceUrl', async () => {
        const calendarInstance = new InstanceElement(
          'SLA1',
          createEmptyType(CALENDAR_TYPE),
          {
            id: 11,
            name: 'SLA1',
          },
          undefined,
          {
            [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(projectInstance.elemID, projectInstance)],
          },
        )
        await filter.onFetch([projectInstance, calendarInstance])
        expect(calendarInstance.annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBeUndefined()
      })
    })
})
