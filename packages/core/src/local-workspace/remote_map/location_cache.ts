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
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import LRU from 'lru-cache'
import { counterInc } from './counters'

const log = logger(module)

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
class LocationCache extends LRU<string, any> {
  readonly location: string

  constructor(location: string, cacheSize: number) {
    super({ max: cacheSize })
    this.location = location
  }
}

export type LocationCachePool = {
  get: (location: string, cacheSize: number) => LocationCache

  // The 'string' overload is temporary to allow the implementation of closeRemoteMapsOfLocation.
  // Once we remove closeRemoteMapOfLocation, the 'string' overload should be removed.
  put: (cache: LocationCache | string) => void
}
export const createLocationCachePool = (): LocationCachePool => {
  // TODO: LRU if we determine too many locationCaches are created.
  const pool = new Map<string, { cache: LocationCache; refcnt: number }>()
  return {
    get: (location, cacheSize) => {
      const cachePoolEntry = pool.get(location)
      if (cachePoolEntry) {
        counterInc(location, 'LocationCacheReuse')
        cachePoolEntry.refcnt += 1
        return cachePoolEntry.cache
      }
      counterInc(location, 'LocationCacheCreated')
      const newCache: LocationCache = new LocationCache(location, cacheSize)
      pool.set(location, { cache: newCache, refcnt: 1 })
      return newCache
    },
    put: cacheOrLocation => {
      const location = _.isString(cacheOrLocation) ? cacheOrLocation : cacheOrLocation.location
      const poolEntry = pool.get(location)
      if (!poolEntry || poolEntry.refcnt === 0) {
        log.error('Bug in LocationCachePool refcounting!')
        return
      }
      poolEntry.refcnt -= 1

      if (poolEntry.refcnt === 0) {
        pool.delete(location)
      }
    },
  }
}
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export const locationCaches = createLocationCachePool()
