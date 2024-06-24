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
import { client as clientUtils } from '@salto-io/adapter-components'
import { mockFunction } from '@salto-io/test-utils'
import { getUsers } from '../src/user_utils'

describe('getUsers', () => {
  let mockPaginator: clientUtils.Paginator

  beforeEach(() => {
    jest.clearAllMocks()
    mockPaginator = mockFunction<clientUtils.Paginator>().mockImplementation(async function* get() {
      yield [
        { id: '111', profile: { login: 'a@a.com', name: 'a' } },
        { id: '222', profile: { login: 'b@a.com' } },
        { id: '333', profile: { login: 'c@a.com' } },
      ]
    })
  })
  describe('when called with allUsers strategy', () => {
    it('it should return a list of users', async () => {
      const users = await getUsers(mockPaginator)
      expect(users).toEqual([
        { id: '111', profile: { login: 'a@a.com', name: 'a' } },
        { id: '222', profile: { login: 'b@a.com' } },
        { id: '333', profile: { login: 'c@a.com' } },
      ])
      expect(mockPaginator).toHaveBeenNthCalledWith(
        1,
        {
          url: '/api/v1/users',
          headers: { 'Content-Type': 'application/json; okta-response=omitCredentials,omitCredentialsLinks' },
          paginationField: 'after',
        },
        expect.anything(),
      )
    })
    it('it should return an empty list if response is invalid', async () => {
      mockPaginator = mockFunction<clientUtils.Paginator>().mockImplementationOnce(async function* get() {
        yield [
          { id: '111', profile: { name: 'a' } },
          { id: '222', profile: { name: 'b' } },
        ]
      })
      const users = await getUsers(mockPaginator)
      expect(users).toEqual([])
    })
  })
  describe('when called with searchQuery strategy', () => {
    it('it should request users by id', async () => {
      const userIds = ['111', '333']
      await getUsers(mockPaginator, { userIds, property: 'id' })
      expect(mockPaginator).toHaveBeenNthCalledWith(
        1,
        {
          url: '/api/v1/users',
          headers: { 'Content-Type': 'application/json; okta-response=omitCredentials,omitCredentialsLinks' },
          paginationField: 'after',
          queryParams: { search: 'id eq "111" or id eq "333"' },
        },
        expect.anything(),
      )
    })
    it('it should request users by login name', async () => {
      const userIds = ['a@a.com', 'c@a.com']
      await getUsers(mockPaginator, { userIds, property: 'profile.login' })
      expect(mockPaginator).toHaveBeenNthCalledWith(
        1,
        {
          url: '/api/v1/users',
          headers: { 'Content-Type': 'application/json; okta-response=omitCredentials,omitCredentialsLinks' },
          paginationField: 'after',
          queryParams: { search: 'profile.login eq "a@a.com" or profile.login eq "c@a.com"' },
        },
        expect.anything(),
      )
    })
  })
})
