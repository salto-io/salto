/*
*                      Copyright 2020 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
import * as vscode from 'vscode'
import path from 'path'
import wu from 'wu'
import { provider, context as ctx, definitions,
  usage, workspace as ws, location } from '@salto-io/editor'
import {
  saltoPosToVsPos, vsPosToSaltoPos, buildVSDefinitions, buildVSCompletionItems,
  buildVSSymbol, toVSFileName, sourceRangeToFoldRange,
} from './adapters'

export const createDocumentSymbolsProvider = (
  workspace: ws.EditorWorkspace
): vscode.DocumentSymbolProvider => ({
  provideDocumentSymbols: async (
    doc: vscode.TextDocument
  ) => {
    const sourceMap = await workspace.getSourceMap(doc.fileName)
    const elements = await workspace.getElements(doc.fileName)
    if (sourceMap && elements) {
      const defTree = ctx.buildDefinitionsTree(doc.getText(), sourceMap, elements)
      return (defTree.children || []).map(c => buildVSDefinitions(c))
    }
    return []
  },
})

// This function is called in order to create a completion provided - and
// bind it to the current workspace
export const createCompletionsProvider = (
  workspace: ws.EditorWorkspace
): vscode.CompletionItemProvider => ({
  provideCompletionItems: async (
    doc: vscode.TextDocument,
    position: vscode.Position
  ) => {
    await workspace.awaitAllUpdates()
    const saltoPos = vsPosToSaltoPos(position)
    const context = await ctx.getPositionContext(
      workspace,
      doc.fileName,
      saltoPos
    )
    const line = doc.lineAt(position).text.substr(0, position.character)
    return buildVSCompletionItems(
      await provider.provideWorkspaceCompletionItems(workspace, context, line, saltoPos)
    )
  },
})

export const createDefinitionsProvider = (
  workspace: ws.EditorWorkspace
): vscode.DefinitionProvider => ({
  provideDefinition: async (
    doc: vscode.TextDocument,
    position: vscode.Position,
  ): Promise<vscode.Definition> => {
    const currentToken = doc.getText(doc.getWordRangeAtPosition(position, /[\w.]+/))
    const context = await ctx.getPositionContext(
      workspace,
      doc.fileName,
      vsPosToSaltoPos(position)
    )
    return (await definitions.provideWorkspaceDefinition(workspace, context, currentToken)).map(
      def => new vscode.Location(
        vscode.Uri.file(path.resolve(workspace.baseDir, def.filename)),
        saltoPosToVsPos(def.range.start)
      )
    )
  },
})

export const createReferenceProvider = (
  workspace: ws.EditorWorkspace
): vscode.ReferenceProvider => ({
  provideReferences: async (
    doc: vscode.TextDocument,
    position: vscode.Position,
  ): Promise<vscode.Location[]> => {
    const currenToken = doc.getText(doc.getWordRangeAtPosition(position, /[\w.]+/))
    const context = await ctx.getPositionContext(
      workspace,
      doc.fileName,
      vsPosToSaltoPos(position)
    )
    return (await usage.provideWorkspaceReferences(workspace, currenToken, context)).map(
      def => new vscode.Location(
        vscode.Uri.file(path.resolve(workspace.baseDir, def.filename)),
        saltoPosToVsPos(def.range.start)
      )
    )
  },
})

export const createWorkspaceSymbolProvider = (
  workspace: ws.EditorWorkspace
): vscode.WorkspaceSymbolProvider => ({
  provideWorkspaceSymbols: async (query: string): Promise<vscode.SymbolInformation[]> => {
    const locToContext = async (loc: location.SaltoElemLocation): Promise<ctx.PositionContext> => (
      ctx.getPositionContext(
        workspace,
        loc.filename,
        loc.range.start
      )
    )
    return Promise.all((await location.getQueryLocations(workspace, query))
      .map(async l => buildVSSymbol(
        await locToContext(l),
        toVSFileName(workspace.baseDir, l.filename)
      )))
  },
})

export const createFoldingProvider = (
  workspace: ws.EditorWorkspace
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
