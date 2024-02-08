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
import { MockInterface, mockFunction } from '@salto-io/test-utils'
import { getWithCursorPagination, getWithPageOffsetPagination, getWithPageOffsetAndLastPagination, HTTPReadClientInterface, createPaginator, ResponseValue, PageEntriesExtractor, PaginationFuncCreator, PaginationFunc, traverseRequests, getWithItemIndexPagination, getAllPagesWithOffsetAndTotal, getWithOffsetAndLimit } from '../../src/client'
import * as traverseAsync from '../../src/client/pagination/pagination_async'

const { toArrayAsync } = collections.asynciterable
const { makeArray } = collections.array

const extractPageEntries: PageEntriesExtractor = page => makeArray(page) as ResponseValue[]

describe('client_pagination', () => {
  describe.each([
    [traverseRequests, 'traverseRequests'],
    [traverseAsync.traverseRequestsAsync, 'traverseRequestsAsync'],
  ])('traverseRequests with function %s', (traverseRequestsFunc, funcName) => {
    const client: MockInterface<HTTPReadClientInterface> = {
      get: mockFunction<HTTPReadClientInterface['get']>(),
      head: mockFunction<HTTPReadClientInterface['head']>(),
      options: mockFunction<HTTPReadClientInterface['options']>(),
      getPageSize: mockFunction<HTTPReadClientInterface['getPageSize']>(),
    }
    const paginationFunc = mockFunction<PaginationFunc>()
    const customEntryExtractor = mockFunction<PageEntriesExtractor>()
    beforeEach(() => {
      client.get.mockReset()
      client.head.mockReset()
      client.options.mockReset()
      client.getPageSize.mockReset()
      paginationFunc.mockReset()
      customEntryExtractor.mockReset()
    })

    it(`${funcName} should query the pagination function even if paginationField is not specified`, async () => {
      client.get.mockResolvedValueOnce(Promise.resolve({
        data: {
          a: 'a',
        },
        status: 200,
        statusText: 'OK',
      }))
      paginationFunc.mockReturnValueOnce([])
      const result = (await toArrayAsync(traverseRequestsFunc(
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
      expect(client.get).toHaveBeenCalledTimes(1)
      expect(client.get).toHaveBeenCalledWith({ url: '/ep' })
    })

    it(`${funcName}  should use query args`, async () => {
      client.get.mockResolvedValueOnce(Promise.resolve({
        data: {
          a: 'a',
        },
        status: 200,
        statusText: 'OK',
      }))
      paginationFunc.mockReturnValueOnce([])
      const result = (await toArrayAsync(traverseRequestsFunc(
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
      expect(client.get).toHaveBeenCalledTimes(1)
      const getParams = { url: '/ep', queryParams: { arg1: 'val1', arg2: 'val2' } }
      expect(client.get).toHaveBeenCalledWith(getParams)
      expect(paginationFunc).toHaveBeenCalledTimes(1)
      expect(paginationFunc).toHaveBeenCalledWith({ currentParams: {}, getParams, page: [{ a: 'a' }], pageSize: 123, responseData: { a: 'a' } })
    })

    it(`${funcName}  should use recursive query args`, async () => {
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
      paginationFunc.mockReturnValueOnce([]).mockReturnValueOnce([])
        .mockReturnValueOnce([])
      const result = (await toArrayAsync(traverseRequestsFunc(
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
      expect(client.get).toHaveBeenCalledTimes(4)
      expect(client.get).toHaveBeenCalledWith({ url: '/ep' })
      expect(client.get).toHaveBeenCalledWith({ url: '/ep', queryParams: { parentId: 123 } })
      expect(client.get).toHaveBeenCalledWith({ url: '/ep', queryParams: { parentId: 456 } })
      expect(client.get).toHaveBeenCalledWith({ url: '/ep', queryParams: { parentId: 789 } })
      expect(paginationFunc).toHaveBeenCalledTimes(3)
    })

    it(`${funcName}  should stop querying if pagination function returns empty`, async () => {
      client.get.mockResolvedValueOnce(Promise.resolve({
        data: {
          a: 'a',
        },
        status: 200,
        statusText: 'OK',
      }))
      paginationFunc.mockReturnValueOnce([])
      const result = (await toArrayAsync(traverseRequestsFunc(
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
      expect(client.get).toHaveBeenCalledTimes(1)
      expect(client.get).toHaveBeenCalledWith({ url: '/ep' })
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

    it(`${funcName}  should query multiple pages if pagination function returns next pages`, async () => {
      client.get.mockResolvedValueOnce(Promise.resolve({
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
      const result = (await toArrayAsync(traverseRequestsFunc(
        paginationFunc,
        extractPageEntries
      )({
        client,
        ...params,
      }))).flat()
      expect(result).toEqual([{ a: 'a1' }, { a: 'a2', b: 'b2' }, { a: 'a3' }])
      expect(client.get).toHaveBeenCalledTimes(4)
      expect(client.get).toHaveBeenCalledWith({ url: '/ep' })
      expect(client.get).toHaveBeenCalledWith({ url: '/ep', queryParams: { page: '2' } })
      expect(client.get).toHaveBeenCalledWith({ url: '/ep', queryParams: { page: '3' } })
      expect(client.get).toHaveBeenCalledWith({ url: '/ep', queryParams: { page: '4' } })
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

    it(`${funcName}  should use page entries from paginator result if provided`, async () => {
      client.get.mockResolvedValueOnce(Promise.resolve({
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
      const result = (await toArrayAsync(traverseRequestsFunc(
        paginationFunc,
        extractPageEntries,
        customEntryExtractor
      )({
        client,
        ...params,
      }))).flat()
      expect(result).toEqual([{ something: 'a' }])
      expect(client.get).toHaveBeenCalledTimes(2)
      expect(client.get).toHaveBeenCalledWith({ url: '/ep' })
      expect(client.get).toHaveBeenCalledWith({ url: '/ep', queryParams: { page: '2' } })
      expect(paginationFunc).toHaveBeenCalledTimes(1)
      expect(paginationFunc).toHaveBeenCalledWith({
        ...params,
        currentParams: {},
        responseData: { items: [{ a: 'a1' }] },
        page: [{ something: 'a' }],
      })
    })
    it(`${funcName}  should continue querying while there are results even if extractor returns empty`, async () => {
      client.get.mockResolvedValueOnce(Promise.resolve({
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
      customEntryExtractor.mockReturnValueOnce([])
      const params = {
        pageSize: 1,
        getParams: {
          url: '/ep',
          paginationField: 'page',
        },
      }
      const result = (await toArrayAsync(traverseRequestsFunc(
        paginationFunc,
        extractPageEntries,
        customEntryExtractor
      )({
        client,
        ...params,
      }))).flat()
      expect(result).toEqual([])
      expect(client.get).toHaveBeenCalledTimes(2)
      expect(client.get).toHaveBeenCalledWith({ url: '/ep' })
      expect(client.get).toHaveBeenCalledWith({ url: '/ep', queryParams: { page: '2' } })
      expect(paginationFunc).toHaveBeenCalledTimes(1)
      expect(paginationFunc).toHaveBeenCalledWith({
        ...params,
        currentParams: {},
        responseData: { items: [{ a: 'a1' }] },
        page: [],
      })
    })
    it(`${funcName}  should fail gracefully on HTTP errors`, async () => {
      client.get.mockResolvedValueOnce(Promise.resolve({
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
      const result = (await toArrayAsync(traverseRequestsFunc(
        paginationFunc,
        extractPageEntries
      )({
        client,
        pageSize: 1,
        getParams,
      }))).flat()
      expect(result).toEqual([{ a: 'a1' }])
      expect(client.get).toHaveBeenCalledTimes(2)
      expect(client.get).toHaveBeenCalledWith({ url: '/ep', queryParams: { arg1: 'val1' } })
      expect(client.get).toHaveBeenCalledWith({ url: '/ep', queryParams: { page: '2', arg1: 'val1' } })
      expect(paginationFunc).toHaveBeenCalledTimes(1)
      expect(paginationFunc).toHaveBeenCalledWith({ currentParams: {}, getParams, page: [{ a: 'a1' }], pageSize: 1, responseData: { items: [{ a: 'a1' }] } })
    })
    it(`${funcName}  should throw if encountered unknown HTTP exception errors`, async () => {
      client.get.mockResolvedValueOnce(Promise.resolve({
        data: {
          items: [{
            a: 'a1',
          }],
        },
        status: 200,
        statusText: 'OK',
      }))
        .mockRejectedValueOnce(new Error('Something went wrong'))
        .mockRejectedValueOnce(new Error('Something else went wrong'))
      paginationFunc.mockReturnValueOnce([{ page: '2' }, { page: '4' }])
      const getParams = {
        url: '/ep',
        paginationField: 'page',
        queryParams: {
          arg1: 'val1',
        },
      }
      await expect(toArrayAsync(traverseRequestsFunc(
        paginationFunc,
        extractPageEntries
      )({
        client,
        pageSize: 1,
        getParams,
      }))).rejects.toThrow('Something went wrong')
    })
  })
  describe('getWithItemIndexPagination', () => {
    it('should query a single page if data has less items than page size', async () => {
      const paginate = getWithItemIndexPagination({ firstIndex: 0, pageSizeArgName: 'maxResults' })
      const args = {
        getParams: {
          url: '/ep',
          paginationField: 'startAt',
          queryParams: {
            maxResults: '20',
          },
        },
        pageSize: 30,
      }
      expect(paginate({
        ...args,
        currentParams: {},
        responseData: {},
        page: [{
          a: 'a1',
        }],
      })).toEqual([])
      expect(paginate({
        ...args,
        currentParams: { startAt: '20' },
        responseData: {},
        page: [],
      })).toEqual([])
    })
    it('should query a single page with default size if data has less items than page size and pageSizeArgName is not provided', async () => {
      const paginate = getWithItemIndexPagination({ firstIndex: 0, pageSizeArgName: undefined })
      const args = {
        getParams: {
          url: '/ep',
          paginationField: 'startAt',
        },
        pageSize: 30,
      }
      expect(paginate({
        ...args,
        currentParams: {},
        responseData: {},
        page: [{
          a: 'a1',
        }],
      })).toEqual([])
    })
    it('should query a single page with default size if data has less items than page size and maxResults is not a number', async () => {
      const paginate = getWithItemIndexPagination({ firstIndex: 0, pageSizeArgName: undefined })
      const args = {
        getParams: {
          url: '/ep',
          paginationField: 'startAt',
          queryParams: {
            maxResults: 'not a number',
          },
        },
        pageSize: 30,
      }
      expect(paginate({
        ...args,
        currentParams: {},
        responseData: {},
        page: [{
          a: 'a1',
        }],
      })).toEqual([])
    })
    it('should query multiple pages if response has more items than page size (or equal)', async () => {
      const paginate = getWithItemIndexPagination({ firstIndex: 0, pageSizeArgName: 'maxResults' })
      const args = {
        getParams: {
          url: '/ep',
          paginationField: 'startAt',
          queryParams: {
            maxResults: '2',
          },
        },
        pageSize: 30,
      }
      expect(paginate({
        ...args,
        currentParams: {},
        responseData: {},
        page: [{
          a: 'a1',
        }, {
          b: 'b2',
        }],
      })).toEqual([{ startAt: '2' }])
      expect(paginate({
        ...args,
        currentParams: { startAt: '2' },
        responseData: {},
        page: [{
          a: 'a1',
        }, {
          b: 'b2',
        }],
      })).toEqual([{ startAt: '4' }])
      expect(paginate({
        ...args,
        currentParams: { startAt: '4' },
        responseData: {},
        page: [{
          a: 'a2',
        }],
      })).toEqual([])
    })
    it('should query multiple pages if response has more items than page size (or equal) with pageSizeArgName is not provided', async () => {
      const paginate = getWithItemIndexPagination({ firstIndex: 0, pageSizeArgName: undefined })
      const args = {
        getParams: {
          url: '/ep',
          paginationField: 'startAt',
        },
        pageSize: 2,
      }
      expect(paginate({
        ...args,
        currentParams: {},
        responseData: {},
        page: [{
          a: 'a1',
        }, {
          b: 'b2',
        }],
      })).toEqual([{ startAt: '2' }])
      expect(paginate({
        ...args,
        currentParams: { startAt: '2' },
        responseData: {},
        page: [{
          a: 'a1',
        }, {
          b: 'b2',
        }],
      })).toEqual([{ startAt: '4' }])
      expect(paginate({
        ...args,
        currentParams: { startAt: '4' },
        responseData: {},
        page: [{
          a: 'a2',
        }],
      })).toEqual([])
    })
    it('should query multiple pages if response has more items than page size (or equal) and maxResults is not a number', async () => {
      const paginate = getWithItemIndexPagination({ firstIndex: 0, pageSizeArgName: 'maxResults' })
      const args = {
        getParams: {
          url: '/ep',
          paginationField: 'startAt',
          queryParams: {
            maxResults: 'not a number',
          },
        },
        pageSize: 2,
      }
      expect(paginate({
        ...args,
        currentParams: {},
        responseData: {},
        page: [{
          a: 'a1',
        }, {
          b: 'b2',
        }],
      })).toEqual([{ startAt: '2' }])
      expect(paginate({
        ...args,
        currentParams: { startAt: '2' },
        responseData: {},
        page: [{
          a: 'a1',
        }, {
          b: 'b2',
        }],
      })).toEqual([{ startAt: '4' }])
      expect(paginate({
        ...args,
        currentParams: { startAt: '4' },
        responseData: {},
        page: [{
          a: 'a2',
        }],
      })).toEqual([])
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
    const client: MockInterface<HTTPReadClientInterface> = {
      get: mockFunction<HTTPReadClientInterface['get']>(),
      head: mockFunction<HTTPReadClientInterface['head']>(),
      options: mockFunction<HTTPReadClientInterface['options']>(),
      getPageSize: mockFunction<HTTPReadClientInterface['getPageSize']>(),
    }
    beforeEach(() => {
      client.get.mockReset()
      client.head.mockReset()
      client.options.mockReset()
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
  })

  describe('getAllPagesWithOffsetAndTotal', () => {
    let paginate: PaginationFunc
    beforeEach(async () => {
      paginate = getAllPagesWithOffsetAndTotal()
    })
    describe('with paginationField', () => {
      describe('when response is a valid page', () => {
        it('should query next pages based on pagination field and number of entries in page', () => {
          expect(paginate({
            pageSize: 2,
            getParams: { url: '/ep', paginationField: 'startAt' },
            currentParams: {},
            responseData: { total: 10, startAt: 0, values: [1, 2] },
            page: [{ total: 10, startAt: 0, values: [1, 2] }],
          })).toEqual([{ startAt: '2' }, { startAt: '4' }, { startAt: '6' }, { startAt: '8' }])
          expect(paginate({
            pageSize: 2,
            getParams: { url: '/ep', paginationField: 'startAt' },
            currentParams: {},
            responseData: { total: 11, startAt: 0, values: [1, 2] },
            page: [{ total: 11, startAt: 0, values: [1, 2] }],
          })).toEqual([{ startAt: '2' }, { startAt: '4' }, { startAt: '6' }, { startAt: '8' }, { startAt: '10' }])
        })
        it('should not query next pages if not first page', () => {
          expect(paginate({
            pageSize: 2,
            getParams: { url: '/ep', paginationField: 'startAt' },
            currentParams: { startAt: '2' },
            responseData: { total: 10, startAt: 2, values: [3, 4] },
            page: [{ total: 10, startAt: 2, values: [3, 4] }],
          })).toEqual([])
        })
        it('should not query next pages if got all answers', () => {
          expect(paginate({
            pageSize: 2,
            getParams: { url: '/ep', paginationField: 'startAt' },
            currentParams: { },
            responseData: { total: 2, startAt: 0, values: [3, 4] },
            page: [{ total: 2, startAt: 0, values: [3, 4] }],
          })).toEqual([])
        })
      })
      describe('when response is not a valid page', () => {
        it('should throw error when wrong pagination field', async () => {
          expect(() => paginate({
            pageSize: 2,
            getParams: { url: '/ep', paginationField: 'wrong' },
            currentParams: {},
            responseData: { total: 10, startAt: 0, values: [1, 2] },
            page: [{ total: 10, startAt: 0, values: [1, 2] }],
          })).toThrow('Response from /ep expected page with pagination field wrong')
        })
        it('should return empty of there is no pagination field', () => {
          expect(paginate({
            pageSize: 2,
            getParams: { url: '/ep' },
            currentParams: { },
            responseData: { total: 10, startAt: 0, values: [1, 2] },
            page: [{ total: 10, startAt: 0, values: [1, 2] }],
          })).toEqual([])
        })
        it('should throw error when wrong response structure', () => {
          expect(() => paginate({
            pageSize: 2,
            getParams: { url: '/ep', paginationField: 'startAt' },
            currentParams: { },
            responseData: { startAt: 0, values: [1, 2] },
            page: [{ total: 10, startAt: 0, values: [1, 2] }],
          })).toThrow('Response from /ep expected page with pagination field startAt, got {"startAt":0,"values":[1,2]}')
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
            responseData: { total: 4, pagination: { startAt: 0 }, values: [1, 2] },
            page: [{ totak: 4, pagination: { startAt: 0 }, values: [1, 2] }],
          })).toEqual([{ 'pagination.startAt': '2' }])
        })
      })
    })
  })

  describe('createPaginator', () => {
    let client: MockInterface<HTTPReadClientInterface>
    beforeEach(() => {
      client = {
        get: mockFunction<HTTPReadClientInterface['get']>(),
        head: mockFunction<HTTPReadClientInterface['head']>(),
        options: mockFunction<HTTPReadClientInterface['options']>(),
        getPageSize: mockFunction<HTTPReadClientInterface['getPageSize']>().mockReturnValueOnce(3),
      }
    })

    it('should call the pagination function with the right parameters', () => {
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
    it('should call the async pagination function with the right parameters', () => {
      const paginationFuncCreator = mockFunction<PaginationFuncCreator>()
      const traverseSpy = jest.spyOn(traverseAsync, 'traverseRequestsAsync')
      const paginator = createPaginator({ client, paginationFuncCreator, asyncRun: true })
      const params = { url: 'url', queryParams: { a: 'b' }, paginationField: 'abc' }
      paginator(params, extractPageEntries)
      expect(paginationFuncCreator).toHaveBeenCalledTimes(1)
      expect(paginationFuncCreator).toHaveBeenLastCalledWith({
        client,
        pageSize: 3,
        getParams: params,
      })
      expect(traverseSpy).toHaveBeenCalledTimes(1)
    })
  })
})
