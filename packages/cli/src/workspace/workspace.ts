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
import _ from 'lodash'
import wu from 'wu'
import semver from 'semver'
import { EOL } from 'os'
import { FetchChange, Tags, StepEmitter } from '@salto-io/core'
import { SaltoError, DetailedChange } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { Workspace, nacl, StateRecency, validator as wsValidator } from '@salto-io/workspace'
import { EventEmitter } from 'pietile-eventemitter'
import {
  formatWorkspaceError,
  formatWorkspaceLoadFailed,
  formatDetailedChanges,
  formatFinishedLoading,
  formatWorkspaceAbort,
  formatShouldCancelWithOldState,
  formatShouldCancelWithNonexistentState,
} from '../formatter'
import { CliOutput, SpinnerCreator, CliTelemetry } from '../types'
import {
  shouldContinueInCaseOfWarnings,
  shouldAbortWorkspaceInCaseOfValidationError,
  shouldCancelCommand,
} from '../callbacks'
import Prompts from '../prompts'
import { groupRelatedErrors } from './errors'
import { version as currentVersion } from '../generated/version.json'

const { isUnresolvedRefError } = wsValidator

const log = logger(module)

export const MAX_DETAIL_CHANGES_TO_LOG = 100
export const MAX_WORKSPACE_ERRORS_TO_LOG = 30

export type LoadWorkspaceResult = {
  workspace: Workspace
  errored: boolean
  stateRecencies: StateRecency[]
}
type WorkspaceStatus = 'Error' | 'Warning' | 'Valid'
type WorkspaceStatusErrors = {
  status: WorkspaceStatus
  errors: ReadonlyArray<SaltoError>
}

export type LoadWorkspaceOptions = {
  force: boolean
  printStateRecency: boolean
  recommendStateStatus: boolean
  spinnerCreator: SpinnerCreator
  sessionEnv?: string
  accounts?: string[]
  ignoreUnresolvedRefs?: boolean
  configOverrides?: DetailedChange[]
}

type ApplyProgressEvents = {
  workspaceWillBeUpdated: (stepProgress: StepEmitter<number>, changes: number, approved: number) => void
}

type ApplyChangesArgs = {
  workspace: Workspace
  changes: FetchChange[]
  cliTelemetry: CliTelemetry
  mode: nacl.RoutingMode
  force: boolean
  shouldCalcTotalSize: boolean
  applyProgress: EventEmitter<ApplyProgressEvents>
  output: CliOutput
  approveChangesCallback: (changes: ReadonlyArray<FetchChange>) => Promise<ReadonlyArray<FetchChange>>
}

export const validateWorkspace = async (
  ws: Workspace,
  ignoreUnresolvedRefs = false,
): Promise<WorkspaceStatusErrors> => {
  const errors = await ws.errors()
  if (!errors.hasErrors()) {
    return { status: 'Valid', errors: [] }
  }
  if (errors.hasErrors('Error')) {
    return { status: 'Error', errors: groupRelatedErrors([...errors.all('Error')]) }
  }

  const relevantErrors = [
    ...(ignoreUnresolvedRefs ? wu.filter(e => !isUnresolvedRefError(e), errors.all('Warning')) : errors.all('Warning')),
  ]

  if (relevantErrors.length === 0) {
    return { status: 'Valid', errors: [] }
  }
  return { status: 'Warning', errors: groupRelatedErrors(relevantErrors) }
}

export const formatWorkspaceErrors = async (workspace: Workspace, errors: Iterable<SaltoError>): Promise<string> =>
  (
    await Promise.all(
      wu(errors)
        .slice(0, MAX_WORKSPACE_ERRORS_TO_LOG)
        .map(err => workspace.transformError(err))
        .map(async err => formatWorkspaceError(await err)),
    )
  ).join(EOL)

const printWorkspaceErrors = async (
  status: WorkspaceStatusErrors['status'],
  errorsStr: string,
  { stdout, stderr }: CliOutput,
): Promise<void> => {
  if (status === 'Valid') return
  const stream = status === 'Error' ? stderr : stdout
  log.debug('workspace status %s, errors:\n%s', status, errorsStr)
  stream.write(`\n${errorsStr}\n`)
}

const logWorkspaceUpdates = async (ws: Workspace, changes: readonly FetchChange[]): Promise<void> => {
  if (!(await ws.isEmpty(true))) {
    log.info('going to update workspace with %d changes', changes.length)
    if (changes.length > MAX_DETAIL_CHANGES_TO_LOG) {
      log.debug('going to log only %d changes', MAX_DETAIL_CHANGES_TO_LOG)
    }
    ;(await formatDetailedChanges([changes.slice(0, MAX_DETAIL_CHANGES_TO_LOG).map(c => c.change)]))
      .split('\n')
      .forEach(s => log.debug(s))
  }
}

export const shouldRecommendFetch = async (
  stateSaltoVersion: string | undefined,
  invalidRecencies: StateRecency[],
  cliOutput: CliOutput,
): Promise<boolean> => {
  if (!stateSaltoVersion) {
    return shouldCancelCommand(Prompts.UNKNOWN_STATE_SALTO_VERSION, cliOutput)
  }
  const maxStateSupportedVersion = semver.inc(stateSaltoVersion, 'patch')
  if (semver.gt(stateSaltoVersion, currentVersion)) {
    return shouldCancelCommand(Prompts.NEW_STATE_SALTO_VERSION(stateSaltoVersion), cliOutput)
  }
  if (!maxStateSupportedVersion) {
    throw new Error('invalid state version string')
  }
  if (semver.gt(currentVersion, maxStateSupportedVersion)) {
    return shouldCancelCommand(Prompts.OLD_STATE_SALTO_VERSION(stateSaltoVersion), cliOutput)
  }
  if (!_.isEmpty(invalidRecencies)) {
    const prompt = invalidRecencies.find(recency => recency.status !== 'Nonexistent')
      ? formatShouldCancelWithOldState
      : formatShouldCancelWithNonexistentState
    return shouldCancelCommand(prompt, cliOutput)
  }
  return false
}

export const isValidWorkspaceForCommand = async ({
  workspace,
  cliOutput,
  spinnerCreator,
  force,
  ignoreUnresolvedRefs = false,
}: {
  workspace: Workspace
  cliOutput: CliOutput
  spinnerCreator: SpinnerCreator
  force?: boolean
  ignoreUnresolvedRefs?: boolean
}): Promise<boolean> => {
  const spinner = spinnerCreator(Prompts.LOADING_WORKSPACE, {})
  const { status, errors } = await validateWorkspace(workspace, ignoreUnresolvedRefs)
  await printWorkspaceErrors(status, await formatWorkspaceErrors(workspace, errors), cliOutput)

  if (status === 'Error') {
    spinner.fail(formatWorkspaceLoadFailed(errors.length))
    cliOutput.stdout.write(formatWorkspaceAbort(errors.length))
    return false
  }

  spinner.succeed(formatFinishedLoading(workspace.currentEnv()))
  if (status === 'Warning' && !force) {
    return shouldContinueInCaseOfWarnings(errors.length, cliOutput)
  }

  return true
}

export const updateStateOnly = async (ws: Workspace, changes: readonly FetchChange[]): Promise<boolean> => {
  try {
    log.info('applying %d changes to state only', changes.length)
    await logWorkspaceUpdates(ws, changes)
    await ws.updateNaclFiles(
      changes.map(change => change.change),
      'default',
      true,
    )
    await ws.flush()
    return true
  } catch (e) {
    log.error(e)
    return false
  }
}

type UpdateWorkspaceParams = {
  workspace: Workspace
  output: CliOutput
  changes: readonly FetchChange[]
  force?: boolean
  mode?: nacl.RoutingMode
}
export const updateWorkspace = async ({
  workspace,
  output,
  changes,
  force = false,
  mode = 'default',
}: UpdateWorkspaceParams): Promise<{ success: boolean; numberOfAppliedChanges: number }> => {
  let numberOfAppliedChanges = 0
  await logWorkspaceUpdates(workspace, changes)
  const updateNaclFilesResult = await workspace.updateNaclFiles(
    changes.map(c => c.change),
    mode,
  )
  numberOfAppliedChanges = updateNaclFilesResult.naclFilesChangesCount + updateNaclFilesResult.stateOnlyChangesCount
  const { status, errors } = await validateWorkspace(workspace)
  const formattedErrors = await formatWorkspaceErrors(workspace, errors)
  await printWorkspaceErrors(status, formattedErrors, output)
  if (status === 'Error') {
    log.warn(formattedErrors)
    const shouldAbort = force || (await shouldAbortWorkspaceInCaseOfValidationError(errors.length))
    if (!shouldAbort) {
      await workspace.flush()
    }
    return { success: false, numberOfAppliedChanges: 0 }
  }
  await workspace.flush()
  log.debug('finished updating workspace')
  return { success: true, numberOfAppliedChanges }
}

export const getWorkspaceTelemetryTags = (ws: Workspace): Tags => ({ workspaceID: ws.uid })

export const applyChangesToWorkspace = async ({
  workspace,
  changes,
  cliTelemetry,
  approveChangesCallback,
  mode,
  force,
  shouldCalcTotalSize,
  applyProgress,
  output,
}: ApplyChangesArgs): Promise<boolean> => {
  // If the workspace starts empty there is no point in showing a huge amount of changes
  const changesToApply = force || (await workspace.isEmpty()) ? changes : await approveChangesCallback(changes)

  cliTelemetry.changesToApply(changesToApply.length)
  const updatingWsEmitter = new StepEmitter<number>()
  applyProgress.emit('workspaceWillBeUpdated', updatingWsEmitter, changes.length, changesToApply.length)
  const results = await updateWorkspace({
    workspace,
    output,
    changes: changesToApply,
    mode,
    force,
  })

  if (results.success) {
    updatingWsEmitter.emit('completed', results.numberOfAppliedChanges)
    if (shouldCalcTotalSize) {
      const totalSize = await workspace.getTotalSize()
      log.debug(`Total size of the workspace is ${totalSize} bytes`)
      cliTelemetry.workspaceSize(totalSize)
    }
    return true
  }
  updatingWsEmitter.emit('failed')
  return false
}
