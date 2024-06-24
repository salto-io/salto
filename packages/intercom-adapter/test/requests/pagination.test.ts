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

import { scrollingPagination } from '../../src/definitions/requests/pagination'

describe('scrollingPagination', () => {
  describe('When the stop condition is not met', () => {
    const paginate = scrollingPagination({ scrollingParam: 'scroll', stopCondition: () => false })
    it('should calculate next pages', async () => {
      expect(
        paginate({
          endpointIdentifier: { path: '/ep' },
          currentParams: {},
          responseData: { a: [{ x: 'y' }], scroll: 'next' },
        }),
      ).toEqual([{ queryParams: { scroll: 'next', timestamp: expect.any(String) } }])
    })
  })

  describe('When the stop condition is met', () => {
    const paginate = scrollingPagination({ scrollingParam: 'scroll', stopCondition: () => true })
    it('should return no next page', async () => {
      expect(
        paginate({
          endpointIdentifier: { path: '/ep' },
          currentParams: {},
          responseData: { a: [{ x: 'y' }], scroll: 'next' },
        }),
      ).toEqual([])
    })
  })

  describe('When there is no scrolling param', () => {
    const paginate = scrollingPagination({ scrollingParam: 'scroll', stopCondition: () => false })
    it('should return no next page', async () => {
      expect(
        paginate({
          endpointIdentifier: { path: '/ep' },
          currentParams: {},
          responseData: { a: [{ x: 'y' }] },
        }),
      ).toEqual([])
    })
  })
})
