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
import { client as clientUtils } from '@salto-io/adapter-components'
import { mockFunction } from '@salto-io/test-utils'
import * as usersUtilsModule from '../src/user_utils'

describe('getUsers', () => {
  let userUtils: typeof usersUtilsModule

  beforeEach(() => {
    jest.isolateModules(() => {
      // eslint-disable-next-line global-require
      userUtils = require('../src/user_utils')
    })
  })

  it('should return valid users when called', async () => {
    const mockPaginator = mockFunction<clientUtils.Paginator>()
      .mockImplementation(async function *get() {
        yield [
          { users: [
            { id: 1, email: 'a@a.com' },
            { id: 2, email: 'b@b.com' },
            { id: 2, email: 'c@c.com', role: 'agent', custom_role_id: '123' },
          ] },
        ]
      })

    const users = await userUtils.getUsers(mockPaginator)
    expect(users).toEqual(
      [
        { id: 1, email: 'a@a.com' },
        { id: 2, email: 'b@b.com' },
        { id: 2, email: 'c@c.com', role: 'agent', custom_role_id: '123' },
      ]
    )
  })
  it('should cache results when between getUsers calls', async () => {
    const mockPaginator = mockFunction<clientUtils.Paginator>()
      .mockImplementation(async function *get() {
        yield [
          { users: [
            { id: 1, email: 'a@a.com' },
            { id: 2, email: 'b@b.com' },
          ] },
        ]
      })
    const users = await userUtils.getUsers(mockPaginator)
    expect(users).toEqual(
      [
        { id: 1, email: 'a@a.com' },
        { id: 2, email: 'b@b.com' },
      ]
    )
    const getUsersAfterCache = await userUtils.getUsers(mockPaginator)
    expect(getUsersAfterCache).toEqual(
      [
        { id: 1, email: 'a@a.com' },
        { id: 2, email: 'b@b.com' },
      ]
    )
    await userUtils.getUsers(mockPaginator)
    expect(mockPaginator).toHaveBeenCalledTimes(1)
  })
  it('should return empty list if users are in invalid format', async () => {
    const mockPaginator = mockFunction<clientUtils.Paginator>()
      .mockImplementation(async function *get() {
        yield [
          { users: [
            { id: 1 },
            { id: 2, email: 'b@b.com' },
            { email: 'c@c.com', role: 'agent', custom_role_id: '123' },
          ] },
        ]
      })
    const users = await userUtils.getUsers(mockPaginator)
    expect(users).toEqual([])
    expect(mockPaginator).toHaveBeenCalledTimes(1)
  })
})
