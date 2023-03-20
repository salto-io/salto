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
type CounterType = typeof COUNTER_TYPES[number]
export const counters: Record<string, Record<CounterType, number>> = {}

export const counterInc = (location: string, counter: CounterType): void => {
  counters[location][counter] += 1
}

export const counterValue = (location: string, counter: CounterType): number => (
  counters[location][counter]
)

export const countersInit = (location: string): void => {
  counters[location] = Object.fromEntries(
    COUNTER_TYPES.map(counterName => [counterName, 0])
  ) as Record<CounterType, number>
}

export const countersDumpAndClose = (location: string): void => {
  log.debug('Remote Map Stats for location \'%s\': %o', location, counters[location])
  delete counters[location]
}
