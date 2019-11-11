import _ from 'lodash'
import { Workspace, loadConfig, FetchChange, WorkspaceError, WorkspaceErrorSeverity } from 'salto'
import { logger } from '@salto/logging'
import { formatWorkspaceErrors, formatChange, formatWorkspaceAbort } from './formatter'
import { CliOutput } from './types'
import { shouldContinueInCaseOfWarnings } from './callbacks'

const log = logger(module)

const isError = (e: WorkspaceError): boolean => (e.severity === 'Error')

export type LoadWorkspaceResult = {
  workspace: Workspace
  errored: boolean
}

// Exported for testing purposes
export const validateWorkspace = (ws: Workspace,
  { stdout, stderr }: CliOutput): WorkspaceErrorSeverity | true => {
  if (ws.hasErrors()) {
    const workspaceErrors = ws.getWorkspaceErrors()
    const errorSeverity = workspaceErrors.filter(isError)
    if (!_.isEmpty(errorSeverity)) {
      stderr.write(formatWorkspaceErrors(errorSeverity))
      stderr.write(formatWorkspaceAbort(errorSeverity.length))
      return 'Error'
    }
    stdout.write(formatWorkspaceErrors(workspaceErrors))
    return 'Warning'
  }
  return true
}

export const loadWorkspace = async (workingDir: string, cliOutput: CliOutput
): Promise<LoadWorkspaceResult> => {
  const config = await loadConfig(workingDir)
  const workspace = await Workspace.load(config)
  const wsStatus = validateWorkspace(workspace, cliOutput)
  if (wsStatus === 'Warning') {
    const numWarnings = workspace.getWorkspaceErrors().filter(e => !isError(e)).length
    const shouldContinue = await shouldContinueInCaseOfWarnings(numWarnings, cliOutput)
    return { workspace, errored: !shouldContinue }
  }
  return { workspace, errored: wsStatus === 'Error' }
}

export const updateWorkspace = async (ws: Workspace, cliOutput: CliOutput,
  ...changes: FetchChange[]): Promise<boolean> => {
  if (changes.length > 0) {
    log.info(`going to update workspace with ${changes.length} changes out of ${
      changes.length} changes`)
    const isEmpty = ws.elements ? !ws.elements.some(elem => !elem.elemID.isConfig()) : false
    if (!isEmpty) {
      _(changes.map(c => formatChange(c.change).split('\n'))).flatten().forEach(s => log.info(s))
    }

    await ws.updateBlueprints(...changes.map(c => c.change))
    if (validateWorkspace(ws, cliOutput) === 'Error') {
      log.warn(`workspace has ${ws.getWorkspaceErrors().filter(isError).length} errors - ABORT`)
      return false
    }
    await ws.flush()
    log.debug('finished to flush workspace state')
  }
  return true
}
