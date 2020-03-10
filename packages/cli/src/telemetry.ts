
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

import { telemetryEventNames } from './types'

const SEPARATOR = '.'
const WORKSPACE = 'workspace'

const baseEventActions: telemetryEventNames = {
  failure: 'failure',
  success: 'success',
  start: 'start',
  mergeErrors: 'merge_errors',
  changes: 'changes',
  changesToApply: 'changes_to_apply',
  errors: 'errors',
  failedRows: 'failed_rows',
  actionsFailure: ['actions', 'failure'].join(SEPARATOR),
  actionsSuccess: ['actions', 'success'].join(SEPARATOR),
}

export const buildEventName = (
  command: string,
  action: string,
): string => [WORKSPACE, command, action].join(SEPARATOR)

export const getEvents = (
  commandName: string,
): telemetryEventNames => ({
  start: buildEventName(commandName, baseEventActions.start),
  success: buildEventName(commandName, baseEventActions.success),
  failure: buildEventName(commandName, baseEventActions.failure),
  mergeErrors: buildEventName(commandName, baseEventActions.mergeErrors),
  changes: buildEventName(commandName, baseEventActions.changes),
  changesToApply: buildEventName(commandName, baseEventActions.changesToApply),
  errors: buildEventName(commandName, baseEventActions.errors),
  failedRows: buildEventName(commandName, baseEventActions.failedRows),
  actionsSuccess: buildEventName(commandName, baseEventActions.actionsSuccess),
  actionsFailure: buildEventName(commandName, baseEventActions.actionsFailure),
})
