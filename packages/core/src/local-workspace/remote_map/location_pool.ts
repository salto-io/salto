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

import { counters, LocationCounters } from './counters'
import { LocationCache, locationCaches } from './location_cache'

type RemoteMapLocation = {
  name: string
  counters: LocationCounters
  cache: LocationCache
}

type RemoteMapLocationPool = {
  get: (location: string) => RemoteMapLocation
  return: (location: RemoteMapLocation) => void
}
const createRemoteMapLocationPool = (): RemoteMapLocationPool => ({
  get: location => ({
    name: location,
    counters: counters.get(location),
    cache: locationCaches.get(location),
  }),
  return: location => {
    locationCaches.return(location.cache)
    counters.return(location.name)
  },
})

export const remoteMapLocations = createRemoteMapLocationPool()
