import * as vscode from 'vscode'
import _ from 'lodash'
import { initWorkspace, updateFile, SaltoWorkspace } from './salto/workspace'
import { provideWorkspaceCompletionItems } from './salto/completions/provider'
import { getPositionContext, EditorPosition } from './salto/context'
import { debugFunctions } from './salto/debug'
import { provideWorkspaceDefinition } from './salto/definitions'

/**
 * This files act as a bridge between VSC and the salto specific functionality.
 */

const workspaces: {[key: string]: SaltoWorkspace} = {}

const SaltoPosToVsPos = (
  pos: EditorPosition
): vscode.Position => new vscode.Position(pos.line - 1, pos.col)

const VsPosToSaltoPos = (pos: vscode.Position): EditorPosition => ({
  line: pos.line + 1,
  col: pos.character,
})

// This function is called whenever a file content is changed. The function will
// reparse the file that changed.
const onDidChangeTextDocument = async (
  event: vscode.TextDocumentChangeEvent,
  workspaceName: string
): Promise<void> => {
  const workspace = workspaces[workspaceName]
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
const onDidChangeConfiguration = async (
  _event: vscode.ConfigurationChangeEvent,
  workspaceName: string,
  settings: vscode.WorkspaceConfiguration
): Promise<void> => {
  const workspace = workspaces[workspaceName]
  workspace.lastUpdate = initWorkspace(
    workspace.baseDir,
    settings.additionalBlueprintDirs,
    settings.additionalBlueprints
  )
  await workspace.lastUpdate
}

// This function is called in order to create a completion provided - and
// bind it to the current workspace
const createCompletionsProvider = (
  workspaceName: string
): vscode.CompletionItemProvider => ({
  provideCompletionItems: async (
    doc: vscode.TextDocument,
    position: vscode.Position
  ) => {
    const workspace = workspaces[workspaceName]
    const context = getPositionContext(workspace, doc.fileName, VsPosToSaltoPos(position))
    const line = doc.lineAt(position).text.substr(0, position.character)
    return provideWorkspaceCompletionItems(workspace, context, line).map(
      ({ label, reInvoke, insertText }) => {
        const item = new vscode.CompletionItem(label)
        item.insertText = new vscode.SnippetString(insertText)
        if (reInvoke) {
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

const createDefinitionsProvider = (
  workspaceName: string
): vscode.DefinitionProvider => ({
  provideDefinition: (
    doc: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.Definition => {
    const workspace = workspaces[workspaceName]
    const context = getPositionContext(workspace, doc.fileName, VsPosToSaltoPos(position))
    const currenToken = doc.getText(doc.getWordRangeAtPosition(position))
    return provideWorkspaceDefinition(workspace, context, currenToken).map(
      def => new vscode.Location(
        vscode.Uri.file(def.filename),
        SaltoPosToVsPos(def.range.start)
      )
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
      createCompletionsProvider(name),
      ' '
    )

    const definitionProvider = vscode.languages.registerDefinitionProvider(
      { scheme: 'file', pattern: { base: rootPath, pattern: '*.bp' } },
      createDefinitionsProvider(name)
    )
    context.subscriptions.push(
      completionProvider,
      definitionProvider,
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
