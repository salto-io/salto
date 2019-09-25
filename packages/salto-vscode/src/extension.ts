import * as vscode from 'vscode'
import { initWorkspace } from './salto/workspace'
import { onDidChangeConfiguration, onDidChangeTextDocument } from './events'
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
    const workspace = await initWorkspace(
      rootPath,
      settings.additionalBlueprintDirs,
      settings.additionalBlueprints
    )

    const completionProvider = vscode.languages.registerCompletionItemProvider(
      { scheme: 'file', pattern: { base: rootPath, pattern: '**/*.bp' } },
      createCompletionsProvider(workspace),
      ' '
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
      vscode.workspace.onDidChangeConfiguration(
        e => onDidChangeConfiguration(e, workspace, settings)
      ),
      vscode.workspace.onDidChangeTextDocument(
        e => onDidChangeTextDocument(e, workspace)
      )
    )
  }
  // We need this log until the parse time will be shorter so we will know when to expect the plugin
  // to start working.
  // eslint-disable-next-line no-console
  console.log('Workspace init done', new Date())
}
