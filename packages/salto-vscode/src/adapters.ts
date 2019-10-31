import * as vscode from 'vscode'
import * as path from 'path'
import _ from 'lodash'
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
  context: PositionContext
): vscode.SymbolInformation => {
  const saltoSymbol = createSaltoSymbol(context)
  return {
    kind : kindMap[saltoSymbol.type],
    location : saltoPosToVsPos(saltoSymbol.range.start),
    
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

const toVSDiagnostic = (
  diag: SaltoDiagnostic
): vscode.Diagnostic => ({
  message: diag.msg,
  severity: vscode.DiagnosticSeverity.Error,
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
  .map(([k, v]) => [vscode.Uri.file(path.resolve(workspaceBaseDir, k)), v] as ReadonlyDiagsItem)
  .value()
