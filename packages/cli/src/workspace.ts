import _ from 'lodash'
import { Workspace, loadConfig, DetailedChange } from 'salto'
import { formatWorkspaceErrors } from './formatter'
import { WriteStream } from './types'


export type LoadWorkspaceResult = {
  workspace: Workspace
  errored: boolean
}

export const validateWorkspace = (ws: Workspace, stderr: WriteStream): boolean => {
  if (ws.hasErrors()) {
    const workspaceErrors = ws.getWorkspaceErrors()
    stderr.write(formatWorkspaceErrors(workspaceErrors))
    return !_.some(workspaceErrors, (we => we.severity === 'Error'))
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
  ...changes: DetailedChange[]): Promise<boolean> => {
  if (changes.length > 0) {
    await ws.updateBlueprints(...changes)
    if (!validateWorkspace(ws, stderr)) {
      return false
    }
    await ws.flush()
  }
  return true
}
