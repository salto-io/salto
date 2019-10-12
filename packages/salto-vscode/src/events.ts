import * as vscode from 'vscode'
import * as fs from 'async-file'
import { EditorWorkspace } from './salto/workspace'
import { buildVSDiagnostics } from './adapters'
import { getDiagnostics } from './salto/diagnostics'
import _ from 'lodash'

// This function is called whenever a file content is changed. The function will
// reparse the file that changed.
export const reportErrorsEvent = async (
  event: vscode.TextDocumentChangeEvent,
  workspace: EditorWorkspace,
  diagCollection: vscode.DiagnosticCollection
): Promise<void> => {
  const uri = event.document.uri
  const oldDiag = diagCollection.get(uri)
  await workspace.awaitAllUpdates()
  const newDiag = buildVSDiagnostics(getDiagnostics(workspace, event.document.fileName))
  if (!_.isEqual(oldDiag, newDiag)) {
    diagCollection.set(uri, newDiag)
  }
}

// This function is called whenever a file content is changed. The function will
// reparse the file that changed.
export const textChangeEvent = (
  event: vscode.TextDocumentChangeEvent,
  workspace: EditorWorkspace
): void => {
  const bp = { filename: event.document.fileName, buffer: event.document.getText() }
  workspace.setBlueprints(bp)
}

export const onFileDelete = (
  workspace: EditorWorkspace,
  filename: string
): Promise<void> => {
  workspace.removeBlueprints(filename)
  return workspace.awaitAllUpdates()
}

export const onFileCreate = async (
  workspace: EditorWorkspace,
  filename: string
): Promise<void> => {
  const buffer = await fs.readFile(filename, 'utf8')
  workspace.setBlueprints({ filename, buffer })
  return workspace.awaitAllUpdates()
}
