import * as vscode from 'vscode'
import _ from 'lodash'
import { EditorPosition, PositionContext } from './salto/context'
import { SaltoCompletion } from './salto/completions/provider';

export const saltoPosToVsPos = (
  pos: EditorPosition
): vscode.Position => new vscode.Position(pos.line - 1, pos.col)

export const vsPosToSaltoPos = (pos: vscode.Position): EditorPosition => ({
  line: pos.line + 1,
  col: pos.character,
})

export const buildVSDefinitions = (context: PositionContext, prefName?: string): vscode.DocumentSymbol => {

  const getDefinitionName = (context: PositionContext, prefName?: string): string => {
    if (context.ref) {
      if (context.ref.path) {
        return context.ref.path
      }
      const fullName = context.ref.element.elemID.getFullName()
      return (prefName) ? fullName.slice(prefName.length + 1) : fullName
    }
    return 'global'
  }

  const getDefinitionType = (context: PositionContext): number => {
    if (context.ref && context.ref.isList) return vscode.SymbolKind.Array
    if (context.type === 'field') {
      return (context.ref && context.ref.path) 
        ? vscode.SymbolKind.Variable 
        : vscode.SymbolKind.Field
    }
    if (context.type === 'instance') {
      return (context.ref && context.ref.path)
        ? vscode.SymbolKind.Variable
        : vscode.SymbolKind.Field
    }
    if (context.type === 'type') {
      return (context.ref && context.ref.path) 
        ? vscode.SymbolKind.Variable 
        : vscode.SymbolKind.Class
    }
    return vscode.SymbolKind.File
  }

  const name = getDefinitionName(context, prefName)
  const range = new vscode.Range(
    saltoPosToVsPos(context.range.start),
    saltoPosToVsPos(context.range.end)
  )
  const def = new vscode.DocumentSymbol(
    name,
    '',
    getDefinitionType(context),
    range,
    range
  )
  def.children = context.children 
    ? context.children.map(c => buildVSDefinitions(c, name)) 
    : []
  return def
}

export const buildVSCompletionItems = (completion: SaltoCompletion[]) => (
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