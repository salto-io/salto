import * as vscode from 'vscode'
import _ from 'lodash'
import { initWorkspace, updateFile, SaltoWorkspace } from './salto/workspace'
import { debugFunctions } from './salto/debug'

const workspaces: {[key: string]: SaltoWorkspace} = {}

const onDidChangeTextDocument = async (
  event: vscode.TextDocumentChangeEvent,
  workspaceName: string
): Promise<void> => {
  const workspace = workspaces[workspaceName]
  await updateFile(workspace, event.document.fileName, event.document.getText())
}

const onDidChangeConfiguration = async (
  _event: vscode.ConfigurationChangeEvent,
  workspaceName: string,
  settings: vscode.WorkspaceConfiguration
): Promise<void> => {
  const workspace = workspaces[workspaceName]
  workspaces[workspaceName] = await initWorkspace(
    workspace.baseDir,
    settings.additionalBlueprintDirs,
    settings.additionalBlueprints
  )
}

export const activate = async (context: vscode.ExtensionContext): Promise<void> => {
  const { name, rootPath } = vscode.workspace
  if (name && rootPath) {
    const settings = vscode.workspace.getConfiguration('salto')
    workspaces[name] = await initWorkspace(
      rootPath,
      settings.additionalBlueprintDirs,
      settings.additionalBlueprints
    )
    context.subscriptions.push(
      vscode.workspace.onDidChangeTextDocument(e => onDidChangeTextDocument(e, name)),
      vscode.workspace.onDidChangeConfiguration(e => onDidChangeConfiguration(e, name, settings)),
      ..._.keys(debugFunctions).map(k =>
        vscode.commands.registerCommand(k, () => debugFunctions[k](workspaces[name])))
    )
  }
  // eslint-disable-next-line no-console
  console.log('Workspace init done', new Date())
}
