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

import { definitions } from '@salto-io/adapter-components'
import { Options } from '../src/definitions/types'
import { createDeployDefinitions, createFetchDefinitions } from '../src/definitions'
import { getUsersAndGroups } from '../src/get_users_and_groups'

const mockRequestAllResources = jest.fn()

jest.mock('@salto-io/adapter-components', () => {
  const actual = jest.requireActual('@salto-io/adapter-components')
  return {
    ...actual,
    fetch: {
      ...actual.fetch,
      request: {
        ...actual.fetch.request,
        getRequester: jest.fn().mockReturnValue({
          requestAllForResource: jest.fn((...args) => mockRequestAllResources(...args)),
        }),
      },
    },
  }
})
describe('getUsersAndGroups', () => {
  const fetchDef = createFetchDefinitions()
  const deployDef = createDeployDefinitions()
  const mockDefinitions = {
    fetch: fetchDef,
    deploy: deployDef,
  } as definitions.ApiDefinitions<Options>
  const mockGroupsResponse = [
    { value: { id: 'group1Id', name: 'group1' } },
    { value: { id: 'group2Id', name: 'group2' } },
    { value: { notValid: 'aaaa', groupStructure: 'bbb' } },
  ]
  const mockUsersResponse = [
    { value: { accountId: 'user1Id', emailAddress: 'user1@email.com', displayName: 'user1' } },
    { value: { accountId: 'user2Id', emailAddress: 'user2@email.com', displayName: 'user2' } },
    { value: { notValid: 'aaa', userStructure: 'bbb' } },
  ]
  const expectedGroupsIndex = {
    group1Id: { name: 'group1', id: 'group1Id' },
    group2Id: { name: 'group2', id: 'group2Id' },
  }
  const expectedUsersIndex = {
    user1Id: { accountId: 'user1Id', emailAddress: 'user1@email.com', displayName: 'user1' },
    user2Id: { accountId: 'user2Id', emailAddress: 'user2@email.com', displayName: 'user2' },
  }
  const userIds = ['user1Id', 'user2Id']

  beforeEach(() => {
    jest.clearAllMocks()
  })
  it('should throw an error when there is no fetch definition', async () => {
    await expect(getUsersAndGroups({ ...mockDefinitions, fetch: undefined }, userIds)).rejects.toThrow()
  })
  it('should return empty indices when failed to fetch groups and users', async () => {
    mockRequestAllResources.mockRejectedValue(new Error('Failed to fetch'))
    expect(await getUsersAndGroups(mockDefinitions, userIds)).toEqual({
      groupsIndex: {},
      usersIndex: {},
    })
  })
  it('should return empty groups index and correct users index when failed to fetch groups', async () => {
    mockRequestAllResources
      .mockRejectedValueOnce(new Error('Failed to fetch groups'))
      .mockResolvedValueOnce(mockUsersResponse)
    expect(await getUsersAndGroups(mockDefinitions, userIds)).toEqual({
      groupsIndex: {},
      usersIndex: expectedUsersIndex,
    })
  })
  it('should return empty users index and correct groups index when failed to fetch users', async () => {
    mockRequestAllResources
      .mockResolvedValueOnce(mockGroupsResponse)
      .mockRejectedValueOnce(new Error('Failed to fetch users'))
    expect(await getUsersAndGroups(mockDefinitions, userIds)).toEqual({
      groupsIndex: expectedGroupsIndex,
      usersIndex: {},
    })
  })
  it('should return user and group indices when succeed to fetch groups and users', async () => {
    mockRequestAllResources.mockReturnValueOnce(mockGroupsResponse).mockReturnValueOnce(mockUsersResponse)
    expect(await getUsersAndGroups(mockDefinitions, userIds)).toEqual({
      groupsIndex: expectedGroupsIndex,
      usersIndex: expectedUsersIndex,
    })
  })
})
