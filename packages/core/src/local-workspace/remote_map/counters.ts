/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'

const { DefaultMap } = collections.map

const log = logger(module)

const COUNTER_TYPES = [
  'LocationCacheCreated',
  'LocationCacheReuse',
  'LocationCacheHit',
  'LocationCacheMiss',
  'RemoteMapCreated',
  'RemoteMapHit',
  'RemoteMapMiss',
  'PersistentDbConnectionCreated',
  'PersistentDbConnectionReuse',
  'TmpDbConnectionReuse',
  'DBIteratorCreated',
] as const
type CounterType = (typeof COUNTER_TYPES)[number]

type Counter = {
  inc: () => void
  value: () => number
}

export type LocationCounters = Record<CounterType, Counter>

type StatCounters = {
  get: (location: string) => LocationCounters
  return: (location: string) => void
}

const createCounter = (): Counter => {
  let counterValue = 0
  return {
    inc: () => {
      counterValue += 1
    },
    value: () => counterValue,
  }
}

const logLocationCounters = (location: string, counters: LocationCounters): void => {
  log.debug(
    "Remote Map Stats for location '%s': %o",
    location,
    Object.fromEntries(COUNTER_TYPES.map(counterType => [counterType, counters[counterType].value()])),
  )
}

const createLocationCounters = (): LocationCounters =>
  Object.fromEntries(COUNTER_TYPES.map(counterType => [counterType, createCounter()])) as LocationCounters

const createStatCounters = (): StatCounters => {
  const locations = new DefaultMap(createLocationCounters)
  return {
    get: location => locations.get(location),
    return: location => {
      if (!locations.has(location)) {
        log.warn('Returning counters that were never acquired. Location=%s', location)
        return
      }
      const locationInfo = locations.get(location)
      logLocationCounters(location, locationInfo)
      locations.delete(location)
    },
  }
}

export const counters = createStatCounters()
