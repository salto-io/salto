
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

import axios from 'axios'
import { platform, arch, release } from 'os'
import { setTimeout, clearTimeout } from 'timers'
import { logger } from '@salto-io/logging'
import { TelemetryConfig } from './app_config'

const log = logger(module)
const MAX_EVENTS_PER_REQUEST = 20
const EVENTS_API_PATH = '/v1/events'
const EVENTS_FLUSH_INTERVAL = 100000

export type RequiredTags = {
  installationID: string
}

export type Tags = {
  [name: string]: string
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
export type StackEvent = Event<Error> & { type: EVENT_TYPES.STACK }

export type Telemetry = {
  enabled: boolean

  sendCountEvent(name: string, value: number, extraTags: Tags): void
  sendStackEvent(name: string, value: Error, extraTags: Tags): void
  start(): void
  stop(): void
  flush(): Promise<void>
}

export const telemetrySender = (
  config: TelemetryConfig,
  tags: RequiredTags & Tags
): Telemetry => {
  const newEvents = [] as Array<Event<unknown>>
  let queuedEvents = [] as Array<Event<unknown>>
  const commonTags = {
    ...tags,
    osArch: arch(),
    osRelease: release(),
    osPlatform: platform(),
  }
  const httpClient = axios.create({
    baseURL: config.host,
    headers: {
      Authorization: config.token,
    },
  })
  const enabled = config.enabled || false
  let timer = {} as NodeJS.Timer
  const flush = async (): Promise<void> => {
    queuedEvents.push(...newEvents.splice(0, MAX_EVENTS_PER_REQUEST - queuedEvents.length))
    if (enabled && queuedEvents.length > 0) {
      try {
        await httpClient.post(
          EVENTS_API_PATH,
          { events: queuedEvents },
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
    }, EVENTS_FLUSH_INTERVAL)
  }

  const stop = (): void => clearTimeout(timer)

  const sendCountEvent = (name: string, value: number, extraTags: Tags): void => {
    const newEvent = {
      name,
      value,
      tags: { ...commonTags, ...extraTags },
      type: EVENT_TYPES.COUNTER,
      timestamp: new Date().toISOString(),
    } as CountEvent
    newEvents.push(newEvent)
  }

  const sendStackEvent = (name: string, value: Error, extraTags: Tags): void => {
    if (value.stack === undefined) {
      return
    }
    const stackWithoutMessage = value.stack.replace(value.toString(), '').trim()
    const newEvent = {
      name,
      value: stackWithoutMessage,
      tags: { ...commonTags, ...extraTags },
      type: EVENT_TYPES.STACK,
      timestamp: new Date().toISOString(),
    }
    newEvents.push(newEvent)
  }

  const sender = {
    enabled,
    sendCountEvent,
    sendStackEvent,
    start,
    stop,
    flush,
  }
  return sender
}
