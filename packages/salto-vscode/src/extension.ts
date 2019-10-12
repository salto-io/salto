import * as vscode from 'vscode'
import { EditorWorkspace } from './salto/workspace'
import { onDidChangeTextDocument, onFileCreate, onFileDelete, reportErrorsEvent } from './events'
import {
  createCompletionsProvider, createDefinitionsProvider, createReferenceProvider,
  createDocumentSymbolsProvider,
} from './providers'
/**
 * This files act as a bridge between VSC and the salto specific functionality.
 */

export const activate = async (context: vscode.ExtensionContext): Promise<void> => {
  // eslint-disable-next-line no-console
  console.log('Workspace init started', new Date())
  const { name, rootPath } = vscode.workspace
  if (name && rootPath) {
    const settings = vscode.workspace.getConfiguration('salto')
    const workspace = await EditorWorkspace.load(
      rootPath,
      settings.additionalBlueprints
    )

    const completionProvider = vscode.languages.registerCompletionItemProvider(
      { scheme: 'file', pattern: { base: rootPath, pattern: '**/*.bp' } },
      createCompletionsProvider(workspace),
      ' ', '.'
    )

    const definitionProvider = vscode.languages.registerDefinitionProvider(
      { scheme: 'file', pattern: { base: rootPath, pattern: '**/*.bp' } },
      createDefinitionsProvider(workspace)
    )

    const referenceProvider = vscode.languages.registerReferenceProvider(
      { scheme: 'file', pattern: { base: rootPath, pattern: '**/*.bp' } },
      createReferenceProvider(workspace)
    )

    const symbolsProvider = vscode.languages.registerDocumentSymbolProvider(
      { scheme: 'file', pattern: { base: rootPath, pattern: '**/*.bp' } },
      createDocumentSymbolsProvider(workspace)
    )

    context.subscriptions.push(
      completionProvider,
      definitionProvider,
      referenceProvider,
      symbolsProvider,
      vscode.workspace.onDidChangeTextDocument(
        e => onDidChangeTextDocument(e, workspace)
      ),
      vscode.workspace.onDidChangeTextDocument(
        async(e) => await reportErrorsEvent(e, workspace)
      )
    )

    const fileWatcher = vscode.workspace.createFileSystemWatcher('**/*.bp')
    fileWatcher.onDidCreate((uri: vscode.Uri) => onFileCreate(workspace, uri.path))
    fileWatcher.onDidDelete((uri: vscode.Uri) => onFileDelete(workspace, uri.path))
  }
  // We need this log until the parse time will be shorter so we will know when to expect the plugin
  // to start working.
  // eslint-disable-next-line no-console
  console.log('Workspace init done', new Date())
}
