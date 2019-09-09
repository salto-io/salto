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

type PositionContextPart = 'body'|'definition'

interface EditorPosition {
  line: number
  col: number
}

interface EditorRange {
  start: EditorPosition
  end: EditorPosition
}

interface ReferencedRange {
  range: EditorRange
  ref: string
}

interface PositionContext {
  parent?: PositionContext
  range: EditorRange
  part: PositionContextPart
  ref?: string
}

const getPositionConextPart = (
  refRange: ReferencedRange, 
  position: EditorPosition
): PositionContextPart => {
  return (position.line === refRange.range.start.line) ? 'definition' : 'body'
}

const buildPositionContext = (
  ranges: ReferencedRange[],
  position: EditorPosition,
  parent?: PositionContext,
): PositionContext => {
  // If ranges are empty - we are not included in any context, so we are in the global scope.
  if (ranges.length == 0) {
    return {
      range: {start: {line: 0, col: 0}, end: {line: Number.MAX_VALUE, col: Number.MAX_VALUE}},
      part: 'body'
    }
  } 

  const refRange = ranges[0]
  const encapsulatedRanges = ranges.slice(1)
  const context = {
    parent,
    range : refRange.range,
    ref : refRange.ref,
    part : getPositionConextPart(refRange, position)
  }

  return (encapsulatedRanges.length > 0) ? 
         buildPositionContext(encapsulatedRanges, position, context) : context
}

const getContext = (
  workspace: SaltoWorkspace, 
  filename: string, 
  position: EditorPosition): PositionContext => {

  const isContained = (inner: EditorRange, outter: EditorRange): boolean => {
    const startsBefore = (outter.start.line !== inner.start.line) ?
          outter.start.line < inner.start.line : outter.start.col <= inner.start.col
    const endsAfter = (outter.end.line !== inner.end.line) ?
          outter.end.line > inner.end.line : outter.end.col >= inner.end.col
    return startsBefore && endsAfter
  }

  const encapluatationComparator = (left: ReferencedRange, right: ReferencedRange): number => {
    if (isContained(left.range, right.range) && isContained(right.range, left.range)) return 0
    if (isContained(left.range, right.range)) return -1
    return 1
  }

  const parsedBlueprints = workspace.parsedBlueprints[filename]
  const cursorRange = { start: position, end: position }


  // We create a list of ReferencedRanges by flattening the sourcemap
  const flatRanges = Object.entries(parsedBlueprints.sourceMap).map(
    ([ref, ranges]) => ranges.map(
      (range: ReferencedRange) => ({ref, range})
    )
  )

  // We created a list of sorted ReferencedRanges which contains the cursor in them
  // and are sorted so that each range contains all of the following ranges in the array
  const encapsulatingRanges = flatRanges.filter(
    r => isContained(cursorRange, r.range)
  ).sort(encapluatationComparator)
  return buildPositionContext(encapsulatingRanges, position)
}

export const debugFunctions: { [key: string] : (workspace: SaltoWorkspace) => void } = {
  'salto.printMergedElementsNames' : (workspace: SaltoWorkspace): void => {
    (workspace.mergedElements || []).forEach(e => console.log(e.elemID.getFullName()))
  },
  'salto.printMergedElementsCount' : (workspace: SaltoWorkspace): void => {
    console.log((workspace.mergedElements || []).length)
  },
  'salto.printErrors' : (workspace: SaltoWorkspace): void => {
    _.keys(workspace.fileErrors).forEach(k => {
      const errors = workspace.fileErrors[k]
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
      console.log("====", getContext(workspace, fn, {line: position.line, col: position.character}))
    }
    else {
      console.log("No active editor :(")
    }
  },
}