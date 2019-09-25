import * as vscode from 'vscode'
import { provideWorkspaceCompletionItems } from './salto/completions/provider'
import {
  getPositionContext, buildDefinitionsTree,
} from './salto/context'
import { provideWorkspaceDefinition } from './salto/definitions'
import { provideWorkspaceReferences } from './salto/usage'
import {
  saltoPosToVsPos, vsPosToSaltoPos, buildVSDefinitions, buildVSCompletionItems,
} from './adapters'
import { SaltoWorkspace } from './salto/workspace'

export const createDocumentSymbolsProvider = (
  workspace: SaltoWorkspace
): vscode.DocumentSymbolProvider => ({
  provideDocumentSymbols: (
    doc: vscode.TextDocument
  ) => {
    const blueprint = workspace.parsedBlueprints[doc.fileName]
    const defTree = buildDefinitionsTree(workspace, doc.getText(), blueprint)
    return (defTree.children || []).map(c => buildVSDefinitions(c))
  },
})

// This function is called in order to create a completion provided - and
// bind it to the current workspace
export const createCompletionsProvider = (
  workspace: SaltoWorkspace
): vscode.CompletionItemProvider => ({
  provideCompletionItems: async (
    doc: vscode.TextDocument,
    position: vscode.Position
  ) => {
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
    return buildVSCompletionItems(
      provideWorkspaceCompletionItems(workspace, context, line, saltoPos)
    )
  },
})

export const createDefinitionsProvider = (
  workspace: SaltoWorkspace
): vscode.DefinitionProvider => ({
  provideDefinition: (
    doc: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.Definition => {
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

export const createReferenceProvider = (
  workspace: SaltoWorkspace
): vscode.ReferenceProvider => ({
  provideReferences: (
    doc: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.Location[] => {
    const currenToken = doc.getText(doc.getWordRangeAtPosition(position))
    return provideWorkspaceReferences(workspace, currenToken).map(
      def => new vscode.Location(
        vscode.Uri.file(def.filename),
        saltoPosToVsPos(def.range.start)
      )
    )
  },
})
