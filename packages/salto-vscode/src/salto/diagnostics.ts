import _ from 'lodash'
import { EditorRange } from './context'
import { EditorWorkspace } from './workspace'

export interface SaltoDiagnostic {
  filename: string
  msg: string
  range: EditorRange
}

export type WorkspaceSaltoDiagnostics = Record<string, SaltoDiagnostic[]>

export const getDiagnostics = (
  workspace: EditorWorkspace,
): WorkspaceSaltoDiagnostics => {
  const emptyDiagFiles = _.mapValues(workspace.parsedBlueprints, _k => [])
  const diag = _(workspace.workspace.getWorkspaceErrors())
    .map(err => err.sourceFragments.map(f => ({
      filename: f.sourceRange.filename,
      msg: err.error,
      range: {
        start: f.sourceRange.start,
        end: f.sourceRange.end,
      },
    })))
    .flatten()
    .groupBy('filename')
    .value()
  return { ...emptyDiagFiles, ...diag }
}
