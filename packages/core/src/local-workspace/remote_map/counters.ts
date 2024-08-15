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
] as const
type CounterType = (typeof COUNTER_TYPES)[number]

type Counter = {
  inc: () => void
  value: () => number
}

export type LocationCounters = Record<CounterType, Counter> & {
  dump: () => void
}

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

const createLocationCounters = (location: string): LocationCounters => {
  const counters = Object.fromEntries([
    ...COUNTER_TYPES.map(counterType => [counterType, createCounter()]),
    [
      'dump',
      () => {
        log.debug(
          "Remote Map Stats for location '%s': %o",
          location,
          Object.fromEntries(COUNTER_TYPES.map(counterType => [counterType, counters[counterType].value()])),
        )
      },
    ],
  ])
  return counters
}

const createStatCounters = (): StatCounters => {
  const locations = new DefaultMap((location: string) => ({ refCnt: 0, counters: createLocationCounters(location) }))
  return {
    get: location => {
      locations.get(location).refCnt += 1
      return locations.get(location).counters
    },
    return: location => {
      if (!locations.has(location)) {
        log.warn('Returning counters that were never acquired. Location=%s', location)
        return
      }
      const locationInfo = locations.get(location)
      locationInfo.refCnt -= 1
      if (locationInfo.refCnt === 0) {
        locations.delete(location)
      }
    },
  }
}

export const counters = createStatCounters()
