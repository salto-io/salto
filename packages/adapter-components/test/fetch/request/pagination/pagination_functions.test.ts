/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ResponseValue } from '../../../../src/client'
import { MaxResultsExceeded } from '../../../../src/fetch/errors'
import {
  defaultPathChecker,
  noPagination,
  itemOffsetPagination,
  cursorPagination,
  offsetAndValuesPagination,
  cursorHeaderPagination,
  tokenPagination,
  offsetAndLimitPagination,
  getPaginationWithLimitedResults,
  getItems,
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

  describe('offsetAndValuesPagination', () => {
    it('should calculate next pages', async () => {
      const paginate = offsetAndValuesPagination({ paginationField: 'startAt' })
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

  describe('offsetAndLimitPagination', () => {
    it('should calculate next pages', async () => {
      const paginate = offsetAndLimitPagination()
      expect(
        paginate({
          endpointIdentifier: { path: '/ep' },
          currentParams: {},
          responseData: { more: true, offset: 0, limit: 3, values: [1, 2, 3] },
        }),
      ).toEqual([{ queryParams: { offset: '3' } }])
      expect(
        paginate({
          endpointIdentifier: { path: '/ep' },
          currentParams: {},
          responseData: { more: false, startAt: 3, values: [4] },
        }),
      ).toEqual([])
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

  describe('getPaginationWithLimitedResults', () => {
    it('should throw MaxResultsExceeded if the number of results exceeds the limit', async () => {
      const paginate = getPaginationWithLimitedResults({
        maxResultsNumber: 3,
        paginationFunc: cursorPagination({ paginationField: 'next', pathChecker: defaultPathChecker }),
        getItemsFunc: (value: ResponseValue | ResponseValue[]): unknown[] => getItems(value, 'data'),
      })
      expect(() =>
        paginate({
          endpointIdentifier: { path: '/ep' },
          currentParams: {},
          responseData: {
            data: [{ a: 'a' }, { a: 'b' }, { a: 'c' }, { a: 'd' }],
            next: 'https://127.0.0.1/ep?arg=val',
          },
        }),
      ).toThrow(new MaxResultsExceeded({ endpoint: '/ep', maxResults: 3 }))
    })
    it('should throw MaxResultsExceeded if the number of results exceeds the limit after multiple pages', async () => {
      const paginate = getPaginationWithLimitedResults({
        maxResultsNumber: 3,
        paginationFunc: cursorPagination({ paginationField: 'next', pathChecker: defaultPathChecker }),
        getItemsFunc: (value: ResponseValue | ResponseValue[]): unknown[] => getItems(value, 'data'),
      })
      paginate({
        endpointIdentifier: { path: '/ep' },
        currentParams: {},
        responseData: { data: [{ a: 'a' }, { a: 'b' }, { a: 'c' }], next: 'https://127.0.0.1/ep?arg=val' },
      })
      expect(() =>
        paginate({
          endpointIdentifier: { path: '/ep' },
          currentParams: { queryParams: { arg: 'val' } },
          responseData: { data: [{ a: 'd' }, { a: 'e' }, { a: 'f' }], next: 'https://127.0.0.1/ep?arg=val' },
        }),
      ).toThrow(new MaxResultsExceeded({ endpoint: '/ep', maxResults: 3 }))
    })
    it('should return results if the number of results does not exceed the limit', async () => {
      const paginate = getPaginationWithLimitedResults({
        maxResultsNumber: 3,
        paginationFunc: cursorPagination({ paginationField: 'next', pathChecker: defaultPathChecker }),
        getItemsFunc: (value: ResponseValue | ResponseValue[]): unknown[] => getItems(value, 'data'),
      })
      expect(
        paginate({
          endpointIdentifier: { path: '/ep' },
          currentParams: {},
          responseData: { data: [{ a: 'a' }, { a: 'b' }, { a: 'c' }], next: 'https://127.0.0.1/ep?arg=val' },
        }),
      ).toEqual([{ queryParams: { arg: 'val' } }])
    })
    it('should not throw MaxResultsExceeded if maxResultsNumber is -1 (no limit)', async () => {
      const paginate = getPaginationWithLimitedResults({
        maxResultsNumber: -1,
        paginationFunc: cursorPagination({ paginationField: 'next', pathChecker: defaultPathChecker }),
        getItemsFunc: (value: ResponseValue | ResponseValue[]): unknown[] => getItems(value, 'data'),
      })
      paginate({
        endpointIdentifier: { path: '/ep' },
        currentParams: { queryParams: { arg: 'val' } },
        responseData: { data: [{ a: 'a' }, { a: 'b' }, { a: 'c' }], next: 'https://127.0.0.1/ep?arg=val' },
      })
      expect(
        paginate({
          endpointIdentifier: { path: '/ep' },
          currentParams: {},
          responseData: { data: [{ a: 'd' }, { a: 'e' }, { a: 'f' }], next: 'https://127.0.0.1/ep?arg=val' },
        }),
      ).toEqual([{ queryParams: { arg: 'val' } }])
    })
  })
  // TODO extend tests for all pagination functions (can rely on previous tests)
})
