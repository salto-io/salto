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
import { InstanceElement } from '@salto-io/adapter-api'
import { client as clientUtils } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import { getFilterParams, mockClient } from '../utils'
import storeUsersFilter from '../../src/filters/store_users'
import { Filter } from '../../src/filter'

describe('storeUsersFilter', () => {
  let filter: Filter
  let mockConnection: MockInterface<clientUtils.APIConnection>
  let elements: InstanceElement[]
  describe('cloud', () => {
    beforeEach(async () => {
      const { connection, getUserMapFunc } = mockClient()
      mockConnection = connection
      filter = storeUsersFilter(getFilterParams({
        getUserMapFunc,
      })) as typeof filter
      elements = []
    })
    it('should store users successfully', async () => {
      mockConnection.get.mockResolvedValueOnce({
        status: 200,
        data: [{
          accountId: '2',
          displayName: 'disp2',
          locale: 'en_US',
        }, {
          accountId: '2n',
          displayName: 'disp2n',
          locale: 'en_US',
        }],
      })
      await filter.onFetch?.(elements)
      expect(elements.length).toEqual(3)
      expect(elements[0].elemID.getFullName()).toEqual('jira.UserInfo')
      expect(elements[1].elemID.getFullName()).toEqual('jira.Users')
      expect(elements[2].value).toEqual({ users: { 2: {
        locale: 'en_US',
        displayName: 'disp2',
        email: undefined,
        username: undefined,
        userId: '2',
      },
      '2n': {
        locale: 'en_US',
        displayName: 'disp2n',
        email: undefined,
        username: undefined,
        userId: '2n',
      } } })
    })
    it('should not fail during error', async () => {
      mockConnection.get.mockRejectedValueOnce({
        status: 400,
        error: 'some error',
      })
      await filter.onFetch?.(elements)
      expect(elements.length).toEqual(0)
    })
  })
  describe('dc', () => {
    beforeEach(async () => {
      const { connection, getUserMapFunc } = mockClient(true)
      mockConnection = connection
      filter = storeUsersFilter(getFilterParams({
        getUserMapFunc,
      })) as typeof filter
      elements = []
    })
    it('should store users successfully', async () => {
      mockConnection.get.mockResolvedValueOnce({
        status: 200,
        data: [{
          key: '2',
          name: 'name2',
          locale: 'en_US',
          displayName: 'name2',
        }, {
          key: '2l',
          name: 'name2l',
          locale: 'en_US',
          displayName: 'name2l',
        }],
      })
      await filter.onFetch?.(elements)
      expect(elements.length).toEqual(3)
      expect(elements[0].elemID.getFullName()).toEqual('jira.UserInfo')
      expect(elements[1].elemID.getFullName()).toEqual('jira.Users')
      expect(elements[2].value).toEqual({ users: { 2: {
        locale: 'en_US',
        displayName: 'name2',
        email: undefined,
        username: 'name2',
        userId: '2',
      },
      '2l': {
        locale: 'en_US',
        displayName: 'name2l',
        email: undefined,
        username: 'name2l',
        userId: '2l',
      } } })
    })
  })
})
