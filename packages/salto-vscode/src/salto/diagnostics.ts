import { EditorRange } from './context'
import { EditorWorkspace } from './workspace'

export interface SaltoDiagnostic {
  filename: string
  msg: string
  range: EditorRange
}

export const getDiagnostics = (
  workspace: EditorWorkspace,
  filename: string
): SaltoDiagnostic[] => {
  const bp = workspace.getParsedBlueprint(filename)
  return bp ? bp.errors.map(e => ({
    filename,
    msg: `${e.summary}: ${e.detail}`,
    range: {
      start: { line: e.subject.start.line, col: e.subject.start.col - 1 },
      end: { line: e.subject.end.line, col: e.subject.end.col - 1 },
    },
  })) : []
}
