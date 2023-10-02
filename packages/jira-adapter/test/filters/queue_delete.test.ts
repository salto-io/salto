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

import { filterUtils, client as clientUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { InstanceElement, ReferenceExpression, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { MockInterface } from '@salto-io/test-utils'
import { getDefaultConfig } from '../../src/config/config'
import queueFilter from '../../src/filters/queue_delete'
import { createEmptyType, getFilterParams, mockClient } from '../utils'
import { PROJECT_TYPE, QUEUE_TYPE } from '../../src/constants'
import JiraClient from '../../src/client/client'


describe('queue filter', () => {
    type FilterType = filterUtils.FilterWith<'deploy' | 'onFetch'>
    let filter: FilterType
    let connection: MockInterface<clientUtils.APIConnection>
    let client: JiraClient
    const projectType = createEmptyType(PROJECT_TYPE)
    let projectInstance: InstanceElement
    const queueType = createEmptyType(QUEUE_TYPE)
    let queueInstance: InstanceElement
    const fieldType = createEmptyType('field')
    const fieldInstanceOne = new InstanceElement(
      'field1',
      fieldType,
      {
        id: 'field1',
        name: 'field1',
      },
    )
    describe('deploy', () => {
      beforeEach(() => {
        const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
        config.fetch.enableJSM = true
        const { client: cli, connection: conn } = mockClient(true)
        connection = conn
        client = cli
        filter = queueFilter(getFilterParams({ config, client })) as typeof filter
        projectInstance = new InstanceElement(
          'project1',
          projectType,
          {
            id: 11111,
            name: 'project1',
            projectTypeKey: 'service_desk',
            key: 'project1Key',
          },
        )
        queueInstance = new InstanceElement(
          'queue1',
          queueType,
          {
            id: 11,
            name: 'queue1',
            fields: [new ReferenceExpression(fieldInstanceOne.elemID, fieldInstanceOne)],
          },
          undefined,
          {
            [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(projectInstance.elemID, projectInstance)],
          },
        )
      })
      it('should deploy removal of a queue', async () => {
        const res = await filter.deploy([{ action: 'remove', data: { before: queueInstance } }])
        expect(res.leftoverChanges).toHaveLength(0)
        expect(res.deployResult.errors).toHaveLength(0)
        expect(res.deployResult.appliedChanges).toHaveLength(1)
        expect(connection.put).toHaveBeenCalledOnce()
      })
      it('should not deploy if enableJSM is false', async () => {
        const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
        config.fetch.enableJSM = false
        filter = queueFilter(getFilterParams({ config, client })) as typeof filter
        const res = await filter.deploy([{ action: 'remove', data: { before: queueInstance } }])
        expect(res.leftoverChanges).toHaveLength(1)
        expect(res.leftoverChanges).toEqual([{ action: 'remove', data: { before: queueInstance } }])
      })
    })
})
