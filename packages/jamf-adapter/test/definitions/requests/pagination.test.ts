/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { client, definitions } from '@salto-io/adapter-components'
import { ClientOptions } from '../../../src/definitions'
import { PAGINATION } from '../../../src/definitions/requests/pagination'

describe('increasePageUntilEmpty', () => {
  const mockArgs = {} as {
    client: client.HTTPReadClientInterface & client.HTTPWriteClientInterface
    endpointIdentifier: definitions.HTTPEndpointIdentifier<ClientOptions>
    params: definitions.ContextParams
  }
  const increasePageUntilEmptyPaginationFunc = PAGINATION.increasePageUntilEmpty.funcCreator(mockArgs)
  it('should return empty array if no results in response data', () => {
    const result = increasePageUntilEmptyPaginationFunc({
      responseData: {},
      currentParams: {},
      endpointIdentifier: { path: '/mockPath' },
    })
    expect(result).toEqual([])
  })
  it('should return empty array if results is not an array', () => {
    const result = increasePageUntilEmptyPaginationFunc({
      responseData: { results: 'not an array' },
      currentParams: {},
      endpointIdentifier: { path: '/mockPath' },
    })
    expect(result).toEqual([])
  })
  it('should return empty array if results is an empty array', () => {
    const result = increasePageUntilEmptyPaginationFunc({
      responseData: { results: [] },
      currentParams: {},
      endpointIdentifier: { path: '/mockPath' },
    })
    expect(result).toEqual([])
  })
  it('should return new params with incremented page number', () => {
    const result = increasePageUntilEmptyPaginationFunc({
      responseData: { results: [1, 2, 3] },
      currentParams: { queryParams: { page: '1' } },
      endpointIdentifier: { path: '/mockPath' },
    })
    expect(result).toEqual([{ queryParams: { page: '2' } }])
  })
})
