/* eslint-disable */
import _ from 'lodash'
import * as vscode from 'vscode'
import { SaltoWorkspace } from './workspace'
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


//TODO define context Object
//Create context chain
//

type PositionContextPart = 'body'|'definition'

interface EditorPosition {
  line: number
  col: number
}

interface EditorRange {
  start: EditorPosition
  end: EditorRange
}

interface PositionContext {
  parentContext: PositionContext
  range: EditorRange
  part: PositionContextPart
  salto_ref: string
}

const isConatined = (inner: EditorRange, outter: EditorRange): boolean => {
  const startsBefore = (outter.start.line !== inner.start.line) ?
        outter.start.line < inner.start.line : outter.start.col <= inner.start.col
  const endsAfter = (outter.end.line !== inner.end.line) ?
        outter.end.line > inner.end.line : outter.end.col >= inner.end.col
  return startsBefore && endsAfter
}

const getContext = (
  workspace: SaltoWorkspace, 
  filename: string, 
  position: vscode.Position): PositionContext => {

  const encapluatationComparator = (EditorRange: rangeA, EditorRange: rangeB): number => {
    if (isConatined(rangeA, rangeB) && isConatined(rangeB, rangeA)) return 0
    if (isConatined(rangeA, rangeB)) return -1
    return 1
  }
  const parsedBlueprints = workspace.parsedBlueprints[filename]
  const cursorRange = {
    start: {
      line: position.line + 1,
      col: position.charecter,
    },
    end: {
      line: position.line + 1,
      col: position.charecter,
    }
  }

  const encapsulatingRanges = Object.entries(parsedBlueprints.sourceMap).filter( 
    ([_k,v]) => isConatined(cursorRange, v) //TODO, CHANGE TO LIST, RENAME VARS
  ).sort(encapluatationComparator)


  return JSON.stringify(candidates.map(([k, _v]) => k))
}

export const debugFunctions: { [key: string] : (workspace: SaltoWorkspace) => void } = {
  'salto.printMergedElementsNames' : (workspace: SaltoWorkspace): void => {
    (workspace.mergedElements || []).forEach(e => console.log(e.elemID.getFullName()))
  },
  'salto.printMergedElementsCount' : (workspace: SaltoWorkspace): void => {
    console.log((workspace.mergedElements || []).length)
  },
  'salto.printErrors' : (workspace: SaltoWorkspace): void => {
    _.keys(workspace.parsedBlueprints).forEach(k => {
      const errors = workspace.parsedBlueprints[k].errors
      if (errors.length > 0) {
        console.log(`======== ${k} =========`)
        console.log(errors.join("\n"))
      }
    })
  },
  'salto.getCursorContext' : (workspace: SaltoWorkspace): void => {
    const editor = vscode.window.activeTextEditor
    if (editor) {
      const position = editor.selection.active
      console.log("Curor at:::::=>", position)
      const fn = editor.document.fileName
      console.log("====", getContext(workspace, fn, position))
    }
    else {
      console.log("No active editor :(")
    }
  },
}