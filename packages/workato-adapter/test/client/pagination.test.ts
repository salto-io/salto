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
import { collections } from '@salto-io/lowerdash'
import { client as clientUtils } from '@salto-io/adapter-components'
import { mockFunction, MockInterface } from '@salto-io/test-utils'
import { getMinSinceIdPagination } from '../../src/client/pagination'

const { toArrayAsync } = collections.asynciterable
const { makeArray } = collections.array

const extractPageEntries: clientUtils.PageEntriesExtractor = page =>
  makeArray(page) as clientUtils.ResponseValue[]

describe('client_pagination', () => {
  describe('getMinSinceIdPagination', () => {
    const client: MockInterface<clientUtils.HTTPReadClientInterface> = {
      get: mockFunction<clientUtils.HTTPReadClientInterface['get']>(),
      head: mockFunction<clientUtils.HTTPReadClientInterface['head']>(),
      options: mockFunction<clientUtils.HTTPReadClientInterface['options']>(),
      getPageSize: mockFunction<clientUtils.HTTPReadClientInterface['getPageSize']>(),
    }
    beforeEach(() => {
      client.get.mockReset()
      client.getPageSize.mockReset()
    })

    it('should query a single page if paginationField is not specified', async () => {
      client.get.mockResolvedValueOnce(Promise.resolve({
        data: {
          a: 'a',
        },
        status: 200,
        statusText: 'OK',
      }))
      const args = {
        client,
        pageSize: 123,
        getParams: {
          url: '/ep',
        },
      }
      const result = (await toArrayAsync(clientUtils.traverseRequests(
        getMinSinceIdPagination(args),
        extractPageEntries,
      )(args))).flat()
      expect(result).toEqual([{ a: 'a' }])
      expect(client.get).toHaveBeenCalledTimes(1)
      expect(client.get).toHaveBeenCalledWith({ url: '/ep' })
    })

    it('should use query args', async () => {
      client.get.mockResolvedValueOnce(Promise.resolve({
        data: {
          a: 'a',
        },
        status: 200,
        statusText: 'OK',
      }))
      const args = {
        client,
        pageSize: 123,
        getParams: {
          url: '/ep',
          queryParams: {
            arg1: 'val1',
            arg2: 'val2',
          },
        },
      }
      const result = (await toArrayAsync(clientUtils.traverseRequests(
        getMinSinceIdPagination(args),
        extractPageEntries,
      )(args))).flat()
      expect(result).toEqual([{ a: 'a' }])
      expect(client.get).toHaveBeenCalledTimes(1)
      expect(client.get).toHaveBeenCalledWith({ url: '/ep', queryParams: { arg1: 'val1', arg2: 'val2' } })
    })

    it('should use recursive query args', async () => {
      client.get.mockResolvedValueOnce(Promise.resolve({
        data: {
          items: [
            { a: 'a1', id: 123 },
            { a: 'a2', id: 456 },
          ],
        },
        status: 200,
        statusText: 'OK',
      })).mockResolvedValueOnce(Promise.resolve({
        data: {
          items: [
            { a: 'a1', id: 789 },
          ],
        },
        status: 200,
        statusText: 'OK',
      })).mockResolvedValueOnce(Promise.resolve({
        data: {
          items: [
            // same id as before
            { a: 'a4', id: 789 },
          ],
        },
        status: 200,
        statusText: 'OK',
      })).mockResolvedValueOnce(Promise.resolve({
        data: {
          items: [],
        },
        status: 200,
        statusText: 'OK',
      }))

      const args = {
        client,
        pageSize: 5,
        getParams: {
          url: '/ep',
          recursiveQueryParams: {
            parentId: (entry: clientUtils.ResponseValue) => entry.id as string,
          },
        },
      }
      const result = (await toArrayAsync(clientUtils.traverseRequests(
        getMinSinceIdPagination(args),
        extractPageEntries,
      )(args))).flat()
      expect(result).toEqual([
        { a: 'a1', id: 123 },
        { a: 'a2', id: 456 },
        { a: 'a1', id: 789 },
        { a: 'a4', id: 789 },
      ])
      expect(client.get).toHaveBeenCalledTimes(4)
      expect(client.get).toHaveBeenCalledWith({ url: '/ep' })
      expect(client.get).toHaveBeenCalledWith({ url: '/ep', queryParams: { parentId: 123 } })
      expect(client.get).toHaveBeenCalledWith({ url: '/ep', queryParams: { parentId: 456 } })
      expect(client.get).toHaveBeenCalledWith({ url: '/ep', queryParams: { parentId: 789 } })
    })

    it('should query a single page if data is empty', async () => {
      client.get.mockResolvedValueOnce(Promise.resolve({
        data: [],
        status: 200,
        statusText: 'OK',
      }))
      const args = {
        client,
        pageSize: 123,
        getParams: {
          url: '/ep',
          paginationField: 'page',
        },
      }
      const result = (await toArrayAsync(clientUtils.traverseRequests(
        getMinSinceIdPagination(args),
        extractPageEntries,
      )(args))).flat()
      expect(result).toEqual([])
      expect(client.get).toHaveBeenCalledTimes(1)
      expect(client.get).toHaveBeenCalledWith({ url: '/ep' })
    })

    it('should query multiple pages if response has items', async () => {
      client.get.mockResolvedValueOnce(Promise.resolve({
        data: {
          items: [{
            a: 'a1',
            id: 150,
          }],
        },
        status: 200,
        statusText: 'OK',
      })).mockResolvedValueOnce(Promise.resolve({
        data: {
          items: [{
            a: 'a2',
            b: 'b2',
            id: 140,
          }],
        },
        status: 200,
        statusText: 'OK',
      })).mockResolvedValueOnce(Promise.resolve({
        data: {
          items: [{
            a: 'a3',
            id: 130,
          }],
        },
        status: 200,
        statusText: 'OK',
      })).mockResolvedValueOnce(Promise.resolve({
        data: {
          items: [],
        },
        status: 200,
        statusText: 'OK',
      }))
      const args = {
        client,
        pageSize: 1,
        getParams: {
          url: '/ep',
          paginationField: 'since_id',
        },
      }
      const result = (await toArrayAsync(clientUtils.traverseRequests(
        getMinSinceIdPagination(args),
        extractPageEntries,
      )(args))).flat()
      expect(result).toEqual([{ a: 'a1', id: 150 }, { a: 'a2', b: 'b2', id: 140 }, { a: 'a3', id: 130 }])
      expect(client.get).toHaveBeenCalledTimes(4)
      expect(client.get).toHaveBeenCalledWith({ url: '/ep' })
      // eslint-disable-next-line camelcase
      expect(client.get).toHaveBeenCalledWith({ url: '/ep', queryParams: { since_id: '150' } })
      // eslint-disable-next-line camelcase
      expect(client.get).toHaveBeenCalledWith({ url: '/ep', queryParams: { since_id: '140' } })
      // eslint-disable-next-line camelcase
      expect(client.get).toHaveBeenCalledWith({ url: '/ep', queryParams: { since_id: '130' } })
    })

    it('should fail gracefully on HTTP errors', async () => {
      client.get.mockResolvedValueOnce(Promise.resolve({
        data: {
          items: [{
            a: 'a1',
            id: 150,
          }],
        },
        status: 200,
        statusText: 'OK',
      })).mockResolvedValueOnce(Promise.resolve({
        data: {},
        status: 404,
        statusText: 'Not Found',
      }))
      const args = {
        client,
        pageSize: 1,
        getParams: {
          url: '/ep',
          paginationField: 'since_id',
          queryParams: {
            arg1: 'val1',
          },
        },
      }
      const result = (await toArrayAsync(clientUtils.traverseRequests(
        getMinSinceIdPagination(args),
        extractPageEntries,
      )(args))).flat()
      expect(result).toEqual([{ a: 'a1', id: 150 }])
      expect(client.get).toHaveBeenCalledTimes(2)
      expect(client.get).toHaveBeenCalledWith({ url: '/ep', queryParams: { arg1: 'val1' } })
      // eslint-disable-next-line camelcase
      expect(client.get).toHaveBeenCalledWith({ url: '/ep', queryParams: { since_id: '150', arg1: 'val1' } })
    })

    it('should stop pagination if min id does not decrease', async () => {
      client.get.mockResolvedValueOnce(Promise.resolve({
        data: {
          items: [{
            a: 'a1',
            id: 150,
          }],
        },
        status: 200,
        statusText: 'OK',
      })).mockResolvedValueOnce(Promise.resolve({
        data: {
          items: [{
            a: 'a2',
            b: 'b2',
            id: 140,
          }],
        },
        status: 200,
        statusText: 'OK',
      })).mockResolvedValueOnce(Promise.resolve({
        data: {
          items: [{
            a: 'a3',
            id: 140,
          }],
        },
        status: 200,
        statusText: 'OK',
      })).mockResolvedValueOnce(Promise.resolve({
        data: {
          items: [],
        },
        status: 200,
        statusText: 'OK',
      }))
      const args = {
        client,
        pageSize: 1,
        getParams: {
          url: '/ep',
          paginationField: 'since_id',
        },
      }
      const result = (await toArrayAsync(clientUtils.traverseRequests(
        getMinSinceIdPagination(args),
        extractPageEntries,
      )(args))).flat()
      expect(result).toEqual([{ a: 'a1', id: 150 }, { a: 'a2', b: 'b2', id: 140 }, { a: 'a3', id: 140 }])
      expect(client.get).toHaveBeenCalledTimes(3)
      expect(client.get).toHaveBeenCalledWith({ url: '/ep' })
      // eslint-disable-next-line camelcase
      expect(client.get).toHaveBeenCalledWith({ url: '/ep', queryParams: { since_id: '150' } })
      // eslint-disable-next-line camelcase
      expect(client.get).toHaveBeenCalledWith({ url: '/ep', queryParams: { since_id: '140' } })
    })
    it('should stop pagination if non-numerical id values are found', async () => {
      client.get.mockResolvedValueOnce(Promise.resolve({
        data: {
          items: [{
            a: 'a1',
            id: 150,
          }],
        },
        status: 200,
        statusText: 'OK',
      })).mockResolvedValueOnce(Promise.resolve({
        data: {
          items: [{
            a: 'a2',
            b: 'b2',
            id: '140',
          }],
        },
        status: 200,
        statusText: 'OK',
      }))
      const args = {
        client,
        pageSize: 1,
        getParams: {
          url: '/ep',
          paginationField: 'since_id',
        },
      }
      const result = (await toArrayAsync(clientUtils.traverseRequests(
        getMinSinceIdPagination(args),
        extractPageEntries,
      )(args))).flat()
      expect(result).toEqual([{ a: 'a1', id: 150 }, { a: 'a2', b: 'b2', id: '140' }])
      expect(client.get).toHaveBeenCalledTimes(2)
      expect(client.get).toHaveBeenCalledWith({ url: '/ep' })
      // eslint-disable-next-line camelcase
      expect(client.get).toHaveBeenCalledWith({ url: '/ep', queryParams: { since_id: '150' } })
    })
  })
})
