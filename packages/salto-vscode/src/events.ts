import * as vscode from 'vscode'
import * as fs from 'async-file'
import { SaltoWorkspace } from './salto/workspace'

// This function is called whenever a file content is changed. The function will
// reparse the file that changed.
export const onDidChangeTextDocument = (
  event: vscode.TextDocumentChangeEvent,
  workspace: SaltoWorkspace
): Promise<void> => {
  const bp = {filename: event.document.fileName, buffer: event.document.getText()}
  workspace.setBlueprints(bp)
  return workspace.awaitAllUpdates()
}

export const onFileDelete = (
  workspace: SaltoWorkspace,
  filename: string
): Promise<void> => {
  workspace.removeBlueprints(filename)
  return workspace.awaitAllUpdates()
}

export const onFileCreate = async (
  workspace: SaltoWorkspace,
  filename: string
): Promise<void> => {
  const buffer = await fs.readFile(filename, 'utf8')
  workspace.setBlueprints({filename, buffer})
  return workspace.awaitAllUpdates()
}
