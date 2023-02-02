/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { client as clientUtils } from '@salto-io/adapter-components'
import { MockInterface, mockFunction } from '@salto-io/test-utils'
import { getWithCursorHeaderPagination } from '../../src/client/pagination'

describe('okta pagination', () => {
  describe('getWithCursorHeaderPagination', () => {
    const client: MockInterface<clientUtils.HTTPReadClientInterface> = {
      getSinglePage: mockFunction<clientUtils.HTTPReadClientInterface['getSinglePage']>(),
      getPageSize: mockFunction<clientUtils.HTTPReadClientInterface['getPageSize']>(),
    }
    const paginate = getWithCursorHeaderPagination()
    beforeEach(() => {
      client.getSinglePage.mockReset()
      client.getPageSize.mockReset()
    })

    it('should query next page if the link header exits and there is a next page', async () => {
      const args = {
        pageSize: 123,
        getParams: {
          url: '/api/v1/groups',
        },
      }
      expect(paginate({
        ...args,
        currentParams: {},
        responseData: {
          products: [{ p: 'a' }, { p: 'b' }],
        },
        responseHeaders: {
          link: '<https://something.okta.com/api/v1/groups?limit=2>; rel="self", <https://something.okta.com/api/v1/groups?after=123123&limit=2>; rel="next"',
        },
        page: [{ p: 'a' }, { p: 'b' }],
      })).toEqual([{
        after: '123123',
        limit: '2',
      }])
    })

    it('should return nothing if there is no link header', () => {
      const args = {
        pageSize: 123,
        getParams: {
          url: '/api/v1/users',
        },
      }
      expect(paginate({
        ...args,
        currentParams: {},
        responseData: {
          products: [{ p: 'a' }, { p: 'b' }],
        },
        responseHeaders: {
          expires: 0,
        },
        page: [{ p: 'a' }, { p: 'b' }],
      })).toEqual([])
    })
    it('should do nothing if there is no next page', () => {
      const args = {
        pageSize: 123,
        getParams: {
          url: '/api/v1/apps',
        },
      }
      expect(paginate({
        ...args,
        currentParams: {},
        responseData: {
          products: [{ p: 'a' }, { p: 'b' }],
        },
        responseHeaders: {
          link: '<https://something.okta.com/api/v1/apps>; rel="self"',
        },
        page: [{ p: 'a' }, { p: 'b' }],
      })).toEqual([])
    })
    it('should throw error if the next page link is for different the endpoint', () => {
      const args = {
        pageSize: 123,
        getParams: {
          url: '/api/v1/groups',
        },
      }
      expect(() => paginate({
        ...args,
        currentParams: {},
        responseData: {
          products: [{ p: 'a' }, { p: 'b' }],
        },
        responseHeaders: {
          link: '<https://something.okta.com/api/v1/groups?limit=2>; rel="self", <https://something.okta.com/api/different/endpoint?after=123123&limit=2>; rel="next"',
        },
        page: [{ p: 'a' }, { p: 'b' }],
      })).toThrow()
    })
  })
})
