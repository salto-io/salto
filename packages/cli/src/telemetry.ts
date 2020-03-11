
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
import { TelemetryEventNames, CliTelemetry } from './types'

const SEPARATOR = '.'
const WORKSPACE = 'workspace'

export const buildEventName = (
  command: string,
  action: keyof TelemetryEventNames,
): string => [WORKSPACE, command, action].join(SEPARATOR)

export const getCliTelemetry = (sender: Telemetry, command: string): CliTelemetry => {
  const sendCount = (name: string, value: number, tags: Tags): void => {
    sender.sendCountEvent(name, value, tags)
  }

  const start = (tags: Tags): void => {
    sendCount(buildEventName(command, 'start'), 1, tags)
  }

  const failure = (tags = {}): void => {
    sendCount(buildEventName(command, 'failure'), 1, tags)
  }

  const success = (tags = {}): void => {
    sendCount(buildEventName(command, 'success'), 1, tags)
  }

  const mergeErrors = (numErrors: number, tags = {}): void => {
    sendCount(buildEventName(command, 'mergeErrors'), numErrors, tags)
  }

  const changes = (numChanges: number, tags = {}): void => {
    sendCount(buildEventName(command, 'changes'), numChanges, tags)
  }

  const changesToApply = (numChanges: number, tags = {}): void => {
    sendCount(buildEventName(command, 'changesToApply'), numChanges, tags)
  }

  const errors = (numErrors: number, tags = {}): void => {
    sendCount(buildEventName(command, 'errors'), numErrors, tags)
  }

  const failedRows = (numFailedRows: number, tags = {}): void => {
    sendCount(buildEventName(command, 'failedRows'), numFailedRows, tags)
  }

  const actionsSuccess = (numActions: number, tags = {}): void => {
    sendCount(buildEventName(command, 'actionsSuccess'), numActions, tags)
  }

  const actionsFailure = (numActions: number, tags = {}): void => {
    sendCount(buildEventName(command, 'actionsFailure'), numActions, tags)
  }

  const stacktrace = (err: Error, tags = {}): void => {
    sender.sendStackEvent(buildEventName(command, 'failure'), err, tags)
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
