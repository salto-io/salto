import * as vscode from 'vscode'
import path from 'path'
import { provideWorkspaceCompletionItems } from './salto/completions/provider'
import {
  buildDefinitionsTree, getPositionContext,
} from './salto/context'
import { provideWorkspaceDefinition } from './salto/definitions'
import { provideWorkspaceReferences } from './salto/usage'
import {
  saltoPosToVsPos, vsPosToSaltoPos, buildVSDefinitions, buildVSCompletionItems,
} from './adapters'
import { EditorWorkspace } from './salto/workspace'

export const createDocumentSymbolsProvider = (
  workspace: EditorWorkspace
): vscode.DocumentSymbolProvider => ({
  provideDocumentSymbols: (
    doc: vscode.TextDocument
  ) => {
    const blueprint = workspace.getParsedBlueprint(doc.fileName)
    const defTree = buildDefinitionsTree(doc.getText(), blueprint)
    return (defTree.children || []).map(c => buildVSDefinitions(c))
  },
})

// This function is called in order to create a completion provided - and
// bind it to the current workspace
export const createCompletionsProvider = (
  workspace: EditorWorkspace
): vscode.CompletionItemProvider => ({
  provideCompletionItems: async (
    doc: vscode.TextDocument,
    position: vscode.Position
  ) => {
    await workspace.awaitAllUpdates()
    const validWorkspace = workspace.getValidCopy()
    if (validWorkspace) {
      const saltoPos = vsPosToSaltoPos(position)
      const context = getPositionContext(
        validWorkspace,
        doc.getText(),
        doc.fileName,
        saltoPos
      )
      const line = doc.lineAt(position).text.substr(0, position.character)
      return buildVSCompletionItems(
        provideWorkspaceCompletionItems(validWorkspace, context, line, saltoPos)
      )
    }
    return []
  },
})

export const createDefinitionsProvider = (
  workspace: EditorWorkspace
): vscode.DefinitionProvider => ({
  provideDefinition: (
    doc: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.Definition => {
    const validWorkspace = workspace.getValidCopy()
    if (validWorkspace) {
      const currenToken = doc.getText(doc.getWordRangeAtPosition(position))
      const context = getPositionContext(
        validWorkspace,
        doc.getText(),
        doc.fileName,
        vsPosToSaltoPos(position)
      )
      return provideWorkspaceDefinition(validWorkspace, context, currenToken).map(
        def => new vscode.Location(
          vscode.Uri.file(path.resolve(workspace.baseDir, def.filename)),
          saltoPosToVsPos(def.range.start)
        )
      )
    }
    return []
  },
})

export const createReferenceProvider = (
  workspace: EditorWorkspace
): vscode.ReferenceProvider => ({
  provideReferences: (
    doc: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.Location[] => {
    const currenToken = doc.getText(doc.getWordRangeAtPosition(position))
    return provideWorkspaceReferences(workspace, currenToken).map(
      def => new vscode.Location(
        vscode.Uri.file(path.resolve(workspace.baseDir, def.filename)),
        saltoPosToVsPos(def.range.start)
      )
    )
  },
})
