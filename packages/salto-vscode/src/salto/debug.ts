/* eslint-disable */
import _ from 'lodash'
import * as vscode from 'vscode'
import { SaltoWorkspace } from './workspace'
import { getPositionContext } from './context'
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
      const ctx = getPositionContext(workspace, editor.document.getText(), editor.document.fileName, {line: position.line + 1, col: position.character})
      console.log("------", ctx)
    }
    else {
      console.log("No active editor :(")
    }
  },
}