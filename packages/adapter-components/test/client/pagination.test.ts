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
import { MockInterface, mockFunction } from '@salto-io/test-utils'
import { getWithCursorPagination, getWithPageOffsetPagination, getWithPageOffsetAndLastPagination, getWithOffsetAndLimit, HTTPClientInterface, createPaginator, ResponseValue, PageEntriesExtractor, PaginationFuncCreator, PaginationFunc, traverseRequests } from '../../src/client'

const { toArrayAsync } = collections.asynciterable
const { makeArray } = collections.array

const extractPageEntries: PageEntriesExtractor = page => makeArray(page) as ResponseValue[]

describe('client_pagination', () => {
  describe('traverseRequests', () => {
    const client: MockInterface<HTTPClientInterface> = {
      getSinglePage: mockFunction<HTTPClientInterface['getSinglePage']>(),
      getPageSize: mockFunction<HTTPClientInterface['getPageSize']>(),
    }
    const paginationFunc = mockFunction<PaginationFunc>()
    const customEntryExtractor = mockFunction<PageEntriesExtractor>()
    beforeEach(() => {
      client.getSinglePage.mockReset()
      client.getPageSize.mockReset()
      paginationFunc.mockReset()
      customEntryExtractor.mockReset()
    })

    it('should query the pagination function even if paginationField is not specified', async () => {
      client.getSinglePage.mockResolvedValueOnce(Promise.resolve({
        data: {
          a: 'a',
        },
        status: 200,
        statusText: 'OK',
      }))
      paginationFunc.mockReturnValueOnce([])
      const result = (await toArrayAsync(traverseRequests(
        paginationFunc,
        extractPageEntries
      )({
        client,
        pageSize: 123,
        getParams: {
          url: '/ep',
        },
      }))).flat()
      expect(result).toEqual([{ a: 'a' }])
      expect(paginationFunc).toHaveBeenCalledTimes(1)
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
      paginationFunc.mockReturnValueOnce([])
      const result = (await toArrayAsync(traverseRequests(
        paginationFunc,
        extractPageEntries
      )({
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
      const getParams = { url: '/ep', queryParams: { arg1: 'val1', arg2: 'val2' } }
      expect(client.getSinglePage).toHaveBeenCalledWith(getParams)
      expect(paginationFunc).toHaveBeenCalledTimes(1)
      expect(paginationFunc).toHaveBeenCalledWith({ currentParams: {}, getParams, page: [{ a: 'a' }], pageSize: 123, responseData: { a: 'a' } })
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
      paginationFunc.mockReturnValueOnce([]).mockReturnValueOnce([])
        .mockReturnValueOnce([])
      const result = (await toArrayAsync(traverseRequests(
        paginationFunc,
        extractPageEntries
      )({
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
      expect(paginationFunc).toHaveBeenCalledTimes(3)
    })

    it('should stop querying if pagination function returns empty', async () => {
      client.getSinglePage.mockResolvedValueOnce(Promise.resolve({
        data: {
          a: 'a',
        },
        status: 200,
        statusText: 'OK',
      }))
      paginationFunc.mockReturnValueOnce([])
      const result = (await toArrayAsync(traverseRequests(
        paginationFunc,
        extractPageEntries
      )({
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
      expect(paginationFunc).toHaveBeenCalledTimes(1)
      expect(paginationFunc).toHaveBeenCalledWith({
        pageSize: 123,
        getParams: {
          url: '/ep',
          paginationField: 'page',
        },
        currentParams: {},
        responseData: { a: 'a' },
        page: [{ a: 'a' }],
      })
    })

    it('should query multiple pages if pagination function returns next pages', async () => {
      client.getSinglePage.mockResolvedValueOnce(Promise.resolve({
        data: {
          items: [{ a: 'a1' }],
        },
        status: 200,
        statusText: 'OK',
      })).mockResolvedValueOnce(Promise.resolve({
        data: {
          items: [{ a: 'a2', b: 'b2' }],
          page: 2,
        },
        status: 200,
        statusText: 'OK',
      })).mockResolvedValueOnce(Promise.resolve({
        data: {
          items: [{ a: 'a3' }],
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
      paginationFunc.mockReturnValueOnce([{ page: '2' }]).mockReturnValueOnce([{ page: '3' }]).mockReturnValueOnce([{ page: '4' }])
      const params = {
        pageSize: 1,
        getParams: {
          url: '/ep',
          paginationField: 'page',
        },
      }
      const result = (await toArrayAsync(traverseRequests(
        paginationFunc,
        extractPageEntries
      )({
        client,
        ...params,
      }))).flat()
      expect(result).toEqual([{ a: 'a1' }, { a: 'a2', b: 'b2' }, { a: 'a3' }])
      expect(client.getSinglePage).toHaveBeenCalledTimes(4)
      expect(client.getSinglePage).toHaveBeenCalledWith({ url: '/ep' })
      expect(client.getSinglePage).toHaveBeenCalledWith({ url: '/ep', queryParams: { page: '2' } })
      expect(client.getSinglePage).toHaveBeenCalledWith({ url: '/ep', queryParams: { page: '3' } })
      expect(client.getSinglePage).toHaveBeenCalledWith({ url: '/ep', queryParams: { page: '4' } })
      expect(paginationFunc).toHaveBeenCalledTimes(3)
      expect(paginationFunc).toHaveBeenCalledWith({
        ...params,
        currentParams: {},
        responseData: { items: [{ a: 'a1' }] },
        page: [{ a: 'a1' }],
      })
      expect(paginationFunc).toHaveBeenCalledWith({
        ...params,
        currentParams: { page: '2' },
        responseData: { items: [{ a: 'a2', b: 'b2' }], page: 2 },
        page: [{ a: 'a2', b: 'b2' }],
      })
      expect(paginationFunc).toHaveBeenCalledWith({
        ...params,
        currentParams: { page: '3' },
        responseData: { items: [{ a: 'a3' }], page: 3 },
        page: [{ a: 'a3' }],
      })
    })

    it('should use page entries from paginator result if provided', async () => {
      client.getSinglePage.mockResolvedValueOnce(Promise.resolve({
        data: {
          items: [{ a: 'a1' }],
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
      paginationFunc.mockReturnValueOnce([{ page: '2' }])
      customEntryExtractor.mockReturnValueOnce([{ something: 'a' }])
      const params = {
        pageSize: 1,
        getParams: {
          url: '/ep',
          paginationField: 'page',
        },
      }
      const result = (await toArrayAsync(traverseRequests(
        paginationFunc,
        extractPageEntries,
        customEntryExtractor
      )({
        client,
        ...params,
      }))).flat()
      expect(result).toEqual([{ something: 'a' }])
      expect(client.getSinglePage).toHaveBeenCalledTimes(2)
      expect(client.getSinglePage).toHaveBeenCalledWith({ url: '/ep' })
      expect(client.getSinglePage).toHaveBeenCalledWith({ url: '/ep', queryParams: { page: '2' } })
      expect(paginationFunc).toHaveBeenCalledTimes(1)
      expect(paginationFunc).toHaveBeenCalledWith({
        ...params,
        currentParams: {},
        responseData: { items: [{ a: 'a1' }] },
        page: [{ something: 'a' }],
      })
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
      paginationFunc.mockReturnValueOnce([{ page: '2' }])
      const getParams = {
        url: '/ep',
        paginationField: 'page',
        queryParams: {
          arg1: 'val1',
        },
      }
      const result = (await toArrayAsync(traverseRequests(
        paginationFunc,
        extractPageEntries
      )({
        client,
        pageSize: 1,
        getParams,
      }))).flat()
      expect(result).toEqual([{ a: 'a1' }])
      expect(client.getSinglePage).toHaveBeenCalledTimes(2)
      expect(client.getSinglePage).toHaveBeenCalledWith({ url: '/ep', queryParams: { arg1: 'val1' } })
      expect(client.getSinglePage).toHaveBeenCalledWith({ url: '/ep', queryParams: { page: '2', arg1: 'val1' } })
      expect(paginationFunc).toHaveBeenCalledTimes(1)
      expect(paginationFunc).toHaveBeenCalledWith({ currentParams: {}, getParams, page: [{ a: 'a1' }], pageSize: 1, responseData: { items: [{ a: 'a1' }] } })
    })
  })

  describe('getWithPageOffsetPagination', () => {
    it('should query a single page if data has less items than page size', async () => {
      const paginate = getWithPageOffsetPagination(1)
      const args = {
        getParams: {
          url: '/ep',
          paginationField: 'page',
        },
        pageSize: 100,
      }
      expect(paginate({
        ...args,
        currentParams: {},
        responseData: {
          items: [{
            a: 'a1',
          }],
        },
        page: [{
          a: 'a1',
        }],
      })).toEqual([])
      expect(paginate({
        ...args,
        currentParams: { page: '3' },
        responseData: {
          items: [],
          page: 3,
        },
        page: [],
      })).toEqual([])
    })


    it('should query multiple pages if response has more items than page size (or equal)', async () => {
      const paginate = getWithPageOffsetPagination(1)
      const args = {
        getParams: {
          url: '/ep',
          paginationField: 'page',
        },
        pageSize: 1,
      }
      expect(paginate({
        ...args,
        currentParams: {},
        responseData: {
          items: [{
            a: 'a1',
          }],
        },
        page: [{
          a: 'a1',
        }],
      })).toEqual([{ page: '2' }])
      expect(paginate({
        ...args,
        currentParams: { page: '2' },
        responseData: {
          items: [{
            a: 'a2',
            b: 'b2',
          }],
          page: 2,
        },
        page: [{
          a: 'a2',
          b: 'b2',
        }],
      })).toEqual([{ page: '3' }])
      expect(paginate({
        ...args,
        currentParams: { page: '3' },
        responseData: {
          items: [],
          page: 3,
        },
        page: [],
      })).toEqual([])
    })

    it('should query multiple pages correctly when paginationField is nested', async () => {
      const paginate = getWithPageOffsetPagination(1)
      const args = {
        getParams: {
          url: '/ep',
          paginationField: 'page.pageNum',
        },
        pageSize: 1,
      }
      expect(paginate({
        ...args,
        currentParams: {},
        responseData: {
          items: [{
            a: 'a1',
          }],
        },
        page: [{
          a: 'a1',
        }],
      })).toEqual([{ 'page.pageNum': '2' }])
      expect(paginate({
        ...args,
        currentParams: { 'page.pageNum': '2' },
        responseData: {
          items: [{
            a: 'a2',
            b: 'b2',
          }],
          page: 2,
        },
        page: [{
          a: 'a2',
          b: 'b2',
        }],
      })).toEqual([{ 'page.pageNum': '3' }])
      expect(paginate({
        ...args,
        currentParams: { 'page.pageNum': '3' },
        responseData: {
          items: [],
          page: 3,
        },
        page: [],
      })).toEqual([])
    })
  })

  describe('getWithPageOffsetAndLastPagination', () => {
    it('should query a single page if data has last=true', async () => {
      const paginate = getWithPageOffsetAndLastPagination(0)
      const args = {
        pageSize: 123,
        getParams: {
          url: '/ep',
          paginationField: 'page',
        },
        currentParams: {},
      }
      expect(paginate({
        ...args,
        responseData: {
          items: [{ a: 'a' }],
          last: true,
        },
        page: [{
          a: 'a',
        }],
      })).toEqual([])
    })
    it('should query a single page if data does not have a \'last\' field', async () => {
      const paginate = getWithPageOffsetAndLastPagination(0)
      const args = {
        pageSize: 123,
        getParams: {
          url: '/ep',
          paginationField: 'page',
        },
        currentParams: {},
      }
      expect(paginate({
        ...args,
        responseData: {
          a: 'a',
        },
        page: [{
          a: 'a',
        }],
      })).toEqual([])
    })

    it('should query next page if response has last=false', async () => {
      const paginate = getWithPageOffsetAndLastPagination(0)
      const args = {
        pageSize: 123,
        getParams: {
          url: '/ep',
          paginationField: 'page',
        },
      }
      expect(paginate({
        ...args,
        currentParams: {},
        responseData: {
          items: [{
            a: 'a1',
          }],
          last: false,
        },
        page: [{
          a: 'a1',
        }],
      })).toEqual([{ page: '1' }])
      expect(paginate({
        ...args,
        currentParams: { page: '1' },
        responseData: {
          items: [{
            a: 'a1',
          }],
          last: false,
        },
        page: [{
          a: 'a1',
        }],
      })).toEqual([{ page: '2' }])
    })

    it('should query multiple pages correctly when paginationField is nested', async () => {
      const paginate = getWithPageOffsetAndLastPagination(0)
      const args = {
        pageSize: 123,
        getParams: {
          url: '/ep',
          paginationField: 'page.pageNum',
        },
      }
      expect(paginate({
        ...args,
        currentParams: {},
        responseData: {
          items: [{
            a: 'a1',
          }],
          last: false,
        },
        page: [{
          a: 'a1',
        }],
      })).toEqual([{ 'page.pageNum': '1' }])
      expect(paginate({
        ...args,
        currentParams: { 'page.pageNum': '1' },
        responseData: {
          items: [{
            a: 'a1',
          }],
          last: false,
        },
        page: [{
          a: 'a1',
        }],
      })).toEqual([{ 'page.pageNum': '2' }])
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

    it('should query next page if paginationField is found in response', async () => {
      const paginate = getWithCursorPagination()
      const args = {
        pageSize: 123,
        getParams: {
          url: '/ep',
          paginationField: 'nextPage',
        },
      }
      expect(paginate({
        ...args,
        currentParams: {},
        responseData: {
          products: [{ p: 'a' }, { p: 'b' }],
          nextPage: '/ep?page=p1',
        },
        page: [{ p: 'a' }, { p: 'b' }],
      })).toEqual([{ page: 'p1' }])
    })
    it('should not query next page if paginationField is not found in response', async () => {
      const paginate = getWithCursorPagination()
      const args = {
        pageSize: 123,
        getParams: {
          url: '/ep',
          paginationField: 'nextPage',
        },
      }
      expect(paginate({
        ...args,
        currentParams: { page: 'p1' },
        responseData: {
          products: [{ p: 'c' }, { p: 'd' }],
        },
        page: [{ p: 'c' }, { p: 'd' }],
      })).toEqual([])
    })
    it('should query multiple pages correctly when paginationField is nested', async () => {
      const paginate = getWithCursorPagination()
      const args = {
        pageSize: 123,
        getParams: {
          url: '/ep',
          paginationField: 'nextPage.url',
        },
      }
      expect(paginate({
        ...args,
        currentParams: {},
        responseData: {
          products: [{ p: 'a' }, { p: 'b' }],
          nextPage: { url: '/ep?page=p1' },
        },
        page: [{ p: 'a' }, { p: 'b' }],
      })).toEqual([{ page: 'p1' }])
    })

    it('should throw on wrong url', async () => {
      const paginate = getWithCursorPagination()
      const args = {
        pageSize: 123,
        getParams: {
          url: '/ep',
          paginationField: 'nextPage',
        },
      }
      expect(() => paginate({
        ...args,
        currentParams: {},
        responseData: {
          products: [{ p: 'a' }, { p: 'b' }],
          nextPage: '/another_ep?page=p1',
        },
        page: [{ p: 'a' }, { p: 'b' }],
      })).toThrow()
    })

    it('should check path based on path checker used by getWithCursorPagination', async () => {
      const paginate = getWithCursorPagination((current, next) => `${current}_suffix` === next)
      const args = {
        pageSize: 123,
        getParams: {
          url: '/ep',
          paginationField: 'nextPage',
        },
      }
      expect(paginate({
        ...args,
        currentParams: {},
        responseData: {
          products: [{ p: 'a' }, { p: 'b' }],
          nextPage: '/ep_suffix?page=p1',
        },
        page: [{ p: 'a' }, { p: 'b' }],
      })).toEqual([{ page: 'p1' }])
    })
  })

  describe('getWithOffsetAndLimit', () => {
    let paginate: PaginationFunc
    beforeEach(async () => {
      paginate = getWithOffsetAndLimit()
    })
    describe('with paginationField', () => {
      describe('when response is a valid page', () => {
        it('should query next page based on pagination field and number of entries in page', () => {
          expect(paginate({
            pageSize: 2,
            getParams: { url: '/ep', paginationField: 'startAt' },
            currentParams: {},
            responseData: { isLast: false, startAt: 0, values: [1, 2] },
            page: [{ isLast: false, startAt: 0, values: [1, 2] }],
          })).toEqual([{ startAt: '2' }])
          expect(paginate({
            pageSize: 2,
            getParams: { url: '/ep', paginationField: 'startAt' },
            currentParams: { startAt: '2' },
            responseData: { isLast: false, startAt: 2, values: [3] },
            page: [{ isLast: false, startAt: 2, values: [3] }],
          })).toEqual([{ startAt: '3' }])
        })
        it('should stop querying when isLast is true', () => {
          expect(paginate({
            pageSize: 2,
            getParams: { url: '/ep', paginationField: 'startAt' },
            currentParams: { startAt: '3' },
            responseData: { isLast: true, startAt: 3, values: [4, 5] },
            page: [{ isLast: true, startAt: 3, values: [4, 5] }],
          })).toEqual([])
        })
      })
      describe('when response is not a valid page', () => {
        it('should throw error', async () => {
          expect(() => paginate({
            pageSize: 2,
            getParams: { url: '/ep', paginationField: 'wrong' },
            currentParams: {},
            responseData: { isLast: false, startAt: 0, values: [1, 2] },
            page: [{ isLast: false, startAt: 0, values: [1, 2] }],
          })).toThrow('Response from /ep expected page with pagination field wrong')
        })
      })
    })

    describe('with nested paginationField', () => {
      describe('when response is a valid page', () => {
        it('should query next page based on pagination field and number of entries in page', () => {
          expect(paginate({
            pageSize: 2,
            getParams: { url: '/ep', paginationField: 'pagination.startAt' },
            currentParams: {},
            responseData: { isLast: false, pagination: { startAt: 0 }, values: [1, 2] },
            page: [{ isLast: false, pagination: { startAt: 0 }, values: [1, 2] }],
          })).toEqual([{ 'pagination.startAt': '2' }])
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
      const paginationFuncCreator: PaginationFuncCreator = mockFunction<PaginationFuncCreator>()
      const paginator = createPaginator({ client, paginationFuncCreator })
      const params = { url: 'url', queryParams: { a: 'b' }, paginationField: 'abc' }
      paginator(params, extractPageEntries)
      expect(paginationFuncCreator).toHaveBeenCalledTimes(1)
      expect(paginationFuncCreator).toHaveBeenLastCalledWith({
        client,
        pageSize: 3,
        getParams: params,
      })
    })
  })
})
