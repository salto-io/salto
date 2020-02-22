
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
import requestretry, { RequestPromise, RequestRetryOptions } from 'requestretry'
import { OptionalUriUrl, DefaultUriUrlRequestApi } from 'request'
import { platform, arch, release } from 'os'
import { setTimeout, clearTimeout } from 'timers'
import { logger } from '@salto-io/logging'
import { TelemetryConfig } from './app_config'

export class AlreadyInitializedError extends Error { }
export class NotInitializedError extends Error { }

const log = logger(module)
const eventsAPIPath = '/v1/events'

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

export type EventType = EVENT_TYPES.COUNTER | EVENT_TYPES.STACK
type Event<T> = {
  name: string
  type: EventType
  value: T
  tags: Tags
  timestamp: Date
}


export type CountEvent = Event<number> & { type: EVENT_TYPES.COUNTER }
export type StackEvent = Event<Error> & { type: EVENT_TYPES.STACK }

export class Telemetry {
  private static instance: Telemetry
  private enabled: boolean
  private commonTags: Tags
  private httpClient: DefaultUriUrlRequestApi<RequestPromise, RequestRetryOptions, OptionalUriUrl>
  private newEvents: Array<Event<unknown>> = []
  private queuedEvents: Array<Event<unknown>> = []
  private flushEventsIntervalMs = 1000
  private timeout: NodeJS.Timer = {} as NodeJS.Timer

  private constructor(config: TelemetryConfig, requiredTags: RequiredTags) {
    this.enabled = config.enabled
    this.commonTags = {
      ...requiredTags,
      osArch: arch(),
      osRelease: release(),
      osPlatform: platform(),
    }
    this.httpClient = requestretry.defaults({ baseUrl: config.host, url: eventsAPIPath, headers: { iko: 'lindo' }, json: true, maxAttempts: 1 })
    this.sendEventsLoop()
  }

  public static init(config: TelemetryConfig, requiredTags: RequiredTags): void {
    if (Telemetry.instance) {
      throw new AlreadyInitializedError('telemetry instance already initiated')
    }
    Telemetry.instance = new Telemetry(config, requiredTags)
  }

  public static getInstance(): Telemetry {
    if (!this.instance) {
      throw new NotInitializedError('telemetry was not initialized, instance was not created')
    }
    return this.instance
  }

  public static setFlushInterval(ms: number): void {
    this.getInstance().flushEventsIntervalMs = ms
  }

  public static sendCountEvent(name: string, value: number, extraTags: Tags = {}): void {
    const ev: CountEvent = {
      name,
      value,
      tags: extraTags,
      type: EVENT_TYPES.COUNTER,
      timestamp: new Date(),
    }
    this.getInstance().sendCountEvent(ev)
  }

  public async sendCountEvent(event: CountEvent): Promise<void> {
    this.sendEvent(event)
  }

  public static sendStackEvent(name: string, value: Error, extraTags: Tags = {}): void {
    const ev: StackEvent = {
      name,
      value,
      tags: extraTags,
      type: EVENT_TYPES.STACK,
      timestamp: new Date(),
    }
    this.getInstance().sendStackEvent(ev)
  }

  public async sendStackEvent(event: StackEvent): Promise<void> {
    if (_.isUndefined(event.value.stack)) {
      return
    }
    const stackWithoutMessage = event.value.stack.replace(event.value.toString(), '').trim()
    const ev = {
      name: event.name,
      value: stackWithoutMessage,
      tags: event.tags,
      type: EVENT_TYPES.STACK,
      timestamp: new Date(),
    }
    this.sendEvent(ev)
  }

  private async sendEvent<T>(event: Event<T>): Promise<void> {
    if (!this.enabled) {
      return Promise.resolve()
    }
    event.tags = _({ ...this.commonTags, ...event.tags }).mapKeys((_v, k) => _.snakeCase(k)).value()
    this.newEvents.push(event)

    return Promise.resolve()
  }

  private sendEventsLoop(): void {
    log.info('l')
    this.timeout = setTimeout(async () => {
      await this.sendEvents()
      this.sendEventsLoop()
    }, this.flushEventsIntervalMs)
  }

  private async sendEvents(): Promise<void> {
    const newEventsToQueue = _.remove(this.newEvents, _event => true)
    this.queuedEvents.push(...newEventsToQueue)
    if (this.queuedEvents.length > 0) {
      this.httpClient.post({ body: { events: this.queuedEvents }, timeout: 500 })
        .then(() => { this.queuedEvents = [] })
        .catch(e => log.debug(e))
    }
  }

  public static async flush(): Promise<void> {
    const telemetry = this.getInstance()
    clearTimeout(telemetry.timeout)
    return telemetry.sendEvents()
  }
}
