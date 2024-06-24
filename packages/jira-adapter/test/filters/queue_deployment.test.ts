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

import { filterUtils, client as clientUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import {
  InstanceElement,
  ReferenceExpression,
  CORE_ANNOTATIONS,
  BuiltinTypes,
  ListType,
  ObjectType,
  ElemID,
} from '@salto-io/adapter-api'
import { MockInterface } from '@salto-io/test-utils'
import { getDefaultConfig } from '../../src/config/config'
import queueFilter from '../../src/filters/queue_deployment'
import { createEmptyType, getFilterParams, mockClient } from '../utils'
import { PROJECT_TYPE, QUEUE_TYPE } from '../../src/constants'
import JiraClient from '../../src/client/client'
import { FIELD_TYPE_NAME } from '../../src/filters/fields/constants'

describe('queue deployment filter', () => {
  type FilterType = filterUtils.FilterWith<'deploy'>
  let filter: FilterType
  let connection: MockInterface<clientUtils.APIConnection>
  let client: JiraClient
  const projectInstance = new InstanceElement('project1', createEmptyType(PROJECT_TYPE), {
    id: 11111,
    name: 'project1',
    projectTypeKey: 'service_desk',
    key: 'project1Key',
  })
  const fieldType = createEmptyType(FIELD_TYPE_NAME)
  const queueType = new ObjectType({
    elemID: new ElemID('jira', QUEUE_TYPE),
    fields: {
      id: { refType: BuiltinTypes.STRING },
      name: { refType: BuiltinTypes.STRING },
      columns: {
        refType: new ListType(BuiltinTypes.STRING),
      },
    },
  })
  let queueInstance: InstanceElement
  const fieldInstanceOne = new InstanceElement('field1', fieldType, {
    id: 'field1',
    name: 'field1',
  })
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
          columns: [new ReferenceExpression(fieldInstanceOne.elemID, fieldInstanceOne)],
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
        undefined,
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
    // client = new JiraClient({ credentials: { baseUrl: 'http://myjira.net', user: 'me', token: 'tok' }, isDataCenter: false })
    let mockGet: jest.SpyInstance
    beforeEach(() => {
      const { client: cli, connection: conn } = mockClient(false)
      connection = conn
      client = cli
      mockGet = jest.spyOn(client, 'get')
      const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableJSM = true
      queueInstance = new InstanceElement(
        'AllOpen',
        queueType,
        {
          name: 'All Open',
          columns: [new ReferenceExpression(fieldInstanceOne.elemID, fieldInstanceOne)],
          favourite: true,
        },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(projectInstance.elemID, projectInstance)],
        },
      )
      mockGet.mockImplementation(async params => {
        if (params.url === '/rest/servicedeskapi/servicedesk/projectId:11111/queue') {
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
        throw new Error(`Unexpected url ${params.url}`)
      })
      filter = queueFilter(getFilterParams({ config, client })) as typeof filter
    })
    it('should deploy addition of a queue with default name as modification change', async () => {
      const res = await filter.deploy([{ action: 'add', data: { after: queueInstance } }])
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(connection.put).toHaveBeenCalledTimes(1)
      expect(connection.post).toHaveBeenCalledTimes(1)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
    })
    it('should deploy addition of a queue with non default name as addition change', async () => {
      connection.post.mockResolvedValueOnce({ status: 200, data: { id: 11 } })
      queueInstance.value.name = 'queue1'
      queueInstance.value.favourite = false
      const res = await filter.deploy([{ action: 'add', data: { after: queueInstance } }])
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(connection.post).toHaveBeenCalledTimes(1)
      expect(connection.delete).toHaveBeenCalledTimes(1)
    })
    it('should deploy modification of a queue with default name favorite filed is undefined', async () => {
      const queueInstnaceAfter = queueInstance.clone()
      queueInstnaceAfter.value.columns = []
      queueInstnaceAfter.value.favourite = undefined
      const res = await filter.deploy([
        { action: 'modify', data: { before: queueInstance, after: queueInstnaceAfter } },
      ])
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(connection.put).toHaveBeenCalledTimes(1)
      expect(connection.delete).toHaveBeenCalledTimes(1)
    })
    it('should deploy addition of a default queue as addition change, if failed to get default queues', async () => {
      mockGet.mockImplementation(async params => {
        if (params.url === '/rest/servicedeskapi/servicedesk/3/queue') {
          return {
            status: 200,
            data: {},
          }
        }
        throw new Error(`Unexpected url ${params.url}`)
      })
      const res = await filter.deploy([{ action: 'add', data: { after: queueInstance } }])
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(connection.post).toHaveBeenCalledTimes(2)
    })
    it("should catch error in addition of a queue, if queue doesn't have a parent", async () => {
      queueInstance.annotations[CORE_ANNOTATIONS.PARENT] = undefined
      const res = await filter.deploy([{ action: 'add', data: { after: queueInstance } }])
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(1)
    })
    it('should not deploy and should not reuturn error if not queue changes', async () => {
      const res = await filter.deploy([{ action: 'add', data: { after: projectInstance } }])
      expect(res.leftoverChanges).toHaveLength(1)
      expect(res.leftoverChanges).toEqual([{ action: 'add', data: { after: projectInstance } }])
      expect(res.deployResult.appliedChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
    })
  })
})
