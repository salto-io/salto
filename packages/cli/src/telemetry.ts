/*
 *                      Copyright 2024 Salto Labs Ltd.
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

export const buildEventName = (command: string, action: keyof TelemetryEventNames): string =>
  [WORKSPACE, command, action].join(SEPARATOR)

export const getCliTelemetry = (sender: Telemetry, command: string): CliTelemetry => {
  let tags: Tags = {}
  const setTags = (newTags: Tags): void => {
    tags = newTags
  }

  const sendCount = (name: string, value: number): void => {
    sender.sendCountEvent(name, value, tags)
  }

  const start = (): void => {
    sendCount(buildEventName(command, 'start'), 1)
  }

  const failure = (): void => {
    sendCount(buildEventName(command, 'failure'), 1)
  }

  const success = (): void => {
    sendCount(buildEventName(command, 'success'), 1)
  }

  const mergeErrors = (numErrors: number): void => {
    sendCount(buildEventName(command, 'mergeErrors'), numErrors)
  }

  const changes = (numChanges: number): void => {
    sendCount(buildEventName(command, 'changes'), numChanges)
  }

  const changesToApply = (numChanges: number): void => {
    sendCount(buildEventName(command, 'changesToApply'), numChanges)
  }

  const errors = (numErrors: number): void => {
    sendCount(buildEventName(command, 'errors'), numErrors)
  }

  const actionsSuccess = (numActions: number): void => {
    sendCount(buildEventName(command, 'actionsSuccess'), numActions)
  }

  const actionsFailure = (numActions: number): void => {
    sendCount(buildEventName(command, 'actionsFailure'), numActions)
  }

  const workspaceSize = (size: number): void => {
    sendCount(buildEventName(command, 'workspaceSize'), size)
  }

  const stacktrace = (err: Error): void => {
    sender.sendStackEvent(buildEventName(command, 'failure'), err, tags)
  }

  return {
    setTags,
    start,
    failure,
    success,
    mergeErrors,
    changes,
    changesToApply,
    errors,
    actionsSuccess,
    actionsFailure,
    workspaceSize,
    stacktrace,
  }
}
