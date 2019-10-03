import * as vscode from 'vscode'
import { EditorPosition, PositionContext } from './salto/context'
import { SaltoCompletion } from './salto/completions/provider'
import { createSymbol, SymbolKind } from './salto/symbols'

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
  const kindMap: {[key in SymbolKind]: vscode.SymbolKind} = {
    [SymbolKind.Field]: vscode.SymbolKind.Field,
    [SymbolKind.Array]: vscode.SymbolKind.Array,
    [SymbolKind.Type]: vscode.SymbolKind.Class,
    [SymbolKind.Instance]: vscode.SymbolKind.Variable,
    [SymbolKind.Annotation]: vscode.SymbolKind.Variable,
    [SymbolKind.File]: vscode.SymbolKind.File,
    [SymbolKind.Attribute]: vscode.SymbolKind.Variable,
  }
  const saltoSymbol = createSymbol(context)
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
  completion.map(({ label, reInvoke, insertText }) => {
    const item = new vscode.CompletionItem(label)
    item.insertText = new vscode.SnippetString(insertText)
    if (reInvoke) {
      item.command = {
        command: 'editor.action.triggerSuggest',
        title: 'Re-trigger completions',
      }
    }
    return item
  })
)
