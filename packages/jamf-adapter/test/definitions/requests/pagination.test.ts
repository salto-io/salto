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
