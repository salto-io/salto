
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
import { telemetryEventNames } from './types'

const SEPARATOR = '.'
const WORKSPACE = 'workspace'

export const buildEventName = (
  command: string,
  action: keyof telemetryEventNames,
): string => [WORKSPACE, command, action].join(SEPARATOR)

export const getEvents = (
  commandName: string,
): telemetryEventNames => ({
  start: buildEventName(commandName, 'start'),
  success: buildEventName(commandName, 'success'),
  failure: buildEventName(commandName, 'failure'),
  mergeErrors: buildEventName(commandName, 'mergeErrors'),
  changes: buildEventName(commandName, 'changes'),
  changesToApply: buildEventName(commandName, 'changesToApply'),
  errors: buildEventName(commandName, 'errors'),
  failedRows: buildEventName(commandName, 'failedRows'),
  actionsSuccess: buildEventName(commandName, 'actionsSuccess'),
  actionsFailure: buildEventName(commandName, 'actionsFailure'),
})

export type CliTelemetry = {
  start(tags?: Tags): void
  failure(tags?: Tags): void
  success(tags?: Tags): void
  mergeErrors(n: number, tags?: Tags): void
  changes(n: number, tags?: Tags): void
  changesToApply(n: number, tags?: Tags): void
  errors(n: number, tags?: Tags): void
  failedRows(n: number, tags?: Tags): void
  actionsSuccess(n: number, tags?: Tags): void
  actionsFailure(n: number, tags?: Tags): void

  stacktrace(err: Error, tags?: Tags): void
}

export const getCliTelemetry = (sender: Telemetry, command: string): CliTelemetry => {
  const telemetryEvents = getEvents(command)

  const sendCount = (name: string, value: number, tags: Tags): void => {
    sender.sendCountEvent(name, value, tags)
  }

  const start = (tags: Tags): void => {
    sendCount(telemetryEvents.start, 1, tags)
  }

  const failure = (tags = {}): void => {
    sendCount(telemetryEvents.failure, 1, tags)
  }

  const success = (tags = {}): void => {
    sendCount(telemetryEvents.success, 1, tags)
  }

  const mergeErrors = (numErrors: number, tags = {}): void => {
    sendCount(telemetryEvents.mergeErrors, numErrors, tags)
  }

  const changes = (numChanges: number, tags = {}): void => {
    sendCount(telemetryEvents.changes, numChanges, tags)
  }

  const changesToApply = (numChanges: number, tags = {}): void => {
    sendCount(telemetryEvents.changesToApply, numChanges, tags)
  }

  const errors = (numErrors: number, tags = {}): void => {
    sendCount(telemetryEvents.errors, numErrors, tags)
  }

  const failedRows = (numFailedRows: number, tags = {}): void => {
    sendCount(telemetryEvents.failedRows, numFailedRows, tags)
  }

  const actionsSuccess = (numActions: number, tags = {}): void => {
    sendCount(telemetryEvents.actionsSuccess, numActions, tags)
  }

  const actionsFailure = (numActions: number, tags = {}): void => {
    sendCount(telemetryEvents.actionsFailure, numActions, tags)
  }

  const stacktrace = (err: Error, tags = {}): void => {
    sender.sendStackEvent(telemetryEvents.failure, err, tags)
  }

  return {
    start,
    failure,
    success,
    mergeErrors,
    changes,
    changesToApply,
    errors,
    failedRows,
    actionsSuccess,
    actionsFailure,
    stacktrace,
  }
}
