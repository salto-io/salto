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

import { filterUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { InstanceElement } from '@salto-io/adapter-api'
import { getDefaultConfig } from '../../src/config/config'
import changeQueueFieldsFilter from '../../src/filters/queue_fetch'
import { createEmptyType, getFilterParams } from '../utils'
import JiraClient from '../../src/client/client'
import { QUEUE_TYPE } from '../../src/constants'

describe('queueFetch filter', () => {
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType
  const client = new JiraClient({
    credentials: { baseUrl: 'http://myjira.net', user: 'me', token: 'tok' },
    isDataCenter: false,
  })
  const mockGet = jest.spyOn(client, 'get')
  let queueInstance: InstanceElement
  describe('on Fetch', () => {
    beforeEach(() => {
      const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableJSM = true
      filter = changeQueueFieldsFilter(getFilterParams({ config, client })) as typeof filter
      queueInstance = new InstanceElement('queue1', createEmptyType(QUEUE_TYPE), {
        id: 11,
        name: 'queue1',
        fields: ['Summary'],
        projectKey: 'PROJ1',
        jql: 'project = ICP56 AND type = Bug',
      })
      mockGet.mockImplementation(async params => {
        if (params.url === '/rest/servicedesk/1/servicedesk/PROJ1/queues/categories') {
          return {
            status: 200,
            data: {
              categories: [
                {
                  queues: [
                    {
                      id: 11,
                      name: 'queue1',
                      canBeHidden: true,
                      favourite: false,
                    },
                  ],
                },
              ],
            },
          }
        }
        return {
          status: 200,
          data: [],
        }
      })
    })
    it('should delete fields field and add columns field and add canBeHidden and favourite fields  ', async () => {
      await filter.onFetch([queueInstance])
      expect(queueInstance.value.fields).toBeUndefined()
      expect(queueInstance.value.columns).toEqual(['Summary'])
      expect(queueInstance.value.canBeHidden).toEqual(true)
      expect(queueInstance.value.favourite).toEqual(false)
    })
    it('should not delete fields field and add columns field if enableJSM is false', async () => {
      const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableJSM = false
      filter = changeQueueFieldsFilter(getFilterParams({ config, client })) as typeof filter
      await filter.onFetch([queueInstance])
      expect(queueInstance.value.fields).toBeDefined()
      expect(queueInstance.value.columns).toBeUndefined()
      expect(queueInstance.value.canBeHidden).toBeUndefined()
      expect(queueInstance.value.favourite).toBeUndefined()
    })
    it('should not add canBeHidden and favourite fields if response is not as expected', async () => {
      mockGet.mockImplementation(async params => {
        if (params.url === '/rest/servicedesk/1/servicedesk/PROJ1/queues/categories') {
          return {
            status: 200,
            data: {
              attributes: [
                {
                  queues: [
                    {
                      id: 11,
                      name: 'queue1',
                    },
                  ],
                },
              ],
            },
          }
        }
        return {
          status: 200,
          data: [],
        }
      })
      await filter.onFetch([queueInstance])
      expect(queueInstance.value.fields).toBeUndefined()
      expect(queueInstance.value.columns).toEqual(['Summary'])
      expect(queueInstance.value.canBeHidden).toBeUndefined()
      expect(queueInstance.value.favourite).toBeUndefined()
    })
    it('should fix jql', async () => {
      await filter.onFetch([queueInstance])
      expect(queueInstance.value.jql).toEqual('issuetype = Bug')
    })
    it('should remove only the first project key', async () => {
      queueInstance.value.jql = 'project = ICP56 AND project = ICP56 AND type = Bug'
      await filter.onFetch([queueInstance])
      expect(queueInstance.value.jql).toEqual('project = ICP56 AND issuetype = Bug')
    })
    it('should do nothing if regex is not match', async () => {
      queueInstance.value.jql = 'assignee = currentUser() AND resolution = Unresolved'
      await filter.onFetch([queueInstance])
      expect(queueInstance.value.jql).toEqual('assignee = currentUser() AND resolution = Unresolved')
    })
    it('should not add canBeHidden and favourite fields if response has empty categories', async () => {
      mockGet.mockImplementation(async params => {
        if (params.url === '/rest/servicedesk/1/servicedesk/PROJ1/queues/categories') {
          return {
            status: 200,
            data: {
              categories: [],
            },
          }
        }
        return {
          status: 200,
          data: [],
        }
      })
      await filter.onFetch([queueInstance])
      expect(queueInstance.value.fields).toBeUndefined()
      expect(queueInstance.value.columns).toEqual(['Summary'])
      expect(queueInstance.value.canBeHidden).toBeUndefined()
      expect(queueInstance.value.favourite).toBeUndefined()
    })
  })
})
