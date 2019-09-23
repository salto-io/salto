import * as vscode from 'vscode'
import _ from 'lodash'
import { initWorkspace, updateFile, SaltoWorkspace } from './salto/workspace'
import { provideWorkspaceCompletionItems } from './salto/completions/provider'
import {
  getPositionContext, buildDefinitionsTree, EditorPosition, PositionContext,
} from './salto/context'
import { debugFunctions } from './salto/debug'
import { provideWorkspaceDefinition } from './salto/definitions'
import { provideWorkspaceReferences } from './salto/usage'
/**
 * This files act as a bridge between VSC and the salto specific functionality.
 */

const workspaces: {[key: string]: SaltoWorkspace} = {}

const saltoPosToVsPos = (
  pos: EditorPosition
): vscode.Position => new vscode.Position(pos.line - 1, pos.col)

const vsPosToSaltoPos = (pos: vscode.Position): EditorPosition => ({
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

const getDefName = (context: PositionContext, prefName?: string): string => {
  if (context.ref) {
    if (context.ref.path) {
      return context.ref.path
    }
    const fullName = context.ref.element.elemID.getFullName()
    return (prefName) ? fullName.slice(prefName.length + 1) : fullName
  }
  return 'global'
}

const getDefType = (context: PositionContext): number => {
  if (context.ref && context.ref.isList) return vscode.SymbolKind.Array
  if (context.type === 'field') {
    return (context.ref && context.ref.path) ? vscode.SymbolKind.Variable : vscode.SymbolKind.Field
  }
  if (context.type === 'instance') {
    return (context.ref && context.ref.path) ? vscode.SymbolKind.Variable : vscode.SymbolKind.Variable
  }
  if (context.type === 'type') {
    return (context.ref && context.ref.path) ? vscode.SymbolKind.Variable : vscode.SymbolKind.Class
  }
  return vscode.SymbolKind.File
}

const buildVSDefinitions = (context: PositionContext, prefName?: string): vscode.DocumentSymbol => {
  const name = getDefName(context, prefName)
  const range = new vscode.Range(
    saltoPosToVsPos(context.range.start),
    saltoPosToVsPos(context.range.end)
  )
  const def = new vscode.DocumentSymbol(
    name,
    '',
    getDefType(context),
    range,
    range
  )
  def.children = context.children ? context.children.map(c => buildVSDefinitions(c, name)) : []
  return def
}

const createDocumentSymbolsProvider = (
  workspaceName: string
): vscode.DocumentSymbolProvider => ({
  provideDocumentSymbols: (
    doc: vscode.TextDocument
  ) => {
    const workspace = workspaces[workspaceName]
    const blueprint = workspace.parsedBlueprints[doc.fileName]
    const defTree = buildDefinitionsTree(workspace, doc.getText(), blueprint)
    return (defTree.children || []).map(c => buildVSDefinitions(c))
  },
})

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
    if (workspace.lastUpdate) {
      await workspace.lastUpdate
    }
    const saltoPos = vsPosToSaltoPos(position)
    const context = getPositionContext(
      workspace,
      doc.getText(),
      doc.fileName,
      saltoPos
    )
    const line = doc.lineAt(position).text.substr(0, position.character)
    return provideWorkspaceCompletionItems(workspace, context, line, saltoPos).map(
      ({ label, reInvoke, insertText }) => {
        const item = new vscode.CompletionItem(label)
        item.insertText = new vscode.SnippetString(insertText)
        if (reInvoke) {
          item.command = {
            command: 'editor.action.triggerSuggest',
            title: 'Re-trigger completions',
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
    const context = getPositionContext(
      workspace,
      doc.getText(),
      doc.fileName,
      vsPosToSaltoPos(position)
    )
    const currenToken = doc.getText(doc.getWordRangeAtPosition(position))
    return provideWorkspaceDefinition(workspace, context, currenToken).map(
      def => new vscode.Location(
        vscode.Uri.file(def.filename),
        saltoPosToVsPos(def.range.start)
      )
    )
  },
})

const createReferenceProvider = (
  workspaceName: string
): vscode.ReferenceProvider => ({
  provideReferences: (
    doc: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.Location[] => {
    const workspace = workspaces[workspaceName]
    const currenToken = doc.getText(doc.getWordRangeAtPosition(position))
    return provideWorkspaceReferences(workspace, currenToken).map(
      def => new vscode.Location(
        vscode.Uri.file(def.filename),
        saltoPosToVsPos(def.range.start)
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
      { scheme: 'file', pattern: { base: rootPath, pattern: '**/*.bp' } },
      createCompletionsProvider(name),
      ' '
    )

    const definitionProvider = vscode.languages.registerDefinitionProvider(
      { scheme: 'file', pattern: { base: rootPath, pattern: '**/*.bp' } },
      createDefinitionsProvider(name)
    )

    const referenceProvider = vscode.languages.registerReferenceProvider(
      { scheme: 'file', pattern: { base: rootPath, pattern: '**/*.bp' } },
      createReferenceProvider(name)
    )

    const symbolsProvider = vscode.languages.registerDocumentSymbolProvider(
      { scheme: 'file', pattern: { base: rootPath, pattern: '**/*.bp' } },
      createDocumentSymbolsProvider(name)
    )

    context.subscriptions.push(
      completionProvider,
      definitionProvider,
      referenceProvider,
      symbolsProvider,
      vscode.workspace.onDidChangeConfiguration(e => onDidChangeConfiguration(e, name, settings)),
      vscode.workspace.onDidChangeTextDocument(e => onDidChangeTextDocument(e, name)),
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
