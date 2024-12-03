/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
  return: (location: string) => void
}
const createRemoteMapLocationPool = (): RemoteMapLocationPool => ({
  get: location => ({
    name: location,
    counters: counters.get(location),
    cache: locationCaches.get(location),
  }),
  return: location => {
    locationCaches.return(location)
    counters.return(location)
  },
})

export const remoteMapLocations = createRemoteMapLocationPool()
