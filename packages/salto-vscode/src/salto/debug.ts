/* eslint-disable */
import _ from 'lodash'
import * as vscode from 'vscode'
import { SaltoWorkspace } from './workspace'
import { getPositionContext, PositionContext} from './context'
/**
 * This file is used in order to quickly create debug functions on the loaded
 * workspace. Just add them to the map below, and to package.json. 
 *
 * Run the commands by pressing shift+command+p and searching for the name
 * added in package.json.
 *
 * This file is not coverd by tests or lints as it should only be used for
 * quick debuging (without it, debuging can be a bit annoying in vscode)
 *
 * TODO - Should we exclude this file from the final build when created?
 */

type LineType = 'instance_def'|'type_def'|'field_def'|'attr'|'na'

const getLineTokens = (line: string): string[] => line.split(' ').filter(c => c.length > 0)

const getFullLine = (doc: vscode.TextDocument, position: vscode.Position): string => {
  return doc.lineAt(position).text.substr(0, position.character)
}

const getLineType = (context: PositionContext, lineTokens: string[]): LineType => {
  if (context.type === 'type' && context.part === 'definition') {
    return 'type_def'
  }
  if (context.type === 'type' && context.part === 'body') {
    return (context.ref && context.ref.path.length > 0) ? 'attr' : 'field_def'
  }
  if (context.type === 'field' && context.part === 'definition') {
    return 'field_def'
  }
  if (context.type === 'field' && context.part === 'body') {
    return 'attr'
  }
  if (context.type === 'instance' && context.part === 'definition') {
    return 'instance_def'
  }
  if (context.type === 'instance' && context.part === 'body') {
    return 'attr'
  }
  // If we reached this point we are in global scope, which means that
  // either we are in one of the following:
  // - a parital type def line
  if (lineTokens[0] === 'type') {
    return 'type_def'
  } 
  // - a parital instance def line (or a undefined line not handle right now)
  if (lineTokens.length > 0) {
    return 'instance_def'
  }
  // - empty line 
  return 'na'
}

const provideWorkspaceCompletionItems = (
    workspace: SaltoWorkspace,
    doc: vscode.TextDocument, 
    position: vscode.Position, 
): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> => {
    const context = getPositionContext(workspace, doc.fileName, {
      line: position.line + 1,
      col: position.character
    })
    const line = getFullLine(doc, position)
    const lineTokens = getLineTokens(line) 
    const lineType = getLineType(context, lineTokens)
    console.log(context, lineTokens, lineType, "\n=====")
    return [new vscode.CompletionItem(lineType)]
}

export const createProvider = (
  workspace: SaltoWorkspace
): vscode.CompletionItemProvider => ({
  provideCompletionItems : (
    doc: vscode.TextDocument, 
    position: vscode.Position
  ) => {return provideWorkspaceCompletionItems(workspace, doc, position)}
})

export const debugFunctions: { [key: string] : (workspace: SaltoWorkspace) => void } = {
  'salto.printMergedElementsNames' : (workspace: SaltoWorkspace): void => {
    (workspace.mergedElements || []).forEach(e => console.log(e.elemID.getFullName()))
  },
  'salto.printMergedElementsCount' : (workspace: SaltoWorkspace): void => {
    console.log((workspace.mergedElements || []).length)
  },
  'salto.printErrors' : (workspace: SaltoWorkspace): void => {
    if (workspace.generalErrors.length > 0) {
      console.log("========= General =======")
      console.log(workspace.generalErrors.join("\n"))
    }
    _.keys(workspace.parsedBlueprints).forEach(k => {
      const errors = workspace.parsedBlueprints[k].errors
      if (errors.length > 0) {
        console.log(`======== ${k} =========`)
        console.log(errors.join("\n"))
      }
    })
    console.log("RR")
  },
  'salto.getCursorContext' : (workspace: SaltoWorkspace): void => {
    const editor = vscode.window.activeTextEditor
    if (editor) {
      const position = editor.selection.active
      const ctx = getPositionContext(workspace, editor.document.fileName, {line: position.line + 1, col: position.character})
      console.log("------", ctx)
    }
    else {
      console.log("No active editor :(")
    }
  },
}