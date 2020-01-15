import * as vscode from 'vscode'
import path from 'path'
import wu from 'wu'
import { provideWorkspaceCompletionItems } from './salto/completions/provider'
import {
  buildDefinitionsTree, getPositionContext, PositionContext,
} from './salto/context'
import { provideWorkspaceDefinition } from './salto/definitions'
import { provideWorkspaceReferences } from './salto/usage'
import {
  saltoPosToVsPos, vsPosToSaltoPos, buildVSDefinitions, buildVSCompletionItems,
  buildVSSymbol, toVSFileName, sourceRangeToFoldRange,
} from './adapters'
import { EditorWorkspace } from './salto/workspace'
import { getQueryLocations, SaltoElemLocation } from './salto/location'

export const createDocumentSymbolsProvider = (
  workspace: EditorWorkspace
): vscode.DocumentSymbolProvider => ({
  provideDocumentSymbols: async (
    doc: vscode.TextDocument
  ) => {
    const sourceMap = await workspace.getSourceMap(doc.fileName)
    const elements = await workspace.getElements(doc.fileName)
    if (sourceMap && elements) {
      const defTree = buildDefinitionsTree(doc.getText(), sourceMap, elements)
      return (defTree.children || []).map(c => buildVSDefinitions(c))
    }
    return []
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
      const context = await getPositionContext(
        validWorkspace,
        doc.fileName,
        saltoPos
      )
      const line = doc.lineAt(position).text.substr(0, position.character)
      return buildVSCompletionItems(
        await provideWorkspaceCompletionItems(validWorkspace, context, line, saltoPos)
      )
    }
    return []
  },
})

export const createDefinitionsProvider = (
  workspace: EditorWorkspace
): vscode.DefinitionProvider => ({
  provideDefinition: async (
    doc: vscode.TextDocument,
    position: vscode.Position,
  ): Promise<vscode.Definition> => {
    const validWorkspace = workspace.getValidCopy()
    if (validWorkspace) {
      const currentToken = doc.getText(doc.getWordRangeAtPosition(position))
      const context = await getPositionContext(
        validWorkspace,
        doc.fileName,
        vsPosToSaltoPos(position)
      )
      return (await provideWorkspaceDefinition(validWorkspace, context, currentToken)).map(
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
  provideReferences: async (
    doc: vscode.TextDocument,
    position: vscode.Position,
  ): Promise<vscode.Location[]> => {
    const currenToken = doc.getText(doc.getWordRangeAtPosition(position))
    return (await provideWorkspaceReferences(workspace, currenToken)).map(
      def => new vscode.Location(
        vscode.Uri.file(path.resolve(workspace.baseDir, def.filename)),
        saltoPosToVsPos(def.range.start)
      )
    )
  },
})

export const createWorkspaceSymbolProvider = (
  workspace: EditorWorkspace
): vscode.WorkspaceSymbolProvider => ({
  provideWorkspaceSymbols: async (query: string): Promise<vscode.SymbolInformation[]> => {
    const locToContext = async (loc: SaltoElemLocation): Promise<PositionContext> => (
      getPositionContext(
        workspace,
        loc.filename,
        loc.range.start
      )
    )
    return Promise.all((await getQueryLocations(workspace, query))
      .map(async l => buildVSSymbol(
        await locToContext(l),
        toVSFileName(workspace.baseDir, l.filename)
      )))
  },
})

export const createFoldingProvider = (
  workspace: EditorWorkspace
): vscode.FoldingRangeProvider => ({
  provideFoldingRanges: async (
    document: vscode.TextDocument,
  ): Promise<vscode.FoldingRange[]> => {
    const sourceMap = await workspace.getSourceMap(document.fileName)
    return wu(sourceMap?.entries() ?? [])
      .map(([name, ranges]) => ranges.map(r => sourceRangeToFoldRange(r, name)))
      .flatten()
      .toArray()
  },
})
