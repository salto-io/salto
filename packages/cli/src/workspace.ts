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
import { EOL } from 'os'
import _ from 'lodash'
import { Workspace, loadConfig, FetchChange, WorkspaceError, Tags } from '@salto-io/core'
import { SaltoError } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { formatWorkspaceErrors, formatWorkspaceLoadFailed, formatDetailedChanges,
  formatFinishedLoading, formatWorkspaceAbort } from './formatter'
import { CliOutput, SpinnerCreator } from './types'
import {
  shouldContinueInCaseOfWarnings,
  shouldAbortWorkspaceInCaseOfValidationError,
  shouldCancelInCaseOfNoRecentState,
} from './callbacks'
import Prompts from './prompts'

const log = logger(module)

export const MAX_DETAIL_CHANGES_TO_LOG = 100
const isError = (e: WorkspaceError<SaltoError>): boolean => (e.severity === 'Error')

export type LoadWorkspaceResult = {
  workspace: Workspace
  errored: boolean
}
type WorkspaceStatus = 'Error' | 'Warning' | 'Valid'
type WorkspaceStatusErrors = {
  status: WorkspaceStatus
  errors: ReadonlyArray<WorkspaceError<SaltoError>>
}

type LoadWorkspaceOptions = {
  force: boolean
  printStateRecency: boolean
  recommendStateRecency: boolean
}

export const validateWorkspace = async (ws: Workspace): Promise<WorkspaceStatusErrors> => {
  if (!(await ws.hasErrors())) {
    return { status: 'Valid', errors: [] }
  }
  const workspaceErrors = await ws.getWorkspaceErrors()
  const severeErrors = workspaceErrors.filter(isError)
  if (!_.isEmpty(severeErrors)) {
    return { status: 'Error', errors: severeErrors }
  }
  return { status: 'Warning', errors: workspaceErrors }
}

const printWorkspaceErrors = ({ status, errors }: WorkspaceStatusErrors,
  { stdout, stderr }: CliOutput): void => {
  if (status === 'Valid') return
  const stream = (status === 'Error' ? stderr : stdout)
  stream.write(`\n${formatWorkspaceErrors(errors)}`)
}

export const loadWorkspace = async (workingDir: string, cliOutput: CliOutput,
  spinnerCreator?: SpinnerCreator,
  { force = false, printStateRecency = false, recommendStateRecency = false }:
    Partial<LoadWorkspaceOptions> = {}): Promise<LoadWorkspaceResult> => {
  const spinner = spinnerCreator
    ? spinnerCreator(Prompts.LOADING_WORKSPACE, {})
    : { succeed: () => undefined, fail: () => undefined }
  const workspace = new Workspace(await loadConfig(workingDir))
  const { status: wsStatus, errors } = await validateWorkspace(workspace)
  // Stop the spinner
  if (wsStatus === 'Error') {
    spinner.fail(formatWorkspaceLoadFailed(errors.length))
  } else {
    spinner.succeed(formatFinishedLoading(workspace.config.currentEnv))
  }
  // Print state's recency
  const stateRecency = await workspace.getStateRecency()
  if (printStateRecency) {
    const prompt = stateRecency.status === 'Nonexistent'
      ? Prompts.NONEXISTENT_STATE : Prompts.STATE_RECENCY(stateRecency.date as Date)
    cliOutput.stdout.write(prompt + EOL)
  }
  // Offer to cancel because of stale state
  if (recommendStateRecency && !force
    && stateRecency.status !== 'Valid' && wsStatus !== 'Error') {
    const shouldCancel = await shouldCancelInCaseOfNoRecentState(stateRecency, cliOutput)
    if (shouldCancel) {
      return { workspace, errored: true }
    }
  }
  // Handle warnings/errors
  printWorkspaceErrors({ status: wsStatus, errors }, cliOutput)
  if (wsStatus === 'Warning' && !force) {
    const shouldContinue = await shouldContinueInCaseOfWarnings(errors.length, cliOutput)
    return { workspace, errored: !shouldContinue }
  }
  if (wsStatus === 'Error') {
    cliOutput.stdout.write(formatWorkspaceAbort(errors.length))
  }
  return { workspace, errored: wsStatus === 'Error' }
}

export const updateWorkspace = async (ws: Workspace, cliOutput: CliOutput,
  changes: readonly FetchChange[], strict = false): Promise<boolean> => {
  if (changes.length > 0) {
    if (!await ws.isEmpty(true)) {
      log.info('going to update workspace with %d changes', changes.length)
      if (changes.length > MAX_DETAIL_CHANGES_TO_LOG) {
        log.info('going to log only %d changes', MAX_DETAIL_CHANGES_TO_LOG)
      }
      formatDetailedChanges([changes.slice(0, MAX_DETAIL_CHANGES_TO_LOG).map(c => c.change)])
        .split('\n')
        .forEach(s => log.info(s))
    }

    await ws.updateBlueprints(
      changes.map(c => c.change),
      strict ? 'strict' : undefined
    )
    const wsStatusErrors = await validateWorkspace(ws)
    printWorkspaceErrors(wsStatusErrors, cliOutput)
    if (wsStatusErrors.status === 'Error') {
      const numErrors = wsStatusErrors.errors.length
      const shouldAbort = await shouldAbortWorkspaceInCaseOfValidationError(numErrors)
      if (!shouldAbort) {
        await ws.flush()
      }
      log.warn(formatWorkspaceErrors(wsStatusErrors.errors))
      return false
    }
  }
  await ws.flush()
  log.debug('finished updating workspace')
  return true
}

export const getWorkspaceTelemetryTags = async (ws: Workspace): Promise<Tags> => (
  { workspaceID: ws.config.uid }
)
