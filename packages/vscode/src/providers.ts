/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import { provider, context as ctx, token, definitions, usage, workspace as ws, location } from '@salto-io/lang-server'
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import {
  saltoPosToVsPos,
  vsPosToSaltoPos,
  buildVSDefinitions,
  buildVSCompletionItems,
  buildVSSymbol,
  toVSFileName,
  sourceRangeToFoldRange,
} from './adapters'

const { awu } = collections.asynciterable

export const createDocumentSymbolsProvider = (workspace: ws.EditorWorkspace): vscode.DocumentSymbolProvider => ({
  provideDocumentSymbols: async (doc: vscode.TextDocument) => {
    const sourceMap = await workspace.getSourceMap(doc.fileName)
    const elements = await workspace.getElements(doc.fileName)
    if (sourceMap && elements) {
      const defTree = ctx.buildDefinitionsTree(doc.getText(), sourceMap, await awu(elements).toArray())
      return (defTree.children || []).map(c => buildVSDefinitions(c))
    }
    return []
  },
})

// This function is called in order to create a completion provided - and
// bind it to the current workspace
export const createCompletionsProvider = (workspace: ws.EditorWorkspace): vscode.CompletionItemProvider => ({
  provideCompletionItems: async (doc: vscode.TextDocument, position: vscode.Position) => {
    await workspace.awaitAllUpdates()
    const saltoPos = vsPosToSaltoPos(position)
    const definitionsTree = ctx.buildDefinitionsTree(
      (await workspace.getNaclFile(doc.fileName))?.buffer as string,
      await workspace.getSourceMap(doc.fileName),
      await awu(await workspace.getElements(doc.fileName)).toArray(),
    )
    const fullElementSource = await workspace.getElementSourceOfPath(doc.fileName)
    const context = await ctx.getPositionContext(doc.fileName, saltoPos, definitionsTree, fullElementSource)
    const line = doc.lineAt(position).text.substr(0, position.character)
    return buildVSCompletionItems(await provider.provideWorkspaceCompletionItems(workspace, context, line, saltoPos))
  },
})

export const createDefinitionsProvider = (workspace: ws.EditorWorkspace): vscode.DefinitionProvider => ({
  provideDefinition: async (doc: vscode.TextDocument, position: vscode.Position): Promise<vscode.Definition> => {
    const currentToken = token.getToken(doc.getText(), { line: position.line, col: position.character })

    if (_.isUndefined(currentToken)) {
      return []
    }
    const definitionsTree = ctx.buildDefinitionsTree(
      (await workspace.getNaclFile(doc.fileName))?.buffer as string,
      await workspace.getSourceMap(doc.fileName),
      await awu(await workspace.getElements(doc.fileName)).toArray(),
    )
    const fullElementSource = await workspace.getElementSourceOfPath(doc.fileName)
    const context = await ctx.getPositionContext(
      doc.fileName,
      vsPosToSaltoPos(position),
      definitionsTree,
      fullElementSource,
    )
    return (await definitions.provideWorkspaceDefinition(workspace, context, currentToken)).map(
      def =>
        new vscode.Location(
          vscode.Uri.file(path.resolve(workspace.baseDir, def.filename)),
          saltoPosToVsPos(def.range.start),
        ),
    )
  },
})

export const createReferenceProvider = (workspace: ws.EditorWorkspace): vscode.ReferenceProvider => ({
  provideReferences: async (doc: vscode.TextDocument, position: vscode.Position): Promise<vscode.Location[]> => {
    const currentToken = token.getToken(doc.getText(), { line: position.line, col: position.character })

    if (_.isUndefined(currentToken)) {
      return []
    }
    const definitionsTree = ctx.buildDefinitionsTree(
      (await workspace.getNaclFile(doc.fileName))?.buffer as string,
      await workspace.getSourceMap(doc.fileName),
      await awu(await workspace.getElements(doc.fileName)).toArray(),
    )
    const fullElementSource = await workspace.getElementSourceOfPath(doc.fileName)
    const context = await ctx.getPositionContext(
      doc.fileName,
      vsPosToSaltoPos(position),
      definitionsTree,
      fullElementSource,
    )
    return (await usage.provideWorkspaceReferences(workspace, currentToken, context)).map(
      def =>
        new vscode.Location(
          vscode.Uri.file(path.resolve(workspace.baseDir, def.filename)),
          saltoPosToVsPos(def.range.start),
        ),
    )
  },
})

export const createWorkspaceSymbolProvider = (workspace: ws.EditorWorkspace): vscode.WorkspaceSymbolProvider => ({
  provideWorkspaceSymbols: async (query: string): Promise<vscode.SymbolInformation[]> => {
    const locToContext = async (loc: location.SaltoElemLocation): Promise<ctx.PositionContext> =>
      ctx.getPositionContext(
        loc.filename,
        loc.range.start,
        ctx.buildDefinitionsTree(
          (await workspace.getNaclFile(loc.filename))?.buffer as string,
          await workspace.getSourceMap(loc.filename),
          await awu(await workspace.getElements(loc.filename)).toArray(),
        ),
        await workspace.getElementSourceOfPath(loc.filename),
      )

    const fullLocations = _.flatten(
      await Promise.all(
        (await location.getQueryLocationsExactMatch(workspace, query)).map(partial =>
          location.completeSaltoLocation(workspace, partial),
        ),
      ),
    )

    return Promise.all(
      fullLocations.map(async l => buildVSSymbol(await locToContext(l), toVSFileName(workspace.baseDir, l.filename))),
    )
  },
})

export const createFoldingProvider = (workspace: ws.EditorWorkspace): vscode.FoldingRangeProvider => ({
  provideFoldingRanges: async (document: vscode.TextDocument): Promise<vscode.FoldingRange[]> => {
    const sourceMap = await workspace.getSourceMap(document.fileName)
    return wu(sourceMap?.entries() ?? [])
      .map(([name, ranges]) => ranges.map(r => sourceRangeToFoldRange(r, name)))
      .flatten()
      .toArray()
  },
})
