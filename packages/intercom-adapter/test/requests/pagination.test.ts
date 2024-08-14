/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
