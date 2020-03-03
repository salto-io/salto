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
import { Workspace, loadConfig, FetchChange, WorkspaceError } from '@salto-io/core'
import { SaltoError } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { formatWorkspaceErrors, formatWorkspaceAbort, formatDetailedChanges, formatFinishedLoading } from './formatter'
import { CliOutput, SpinnerCreator } from './types'
import { shouldContinueInCaseOfWarnings,
  shouldAbortWorkspaceInCaseOfValidationError } from './callbacks'
import Prompts from './prompts'

const log = logger(module)

export const MAX_DETAIL_CHANGES_TO_LOG = 100
const isError = (e: WorkspaceError<SaltoError>): boolean => (e.severity === 'Error')

export type LoadWorkspaceResult = {
  workspace: Workspace
  errored: boolean
}

type WorkspaceStatus = 'Error' | 'Warning' | 'Valid'
// Exported for testing purposes
export const validateWorkspace = async (ws: Workspace,
  { stdout, stderr }: CliOutput): Promise<WorkspaceStatus> => {
  if (await ws.hasErrors()) {
    const workspaceErrors = await ws.getWorkspaceErrors()
    const severeErrors = workspaceErrors.filter(isError)
    if (!_.isEmpty(severeErrors)) {
      stderr.write(`\n${formatWorkspaceErrors(severeErrors)}`)
      return 'Error'
    }
    stdout.write(`\n${formatWorkspaceErrors(workspaceErrors)}`)
    return 'Warning'
  }
  return 'Valid'
}

export const loadWorkspace = async (workingDir: string, cliOutput: CliOutput,
  spinnerCreator?: SpinnerCreator): Promise<LoadWorkspaceResult> => {
  const spinner = spinnerCreator
    ? spinnerCreator(Prompts.LOADING_WORKSPACE, {})
    : { succeed: () => undefined, fail: () => undefined }
  const workspace = new Workspace(await loadConfig(workingDir))
  const wsStatus = await validateWorkspace(workspace, cliOutput)

  if (wsStatus === 'Warning') {
    spinner.succeed(formatFinishedLoading(workspace.config.currentEnv))
    const numWarnings = (await workspace.getWorkspaceErrors()).filter(e => !isError(e)).length
    const shouldContinue = await shouldContinueInCaseOfWarnings(numWarnings, cliOutput)
    return { workspace, errored: !shouldContinue }
  }

  if (wsStatus === 'Error') {
    const numErrors = (await workspace.getWorkspaceErrors()).filter(isError).length
    spinner.fail(formatWorkspaceAbort(numErrors))
  } else {
    spinner.succeed(formatFinishedLoading(workspace.config.currentEnv))
  }

  return { workspace, errored: wsStatus === 'Error' }
}

export const updateWorkspace = async (ws: Workspace, cliOutput: CliOutput,
  changes: readonly FetchChange[], strict = false): Promise<boolean> => {
  if (changes.length > 0) {
    log.info('going to update workspace with %d changes and print %d of them',
      changes.length,
      changes.length > MAX_DETAIL_CHANGES_TO_LOG ? MAX_DETAIL_CHANGES_TO_LOG : changes.length)
    if (!await ws.isEmpty(true)) {
      formatDetailedChanges([changes.slice(0, MAX_DETAIL_CHANGES_TO_LOG).map(c => c.change)])
        .split('\n')
        .forEach(s => log.info(s))
    }

    await ws.updateBlueprints(
      changes.map(c => c.change),
      strict ? 'strict' : undefined
    )
    if (await validateWorkspace(ws, cliOutput) === 'Error') {
      const wsErrors = await ws.getWorkspaceErrors()
      const numErrors = wsErrors.filter(isError).length
      const shouldAbort = await shouldAbortWorkspaceInCaseOfValidationError(numErrors)
      if (!shouldAbort) {
        await ws.flush()
      }
      log.warn(formatWorkspaceErrors(wsErrors))
      return false
    }
  }
  await ws.flush()
  log.debug('finished updating workspace')
  return true
}
