
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

import { Telemetry, Tags } from '@salto-io/core'
import { TelemetryEventNames, MonitoringTelemetry, TelemetryOptions } from './types'

const SEPARATOR = '.'

export const buildEventName = (
  action: keyof TelemetryEventNames,
  eventParts: string[] = [],
): string => [...eventParts, action].join(SEPARATOR)

export const getMonitoringTelemetry = (sender: Telemetry): MonitoringTelemetry => {
  const sendCount = (name: string, value: number, tags?: Tags): void => {
    sender.sendCountEvent(name, value, tags)
  }

  const start = (options: TelemetryOptions = {}): void => {
    sendCount(buildEventName('start', options.eventParts), 1, options.tags)
  }

  const failure = (options: TelemetryOptions = {}): void => {
    sendCount(buildEventName('failure', options.eventParts), 1, options.tags)
  }

  const success = (options: TelemetryOptions = {}): void => {
    sendCount(buildEventName('success', options.eventParts), 1, options.tags)
  }

  const stacktrace = (options: TelemetryOptions = {}): void => {
    if (options.err) {
      sender.sendStackEvent(buildEventName('failure', options.eventParts), options.err, options.tags)
    }
  }

  return {
    start,
    failure,
    success,
    stacktrace,
  }
}
