import _ from 'lodash'
import { Workspace, loadConfig, FetchChange, WorkspaceError } from 'salto'
import { SaltoError } from 'adapter-api'
import { logger } from '@salto/logging'
import { formatWorkspaceErrors, formatWorkspaceAbort, formatDetailedChanges } from './formatter'
import { CliOutput, SpinnerCreator } from './types'
import { shouldContinueInCaseOfWarnings } from './callbacks'
import Prompts from './prompts'

const log = logger(module)

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
    spinner.succeed(Prompts.FINISHED_LOADING)
    const numWarnings = (await workspace.getWorkspaceErrors()).filter(e => !isError(e)).length
    const shouldContinue = await shouldContinueInCaseOfWarnings(numWarnings, cliOutput)
    return { workspace, errored: !shouldContinue }
  }

  if (wsStatus === 'Error') {
    const numErrors = (await workspace.getWorkspaceErrors()).filter(isError).length
    spinner.fail(formatWorkspaceAbort(numErrors))
  } else {
    spinner.succeed(Prompts.FINISHED_LOADING)
  }

  return { workspace, errored: wsStatus === 'Error' }
}

export const updateWorkspace = async (ws: Workspace, cliOutput: CliOutput,
  ...changes: FetchChange[]): Promise<boolean> => {
  if (changes.length > 0) {
    log.info(`going to update workspace with ${changes.length} changes out of ${
      changes.length} changes`)
    if (!await ws.isEmpty(true)) {
      formatDetailedChanges([changes.map(c => c.change)]).split('\n').forEach(s => log.info(s))
    }

    await ws.updateBlueprints(...changes.map(c => c.change))
    if (await validateWorkspace(ws, cliOutput) === 'Error') {
      const wsErrors = await ws.getWorkspaceErrors()
      log.warn('workspace has %d errors - ABORT', wsErrors.filter(isError).length)
      log.warn(formatWorkspaceErrors(wsErrors))
      return false
    }
    await ws.flush()
    log.debug('finished updating workspace blueprints')
  }
  return true
}
