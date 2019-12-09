import _ from 'lodash'
import { WorkspaceErrorSeverity } from 'salto'
import { EditorRange } from './context'
import { EditorWorkspace } from './workspace'

export interface SaltoDiagnostic {
  filename: string
  msg: string
  range: EditorRange
  severity: WorkspaceErrorSeverity
}

export type WorkspaceSaltoDiagnostics = Record<string, SaltoDiagnostic[]>

export const getDiagnostics = async (
  workspace: EditorWorkspace,
): Promise<WorkspaceSaltoDiagnostics> => {
  const emptyDiagFiles = _.mapValues(workspace.parsedBlueprints, _k => [])
  const diag = _(await workspace.workspace.getWorkspaceErrors())
    .map(err => err.sourceFragments.map(f => ({
      filename: f.sourceRange.filename,
      severity: err.severity,
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
