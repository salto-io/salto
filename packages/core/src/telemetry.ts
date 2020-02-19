
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

import * as restClient from 'typed-rest-client/RestClient'
import _ from 'lodash'
import { TelemetryConfig } from './app_config'

export class AlreadyInitializedError extends Error { }
export class NotInitializedError extends Error { }

const saltoUserAgent = 'salto/1.0'

export type CommonTags = {
  installationID: string
  osArch: string
  osPlatform: string
  osRelease: string
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
  private http: string
  private enabled: boolean
  private commonTags: CommonTags
  private client: restClient.RestClient

  private constructor(config: TelemetryConfig, commonTags: CommonTags) {
    this.http = config.host
    this.enabled = config.enabled
    this.commonTags = commonTags
    this.client = new restClient.RestClient(saltoUserAgent, this.http)
  }

  public static init(config: TelemetryConfig, commonTags: CommonTags): void {
    if (Telemetry.instance) {
      throw new AlreadyInitializedError('telemetry instance already initiated')
    }
    Telemetry.instance = new Telemetry(config, commonTags)
  }

  public static getInstance(): Telemetry {
    if (!this.instance) {
      throw new NotInitializedError('telemetry was not initialized, instance was not created')
    }
    return this.instance
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

  public async sendCountEvent(event: CountEvent): Promise<void> {
    this.sendEvent(event)
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

  private async sendEvent(event: Event<unknown>): Promise<void> {
    if (!this.enabled) {
      return Promise.resolve()
    }
    event.tags = _({ ...this.commonTags, ...event.tags }).mapKeys((_v, k) => _.snakeCase(k)).value()
    this.client.create('/v1/events', { events: [event] })
    return Promise.resolve()
  }
}
