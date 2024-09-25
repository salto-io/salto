/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { getMinSinceIdPagination } from '../../../src/definitions/requests/pagination'

describe('pagination', () => {
  describe('getMinSinceIdPagination', () => {
    it('should stop pagination if received empty page', () => {
      const paginate = getMinSinceIdPagination()
      const responseData = { items: [] }
      const res = paginate({ responseData, currentParams: {}, endpointIdentifier: { path: '/recipes' } })
      expect(res).toEqual([])
    })
    it('should stop pagination if response contains unexpected ids', () => {
      const paginate = getMinSinceIdPagination()
      const responseData = {
        items: [
          { key: 5, name: 'a' },
          { id: 4, name: 'b' },
          { id: 6, name: 'c' },
        ],
      }
      const res = paginate({ responseData, currentParams: {}, endpointIdentifier: { path: '/recipes' } })
      expect(res).toEqual([])
    })
    it('should calculate query param for the next page', () => {
      const paginate = getMinSinceIdPagination()
      const responseData = {
        items: [
          { id: 5, name: 'a' },
          { id: 4, name: 'b' },
          { id: 6, name: 'c' },
        ],
      }
      const res = paginate({ responseData, currentParams: {}, endpointIdentifier: { path: '/recipes' } })
      expect(res).toEqual([{ queryParams: { since_id: '4' } }])
    })
    it('should update query params on multiple requests', () => {
      const paginate = getMinSinceIdPagination()
      const firstPage = {
        items: [
          { id: 11, name: 'a' },
          { id: 10, name: 'b' },
          { id: 9, name: 'c' },
        ],
      }
      const secondPage = {
        items: [
          { id: 8, name: 'd' },
          { id: 7, name: 'e' },
          { id: 6, name: 'f' },
        ],
      }
      const firstRes = paginate({
        responseData: firstPage,
        currentParams: { queryParams: {} },
        endpointIdentifier: { path: '/recipes' },
      })
      const secondRes = paginate({
        responseData: secondPage,
        currentParams: { queryParams: firstRes[0].queryParams },
        endpointIdentifier: { path: '/recipes' },
      })
      expect(firstRes).toEqual([{ queryParams: { since_id: '9' } }])
      expect(secondRes).toEqual([{ queryParams: { since_id: '6' } }])
    })
  })
})
