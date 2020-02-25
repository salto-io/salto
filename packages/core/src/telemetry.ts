
/*
*                      Copyright 2020 Salto Labs Ltd.
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
import axios from 'axios'
import { platform, arch, release, EOL } from 'os'
import { setTimeout, clearTimeout } from 'timers'
import { logger } from '@salto-io/logging'

const log = logger(module)
const MAX_EVENTS_PER_REQUEST = 20
const EVENTS_API_PATH = '/v1/events'
const EVENTS_FLUSH_INTERVAL = 1000

export type TelemetryConfig = {
  url: string
  enabled: boolean
  token: string
  flushInterval?: number
}

export type RequiredTags = {
  installationID: string
  app: string
}

export type Tags = {
  [name: string]: string | number
}

export enum EVENT_TYPES {
  COUNTER = 'counter',
  STACK = 'stack',
}

type Event<T> = {
  name: string
  value: T
  tags: Tags
  timestamp: string
}

export type CountEvent = Event<number> & { type: EVENT_TYPES.COUNTER }
export type StackEvent = Event<string[]> & { type: EVENT_TYPES.STACK }
export type TelemetryEvent = CountEvent | StackEvent

export type Telemetry = {
  enabled: boolean

  sendCountEvent(name: string, value: number, extraTags?: Tags): void
  sendStackEvent(name: string, value: Error, extraTags?: Tags): void
  stop(timeoutMs: number): Promise<void>
  flush(): Promise<void>
}

export const telemetrySender = (
  config: TelemetryConfig,
  tags: RequiredTags & Tags
): Telemetry => {
  const newEvents = [] as Array<TelemetryEvent>
  let queuedEvents = [] as Array<TelemetryEvent>
  const enabled = config.enabled || false
  const flushInterval = config.flushInterval ? config.flushInterval : EVENTS_FLUSH_INTERVAL
  let httpRequestTimeout = axios.defaults.timeout
  let timer = {} as NodeJS.Timer
  const commonTags = {
    ...tags,
    osArch: arch(),
    osRelease: release(),
    osPlatform: platform(),
  }
  const httpClient = axios.create({
    baseURL: config.url,
    headers: {
      Authorization: config.token,
    },
  })

  const transformTags = (extraTags: Tags): Tags => (
    _({ ...commonTags, ...extraTags }).mapKeys((_v, k) => _.snakeCase(k)).value()
  )

  const flush = async (): Promise<void> => {
    queuedEvents.push(...newEvents.splice(0, MAX_EVENTS_PER_REQUEST - queuedEvents.length))
    if (enabled && queuedEvents.length > 0) {
      try {
        await httpClient.post(
          EVENTS_API_PATH,
          { events: queuedEvents },
          { timeout: httpRequestTimeout },
        )
        queuedEvents = []
      } catch (e) {
        log.debug(`failed sending telemetry events: ${e}`)
      }
    }
  }

  const start = (): void => {
    timer = setTimeout(() => {
      flush()
      start()
    }, flushInterval)
  }

  const stop = async (timeoutMs: number): Promise<void> => {
    clearTimeout(timer)
    httpRequestTimeout = timeoutMs
    return flush()
  }

  const sendCountEvent = (name: string, value: number, extraTags: Tags = {}): void => {
    const newEvent = {
      name,
      value,
      tags: transformTags(extraTags),
      type: EVENT_TYPES.COUNTER,
      timestamp: new Date().toISOString(),
    } as CountEvent
    newEvents.push(newEvent)
  }

  const sendStackEvent = (name: string, value: Error, extraTags: Tags = {}): void => {
    if (value.stack === undefined) {
      return
    }
    const stackWithoutMessage = value.stack
      .replace(value.toString(), '')
    const stackArray = _(stackWithoutMessage)
      .split(EOL)
      .map(line => line.trim())
      .compact()
      .value()
    if (stackArray.length === 0) {
      return
    }
    const newEvent = {
      name,
      value: stackArray,
      tags: transformTags(extraTags),
      type: EVENT_TYPES.STACK,
      timestamp: new Date().toISOString(),
    } as StackEvent
    newEvents.push(newEvent)
  }

  const sender = {
    enabled,
    sendCountEvent,
    sendStackEvent,
    stop,
    flush,
  }
  start()
  return sender
}
