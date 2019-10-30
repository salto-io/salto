import _ from 'lodash'
import { Workspace } from 'salto'
import { formatWorkspaceErrors } from './formatter'
import { WriteStream } from './types'

export const validateWorkspace = (ws: Workspace, stderr: WriteStream): boolean => {
  if (ws.hasErrors()) {
    const workspaceErrors = ws.getWorkspaceErrors()
    stderr.write(formatWorkspaceErrors(workspaceErrors))
    return !_.some(workspaceErrors, (we => we.severity === 'Error'))
  }
  return true
}
