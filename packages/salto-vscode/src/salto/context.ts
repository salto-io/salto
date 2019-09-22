import _ from 'lodash'
import wu from 'wu'
import {
  Element, isField, isType, isObjectType
} from 'adapter-api'
import { ParsedBlueprint } from 'salto'
import { SaltoWorkspace } from './workspace'

type PositionContextType = 'global'|'instance'|'type'|'field'

export interface EditorPosition {
  line: number
  col: number
}

export interface EditorRange {
  start: EditorPosition
  end: EditorPosition
}

interface NamedRange {
  range: EditorRange
  name: string
}

export interface ContextReference {
  element: Element
  path: string
  isList: boolean
}

export interface PositionContext {
  range: EditorRange
  type: PositionContextType
  ref?: ContextReference
  parent?: PositionContext
  children?: PositionContext[]
}

const GLOBAL_RANGE: NamedRange = {
  name: 'global',
  range: {
    start: { line: 0, col: 0 },
    end: { line: Number.MAX_VALUE, col: Number.MAX_VALUE }
  }
}

const getText = (content: string, range: EditorRange): string => {
  const rangeLines = content.split('\n').slice(range.start.line - 1, range.end.line)
  return [
    rangeLines[0].slice(range.start.col - 1),
    ...rangeLines.slice(1, rangeLines.length - 1),
    rangeLines[rangeLines.length - 1].slice(0, range.end.col),
  ].join('\n')
}

// Creates the reference for the context by locating the element with the smallest
// scope in which contains the ref, and its internal path
const getContextReference = (
  fileContent: string,
  mergedElements: Element[],
  contextRange: NamedRange
): ContextReference | undefined => {
  // The context can be a type, field, or instance. fields are not a part of the mergedElements
  // array so we need to extract them out.
  const elementAndFields = _.reduce(mergedElements,
    (acc, e) => (isObjectType(e) ? [...acc, ..._.values(e.fields), e] : [...acc, e]),
    [] as Element[])
  // If the range is contained in the element, then the elementID is a prefix of the refName
  const candidates = elementAndFields.filter(e =>
    contextRange.name.startsWith(e.elemID.getFullName()))

  // Now all we need is to find the element with the longest fullName
  const element = _.maxBy(candidates, e => e.elemID.getFullName().length)
  if (element) {
    const rangeContext = getText(fileContent, contextRange.range)
    const isList = rangeContext[0] === '['
    // The part of the range name which is not in the element name is the path
    const path = contextRange.name.slice(element.elemID.getFullName().length + 1)
    return { element, path, isList }
  }
  return undefined
}

// const getPositionConextPart = (
//   contextRange: NamedRange,
//   position: EditorPosition,
//   ref?: ContextReference
// ): PositionContextPart => {
//   if (ref && ref.path.length > 0) {
//     return 'body'
//   }
//   return (position.line === contextRange.range.start.line) ? 'definition' : 'body'
// }

const getPositionConextType = (
  ref?: ContextReference
): PositionContextType => {
  if (!ref) {
    return 'global'
  }
  if (isType(ref.element)) {
    return 'type'
  }
  if (isField(ref.element)) {
    return 'field'
  }
  return 'instance'
}

// Recursivally builds a context from an array of ranges.
// Note - we build from the out in since we need the outer contexts
// to create the context, but return the inner most context (with links to
// the outer contexts via the parent attr) since we mostly need it.

// const buildPositionContext = (
//   workspace: SaltoWorkspace,
//   fileContent: string,
//   ranges: NamedRange[],
//   position: EditorPosition,
//   parent: PositionContext = GLOBAL_CONTEXT,
// ): PositionContext => {
//   if (ranges.length === 0) {
//     return parent
//   }

//   const range = ranges[0]
//   const encapsulatedRanges = ranges.slice(1)
//   const ref = getContextReference(fileContent, workspace.mergedElements || [], range)
//   const context = {
//     parent,
//     ref,
//     range: range.range,
//     part: getPositionConextPart(range, position, ref),
//     type: getPositionConextType(ref),
//   }

//   return (encapsulatedRanges.length > 0)
//     ? buildPositionContext(workspace, fileContent, encapsulatedRanges, position, context) : context
// }

const flattenBlueprintRanges = (
  parsedBlueprint: ParsedBlueprint
): NamedRange[] => wu(parsedBlueprint.sourceMap.entries())
  .map(([name, ranges]) => ranges.map(range => ({name, range})))
  .flatten()
  .toArray()

const isContained = (inner: EditorRange, outter: EditorRange): boolean => {
  const startsBefore = (outter.start.line !== inner.start.line)
    ? outter.start.line < inner.start.line : outter.start.col <= inner.start.col
  const endsAfter = (outter.end.line !== inner.end.line)
    ? outter.end.line > inner.end.line : outter.end.col >= inner.end.col
  return startsBefore && endsAfter
}

const buildPositionContext = (
  workspace: SaltoWorkspace,
  fileContent: string,
  range: NamedRange,
  encapsulatedRanges: NamedRange[],
  parent?: PositionContext
): PositionContext => {

  const buildChildren = (ranges: NamedRange[]): PositionContext[] => {
    const child = ranges[0]
    const rest = ranges.slice(1)
    const encapsulatedByChild =  rest.filter(r => isContained(r.range, child.range))
    const childCtx = buildPositionContext(workspace, fileContent, child, encapsulatedByChild, parent)
    const notEncapsulated = _.without(rest, ...encapsulatedByChild)
    return _.isEmpty(notEncapsulated) ? [childCtx] : [childCtx, ... buildChildren(notEncapsulated)]
  }

  const range = ranges[0]
  const encapsulatedRanges = ranges.slice(1)
  const ref = getContextReference(fileContent, workspace.mergedElements || [], range)
  const context = {
    parent,
    ref,
    range: range.range,
    type: getPositionConextType(ref),
  }
  context.children = _.isEmpty(encapsulatedRanges) ? [] : buildChildren(encapsulatedRanges)
  return context
}



export const buildDefinitionsTree = (
  workspace: SaltoWorkspace,
  fileContent: string,
  parsedBlueprint: ParsedBlueprint
): PositionContext => {

  const startPosComparator = (left: NamedRange, right: NamedRange): number => (
    (left.range.start.line === right.range.start.line) ?  
      left.range.start.col - right.range.start.col :
      left.range.start.line - right.range.start.line
  )

  return buildPositionContext(
    workspace,
    fileContent,
    GLOBAL_RANGE,
    flattenBlueprintRanges(parsedBlueprint).sort(startPosComparator)
  )
}

const getPositionFromTree = (
  treeBase: PositionContext, 
  position: EditorPosition
): PositionContext => {
  const range = {start: position, end: position}
  const [nextBase] = (treeBase.children || []).filter(child => isContained(child.range, range))
  return (nextBase) ? getPositionFromTree(nextBase, position) : treeBase
}

export const getPositionContext = (
  workspace: SaltoWorkspace,
  fileContent: string,
  filename: string,
  position: EditorPosition
): PositionContext => {
  const parsedBlueprint = workspace.parsedBlueprints[filename]
  const definitionsTree = buildDefinitionsTree(workspace, fileContent, parsedBlueprint)
  return getPositionFromTree(definitionsTree, position)
}
