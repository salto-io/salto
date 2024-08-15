/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/

import _ from 'lodash'
import {
  LocationCachePool,
  createLocationCachePool,
  LocationCachePoolContents,
  LocationCache,
} from '../../../../src/local-workspace/remote_map/location_cache'

describe('remote map location cache pool', () => {
  let poolContents: LocationCachePoolContents
  let pool: LocationCachePool
  const LOCATION1 = 'SomeLocation'
  const LOCATION2 = 'SomeOtherLocation'

  beforeEach(() => {
    poolContents = new Map<string, { cache: LocationCache; refcnt: number }>()
    pool = createLocationCachePool(poolContents)
  })

  it('should create a location cache for the right location', () => {
    const cache = pool.get(LOCATION1)
    expect(cache.location).toEqual(LOCATION1)
    expect(poolContents.size).toEqual(1)
    expect(poolContents.get(LOCATION1)).toBeDefined()
  })

  it('should reuse caches where possible', () => {
    _.times(10, () => pool.get(LOCATION1))
    expect(poolContents.size).toEqual(1)
  })

  it('should not reuse caches of a different location', () => {
    const cache = pool.get(LOCATION1)
    const anotherCache = pool.get(LOCATION2)
    expect(cache.location).toEqual(LOCATION1)
    expect(anotherCache.location).toEqual(LOCATION2)
    expect(poolContents.size).toEqual(2)
  })

  it('should destroy cache when the last reference to it is returned', () => {
    const cache = pool.get(LOCATION1)
    pool.return(cache)
    expect(poolContents.size).toEqual(0)
    pool.get(LOCATION1)
    expect(poolContents.size).toEqual(1)
  })
})
