import _ from 'lodash'
import { Workspace, loadConfig, FetchChange, WorkspaceError } from 'salto'
import { logger } from '@salto/logging'
import { formatWorkspaceErrors, formatChange } from './formatter'
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
    log.info(`going to update workspace with ${changes.length} changes out of ${
      changes.length} changes`)
    const isEmpty = ws.elements ? !ws.elements.some(elem => !elem.elemID.isConfig()) : false
    if (!isEmpty) {
      _(changes.map(c => formatChange(c.change).split('\n'))).flatten().forEach(s => log.info(s))
    }

    await ws.updateBlueprints(...changes.map(c => c.change))
    if (!validateWorkspace(ws, stderr)) {
      log.warn(`workspace has ${ws.getWorkspaceErrors().filter(isError).length} errors - ABORT`)
      return false
    }
    await ws.flush()
    log.debug('finished to flush workspace state')
  }
  return true
}
