/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Telemetry, Tags } from '@salto-io/local-workspace'
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
