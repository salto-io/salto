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
import { logger } from '@salto-io/logging'
import { counters, LocationCounters } from './counters'
import { LocationCache, locationCaches } from './location_cache'
import { DbAttributes, DbConnection, dbConnectionPool } from './db_connection_pool'

const log = logger(module)

type RemoteMapLocation = {
  name: string
  counters: LocationCounters
  cache: LocationCache
  mainDb: DbConnection
}

type RemoteMapLocationPool = {
  get: (location: string, persistent: boolean) => Promise<RemoteMapLocation>
  return: (location: RemoteMapLocation) => Promise<void>
  returnAll: (location: string) => Promise<void>
}

const dbAttributes = (location: string, persistent: boolean): DbAttributes => (
  {
    location,
    type: persistent ? 'main-persistent' : 'main-ephemeral',
  }
)

const createRemoteMapLocationPool = (): RemoteMapLocationPool => {
  const pool: Map<string, RemoteMapLocation> = new Map()
  return {
    get: async (location, persistent) => {
      const locationResources = {
        name: location,
        counters: counters.get(location),
        cache: locationCaches.get(location),
        mainDb: await dbConnectionPool.get(dbAttributes(location, persistent)),
      }
      pool.set(location, locationResources)
      return locationResources
    },
    return: async location => {
      locationCaches.return(location.cache)
      await dbConnectionPool.put(location.mainDb)
      counters.return(location.name)
    },
    returnAll: async location => {
      const locationResources = pool.get(location)
      if (locationResources === undefined) {
        log.warn('Returning resources for unknown location %s', location)
        return
      }
      await dbConnectionPool.putAll(location, 'main-persistent')
      await dbConnectionPool.putAll(location, 'main-ephemeral')
      locationCaches.return(locationResources.cache)
      counters.destroyAll(location)
    },
  }
}

export const remoteMapLocations = createRemoteMapLocationPool()
