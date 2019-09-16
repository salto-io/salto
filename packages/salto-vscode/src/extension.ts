import * as vscode from 'vscode'
import _ from 'lodash'
import { initWorkspace, updateFile, SaltoWorkspace } from './salto/workspace'
import { provideWorkspaceCompletionItems } from './salto/completions/provider'
import { getPositionContext } from './salto/context'
import { debugFunctions } from './salto/debug'

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

// This function is called in order to create a completion provided - and
// bind it to the current workspace
const createProvider = (
  workspace: SaltoWorkspace
): vscode.CompletionItemProvider => ({
  provideCompletionItems: (
    doc: vscode.TextDocument,
    position: vscode.Position
  ) => {
    const getFullLine = (d: vscode.TextDocument, p: vscode.Position): string => {
      const LINE_ENDERS = ['\\{', '\\}', '\\[', '\\]', ',', ';']
      const lineEnderReg = new RegExp(`[${LINE_ENDERS.join('')}]`)
      const lines = d.lineAt(p).text.substr(0, p.character).split(lineEnderReg)
      return _.trimStart(lines[lines.length - 1])
    }
    const context = getPositionContext(workspace, doc.fileName, {
      line: position.line + 1,
      col: position.character,
    })
    const line = getFullLine(doc, position)
    return provideWorkspaceCompletionItems(workspace, context, line).map(
      ({ label, reInvoke, insertText }) => {
        const item = new vscode.CompletionItem(label)
        if (reInvoke) {
          item.insertText = insertText
          item.command = {
            command: 'editor.action.triggerSuggest',
            title: 'Re-trigger completions...',
          }
        }
        return item
      }
    )
  },
})


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
      { scheme: 'file', pattern: { base: rootPath, pattern: '*.bp' } },
      createProvider(workspaces[name]),
      ' '
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
