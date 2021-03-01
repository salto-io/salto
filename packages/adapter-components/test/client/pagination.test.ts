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
import { APIConnection, getWithCursorPagination, getWithPageOffsetPagination } from '../../src/client'
import { MockInterface } from '../common'

const { toArrayAsync } = collections.asynciterable

describe('client_pagination', () => {
  describe('getWithPageOffsetPagination', () => {
    const conn: MockInterface<APIConnection> = { get: jest.fn() }
    beforeEach(() => {
      conn.get.mockReset()
    })

    it('should query a single page if paginationField is not specified', async () => {
      conn.get.mockResolvedValueOnce(Promise.resolve({
        data: {
          a: 'a',
        },
        status: 200,
        statusText: 'OK',
      }))
      const result = (await toArrayAsync(await getWithPageOffsetPagination({
        conn,
        pageSize: 123,
        getParams: {
          url: '/ep',
        },
      }))).flat()
      expect(result).toEqual([{ a: 'a' }])
      expect(conn.get).toHaveBeenCalledTimes(1)
      expect(conn.get).toHaveBeenCalledWith('/ep', undefined)
    })

    it('should use query args', async () => {
      conn.get.mockResolvedValueOnce(Promise.resolve({
        data: {
          a: 'a',
        },
        status: 200,
        statusText: 'OK',
      }))
      const result = (await toArrayAsync(await getWithPageOffsetPagination({
        conn,
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
      expect(conn.get).toHaveBeenCalledTimes(1)
      expect(conn.get).toHaveBeenCalledWith('/ep', { params: { arg1: 'val1', arg2: 'val2' } })
    })

    it('should use recursive query args', async () => {
      conn.get.mockResolvedValueOnce(Promise.resolve({
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
      const result = (await toArrayAsync(await getWithPageOffsetPagination({
        conn,
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
      expect(conn.get).toHaveBeenCalledTimes(4)
      expect(conn.get).toHaveBeenCalledWith('/ep', undefined)
      expect(conn.get).toHaveBeenCalledWith('/ep', { params: { parentId: 123 } })
      expect(conn.get).toHaveBeenCalledWith('/ep', { params: { parentId: 456 } })
      expect(conn.get).toHaveBeenCalledWith('/ep', { params: { parentId: 789 } })
    })

    it('should query a single page if data has less items than page size', async () => {
      conn.get.mockResolvedValueOnce(Promise.resolve({
        data: {
          a: 'a',
        },
        status: 200,
        statusText: 'OK',
      }))
      const result = (await toArrayAsync(await getWithPageOffsetPagination({
        conn,
        pageSize: 123,
        getParams: {
          url: '/ep',
          paginationField: 'page',
        },
      }))).flat()
      expect(result).toEqual([{ a: 'a' }])
      expect(conn.get).toHaveBeenCalledTimes(1)
      expect(conn.get).toHaveBeenCalledWith('/ep', undefined)
    })

    it('should query multiple pages if response has more items than page size (or equal)', async () => {
      conn.get.mockResolvedValueOnce(Promise.resolve({
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
      const result = (await toArrayAsync(await getWithPageOffsetPagination({
        conn,
        pageSize: 1,
        getParams: {
          url: '/ep',
          paginationField: 'page',
        },
      }))).flat()
      expect(result).toEqual([{ a: 'a1' }, { a: 'a2', b: 'b2' }, { a: 'a3' }])
      expect(conn.get).toHaveBeenCalledTimes(4)
      expect(conn.get).toHaveBeenCalledWith('/ep', undefined)
      expect(conn.get).toHaveBeenCalledWith('/ep', { params: { page: 2 } })
      expect(conn.get).toHaveBeenCalledWith('/ep', { params: { page: 3 } })
      expect(conn.get).toHaveBeenCalledWith('/ep', { params: { page: 4 } })
    })

    it('should fail gracefully on HTTP errors', async () => {
      conn.get.mockResolvedValueOnce(Promise.resolve({
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
      const result = (await toArrayAsync(await getWithPageOffsetPagination({
        conn,
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
      expect(conn.get).toHaveBeenCalledTimes(2)
      expect(conn.get).toHaveBeenCalledWith('/ep', { params: { arg1: 'val1' } })
      expect(conn.get).toHaveBeenCalledWith('/ep', { params: { page: 2, arg1: 'val1' } })
    })
  })

  describe('getWithCursorPagination', () => {
    const conn: MockInterface<APIConnection> = { get: jest.fn() }
    beforeEach(() => {
      conn.get.mockReset()
    })

    it('should query a single page if paginationField is not specified', async () => {
      conn.get.mockResolvedValueOnce(Promise.resolve({
        data: {
          products: ['a', 'b'],
        },
        status: 200,
        statusText: 'OK',
      }))
      const result = (await toArrayAsync(await getWithCursorPagination({
        conn,
        pageSize: 123,
        getParams: {
          url: '/ep',
        },
      }))).flat()
      expect(result).toEqual([{ products: ['a', 'b'] }])
      expect(conn.get).toHaveBeenCalledTimes(1)
      expect(conn.get).toHaveBeenCalledWith('/ep', undefined)
    })

    it('should use query args', async () => {
      conn.get.mockResolvedValueOnce(Promise.resolve({
        data: {
          a: 'a',
        },
        status: 200,
        statusText: 'OK',
      }))
      const result = (await toArrayAsync(await getWithCursorPagination({
        conn,
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
      expect(conn.get).toHaveBeenCalledTimes(1)
      expect(conn.get).toHaveBeenCalledWith('/ep', { params: { arg1: 'val1', arg2: 'val2' } })
    })

    it('should query multiple pages if paginationField is found in response', async () => {
      conn.get.mockResolvedValueOnce(Promise.resolve({
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
      const result = (await toArrayAsync(await getWithCursorPagination({
        conn,
        pageSize: 123,
        getParams: {
          url: '/ep',
          paginationField: 'nextPage',
        },
      }))).flat()
      expect(result).toEqual([{ products: ['a', 'b'], nextPage: '/ep?page=p1' }, { products: ['c', 'd'] }])
      expect(conn.get).toHaveBeenCalledTimes(2)
      expect(conn.get).toHaveBeenCalledWith('/ep', undefined)
      expect(conn.get).toHaveBeenCalledWith('/ep', { params: { page: 'p1' } })
    })

    it('should fail gracefully on HTTP errors', async () => {
      conn.get.mockResolvedValueOnce(Promise.resolve({
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
      const result = (await toArrayAsync(await getWithCursorPagination({
        conn,
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
      expect(conn.get).toHaveBeenCalledTimes(2)
      expect(conn.get).toHaveBeenCalledWith('/ep', { params: { arg1: 'val1' } })
      expect(conn.get).toHaveBeenCalledWith('/ep', { params: { page: 'p1', arg1: 'val1' } })
    })
  })
})
