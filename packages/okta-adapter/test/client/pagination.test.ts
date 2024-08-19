/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { client as clientUtils } from '@salto-io/adapter-components'
import { MockInterface, mockFunction } from '@salto-io/test-utils'
import { getWithCursorHeaderPagination } from '../../src/client/pagination'

describe('okta pagination', () => {
  describe('getWithCursorHeaderPagination', () => {
    const client: MockInterface<clientUtils.HTTPReadClientInterface> = {
      get: mockFunction<clientUtils.HTTPReadClientInterface['get']>(),
      head: mockFunction<clientUtils.HTTPReadClientInterface['head']>(),
      options: mockFunction<clientUtils.HTTPReadClientInterface['options']>(),
      getPageSize: mockFunction<clientUtils.HTTPReadClientInterface['getPageSize']>(),
    }
    const paginate = getWithCursorHeaderPagination()
    beforeEach(() => {
      client.get.mockReset()
      client.head.mockReset()
      client.options.mockReset()
      client.getPageSize.mockReset()
    })

    it('should query next page if the link header exits and there is a next page', async () => {
      const args = {
        pageSize: 123,
        getParams: {
          url: '/api/v1/groups',
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
            link: '<https://something.okta.com/api/v1/groups?limit=2>; rel="self", <https://something.okta.com/api/v1/groups?after=123123&limit=2>; rel="next"',
          },
          page: [{ p: 'a' }, { p: 'b' }],
        }),
      ).toEqual([
        {
          after: '123123',
          limit: '2',
        },
      ])
    })

    it('should return nothing if there is no link header', () => {
      const args = {
        pageSize: 123,
        getParams: {
          url: '/api/v1/users',
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
            expires: 0,
          },
          page: [{ p: 'a' }, { p: 'b' }],
        }),
      ).toEqual([])
    })
    it('should do nothing if there is no next page', () => {
      const args = {
        pageSize: 123,
        getParams: {
          url: '/api/v1/apps',
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
            link: '<https://something.okta.com/api/v1/apps>; rel="self"',
          },
          page: [{ p: 'a' }, { p: 'b' }],
        }),
      ).toEqual([])
    })
    it('should throw error if the next page link is for different the endpoint', () => {
      const args = {
        pageSize: 123,
        getParams: {
          url: '/api/v1/groups',
        },
      }
      expect(() =>
        paginate({
          ...args,
          currentParams: {},
          responseData: {
            products: [{ p: 'a' }, { p: 'b' }],
          },
          responseHeaders: {
            link: '<https://something.okta.com/api/v1/groups?limit=2>; rel="self", <https://something.okta.com/api/different/endpoint?after=123123&limit=2>; rel="next"',
          },
          page: [{ p: 'a' }, { p: 'b' }],
        }),
      ).toThrow()
    })
  })
})
