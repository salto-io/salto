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
import {
  defaultPathChecker,
  noPagination,
  itemOffsetPagination,
  cursorPagination,
  offsetAndLimitPagination,
  cursorHeaderPagination,
  tokenPagination,
} from '../../../../src/fetch/request/pagination/pagination_functions'

describe('pagination functions', () => {
  describe('defaultPathChecker', () => {
    it('should return true for identical paths', () => {
      expect(defaultPathChecker('/a/b/c', '/a/b/c')).toEqual(true)
    })

    it('should return false for different paths', () => {
      expect(defaultPathChecker('/a/b/c', '/a/b/c/d')).toEqual(false)
    })
  })
  describe('noPagination', () => {
    it('should return no next page', () => {
      expect(noPagination()({ endpointIdentifier: { path: '/ep' }, responseData: {}, currentParams: {} })).toEqual([])
    })
  })

  describe('itemOffsetPagination', () => {
    it('should calculate next pages', async () => {
      const paginate = itemOffsetPagination({
        firstIndex: 0,
        dataField: 'a',
        pageSize: 1,
        paginationField: 'next',
        pageSizeArgName: 'maxResults',
      })
      expect(
        paginate({
          endpointIdentifier: { path: '/ep' },
          currentParams: {},
          responseData: { a: [{ x: 'y' }], maxResults: 30 },
        }),
      ).toEqual([{ queryParams: { next: '1' } }])
      expect(
        paginate({
          endpointIdentifier: { path: '/ep' },
          currentParams: { queryParams: { next: '20' } },
          responseData: { maxResults: 30 },
        }),
      ).toEqual([{ queryParams: { next: '21' } }])
    })
  })

  describe('cursorPagination', () => {
    it('should calculate next pages', async () => {
      const paginate = cursorPagination({ paginationField: 'next', pathChecker: defaultPathChecker })
      expect(
        paginate({
          endpointIdentifier: { path: '/ep' },
          currentParams: {},
          responseData: { a: [{ x: 'y' }], next: 'https://127.0.0.1/ep?arg=val' },
        }),
      ).toEqual([{ queryParams: { arg: 'val' } }])
    })
  })

  describe('offsetAndLimitPagination', () => {
    it('should calculate next pages', async () => {
      const paginate = offsetAndLimitPagination({ paginationField: 'startAt' })
      expect(
        paginate({
          endpointIdentifier: { path: '/ep' },
          currentParams: {},
          responseData: { isLast: false, startAt: 0, values: [1, 2] },
        }),
      ).toEqual([{ queryParams: { startAt: '2' } }])
      expect(
        paginate({
          endpointIdentifier: { path: '/ep' },
          currentParams: {},
          responseData: { isLast: false, startAt: 2, values: [3] },
        }),
      ).toEqual([{ queryParams: { startAt: '3' } }])
    })
  })

  describe('cursorHeaderPagination', () => {
    const paginate = cursorHeaderPagination({ pathChecker: defaultPathChecker })

    it('should query next page if the link header exits and there is a next page', async () => {
      const args = { pageSize: 123 }
      expect(
        paginate({
          ...args,
          currentParams: {},
          responseData: {
            products: [{ p: 'a' }, { p: 'b' }],
          },
          responseHeaders: {
            link: '<https://something.adapter.com/api/v1/path?limit=2>; rel="self", <https://something.adapter.com/api/v1/path?after=123123&limit=2>; rel="next"',
          },
          endpointIdentifier: { path: '/api/v1/path' },
        }),
      ).toEqual([
        {
          queryParams: { after: '123123', limit: '2' },
        },
      ])
    })

    it('should return nothing if there is no link header', () => {
      const args = { pageSize: 123 }
      expect(
        paginate({
          ...args,
          currentParams: {},
          responseData: {
            products: [{ p: 'a' }, { p: 'b' }],
          },
          responseHeaders: {
            expires: 0,
          },
          endpointIdentifier: { path: '/api/v1/path' },
        }),
      ).toEqual([])
    })
    it('should do nothing if there is no next page', () => {
      const args = {
        pageSize: 123,
        getParams: {
          url: '/api/v1/path',
        },
      }
      expect(
        paginate({
          ...args,
          currentParams: {},
          responseData: {
            products: [{ p: 'a' }, { p: 'b' }],
          },
          responseHeaders: {
            link: '<https://something.okta.com/api/v1/path>; rel="self"',
          },
          endpointIdentifier: { path: '/api/v1/path' },
        }),
      ).toEqual([])
    })
    it('should throw error if the next page link is for different the endpoint', () => {
      const args = { pageSize: 123 }
      expect(() =>
        paginate({
          ...args,
          currentParams: {},
          responseData: {
            products: [{ p: 'a' }, { p: 'b' }],
          },
          responseHeaders: {
            link: '<https://something.okta.com/api/v1/path?limit=2>; rel="self", <https://something.okta.com/api/different/endpoint?after=123123&limit=2>; rel="next"',
          },
          endpointIdentifier: { path: '/api/v1/path' },
        }),
      ).toThrow()
    })
  })

  describe('tokenPagination', () => {
    it('should calculate next pages', async () => {
      const paginate = tokenPagination({ paginationField: 'pageToken', tokenField: 'nextPageToken' })
      expect(
        paginate({
          endpointIdentifier: { path: '/ep' },
          currentParams: { queryParams: { pageToken: 'first' } },
          responseData: { a: [{ x: 'y' }], nextPageToken: 'second' },
        }),
      ).toEqual([{ queryParams: { pageToken: 'second' } }])
    })
  })
  // TODO extend tests for all pagination functions (can rely on previous tests)
})
