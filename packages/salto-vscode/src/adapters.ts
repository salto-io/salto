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
import * as path from 'path'
import _ from 'lodash'
import { SourceRange } from 'salto'
import { EditorPosition, PositionContext } from './salto/context'
import { SaltoCompletion } from './salto/completions/provider'
import { createSaltoSymbol, SaltoSymbolKind } from './salto/symbols'
import { SaltoDiagnostic, WorkspaceSaltoDiagnostics } from './salto/diagnostics'

type ReadonlyDiagsItem = [vscode.Uri, ReadonlyArray<vscode.Diagnostic>]
type ReadonlyDiags = ReadonlyArray<ReadonlyDiagsItem>

export const saltoPosToVsPos = (
  pos: EditorPosition
): vscode.Position => new vscode.Position(pos.line - 1, pos.col)

export const vsPosToSaltoPos = (pos: vscode.Position): EditorPosition => ({
  line: pos.line + 1,
  col: pos.character,
})

const AUTO_FOLD_ELEMENT_NAMES = ['fieldLevelSecurity']

const kindMap: {[key in SaltoSymbolKind]: vscode.SymbolKind} = {
  [SaltoSymbolKind.Field]: vscode.SymbolKind.Field,
  [SaltoSymbolKind.Array]: vscode.SymbolKind.Array,
  [SaltoSymbolKind.Type]: vscode.SymbolKind.Class,
  [SaltoSymbolKind.Instance]: vscode.SymbolKind.Variable,
  [SaltoSymbolKind.Annotation]: vscode.SymbolKind.Variable,
  [SaltoSymbolKind.File]: vscode.SymbolKind.File,
  [SaltoSymbolKind.Attribute]: vscode.SymbolKind.Variable,
}

export const buildVSSymbol = (
  context: PositionContext,
  filename: string
): vscode.SymbolInformation => {
  const saltoSymbol = createSaltoSymbol(context)
  return {
    kind: kindMap[saltoSymbol.type],
    location: {
      range: new vscode.Range(
        saltoPosToVsPos(saltoSymbol.range.start),
        saltoPosToVsPos(saltoSymbol.range.end)
      ),
      uri: vscode.Uri.file(filename),
    },
    name: saltoSymbol.name,
    containerName: context.parent
      ? createSaltoSymbol(context.parent).name
      : '',
  }
}

export const buildVSDefinitions = (
  context: PositionContext,
): vscode.DocumentSymbol => {
  const saltoSymbol = createSaltoSymbol(context)
  const range = new vscode.Range(
    saltoPosToVsPos(saltoSymbol.range.start),
    saltoPosToVsPos(saltoSymbol.range.end)
  )
  const vsSymbol = new vscode.DocumentSymbol(
    saltoSymbol.name,
    '',
    kindMap[saltoSymbol.type],
    range,
    range
  )
  vsSymbol.children = context.children
    ? context.children.map(buildVSDefinitions)
    : []
  return vsSymbol
}

export const buildVSCompletionItems = (
  completion: SaltoCompletion[]
): vscode.CompletionItem[] => (
  completion.map(({
    label, reInvoke, insertText, filterText,
  }) => {
    const item = new vscode.CompletionItem(label)
    item.insertText = new vscode.SnippetString(insertText)
    item.filterText = filterText
    if (reInvoke) {
      item.command = {
        command: 'editor.action.triggerSuggest',
        title: 'Re-trigger completions',
      }
    }
    return item
  })
)

export const toVSFileName = (
  workspaceBaseDir: string,
  filename: string
): string => path.resolve(workspaceBaseDir, filename)

const toVSDiagnostic = (
  diag: SaltoDiagnostic
): vscode.Diagnostic => ({
  message: diag.msg,
  severity: diag.severity === 'Error'
    ? vscode.DiagnosticSeverity.Error
    : vscode.DiagnosticSeverity.Warning,
  range: new vscode.Range(
    saltoPosToVsPos({ col: diag.range.start.col - 1, line: diag.range.start.line }),
    saltoPosToVsPos(diag.range.end)
  ),
})

export const toVSDiagnostics = (
  workspaceBaseDir: string,
  workspaceDiag: WorkspaceSaltoDiagnostics
): ReadonlyDiags => _(workspaceDiag)
  .mapValues(diags => diags.map(toVSDiagnostic))
  .entries()
  .map(([k, v]) => [vscode.Uri.file(toVSFileName(workspaceBaseDir, k)), v] as ReadonlyDiagsItem)
  .value()

export const sourceRangeToFoldRange = (
  range: SourceRange,
  name: string
): vscode.FoldingRange => new vscode.FoldingRange(
  range.start.line - 1,
  range.end.line - 1,
  _.some(AUTO_FOLD_ELEMENT_NAMES.map(autoFoldName => name.indexOf(autoFoldName) >= 0))
    ? vscode.FoldingRangeKind.Region
    : undefined
)
