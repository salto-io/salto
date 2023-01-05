/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { getUsersFunc } from '../src/userUtils'

describe('getUserFunc', () => {
  let mockPaginator: clientUtils.Paginator

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return valid users when called', async () => {
    mockPaginator = mockFunction<clientUtils.Paginator>()
      .mockImplementationOnce(async function *get() {
        yield [
          { users: [
            { id: 1, email: 'a@a.com' },
            { id: 2, email: 'b@b.com' },
            { id: 2, email: 'c@c.com', role: 'agent', custom_role_id: '123' },
          ] },
        ]
      })
    const getUsers = getUsersFunc(mockPaginator)
    const users = await getUsers()
    expect(users).toEqual(
      [
        { id: 1, email: 'a@a.com' },
        { id: 2, email: 'b@b.com' },
        { id: 2, email: 'c@c.com', role: 'agent', custom_role_id: '123' },
      ]
    )
  })
  it('should cache results when between getUsers calls', async () => {
    mockPaginator = mockFunction<clientUtils.Paginator>()
      .mockImplementationOnce(async function *get() {
        yield [
          { users: [
            { id: 1, email: 'a@a.com' },
            { id: 2, email: 'b@b.com' },
          ] },
        ]
      })
    const getUsers = getUsersFunc(mockPaginator)
    const users = await getUsers()
    expect(users).toEqual(
      [
        { id: 1, email: 'a@a.com' },
        { id: 2, email: 'b@b.com' },
      ]
    )
    const getUsersAfterCache = await getUsers()
    expect(getUsersAfterCache).toEqual(
      [
        { id: 1, email: 'a@a.com' },
        { id: 2, email: 'b@b.com' },
      ]
    )
    await getUsers()
    expect(mockPaginator).toHaveBeenCalledTimes(1)
  })
  it('should return empty list if users are in invalid format', async () => {
    mockPaginator = mockFunction<clientUtils.Paginator>()
      .mockImplementationOnce(async function *get() {
        yield [
          { users: [
            { id: 1 },
            { id: 2, email: 'b@b.com' },
            { email: 'c@c.com', role: 'agent', custom_role_id: '123' },
          ] },
        ]
      })
    const getUsers = getUsersFunc(mockPaginator)
    const users = await getUsers()
    expect(users).toEqual([])
    expect(mockPaginator).toHaveBeenCalledTimes(1)
  })
})
