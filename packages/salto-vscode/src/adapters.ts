import * as vscode from 'vscode'
import { EditorPosition, PositionContext } from './salto/context'
import { SaltoCompletion } from './salto/completions/provider'
import { createSaltoSymbol, SaltoSymbolKind } from './salto/symbols'

export const saltoPosToVsPos = (
  pos: EditorPosition
): vscode.Position => new vscode.Position(pos.line - 1, pos.col)

export const vsPosToSaltoPos = (pos: vscode.Position): EditorPosition => ({
  line: pos.line + 1,
  col: pos.character,
})

export const buildVSDefinitions = (
  context: PositionContext,
): vscode.DocumentSymbol => {
  const kindMap: {[key in SaltoSymbolKind]: vscode.SymbolKind} = {
    [SaltoSymbolKind.Field]: vscode.SymbolKind.Field,
    [SaltoSymbolKind.Array]: vscode.SymbolKind.Array,
    [SaltoSymbolKind.Type]: vscode.SymbolKind.Class,
    [SaltoSymbolKind.Instance]: vscode.SymbolKind.Variable,
    [SaltoSymbolKind.Annotation]: vscode.SymbolKind.Variable,
    [SaltoSymbolKind.File]: vscode.SymbolKind.File,
    [SaltoSymbolKind.Attribute]: vscode.SymbolKind.Variable,
  }
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
