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
import { MockInterface, mockFunction } from '@salto-io/test-utils'
import {
  HTTPError,
  HTTPReadClientInterface,
  HTTPWriteClientInterface,
  Response,
  ResponseValue,
} from '../../../../src/client'
import { PaginationFunction } from '../../../../src/definitions'
import { PaginationFuncCreator } from '../../../../src/definitions/system/requests/pagination'
import { traversePages } from '../../../../src/fetch/request/pagination'

describe('pagination', () => {
  describe('traversePages', () => {
    const client: MockInterface<HTTPReadClientInterface & HTTPWriteClientInterface> = {
      get: mockFunction<(HTTPReadClientInterface & HTTPWriteClientInterface)['get']>(),
      put: mockFunction<(HTTPReadClientInterface & HTTPWriteClientInterface)['put']>(),
      patch: mockFunction<(HTTPReadClientInterface & HTTPWriteClientInterface)['patch']>(),
      post: mockFunction<(HTTPReadClientInterface & HTTPWriteClientInterface)['post']>(),
      delete: mockFunction<(HTTPReadClientInterface & HTTPWriteClientInterface)['delete']>(),
      head: mockFunction<(HTTPReadClientInterface & HTTPWriteClientInterface)['head']>(),
      options: mockFunction<(HTTPReadClientInterface & HTTPWriteClientInterface)['options']>(),
      getPageSize: mockFunction<(HTTPReadClientInterface & HTTPWriteClientInterface)['getPageSize']>(),
    }
    const paginationFunc = mockFunction<PaginationFunction>()
    const paginationFuncCreator = mockFunction<PaginationFuncCreator<'main'>>()
    beforeEach(() => {
      client.get.mockReset()
      client.post.mockReset()
      paginationFunc.mockReset()
      paginationFunc.mockReturnValue([])
      paginationFuncCreator.mockReset()
      paginationFuncCreator.mockReturnValue(paginationFunc)
    })
    it('should make calls to the correct endpoint', async () => {
      client.get.mockResolvedValueOnce(
        Promise.resolve({
          data: {
            a: 'a',
          },
          status: 200,
          statusText: 'OK',
        }),
      )
      const result = await traversePages({
        client,
        endpointIdentifier: {
          path: '/ep',
        },
        paginationDef: {
          funcCreator: paginationFuncCreator,
        },
        callArgs: {},
        contexts: [],
      })
      expect(result).toEqual([{ context: {}, pages: [{ a: 'a' }] }])
      expect(paginationFunc).toHaveBeenCalledTimes(1)
      expect(client.get).toHaveBeenCalledTimes(1)
      expect(client.get).toHaveBeenCalledWith({ url: '/ep' })
    })
    it('should support non-GET calls', async () => {
      client.post.mockResolvedValueOnce(
        Promise.resolve({
          data: {
            a: 'a',
          },
          status: 200,
          statusText: 'OK',
        }),
      )
      const result = await traversePages({
        client,
        endpointIdentifier: {
          path: '/ep',
          method: 'post',
        },
        paginationDef: {
          funcCreator: paginationFuncCreator,
        },
        callArgs: {
          body: { something: 'SOMETHING' },
        },
        contexts: [],
      })
      expect(result).toEqual([{ context: {}, pages: [{ a: 'a' }] }])
      expect(paginationFunc).toHaveBeenCalledTimes(1)
      expect(client.post).toHaveBeenCalledTimes(1)
      expect(client.post).toHaveBeenCalledWith({ url: '/ep', body: { something: 'SOMETHING' } })
    })
    it('should pass query args in all requests', async () => {
      paginationFunc
        .mockReturnValueOnce([
          {
            queryParams: { offset: '20' },
          },
        ])
        .mockReturnValueOnce([])
      client.get
        .mockResolvedValueOnce(
          Promise.resolve({
            data: {
              a: 'a',
            },
            status: 200,
            statusText: 'OK',
          }),
        )
        .mockResolvedValueOnce(
          Promise.resolve({
            data: {
              a: 'b',
            },
            status: 200,
            statusText: 'OK',
          }),
        )
      const result = await traversePages({
        client,
        endpointIdentifier: {
          path: '/ep',
        },
        paginationDef: {
          funcCreator: paginationFuncCreator,
        },
        callArgs: {},
        contexts: [],
      })
      expect(result).toEqual([{ context: {}, pages: [{ a: 'a' }, { a: 'b' }] }])
      expect(paginationFunc).toHaveBeenCalledTimes(2)
      expect(client.get).toHaveBeenCalledTimes(2)
      expect(client.get).toHaveBeenCalledWith({ url: '/ep' })
      expect(client.get).toHaveBeenCalledWith({ url: '/ep', queryParams: { offset: '20' } })
    })

    it('should query multiple pages if pagination function returns next pages and avoid getting the same page more than once', async () => {
      paginationFunc
        .mockReturnValueOnce([
          {
            queryParams: { offset: '20' },
          },
          {
            queryParams: { offset: '40' },
          },
        ])
        .mockReturnValueOnce([
          {
            queryParams: { offset: '20' },
          },
        ])

      client.get
        .mockResolvedValueOnce(
          Promise.resolve({
            data: {
              a: 'a',
            },
            status: 200,
            statusText: 'OK',
          }),
        )
        .mockResolvedValueOnce(
          Promise.resolve({
            data: {
              a: 'b',
            },
            status: 200,
            statusText: 'OK',
          }),
        )
        .mockResolvedValueOnce(
          Promise.resolve({
            data: {
              a: 'c',
            },
            status: 200,
            statusText: 'OK',
          }),
        )
      const result = await traversePages({
        client,
        endpointIdentifier: {
          path: '/ep',
        },
        paginationDef: {
          funcCreator: paginationFuncCreator,
        },
        callArgs: {},
        contexts: [],
      })
      expect(result).toEqual([{ context: {}, pages: [{ a: 'a' }, { a: 'b' }, { a: 'c' }] }])
      expect(client.get).toHaveBeenCalledTimes(3)
      expect(client.get).toHaveBeenCalledWith({ url: '/ep' })
      expect(client.get).toHaveBeenCalledWith({ url: '/ep', queryParams: { offset: '20' } })
      expect(client.get).toHaveBeenCalledWith({ url: '/ep', queryParams: { offset: '40' } })
      expect(paginationFunc).toHaveBeenCalledTimes(3)
      expect(paginationFunc).toHaveBeenCalledWith({
        endpointIdentifier: {
          path: '/ep',
        },
        responseData: { a: 'a' },
        currentParams: {},
      })
      expect(paginationFunc).toHaveBeenCalledWith({
        endpointIdentifier: {
          path: '/ep',
        },
        currentParams: { queryParams: { offset: '20' } },
        responseData: { a: 'b' },
      })
      expect(paginationFunc).toHaveBeenCalledWith({
        endpointIdentifier: {
          path: '/ep',
        },
        currentParams: { queryParams: { offset: '40' } },
        responseData: { a: 'c' },
      })
    })

    it('should fail gracefully on HTTP errors that their status is in the additionalValidStatuses param', async () => {
      client.get
        .mockResolvedValueOnce(
          Promise.resolve({
            data: {
              items: [
                {
                  a: 'a1',
                },
              ],
            },
            status: 200,
            statusText: 'OK',
          }),
        )
        .mockRejectedValueOnce(
          new HTTPError('Not Found', {
            data: {},
            status: 404,
          }),
        )
      paginationFunc.mockReturnValueOnce([{ queryParams: { offset: '20' } }])
      const result = await traversePages({
        client,
        endpointIdentifier: {
          path: '/ep',
        },
        paginationDef: {
          funcCreator: paginationFuncCreator,
        },
        callArgs: {},
        contexts: [],
        additionalValidStatuses: [404],
      })
      expect(result).toEqual([{ context: {}, pages: [{ items: [{ a: 'a1' }] }] }])
      expect(client.get).toHaveBeenCalledTimes(2)
      expect(client.get).toHaveBeenCalledWith({ url: '/ep', queryParams: { offset: '20' } })
      expect(paginationFunc).toHaveBeenCalledTimes(2)
      expect(paginationFunc).toHaveBeenCalledWith({
        endpointIdentifier: {
          path: '/ep',
        },
        currentParams: {},
        responseData: { items: [{ a: 'a1' }] },
      })
      expect(paginationFunc).toHaveBeenCalledWith({
        endpointIdentifier: {
          path: '/ep',
        },
        responseData: {},
        currentParams: { queryParams: { offset: '20' } },
      })
    })
    it('should throw if encountered unknown HTTP exception errors', async () => {
      client.get
        .mockResolvedValueOnce(
          Promise.resolve({
            data: {
              items: [
                {
                  a: 'a1',
                },
              ],
            },
            status: 200,
            statusText: 'OK',
          }),
        )
        .mockRejectedValueOnce(
          new HTTPError('Something went wrong', {
            data: {},
            status: 400,
          }),
        )
        .mockRejectedValueOnce(
          new HTTPError('Something else went wrong', {
            data: {},
            status: 404,
          }),
        )
      paginationFunc.mockReturnValueOnce([{ queryParams: { offset: '20' } }, { queryParams: { offset: '40' } }])
      await expect(() =>
        traversePages({
          client,
          endpointIdentifier: {
            path: '/ep',
          },
          paginationDef: {
            funcCreator: paginationFuncCreator,
          },
          callArgs: {},
          contexts: [],
        }),
      ).rejects.toThrow('Something went wrong')
    })
    it('should call the client few times when polling', async () => {
      client.get
        .mockRejectedValueOnce(
          new HTTPError('Something else went wrong', {
            data: {},
            status: 404,
          }),
        )
        .mockResolvedValueOnce(
          Promise.resolve({
            data: {
              a: 'b',
            },
            status: 201,
            statusText: 'OK',
          }),
        )
        .mockResolvedValueOnce(
          Promise.resolve({
            data: {
              a: 'c',
            },
            status: 200,
            statusText: 'OK',
          }),
        )
      const result = await traversePages({
        client,
        endpointIdentifier: {
          path: '/ep',
        },
        paginationDef: {
          funcCreator: paginationFuncCreator,
        },
        callArgs: {},
        contexts: [],
        polling: {
          interval: 100,
          retries: 5,
          checkStatus: (response: Response<ResponseValue | ResponseValue[]>): boolean => response.status === 200,
        },
        additionalValidStatuses: [404],
      })
      expect(result).toEqual([{ context: {}, pages: [{ a: 'c' }] }])
      expect(client.get).toHaveBeenCalledTimes(3)
    })
  })
})
