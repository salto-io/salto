import _ from 'lodash'
import { Workspace, loadConfig } from 'salto'
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
