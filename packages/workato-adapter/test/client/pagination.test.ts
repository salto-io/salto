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
import { client as clientUtils } from '@salto-io/adapter-components'
import { getMinSinceIdPagination } from '../../src/client/pagination'
import { MockFunction, mockFunction } from '../utils'

const { toArrayAsync } = collections.asynciterable

type MockInterface<T extends {}> = {
  [k in keyof T]: T[k] extends (...args: never[]) => unknown
    ? MockFunction<T[k]>
    : MockInterface<T[k]>
}

describe('client_pagination', () => {
  describe('getMinSinceIdPagination', () => {
    const client: MockInterface<clientUtils.HTTPClientInterface> = {
      getSinglePage: mockFunction<clientUtils.HTTPClientInterface['getSinglePage']>(),
      getPageSize: mockFunction<clientUtils.HTTPClientInterface['getPageSize']>(),
    }
    beforeEach(() => {
      client.getSinglePage.mockReset()
    })

    it('should query a single page if paginationField is not specified', async () => {
      client.getSinglePage.mockResolvedValueOnce(Promise.resolve({
        data: {
          a: 'a',
        },
        status: 200,
        statusText: 'OK',
      }))
      const result = (await toArrayAsync(await getMinSinceIdPagination({
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
      const result = (await toArrayAsync(await getMinSinceIdPagination({
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
      const result = (await toArrayAsync(await getMinSinceIdPagination({
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

    it('should query a single page if data is empty', async () => {
      client.getSinglePage.mockResolvedValueOnce(Promise.resolve({
        data: [],
        status: 200,
        statusText: 'OK',
      }))
      const result = (await toArrayAsync(getMinSinceIdPagination({
        client,
        pageSize: 123,
        getParams: {
          url: '/ep',
          paginationField: 'page',
        },
      }))).flat()
      expect(result).toEqual([])
      expect(client.getSinglePage).toHaveBeenCalledTimes(1)
      expect(client.getSinglePage).toHaveBeenCalledWith({ url: '/ep' })
    })

    it('should query multiple pages if response has items', async () => {
      client.getSinglePage.mockResolvedValueOnce(Promise.resolve({
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
      const result = (await toArrayAsync(await getMinSinceIdPagination({
        client,
        pageSize: 1,
        getParams: {
          url: '/ep',
          paginationField: 'since_id',
        },
      }))).flat()
      expect(result).toEqual([{ a: 'a1', id: 150 }, { a: 'a2', b: 'b2', id: 140 }, { a: 'a3', id: 130 }])
      expect(client.getSinglePage).toHaveBeenCalledTimes(4)
      expect(client.getSinglePage).toHaveBeenCalledWith({ url: '/ep' })
      // eslint-disable-next-line @typescript-eslint/camelcase
      expect(client.getSinglePage).toHaveBeenCalledWith({ url: '/ep', queryParams: { since_id: '150' } })
      // eslint-disable-next-line @typescript-eslint/camelcase
      expect(client.getSinglePage).toHaveBeenCalledWith({ url: '/ep', queryParams: { since_id: '140' } })
      // eslint-disable-next-line @typescript-eslint/camelcase
      expect(client.getSinglePage).toHaveBeenCalledWith({ url: '/ep', queryParams: { since_id: '130' } })
    })

    it('should fail gracefully on HTTP errors', async () => {
      client.getSinglePage.mockResolvedValueOnce(Promise.resolve({
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
      const result = (await toArrayAsync(await getMinSinceIdPagination({
        client,
        pageSize: 1,
        getParams: {
          url: '/ep',
          paginationField: 'since_id',
          queryParams: {
            arg1: 'val1',
          },
        },
      }))).flat()
      expect(result).toEqual([{ a: 'a1', id: 150 }])
      expect(client.getSinglePage).toHaveBeenCalledTimes(2)
      expect(client.getSinglePage).toHaveBeenCalledWith({ url: '/ep', queryParams: { arg1: 'val1' } })
      // eslint-disable-next-line @typescript-eslint/camelcase
      expect(client.getSinglePage).toHaveBeenCalledWith({ url: '/ep', queryParams: { since_id: '150', arg1: 'val1' } })
    })

    it('should stop pagination if min id does not decrease', async () => {
      client.getSinglePage.mockResolvedValueOnce(Promise.resolve({
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
      const result = (await toArrayAsync(await getMinSinceIdPagination({
        client,
        pageSize: 1,
        getParams: {
          url: '/ep',
          paginationField: 'since_id',
        },
      }))).flat()
      expect(result).toEqual([{ a: 'a1', id: 150 }, { a: 'a2', b: 'b2', id: 140 }, { a: 'a3', id: 140 }])
      expect(client.getSinglePage).toHaveBeenCalledTimes(3)
      expect(client.getSinglePage).toHaveBeenCalledWith({ url: '/ep' })
      // eslint-disable-next-line @typescript-eslint/camelcase
      expect(client.getSinglePage).toHaveBeenCalledWith({ url: '/ep', queryParams: { since_id: '150' } })
      // eslint-disable-next-line @typescript-eslint/camelcase
      expect(client.getSinglePage).toHaveBeenCalledWith({ url: '/ep', queryParams: { since_id: '140' } })
    })
    it('should stop pagination if non-numerical id values are found', async () => {
      client.getSinglePage.mockResolvedValueOnce(Promise.resolve({
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
      const result = (await toArrayAsync(await getMinSinceIdPagination({
        client,
        pageSize: 1,
        getParams: {
          url: '/ep',
          paginationField: 'since_id',
        },
      }))).flat()
      expect(result).toEqual([{ a: 'a1', id: 150 }, { a: 'a2', b: 'b2', id: '140' }])
      expect(client.getSinglePage).toHaveBeenCalledTimes(2)
      expect(client.getSinglePage).toHaveBeenCalledWith({ url: '/ep' })
      // eslint-disable-next-line @typescript-eslint/camelcase
      expect(client.getSinglePage).toHaveBeenCalledWith({ url: '/ep', queryParams: { since_id: '150' } })
    })
  })
})
