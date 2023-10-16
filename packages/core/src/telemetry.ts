
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
import axios from 'axios'
import { platform, arch, release, EOL } from 'os'
import { setTimeout, clearTimeout } from 'timers'
import { logger } from '@salto-io/logging'
import { HTTPError } from '@salto-io/adapter-components/src/client'

const log = logger(module)
const MAX_EVENTS_PER_REQUEST = 20
const EVENTS_API_PATH = '/v1/events'
const EVENTS_FLUSH_INTERVAL = 1000
const EVENT_NAME_SEPARATOR = '.'
export const MAX_CONSECUTIVE_RETRIES = 5
export const DEFAULT_EVENT_NAME_PREFIX = 'salto'

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

export type OptionalTags = {
  version?: string
  versionString?: string
  workspaceID?: string
  osArch?: string
  osRelease?: string
  osPlatform?: string
}

export type Tags = OptionalTags & {
  [name: string]: string | number | boolean | undefined
}

export enum EVENT_TYPES {
  COUNTER = 'counter',
  STACK = 'stack',
}

type Event = {
  name: string
  tags: Tags
  timestamp: string
}

export type CountEvent = Event & { type: EVENT_TYPES.COUNTER; value: number }
export type StackEvent = Event & { type: EVENT_TYPES.STACK; value: string[] }
export type TelemetryEvent = CountEvent | StackEvent

export const isCountEvent = (event: TelemetryEvent): event is CountEvent => (
  event.type === EVENT_TYPES.COUNTER && _.isNumber(event.value)
)

export const isStackEvent = (event: TelemetryEvent): event is StackEvent => (
  event.type === EVENT_TYPES.STACK && _.isArray(event.value)
)

const stacktraceFromError = (err: Error): string[] => {
  if (err.stack === undefined) {
    return []
  }
  const stackWithoutMessage = err.stack
    .replace(err.toString(), '')
  return _(stackWithoutMessage)
    .split(EOL)
    .map(line => line.trim())
    .compact()
    .value()
}

export type Telemetry = {
  enabled: boolean

  isStopped(): boolean
  sendCountEvent(name: string, value: number, extraTags?: OptionalTags): void
  sendStackEvent(name: string, value: Error, extraTags?: OptionalTags): void
  stop(timeoutMs: number): Promise<void>
  flush(): Promise<void>
}

export const telemetrySender = (
  config: TelemetryConfig,
  tags: RequiredTags & Tags,
  eventNamePrefix = DEFAULT_EVENT_NAME_PREFIX
): Telemetry => {
  const newEvents = [] as Array<TelemetryEvent>
  let queuedEvents = [] as Array<TelemetryEvent>
  const enabled = config.enabled || false
  const flushInterval = config.flushInterval ? config.flushInterval : EVENTS_FLUSH_INTERVAL
  const namePrefix = eventNamePrefix
  let httpRequestTimeout = axios.defaults.timeout
  let timer = {} as NodeJS.Timer
  let stopped = false
  let consecutiveRetryCount = 0
  const commonTags: RequiredTags & OptionalTags = {
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

  const transformTags = (extraTags: OptionalTags): Tags => (
    _({ ...commonTags, ...extraTags }).mapKeys((_v, k) => _.snakeCase(k)).value()
  )

  const transformName = (eventName: string): string => (
    [namePrefix, eventName].join(EVENT_NAME_SEPARATOR)
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
        consecutiveRetryCount = 0
      } catch (e) {
        log.debug(`failed sending telemetry events: ${e}`)
        if ((e as HTTPError).response) {
          const { status } = (e as HTTPError).response
          if (status >= 400 && status < 500) {
            log.debug('telemetry http response status: %d, giving up on sending events', status)
            stopped = true
            return
          }
        }
        consecutiveRetryCount += 1
        if (consecutiveRetryCount === MAX_CONSECUTIVE_RETRIES) {
          log.debug('reached maximum retries: %d, giving up on sending events', MAX_CONSECUTIVE_RETRIES)
          stopped = true
        }
      }
    }
  }

  const start = (): void => {
    if (stopped) {
      return
    }
    timer = setTimeout(async () => {
      await flush()
      start()
    }, flushInterval)
  }

  const stop = async (timeoutMs: number): Promise<void> => {
    if (stopped) {
      return Promise.resolve()
    }
    stopped = true
    clearTimeout(timer)
    httpRequestTimeout = timeoutMs
    return flush()
  }

  const sendCountEvent = (name: string, value: number, extraTags: OptionalTags = {}): void => {
    const newEvent = {
      name: transformName(name),
      value,
      tags: transformTags(extraTags),
      type: EVENT_TYPES.COUNTER,
      timestamp: new Date().toISOString(),
    } as CountEvent
    newEvents.push(newEvent)
  }

  const sendStackEvent = (name: string, value: Error, extraTags: OptionalTags = {}): void => {
    const stackArray = stacktraceFromError(value)
    if (stackArray.length === 0) {
      return
    }
    const newEvent = {
      name: transformName(name),
      value: stackArray,
      tags: transformTags(extraTags),
      type: EVENT_TYPES.STACK,
      timestamp: new Date().toISOString(),
    } as StackEvent
    newEvents.push(newEvent)
  }

  const isStopped = (): boolean => stopped

  const sender = {
    enabled,
    isStopped,
    sendCountEvent,
    sendStackEvent,
    stop,
    flush,
  }
  start()
  return sender
}
