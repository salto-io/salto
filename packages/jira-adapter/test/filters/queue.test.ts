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
import { InstanceElement, ReferenceExpression, CORE_ANNOTATIONS, BuiltinTypes, ListType, ObjectType, ElemID } from '@salto-io/adapter-api'
import { MockInterface } from '@salto-io/test-utils'
import { getDefaultConfig } from '../../src/config/config'
import queueFilter from '../../src/filters/queue'
import { createEmptyType, getFilterParams, mockClient } from '../utils'
import { PROJECT_TYPE, QUEUE_TYPE } from '../../src/constants'
import JiraClient from '../../src/client/client'


describe('queue filter', () => {
    type FilterType = filterUtils.FilterWith<'deploy'>
    let filter: FilterType
    let connection: MockInterface<clientUtils.APIConnection>
    let client: JiraClient
    const projectInstance = new InstanceElement(
      'project1',
      createEmptyType(PROJECT_TYPE),
      {
        id: 11111,
        name: 'project1',
        projectTypeKey: 'service_desk',
        key: 'project1Key',
        serviceDeskId: 3,
      },
    )
    const queueType = new ObjectType({
      elemID: new ElemID('jira', QUEUE_TYPE),
      fields: {
        id: { refType: BuiltinTypes.NUMBER },
        name: { refType: BuiltinTypes.STRING },
        fields: { refType: new ListType(BuiltinTypes.STRING) },
      },
    })
    let queueInstance: InstanceElement
    const fieldType = new ObjectType({
      elemID: new ElemID('jira', 'field'),
      fields: {
        id: { refType: BuiltinTypes.NUMBER },
        name: { refType: BuiltinTypes.STRING },
      },
    })
    const fieldInstanceOne = new InstanceElement(
      'field1',
      fieldType,
      {
        id: 'field1',
        name: 'field1',
      },
    )
    describe('deploy removal changes', () => {
      beforeEach(() => {
        const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
        config.fetch.enableJSM = true
        const { client: cli, connection: conn } = mockClient(false)
        connection = conn
        client = cli
        filter = queueFilter(getFilterParams({ config, client })) as typeof filter
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
        expect(connection.put).toHaveBeenCalledWith(
          '/rest/servicedesk/1/servicedesk/project1Key/queues',
          { deleted: [11] },
          undefined
        )
      })
      it('should not deploy if enableJSM is false', async () => {
        const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
        config.fetch.enableJSM = false
        filter = queueFilter(getFilterParams({ config, client })) as typeof filter
        const res = await filter.deploy([{ action: 'remove', data: { before: queueInstance } }])
        expect(res.leftoverChanges).toHaveLength(1)
        expect(res.leftoverChanges).toEqual([{ action: 'remove', data: { before: queueInstance } }])
        expect(res.deployResult.appliedChanges).toHaveLength(0)
      })
    })
    describe('deploy addition changes with default name', () => {
      beforeEach(() => {
        const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
        config.fetch.enableJSM = true
        const { client: cli, connection: conn } = mockClient(false)
        connection = conn
        client = cli
        queueInstance = new InstanceElement(
          'AllOpen',
          queueType,
          {
            name: 'All Open',
            fields: [new ReferenceExpression(fieldInstanceOne.elemID, fieldInstanceOne)],
          },
          undefined,
          {
            [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(projectInstance.elemID, projectInstance)],
          },
        )
        connection.get.mockImplementation(async url => {
          if (url === '/rest/servicedeskapi/servicedesk/3/queue') {
            return {
              status: 200,
              data: {
                values: [
                  {
                    id: '11',
                    name: 'All Open',
                  },
                ],
              },
            }
          }
          throw new Error(`Unexpected url ${url}`)
        })
        filter = queueFilter(getFilterParams({ config, client })) as typeof filter
      })
      it('should deploy addition of a queue with defualt name', async () => {
        const res = await filter.deploy([{ action: 'add', data: { after: queueInstance } }])
        expect(res.leftoverChanges).toHaveLength(0)
        expect(res.deployResult.errors).toHaveLength(0)
        expect(res.deployResult.appliedChanges).toHaveLength(1)
        expect(connection.post).toHaveBeenCalledTimes(0)
        expect(connection.put).toHaveBeenCalledOnce()
        expect(connection.put).toHaveBeenCalledWith(
          '/rest/servicedesk/1/servicedesk/project1Key/queues',
          {
            name: 'All Open',
            fields: ['field1'],
          },
          undefined
        )
      })
      it('should not deploy addition of a queue with non defualt name', async () => {
        queueInstance.value.name = 'queue1'
        const res = await filter.deploy([{ action: 'add', data: { after: queueInstance } }])
        expect(res.leftoverChanges).toHaveLength(1)
        expect(res.leftoverChanges).toEqual([{ action: 'add', data: { after: queueInstance } }])
        expect(res.deployResult.appliedChanges).toHaveLength(0)
      })
      it('should not deploy modification of a queue with defualt name', async () => {
        const queueInstnaceAfter = queueInstance.clone()
        queueInstnaceAfter.value.fields = []
        const res = await filter.deploy([{ action: 'modify', data: { before: queueInstance, after: queueInstnaceAfter } }])
        expect(res.leftoverChanges).toHaveLength(1)
        expect(res.leftoverChanges).toEqual([{ action: 'modify', data: { before: queueInstance, after: queueInstnaceAfter } }])
        expect(res.deployResult.appliedChanges).toHaveLength(0)
      })
    })
})
