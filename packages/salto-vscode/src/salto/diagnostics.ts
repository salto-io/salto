import { EditorRange } from './context'
import { EditorWorkspace } from './workspace'
import _ from 'lodash'

export interface SaltoDiagnostic {
  filename: string
  msg: string
  range: EditorRange
}

// export interface WorkspaceSaltoDiagnostics {
//   [key: string] : SaltoDiagnostic[]
// }

export type WorkspaceSaltoDiagnostics = Record<string, SaltoDiagnostic[]>

export const getDiagnostics = (
  workspace: EditorWorkspace,
): WorkspaceSaltoDiagnostics => {
  return _(workspace.workspace.getWorkspaceErrors())
    .map(err => err.sourceRanges.map( r => ({
      filename: r.filename,
      msg: err.error,
      range: {
        start: r.start,
        end: r.end
      }
    })))
    .flatten()
    .groupBy('filename')
    .value()
  }
