import _ from 'lodash'
import { SaltoErrorSeverity } from 'adapter-api'
import { EditorRange } from './context'
import { EditorWorkspace } from './workspace'

export interface SaltoDiagnostic {
  filename: string
  msg: string
  range: EditorRange
  severity: SaltoErrorSeverity
}

export type WorkspaceSaltoDiagnostics = Record<string, SaltoDiagnostic[]>

export const getDiagnostics = async (
  workspace: EditorWorkspace,
): Promise<WorkspaceSaltoDiagnostics> => {
  const emptyDiagFiles: WorkspaceSaltoDiagnostics = _.fromPairs(
    (await workspace.workspace.listBlueprints())
      .map(filename => [filename, []])
  )
  const diag = _(await workspace.workspace.getWorkspaceErrors())
    .map(err => err.sourceFragments.map(f => ({
      filename: f.sourceRange.filename,
      severity: err.severity,
      msg: err.message,
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
