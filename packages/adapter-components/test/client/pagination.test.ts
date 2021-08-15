/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { getWithCursorPagination, getWithPageOffsetPagination, getWithPageOffsetAndLastPagination, getWithOffsetAndLimit, HTTPClientInterface, createPaginator, GetAllItemsFunc, ResponseValue } from '../../src/client'
import { MockInterface, mockFunction } from '../common'

const { toArrayAsync } = collections.asynciterable

describe('client_pagination', () => {
  describe('getWithPageOffsetPagination', () => {
    const client: MockInterface<HTTPClientInterface> = {
      getSinglePage: mockFunction<HTTPClientInterface['getSinglePage']>(),
      getPageSize: mockFunction<HTTPClientInterface['getPageSize']>(),
    }
    beforeEach(() => {
      client.getSinglePage.mockReset()
      client.getPageSize.mockReset()
    })

    it('should query a single page if paginationField is not specified', async () => {
      client.getSinglePage.mockResolvedValueOnce(Promise.resolve({
        data: {
          a: 'a',
        },
        status: 200,
        statusText: 'OK',
      }))
      const result = (await toArrayAsync(await getWithPageOffsetPagination(1)({
        client,
        pageSize: 123,
        getParams: {
          url: '/ep',
        },
      }))).flat()
      expect(result).toEqual([{ a: 'a' }])
      expect(client.getSinglePage).toHaveBeenCalledTimes(1)
      expect(client.getSinglePage).toHaveBeenCalledWith({ url: '/ep' })
    })

    it('should use query args', async () => {
      client.getSinglePage.mockResolvedValueOnce(Promise.resolve({
        data: {
          a: 'a',
        },
        status: 200,
        statusText: 'OK',
      }))
      const result = (await toArrayAsync(await getWithPageOffsetPagination(1)({
        client,
        pageSize: 123,
        getParams: {
          url: '/ep',
          queryParams: {
            arg1: 'val1',
            arg2: 'val2',
          },
        },
      }))).flat()
      expect(result).toEqual([{ a: 'a' }])
      expect(client.getSinglePage).toHaveBeenCalledTimes(1)
      expect(client.getSinglePage).toHaveBeenCalledWith({ url: '/ep', queryParams: { arg1: 'val1', arg2: 'val2' } })
    })

    it('should use recursive query args', async () => {
      client.getSinglePage.mockResolvedValueOnce(Promise.resolve({
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
      const result = (await toArrayAsync(await getWithPageOffsetPagination(1)({
        client,
        pageSize: 5,
        getParams: {
          url: '/ep',
          recursiveQueryParams: {
            parentId: (entry => entry.id as string),
          },
        },
      }))).flat()
      expect(result).toEqual([
        { a: 'a1', id: 123 },
        { a: 'a2', id: 456 },
        { a: 'a1', id: 789 },
        { a: 'a4', id: 789 },
      ])
      expect(client.getSinglePage).toHaveBeenCalledTimes(4)
      expect(client.getSinglePage).toHaveBeenCalledWith({ url: '/ep' })
      expect(client.getSinglePage).toHaveBeenCalledWith({ url: '/ep', queryParams: { parentId: 123 } })
      expect(client.getSinglePage).toHaveBeenCalledWith({ url: '/ep', queryParams: { parentId: 456 } })
      expect(client.getSinglePage).toHaveBeenCalledWith({ url: '/ep', queryParams: { parentId: 789 } })
    })

    it('should query a single page if data has less items than page size', async () => {
      client.getSinglePage.mockResolvedValueOnce(Promise.resolve({
        data: {
          a: 'a',
        },
        status: 200,
        statusText: 'OK',
      }))
      const result = (await toArrayAsync(await getWithPageOffsetPagination(1)({
        client,
        pageSize: 123,
        getParams: {
          url: '/ep',
          paginationField: 'page',
        },
      }))).flat()
      expect(result).toEqual([{ a: 'a' }])
      expect(client.getSinglePage).toHaveBeenCalledTimes(1)
      expect(client.getSinglePage).toHaveBeenCalledWith({ url: '/ep' })
    })

    it('should query multiple pages if response has more items than page size (or equal)', async () => {
      client.getSinglePage.mockResolvedValueOnce(Promise.resolve({
        data: {
          items: [{
            a: 'a1',
          }],
        },
        status: 200,
        statusText: 'OK',
      })).mockResolvedValueOnce(Promise.resolve({
        data: {
          items: [{
            a: 'a2',
            b: 'b2',
          }],
          page: 2,
        },
        status: 200,
        statusText: 'OK',
      })).mockResolvedValueOnce(Promise.resolve({
        data: {
          items: [{
            a: 'a3',
          }],
          page: 3,
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
      const result = (await toArrayAsync(await getWithPageOffsetPagination(1)({
        client,
        pageSize: 1,
        getParams: {
          url: '/ep',
          paginationField: 'page',
        },
      }))).flat()
      expect(result).toEqual([{ a: 'a1' }, { a: 'a2', b: 'b2' }, { a: 'a3' }])
      expect(client.getSinglePage).toHaveBeenCalledTimes(4)
      expect(client.getSinglePage).toHaveBeenCalledWith({ url: '/ep' })
      expect(client.getSinglePage).toHaveBeenCalledWith({ url: '/ep', queryParams: { page: 2 } })
      expect(client.getSinglePage).toHaveBeenCalledWith({ url: '/ep', queryParams: { page: 3 } })
      expect(client.getSinglePage).toHaveBeenCalledWith({ url: '/ep', queryParams: { page: 4 } })
    })

    it('should query multiple pages correctly when paginationField is nested', async () => {
      client.getSinglePage.mockResolvedValueOnce(Promise.resolve({
        data: {
          items: [{
            a: 'a1',
          }],
        },
        status: 200,
        statusText: 'OK',
      })).mockResolvedValueOnce(Promise.resolve({
        data: {
          items: [{
            a: 'a2',
            b: 'b2',
          }],
          page: 2,
        },
        status: 200,
        statusText: 'OK',
      })).mockResolvedValueOnce(Promise.resolve({
        data: {
          items: [{
            a: 'a3',
          }],
          page: 3,
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
      const result = (await toArrayAsync(await getWithPageOffsetPagination(1)({
        client,
        pageSize: 1,
        getParams: {
          url: '/ep',
          paginationField: 'page.pageNum',
        },
      }))).flat()
      expect(result).toEqual([{ a: 'a1' }, { a: 'a2', b: 'b2' }, { a: 'a3' }])
      expect(client.getSinglePage).toHaveBeenCalledTimes(4)
      expect(client.getSinglePage).toHaveBeenCalledWith({ url: '/ep' })
      expect(client.getSinglePage).toHaveBeenCalledWith({ url: '/ep', queryParams: { 'page.pageNum': 2 } })
      expect(client.getSinglePage).toHaveBeenCalledWith({ url: '/ep', queryParams: { 'page.pageNum': 3 } })
      expect(client.getSinglePage).toHaveBeenCalledWith({ url: '/ep', queryParams: { 'page.pageNum': 4 } })
    })

    it('should fail gracefully on HTTP errors', async () => {
      client.getSinglePage.mockResolvedValueOnce(Promise.resolve({
        data: {
          items: [{
            a: 'a1',
          }],
        },
        status: 200,
        statusText: 'OK',
      })).mockResolvedValueOnce(Promise.resolve({
        data: {},
        status: 404,
        statusText: 'Not Found',
      }))
      const result = (await toArrayAsync(await getWithPageOffsetPagination(1)({
        client,
        pageSize: 1,
        getParams: {
          url: '/ep',
          paginationField: 'page',
          queryParams: {
            arg1: 'val1',
          },
        },
      }))).flat()
      expect(result).toEqual([{ a: 'a1' }])
      expect(client.getSinglePage).toHaveBeenCalledTimes(2)
      expect(client.getSinglePage).toHaveBeenCalledWith({ url: '/ep', queryParams: { arg1: 'val1' } })
      expect(client.getSinglePage).toHaveBeenCalledWith({ url: '/ep', queryParams: { page: 2, arg1: 'val1' } })
    })
  })

  describe('getWithPageOffsetAndLastPagination', () => {
    const client: MockInterface<HTTPClientInterface> = {
      getSinglePage: mockFunction<HTTPClientInterface['getSinglePage']>(),
      getPageSize: mockFunction<HTTPClientInterface['getPageSize']>(),
    }
    beforeEach(() => {
      client.getSinglePage.mockReset()
      client.getPageSize.mockReset()
    })

    it('should query a single page if paginationField is not specified', async () => {
      client.getSinglePage.mockResolvedValueOnce(Promise.resolve({
        data: {
          a: 'a',
        },
        status: 200,
        statusText: 'OK',
      }))
      const result = (await toArrayAsync(await getWithPageOffsetAndLastPagination(0)({
        client,
        pageSize: 123,
        getParams: {
          url: '/ep',
        },
      }))).flat()
      expect(result).toEqual([{ a: 'a' }])
      expect(client.getSinglePage).toHaveBeenCalledTimes(1)
      expect(client.getSinglePage).toHaveBeenCalledWith({ url: '/ep' })
    })

    it('should use query args', async () => {
      client.getSinglePage.mockResolvedValueOnce(Promise.resolve({
        data: {
          a: 'a',
        },
        status: 200,
        statusText: 'OK',
      }))
      const result = (await toArrayAsync(await getWithPageOffsetAndLastPagination(0)({
        client,
        pageSize: 123,
        getParams: {
          url: '/ep',
          queryParams: {
            arg1: 'val1',
            arg2: 'val2',
          },
        },
      }))).flat()
      expect(result).toEqual([{ a: 'a' }])
      expect(client.getSinglePage).toHaveBeenCalledTimes(1)
      expect(client.getSinglePage).toHaveBeenCalledWith({ url: '/ep', queryParams: { arg1: 'val1', arg2: 'val2' } })
    })

    it('should use recursive query args', async () => {
      client.getSinglePage.mockResolvedValueOnce(Promise.resolve({
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
      const result = (await toArrayAsync(await getWithPageOffsetAndLastPagination(0)({
        client,
        pageSize: 5,
        getParams: {
          url: '/ep',
          recursiveQueryParams: {
            parentId: (entry => entry.id as string),
          },
        },
      }))).flat()
      expect(result).toEqual([
        { a: 'a1', id: 123 },
        { a: 'a2', id: 456 },
        { a: 'a1', id: 789 },
        { a: 'a4', id: 789 },
      ])
      expect(client.getSinglePage).toHaveBeenCalledTimes(4)
      expect(client.getSinglePage).toHaveBeenCalledWith({ url: '/ep' })
      expect(client.getSinglePage).toHaveBeenCalledWith({ url: '/ep', queryParams: { parentId: 123 } })
      expect(client.getSinglePage).toHaveBeenCalledWith({ url: '/ep', queryParams: { parentId: 456 } })
      expect(client.getSinglePage).toHaveBeenCalledWith({ url: '/ep', queryParams: { parentId: 789 } })
    })

    it('should query a single page if data has last=true', async () => {
      client.getSinglePage.mockResolvedValueOnce(Promise.resolve({
        data: {
          items: [{ a: 'a' }],
          last: true,
        },
        status: 200,
        statusText: 'OK',
      }))
      const result = (await toArrayAsync(await getWithPageOffsetAndLastPagination(0)({
        client,
        pageSize: 123,
        getParams: {
          url: '/ep',
          paginationField: 'page',
        },
      }))).flat()
      expect(result).toEqual([{ a: 'a' }])
      expect(client.getSinglePage).toHaveBeenCalledTimes(1)
      expect(client.getSinglePage).toHaveBeenCalledWith({ url: '/ep' })
    })
    it('should query a single page if data does not have a \'last\' field', async () => {
      client.getSinglePage.mockResolvedValueOnce(Promise.resolve({
        data: {
          a: 'a',
        },
        status: 200,
        statusText: 'OK',
      }))
      const result = (await toArrayAsync(await getWithPageOffsetAndLastPagination(0)({
        client,
        pageSize: 123,
        getParams: {
          url: '/ep',
          paginationField: 'page',
        },
      }))).flat()
      expect(result).toEqual([{ a: 'a' }])
      expect(client.getSinglePage).toHaveBeenCalledTimes(1)
      expect(client.getSinglePage).toHaveBeenCalledWith({ url: '/ep' })
    })

    it('should query multiple pages if response has last=false', async () => {
      client.getSinglePage.mockResolvedValueOnce(Promise.resolve({
        data: {
          items: [{
            a: 'a1',
          }],
          last: false,
        },
        status: 200,
        statusText: 'OK',
      })).mockResolvedValueOnce(Promise.resolve({
        data: {
          items: [{
            a: 'a2',
            b: 'b2',
          }],
          last: false,
        },
        status: 200,
        statusText: 'OK',
      })).mockResolvedValueOnce(Promise.resolve({
        data: {
          items: [{
            a: 'a3',
          }],
          last: false,
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
      const result = (await toArrayAsync(await getWithPageOffsetAndLastPagination(0)({
        client,
        pageSize: 1,
        getParams: {
          url: '/ep',
          paginationField: 'page',
        },
      }))).flat()
      expect(result).toEqual([{ a: 'a1' }, { a: 'a2', b: 'b2' }, { a: 'a3' }])
      expect(client.getSinglePage).toHaveBeenCalledTimes(4)
      expect(client.getSinglePage).toHaveBeenCalledWith({ url: '/ep' })
      expect(client.getSinglePage).toHaveBeenCalledWith({ url: '/ep', queryParams: { page: 1 } })
      expect(client.getSinglePage).toHaveBeenCalledWith({ url: '/ep', queryParams: { page: 2 } })
      expect(client.getSinglePage).toHaveBeenCalledWith({ url: '/ep', queryParams: { page: 3 } })
    })

    it('should query multiple pages correctly when paginationField is nested', async () => {
      client.getSinglePage.mockResolvedValueOnce(Promise.resolve({
        data: {
          items: [{
            a: 'a1',
          }],
          last: false,
        },
        status: 200,
        statusText: 'OK',
      })).mockResolvedValueOnce(Promise.resolve({
        data: {
          items: [{
            a: 'a2',
            b: 'b2',
          }],
          last: false,
        },
        status: 200,
        statusText: 'OK',
      })).mockResolvedValueOnce(Promise.resolve({
        data: {
          items: [{
            a: 'a3',
          }],
          last: false,
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
      const result = (await toArrayAsync(await getWithPageOffsetPagination(1)({
        client,
        pageSize: 1,
        getParams: {
          url: '/ep',
          paginationField: 'page.pageNum',
        },
      }))).flat()
      expect(result).toEqual([{ a: 'a1' }, { a: 'a2', b: 'b2' }, { a: 'a3' }])
      expect(client.getSinglePage).toHaveBeenCalledTimes(4)
      expect(client.getSinglePage).toHaveBeenCalledWith({ url: '/ep' })
      expect(client.getSinglePage).toHaveBeenCalledWith({ url: '/ep', queryParams: { 'page.pageNum': 2 } })
      expect(client.getSinglePage).toHaveBeenCalledWith({ url: '/ep', queryParams: { 'page.pageNum': 3 } })
      expect(client.getSinglePage).toHaveBeenCalledWith({ url: '/ep', queryParams: { 'page.pageNum': 4 } })
    })

    it('should fail gracefully on HTTP errors', async () => {
      client.getSinglePage.mockResolvedValueOnce(Promise.resolve({
        data: {
          items: [{
            a: 'a1',
          }],
          last: false,
        },
        status: 200,
        statusText: 'OK',
      })).mockResolvedValueOnce(Promise.resolve({
        data: {},
        status: 404,
        statusText: 'Not Found',
      }))
      const result = (await toArrayAsync(await getWithPageOffsetAndLastPagination(0)({
        client,
        pageSize: 1,
        getParams: {
          url: '/ep',
          paginationField: 'page',
          queryParams: {
            arg1: 'val1',
          },
        },
      }))).flat()
      expect(result).toEqual([{ a: 'a1' }])
      expect(client.getSinglePage).toHaveBeenCalledTimes(2)
      expect(client.getSinglePage).toHaveBeenCalledWith({ url: '/ep', queryParams: { arg1: 'val1' } })
      expect(client.getSinglePage).toHaveBeenCalledWith({ url: '/ep', queryParams: { page: 1, arg1: 'val1' } })
    })
  })

  describe('getWithCursorPagination', () => {
    const client: MockInterface<HTTPClientInterface> = {
      getSinglePage: mockFunction<HTTPClientInterface['getSinglePage']>(),
      getPageSize: mockFunction<HTTPClientInterface['getPageSize']>(),
    }
    beforeEach(() => {
      client.getSinglePage.mockReset()
      client.getPageSize.mockReset()
    })

    it('should query a single page if paginationField is not specified', async () => {
      client.getSinglePage.mockResolvedValueOnce(Promise.resolve({
        data: {
          products: ['a', 'b'],
        },
        status: 200,
        statusText: 'OK',
      }))
      const result = (await toArrayAsync(await getWithCursorPagination()({
        client,
        pageSize: 123,
        getParams: {
          url: '/ep',
        },
      }))).flat()
      expect(result).toEqual([{ products: ['a', 'b'] }])
      expect(client.getSinglePage).toHaveBeenCalledTimes(1)
      expect(client.getSinglePage).toHaveBeenCalledWith({ url: '/ep' })
    })

    it('should use query args', async () => {
      client.getSinglePage.mockResolvedValueOnce(Promise.resolve({
        data: {
          a: 'a',
        },
        status: 200,
        statusText: 'OK',
      }))
      const result = (await toArrayAsync(await getWithCursorPagination()({
        client,
        pageSize: 123,
        getParams: {
          url: '/ep',
          paginationField: 'nextPage',
          queryParams: {
            arg1: 'val1',
            arg2: 'val2',
          },
        },
      }))).flat()
      expect(result).toEqual([{ a: 'a' }])
      expect(client.getSinglePage).toHaveBeenCalledTimes(1)
      expect(client.getSinglePage).toHaveBeenCalledWith({ url: '/ep', queryParams: { arg1: 'val1', arg2: 'val2' } })
    })

    it('should query multiple pages if paginationField is found in response', async () => {
      client.getSinglePage.mockResolvedValueOnce(Promise.resolve({
        data: {
          products: ['a', 'b'],
          nextPage: '/ep?page=p1',
        },
        status: 200,
        statusText: 'OK',
      })).mockResolvedValueOnce(Promise.resolve({
        data: {
          products: ['c', 'd'],
        },
        status: 200,
        statusText: 'OK',
      }))
      const result = (await toArrayAsync(await getWithCursorPagination()({
        client,
        pageSize: 123,
        getParams: {
          url: '/ep',
          paginationField: 'nextPage',
        },
      }))).flat()
      expect(result).toEqual([{ products: ['a', 'b'], nextPage: '/ep?page=p1' }, { products: ['c', 'd'] }])
      expect(client.getSinglePage).toHaveBeenCalledTimes(2)
      expect(client.getSinglePage).toHaveBeenCalledWith({ url: '/ep' })
      expect(client.getSinglePage).toHaveBeenCalledWith({ url: '/ep', queryParams: { page: 'p1' } })
    })

    it('should query multiple pages correctly when paginationField is nested', async () => {
      client.getSinglePage.mockResolvedValueOnce(Promise.resolve({
        data: {
          products: ['a', 'b'],
          nextPage: { url: '/ep?page=p1' },
        },
        status: 200,
        statusText: 'OK',
      })).mockResolvedValueOnce(Promise.resolve({
        data: {
          products: ['c', 'd'],
        },
        status: 200,
        statusText: 'OK',
      }))
      const result = (await toArrayAsync(await getWithCursorPagination()({
        client,
        pageSize: 123,
        getParams: {
          url: '/ep',
          paginationField: 'nextPage.url',
        },
      }))).flat()
      expect(result).toEqual([{ products: ['a', 'b'], nextPage: { url: '/ep?page=p1' } }, { products: ['c', 'd'] }])
      expect(client.getSinglePage).toHaveBeenCalledTimes(2)
      expect(client.getSinglePage).toHaveBeenCalledWith({ url: '/ep' })
      expect(client.getSinglePage).toHaveBeenCalledWith({ url: '/ep', queryParams: { page: 'p1' } })
    })

    it('should fail gracefully on HTTP errors', async () => {
      client.getSinglePage.mockResolvedValueOnce(Promise.resolve({
        data: {
          products: ['a', 'b'],
          nextPage: '/ep?page=p1',
        },
        status: 200,
        statusText: 'OK',
      })).mockResolvedValueOnce(Promise.resolve({
        data: {},
        status: 404,
        statusText: 'Not Found',
      }))
      const result = (await toArrayAsync(await getWithCursorPagination()({
        client,
        pageSize: 1,
        getParams: {
          url: '/ep',
          paginationField: 'nextPage',
          queryParams: {
            arg1: 'val1',
          },
        },
      }))).flat()
      expect(result).toEqual([{ products: ['a', 'b'], nextPage: '/ep?page=p1' }])
      expect(client.getSinglePage).toHaveBeenCalledTimes(2)
      expect(client.getSinglePage).toHaveBeenCalledWith({ url: '/ep', queryParams: { arg1: 'val1' } })
      expect(client.getSinglePage).toHaveBeenCalledWith({ url: '/ep', queryParams: { page: 'p1', arg1: 'val1' } })
    })

    it('should throw on wrong url', async () => {
      client.getSinglePage.mockResolvedValueOnce(Promise.resolve({
        data: {
          products: ['a', 'b'],
          nextPage: '/another_ep?page=p1',
        },
        status: 200,
        statusText: 'OK',
      })).mockResolvedValueOnce(Promise.resolve({
        data: {},
        status: 404,
        statusText: 'Not Found',
      }))
      await expect(toArrayAsync(await getWithCursorPagination()({
        client,
        pageSize: 1,
        getParams: {
          url: '/ep',
          paginationField: 'nextPage',
          queryParams: {
            arg1: 'val1',
          },
        },
      }))).rejects.toThrow()
    })

    it('should check path based on path checker used by getWithCursorPagination', async () => {
      client.getSinglePage.mockResolvedValueOnce(Promise.resolve({
        data: {
          products: ['a', 'b'],
          nextPage: '/ep_suffix?page=p1',
        },
        status: 200,
        statusText: 'OK',
      })).mockResolvedValueOnce(Promise.resolve({
        data: {
          products: ['c', 'd'],
        },
        status: 200,
        statusText: 'OK',
      }))
      const result = (await toArrayAsync(await getWithCursorPagination((current, next) => `${current}_suffix` === next)({
        client,
        pageSize: 123,
        getParams: {
          url: '/ep',
          paginationField: 'nextPage',
        },
      }))).flat()
      expect(result).toEqual([{ products: ['a', 'b'], nextPage: '/ep_suffix?page=p1' }, { products: ['c', 'd'] }])
      expect(client.getSinglePage).toHaveBeenCalledTimes(2)
      expect(client.getSinglePage).toHaveBeenCalledWith({ url: '/ep' })
      expect(client.getSinglePage).toHaveBeenCalledWith({ url: '/ep', queryParams: { page: 'p1' } })
    })
  })

  describe('getWithOffsetAndLimit', () => {
    let client: MockInterface<HTTPClientInterface>
    beforeEach(() => {
      client = {
        getSinglePage: mockFunction<HTTPClientInterface['getSinglePage']>(),
        getPageSize: mockFunction<HTTPClientInterface['getPageSize']>().mockReturnValue(2),
      }
    })
    describe('when paginationField is not specified', () => {
      let results: ResponseValue[][]
      beforeEach(async () => {
        client.getSinglePage.mockResolvedValue({ status: 200, statusText: 'OK', data: { page: 1 } })
        results = await toArrayAsync(
          getWithOffsetAndLimit({ client, pageSize: 2, getParams: { url: '/ep' } })
        )
      })
      it('should query a single page', () => {
        expect(client.getSinglePage).toHaveBeenCalledTimes(1)
        expect(results).toHaveLength(1)
      })
    })
    describe('with paginationField', () => {
      const pages = [
        { isLast: false, startAt: 0, values: [1, 2] },
        { isLast: false, startAt: 2, values: [3] },
        { isLast: true, startAt: 3, values: [4, 5] },
      ]
      beforeEach(() => {
        pages.forEach(
          data => client.getSinglePage.mockResolvedValueOnce(
            { status: 200, statusText: 'OK', data }
          )
        )
      })
      describe('when response is a valid page', () => {
        let results: ResponseValue[][]
        beforeEach(async () => {
          results = await toArrayAsync(getWithOffsetAndLimit(
            { client, pageSize: 2, getParams: { url: '/ep', paginationField: 'startAt' } }
          ))
        })
        it('should query until isLast is true', () => {
          expect(client.getSinglePage).toHaveBeenCalledTimes(3)
          expect(results).toHaveLength(3)
          expect(results).toEqual(pages.map(page => [page]))
        })
      })
      describe('when response is not a valid page', () => {
        let resultIter: AsyncIterable<ResponseValue[]>
        beforeEach(async () => {
          resultIter = getWithOffsetAndLimit({ client, pageSize: 2, getParams: { url: '/ep', paginationField: 'wrong' } })
        })
        it('should throw error', async () => {
          await expect(toArrayAsync(resultIter)).rejects.toThrow()
        })
      })
    })

    describe('with nested paginationField', () => {
      const pages = [
        { isLast: false, pagination: { startAt: 0 }, values: [1, 2] },
        { isLast: false, pagination: { startAt: 2 }, values: [3] },
        { isLast: true, pagination: { startAt: 3 }, values: [4, 5] },
      ]
      beforeEach(() => {
        pages.forEach(
          data => client.getSinglePage.mockResolvedValueOnce(
            { status: 200, statusText: 'OK', data }
          )
        )
      })
      describe('when response is a valid page', () => {
        let results: ResponseValue[][]
        beforeEach(async () => {
          results = await toArrayAsync(getWithOffsetAndLimit(
            { client, pageSize: 2, getParams: { url: '/ep', paginationField: 'pagination.startAt' } }
          ))
        })
        it('should query until isLast is true', () => {
          expect(client.getSinglePage).toHaveBeenCalledTimes(3)
          expect(results).toHaveLength(3)
          expect(results).toEqual(pages.map(page => [page]))
        })
      })
    })
  })

  describe('createPaginator', () => {
    const client: MockInterface<HTTPClientInterface> = {
      getSinglePage: mockFunction<HTTPClientInterface['getSinglePage']>(),
      getPageSize: mockFunction<HTTPClientInterface['getPageSize']>().mockReturnValueOnce(3),
    }

    it('should call the pagination function with the right paramters', () => {
      const paginationFunc: GetAllItemsFunc = mockFunction<GetAllItemsFunc>()
      const paginator = createPaginator({ client, paginationFunc })
      const params = { url: 'url', queryParams: { a: 'b' }, paginationField: 'abc' }
      paginator(params)
      expect(paginationFunc).toHaveBeenCalledTimes(1)
      expect(paginationFunc).toHaveBeenLastCalledWith({
        client,
        pageSize: 3,
        getParams: params,
      })
    })
  })
})
