import * as vscode from 'vscode'
import _ from 'lodash'
import { initWorkspace, updateFile, SaltoWorkspace } from './salto/workspace'
import { debugFunctions, createProvider } from './salto/debug'

/**
 * This files act as a bridge between VSC and the salto specific functionality.
 */

const workspaces: {[key: string]: SaltoWorkspace} = {}

// This function is called whenever a file content is changed. The function will
// reparse the file that changed.
const onDidChangeTextDocument = async (
  event: vscode.TextDocumentChangeEvent,
  workspaceName: string
): Promise<void> => {
  const workspace = workspaces[workspaceName]
  await updateFile(workspace, event.document.fileName, event.document.getText())
}

// This function is registered as callback function for configuration changes in the
// salto settings - which means we need to recompile all of the files since we may
// have new files to consider.
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
  // eslint-disable-next-line no-console
  console.log('Workspace init started', new Date())
  const { name, rootPath } = vscode.workspace
  if (name && rootPath) {
    const settings = vscode.workspace.getConfiguration('salto')
    workspaces[name] = await initWorkspace(
      rootPath,
      settings.additionalBlueprintDirs,
      settings.additionalBlueprints
    )

    const completionProvider = vscode.languages.registerCompletionItemProvider(
      { scheme: 'file', pattern: {base: rootPath, pattern: "*.bp"}},
      createProvider(workspaces[name]),
      "_"
    )
    context.subscriptions.push(
      completionProvider,
      vscode.workspace.onDidChangeTextDocument(e => onDidChangeTextDocument(e, name)),
      vscode.workspace.onDidChangeConfiguration(e => onDidChangeConfiguration(e, name, settings)),
      // A shortcut for registering all debug commands from debug.ts
      ..._.keys(debugFunctions).map(k =>
        vscode.commands.registerCommand(k, () => debugFunctions[k](workspaces[name])))
    )
  }
  // We need this log until the parse time will be shorter so we will know when to expect the plugin
  // to start working.
  // eslint-disable-next-line no-console
  console.log('Workspace init done', new Date())
}
