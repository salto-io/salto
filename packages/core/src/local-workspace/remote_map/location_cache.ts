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

  return: (cache: LocationCache) => void
}

export type LocationCachePoolContents = Map<string, { cache: LocationCache; refcnt: number }>

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
        cachePoolEntry.refcnt += 1
        return cachePoolEntry.cache
      }
      statCounters.LocationCacheCreated.inc()
      const newCache: LocationCache = new LocationCache(location, cacheSize)
      pool.set(location, { cache: newCache, refcnt: 1 })
      if (pool.size > poolSizeWatermark) {
        poolSizeWatermark = pool.size
        log.debug('Max location cache pool size: %d', poolSizeWatermark)
      }
      return newCache
    },
    return: ({ location }) => {
      const poolEntry = pool.get(location)
      if (poolEntry === undefined || poolEntry.refcnt === 0) {
        log.warn('Returning a locationCache for an unknown location %s. poolEntry=%o', location, poolEntry)
        return
      }
      poolEntry.refcnt -= 1

      if (poolEntry.refcnt === 0) {
        pool.delete(location)
        if (pool.size === 0) {
          log.debug('Last location closed. Max location cache pool size: %d', poolSizeWatermark)
          poolSizeWatermark = 0
        }
      }
    },
  }
}

export const locationCaches = createLocationCachePool()
