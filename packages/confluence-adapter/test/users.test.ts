/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { definitions } from '@salto-io/adapter-components'
import { Options } from '../src/definitions/types'
import { createDeployDefinitions, createFetchDefinitions } from '../src/definitions'
import { getUsersIndex } from '../src/users'
import { DEFAULT_CONFIG } from '../src/config'

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
describe('getUsersIndex', () => {
  const fetchDef = createFetchDefinitions(DEFAULT_CONFIG)
  const deployDef = createDeployDefinitions()
  const mockDefinitions = {
    fetch: fetchDef,
    deploy: deployDef,
  } as definitions.ApiDefinitions<Options>
  const mockUsersResponse = [
    { value: { accountId: 'user1Id', emailAddress: 'user1@email.com', displayName: 'user1' } },
    { value: { accountId: 'user2Id', emailAddress: 'user2@email.com', displayName: 'user2' } },
    { value: { notValid: 'aaa', userStructure: 'bbb' } },
  ]
  const expectedUsersIndex = {
    user1Id: { accountId: 'user1Id', emailAddress: 'user1@email.com', displayName: 'user1' },
    user2Id: { accountId: 'user2Id', emailAddress: 'user2@email.com', displayName: 'user2' },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })
  it('should throw an error when there is no fetch definition', async () => {
    await expect(getUsersIndex({ ...mockDefinitions, fetch: undefined })).rejects.toThrow()
  })
  it('should return empty index when failed to fetch users', async () => {
    mockRequestAllResources.mockRejectedValue(new Error('Failed to fetch'))
    expect(await getUsersIndex(mockDefinitions)).toEqual({})
  })
  it('should return user and group indices when succeed to fetch groups and users', async () => {
    mockRequestAllResources.mockReturnValueOnce(mockUsersResponse)
    expect(await getUsersIndex(mockDefinitions)).toEqual(expectedUsersIndex)
  })
})
