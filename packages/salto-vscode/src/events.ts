import * as vscode from 'vscode'
import * as fs from 'async-file'
import {
  initWorkspace, updateFile, SaltoWorkspace, removeBPFromWorkspace,
} from './salto/workspace'

// This function is called whenever a file content is changed. The function will
// reparse the file that changed.
export const onDidChangeTextDocument = async (
  event: vscode.TextDocumentChangeEvent,
  workspace: SaltoWorkspace
): Promise<void> => {
  workspace.lastUpdate = updateFile(
    workspace,
    event.document.fileName,
    event.document.getText()
  )
  await workspace.lastUpdate
}

// This function is registered as callback function for configuration changes in the
// salto settings - which means we need to recompile all of the files since we may
// have new files to consider.
export const onDidChangeConfiguration = async (
  _event: vscode.ConfigurationChangeEvent,
  workspace: SaltoWorkspace,
  settings: vscode.WorkspaceConfiguration
): Promise<void> => {
  workspace.lastUpdate = initWorkspace(
    workspace.baseDir,
    settings.additionalBlueprintDirs,
    settings.additionalBlueprints
  )
  await workspace.lastUpdate
}

export const onFileDelete = async (
  workspace: SaltoWorkspace,
  filename: string
): Promise<void> => {
  await removeBPFromWorkspace(workspace, filename)
}

export const onFileCreate = async (
  workspace: SaltoWorkspace,
  filename: string
): Promise<void> => {
  const content = await fs.readFile(filename, 'utf8')
  await updateFile(workspace, filename, content)
}
