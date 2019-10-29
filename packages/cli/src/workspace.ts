import _ from 'lodash'
import { Workspace, WorkspaceErrorSeverity } from 'salto'
import { formatWorkspaceErrors } from './formatter'
import { WriteStream } from './types'

export const validateWorkspace = (ws: Workspace, stderr: WriteStream): boolean => {
  if (ws.hasErrors()) {
    const workspaceErrors = ws.getWorkspaceErrors()
    stderr.write(formatWorkspaceErrors(workspaceErrors))
    return _.isEmpty(workspaceErrors.filter(we => we.severity === WorkspaceErrorSeverity.Error))
  }
  return true
}
