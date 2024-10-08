/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { logger } from '@salto-io/logging'
import LRU from 'lru-cache'
import { counters } from './counters'

const log = logger(module)

export class LocationCache extends LRU<string, unknown> {
  readonly location: string

  constructor(location: string, cacheSize: number) {
    super({ max: cacheSize })
    this.location = location
  }
}

export type LocationCachePool = {
  get: (location: string) => LocationCache
  return: (location: string) => void
}

export type LocationCachePoolContents = Map<string, LocationCache>

const DEFAULT_LOCATION_CACHE_SIZE = 5000

export const createLocationCachePool = (
  initialContents?: LocationCachePoolContents,
  cacheSize: number = DEFAULT_LOCATION_CACHE_SIZE,
): LocationCachePool => {
  // TODO: LRU if we determine too many locationCaches are created.
  const pool: LocationCachePoolContents = initialContents ?? new Map()
  let poolSizeWatermark = 0
  return {
    get: location => {
      const statCounters = counters.get(location)
      const cachePoolEntry = pool.get(location)
      if (cachePoolEntry !== undefined) {
        statCounters.LocationCacheReuse.inc()
        return cachePoolEntry
      }
      statCounters.LocationCacheCreated.inc()
      const newCache: LocationCache = new LocationCache(location, cacheSize)
      pool.set(location, newCache)
      if (pool.size > poolSizeWatermark) {
        poolSizeWatermark = pool.size
        log.debug('Max location cache pool size: %d', poolSizeWatermark)
      }
      return newCache
    },
    return: location => {
      if (!pool.has(location)) {
        log.warn('Returning a locationCache for an unknown location %s', location)
        return
      }
      pool.delete(location)
      if (pool.size === 0) {
        log.debug('Last location closed. Max location cache pool size: %d', poolSizeWatermark)
        poolSizeWatermark = 0
      }
    },
  }
}

export const locationCaches = createLocationCachePool()
