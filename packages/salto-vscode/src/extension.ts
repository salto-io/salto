import * as vscode from 'vscode'
import { loadConfig } from 'salto'
import { EditorWorkspace } from './salto/workspace'
import { onTextChangeEvent, onFileCreate, onFileDelete, onReportErrorsEvent } from './events'
import {
  createCompletionsProvider, createDefinitionsProvider, createReferenceProvider,
  createDocumentSymbolsProvider,
} from './providers'
import { planCommand, applyCommand } from './commands'

/**
 * This files act as a bridge between VSC and the salto specific functionality.
 */

export const activate = async (context: vscode.ExtensionContext): Promise<void> => {
  // eslint-disable-next-line no-console
  console.log('Workspace init started', new Date())
  const { name, rootPath } = vscode.workspace
  if (name && rootPath) {
    const settings = vscode.workspace.getConfiguration('salto')
    const diagCollection = vscode.languages.createDiagnosticCollection('salto')
    const config = await loadConfig(rootPath)
    const workspace = await EditorWorkspace.load(
      config,
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

    const plan = vscode.commands.registerCommand('salto.plan', () => {
      planCommand(workspace, context.extensionPath)
    })

    const apply = vscode.commands.registerCommand('salto.apply', () => {
      applyCommand(workspace, context.extensionPath)
    })

    const planStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100)
    planStatusBar.text = 'Salto: Plan'
    planStatusBar.command = 'salto.plan'
    planStatusBar.show()

    const applyStatus = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100)
    applyStatus.text = 'Salto: Apply'
    applyStatus.command = 'salto.apply'
    applyStatus.show()

    context.subscriptions.push(
      completionProvider,
      definitionProvider,
      referenceProvider,
      symbolsProvider,
      plan,
      apply,
      planStatusBar,
      applyStatus,
      vscode.workspace.onDidChangeTextDocument(
        e => onTextChangeEvent(e, workspace)
      ),
      vscode.workspace.onDidChangeTextDocument(
        e => onReportErrorsEvent(e, workspace, diagCollection)
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
