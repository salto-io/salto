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
import * as path from 'path'
import _ from 'lodash'
import { parser } from '@salto-io/parser'
import { context as ctx, provider, symbols, diagnostics } from '@salto-io/lang-server'

type ReadonlyDiagsItem = [vscode.Uri, ReadonlyArray<vscode.Diagnostic>]
type ReadonlyDiags = ReadonlyArray<ReadonlyDiagsItem>

export const saltoPosToVsPos = (pos: ctx.EditorPosition): vscode.Position =>
  new vscode.Position(pos.line - 1, pos.col - 1)

export const vsPosToSaltoPos = (pos: vscode.Position): ctx.EditorPosition => ({
  line: pos.line + 1,
  col: pos.character + 1,
})

const AUTO_FOLD_ELEMENT_NAMES: string[] = []

const kindMap: { [key in symbols.SaltoSymbolKind]: vscode.SymbolKind } = {
  [symbols.SaltoSymbolKind.Field]: vscode.SymbolKind.Field,
  [symbols.SaltoSymbolKind.Array]: vscode.SymbolKind.Array,
  [symbols.SaltoSymbolKind.Type]: vscode.SymbolKind.Class,
  [symbols.SaltoSymbolKind.Instance]: vscode.SymbolKind.Variable,
  [symbols.SaltoSymbolKind.Annotation]: vscode.SymbolKind.Variable,
  [symbols.SaltoSymbolKind.File]: vscode.SymbolKind.File,
  [symbols.SaltoSymbolKind.Attribute]: vscode.SymbolKind.Variable,
}

export const buildVSSymbol = (context: ctx.PositionContext, filename: string): vscode.SymbolInformation => {
  const saltoSymbol = symbols.createSaltoSymbol(context, true)
  return {
    kind: kindMap[saltoSymbol.type],
    location: {
      range: new vscode.Range(saltoPosToVsPos(saltoSymbol.range.start), saltoPosToVsPos(saltoSymbol.range.end)),
      uri: vscode.Uri.file(filename),
    },
    name: saltoSymbol.name,
    containerName: context.parent ? symbols.createSaltoSymbol(context.parent, true).name : '',
  }
}

export const buildVSDefinitions = (context: ctx.PositionContext): vscode.DocumentSymbol => {
  const saltoSymbol = symbols.createSaltoSymbol(context)
  const range = new vscode.Range(saltoPosToVsPos(saltoSymbol.range.start), saltoPosToVsPos(saltoSymbol.range.end))
  const vsSymbol = new vscode.DocumentSymbol(saltoSymbol.name, '', kindMap[saltoSymbol.type], range, range)
  vsSymbol.children = context.children ? context.children.map(buildVSDefinitions) : []
  return vsSymbol
}

export const buildVSCompletionItems = (completion: provider.SaltoCompletion[]): vscode.CompletionItem[] =>
  completion.map(({ label, insertText, filterText }) => {
    const item = new vscode.CompletionItem(label)
    item.insertText = new vscode.SnippetString(insertText)
    item.filterText = filterText
    return item
  })

export const toVSFileName = (workspaceBaseDir: string, filename: string): string =>
  path.resolve(workspaceBaseDir, filename)

const toVSDiagnostic = (diag: diagnostics.SaltoDiagnostic): vscode.Diagnostic => ({
  message: diag.msg,
  severity: diag.severity === 'Error' ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning,
  range: new vscode.Range(
    saltoPosToVsPos({ col: diag.range.start.col, line: diag.range.start.line }),
    saltoPosToVsPos(diag.range.end),
  ),
})

export const toVSDiagnostics = (
  workspaceBaseDir: string,
  workspaceDiag: diagnostics.WorkspaceSaltoDiagnostics,
): ReadonlyDiags =>
  _(workspaceDiag.errors)
    .mapValues(diags => diags.map(toVSDiagnostic))
    .entries()
    .map(([k, v]) => [vscode.Uri.file(toVSFileName(workspaceBaseDir, k)), v] as ReadonlyDiagsItem)
    .value()

export const sourceRangeToFoldRange = (range: parser.SourceRange, name: string): vscode.FoldingRange =>
  new vscode.FoldingRange(
    range.start.line - 1,
    range.end.line - 1,
    _.some(AUTO_FOLD_ELEMENT_NAMES.map(autoFoldName => name.indexOf(autoFoldName) >= 0))
      ? vscode.FoldingRangeKind.Region
      : undefined,
  )
