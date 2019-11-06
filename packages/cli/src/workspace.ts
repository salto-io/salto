import _ from 'lodash'
import { Workspace, loadConfig, FetchChange, WorkspaceError } from 'salto'
import { logger } from '@salto/logging'
import { formatWorkspaceErrors } from './formatter'
import { WriteStream } from './types'

const log = logger(module)

const isError = (e: WorkspaceError): boolean => (e.severity === 'Error')

export type LoadWorkspaceResult = {
  workspace: Workspace
  errored: boolean
}

export const validateWorkspace = (ws: Workspace, stderr: WriteStream): boolean => {
  if (ws.hasErrors()) {
    const workspaceErrors = ws.getWorkspaceErrors()
    stderr.write(formatWorkspaceErrors(workspaceErrors))
    return !_.some(workspaceErrors, isError)
  }
  return true
}

export const loadWorkspace = async (
  workingDir: string,
  stderr: WriteStream): Promise<LoadWorkspaceResult> => {
  const config = await loadConfig(workingDir)
  const workspace = await Workspace.load(config)
  const errored = !validateWorkspace(workspace, stderr)
  return { workspace, errored }
}

export const updateWorkspace = async (ws: Workspace, stderr: WriteStream,
  ...changes: FetchChange[]): Promise<boolean> => {
  if (changes.length > 0) {
    await ws.updateBlueprints(...changes.map(c => c.change))
    log.debug(`updated workspace with ${changes.length} changes`)
    if (!validateWorkspace(ws, stderr)) {
      log.warn(`workspace has ${ws.getWorkspaceErrors().filter(isError).length} errors - ABORT`)
      return false
    }
    log.debug('going to flush workspace state')
    await ws.flush()
    log.debug('finished to flush workspace state')
  }
  return true
}
