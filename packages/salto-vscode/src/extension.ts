import * as vscode from 'vscode'
import { loadConfig } from 'salto'
import { EditorWorkspace } from './salto/workspace'
import { onTextChangeEvent, onFileChange, onFileDelete, onReportErrorsEvent, onFileOpen } from './events'
import {
  createCompletionsProvider, createDefinitionsProvider, createReferenceProvider,
  createDocumentSymbolsProvider,
  createWorkspaceSymbolProvider,
  createFoldingProvider,
} from './providers'
import { previewCommand, deployCommand } from './commands'
import { toVSDiagnostics } from './adapters'
import { getDiagnostics } from './salto/diagnostics'

/**
 * This files act as a bridge between VSC and the salto specific functionality.
 */


const onActivate = async (context: vscode.ExtensionContext): Promise<void> => {
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

    const searchProvier = vscode.languages.registerWorkspaceSymbolProvider(
      createWorkspaceSymbolProvider(workspace)
    )

    const foldProvider = vscode.languages.registerFoldingRangeProvider(
      { scheme: 'file', pattern: { base: rootPath, pattern: '**/*.bp' } },
      createFoldingProvider(workspace)
    )

    const preview = vscode.commands.registerCommand('salto.preview', () => {
      previewCommand(workspace, context.extensionPath)
    })

    const deploy = vscode.commands.registerCommand('salto.deploy', () => {
      deployCommand(workspace, context.extensionPath)
    })

    const previewStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100)
    previewStatusBar.text = 'Salto: Preview'
    previewStatusBar.command = 'salto.preview'
    previewStatusBar.show()

    const deployStatus = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100)
    deployStatus.text = 'Salto: Deploy'
    deployStatus.command = 'salto.deploy'
    deployStatus.show()

    context.subscriptions.push(
      completionProvider,
      definitionProvider,
      referenceProvider,
      symbolsProvider,
      searchProvier,
      foldProvider,
      preview,
      deploy,
      previewStatusBar,
      deployStatus,
      vscode.workspace.onDidChangeTextDocument(
        e => onTextChangeEvent(e, workspace)
      ),
      vscode.workspace.onDidChangeTextDocument(
        e => onReportErrorsEvent(e, workspace, diagCollection)
      ),
      vscode.workspace.onDidOpenTextDocument(onFileOpen)
    )

    const fileWatcher = vscode.workspace.createFileSystemWatcher('**/*.bp')
    fileWatcher.onDidCreate((uri: vscode.Uri) => onFileChange(workspace, uri.fsPath))
    fileWatcher.onDidChange((uri: vscode.Uri) => onFileChange(workspace, uri.fsPath))
    fileWatcher.onDidDelete((uri: vscode.Uri) => onFileDelete(workspace, uri.fsPath))
    const newDiag = toVSDiagnostics(workspace.workspace.config.baseDir, getDiagnostics(workspace))
    diagCollection.set(newDiag)
  }
  // We need this log until the parse time will be shorter so we will know when to expect the plugin
  // to start working.
  // eslint-disable-next-line no-console
  console.log('Workspace init done', new Date())
}

export const activate = async (context: vscode.ExtensionContext): Promise<void> => (
  vscode.window.withProgress({
    location: vscode.ProgressLocation.Window,
    title: 'Initiating salto extension',
  },
  async () => onActivate(context))
)
