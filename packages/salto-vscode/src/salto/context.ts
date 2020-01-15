import _ from 'lodash'
import wu from 'wu'
import {
  Element, isField, isType, isObjectType, findElement,
} from 'adapter-api'
import { SourceMap } from 'salto'
import { EditorWorkspace } from './workspace'

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
    end: { line: Number.MAX_VALUE, col: Number.MAX_VALUE },
  },
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
  refElements: Element[],
  contextRange: NamedRange
): ContextReference | undefined => {
  // If the range is contained in the element, then the elementID is a prefix of the refName
  const candidates = refElements.filter(e =>
    // using index of and not startsWith for performance
    contextRange.name.indexOf(e.elemID.getFullName()) === 0)
  // Now all we need is to find the element with the longest fullName
  const element = _.maxBy(candidates, e => e.elemID.getFullName().length)
  if (element) {
    const rangeContent = getText(fileContent, contextRange.range)
    const isList = _.last(rangeContent) === ']'
    // The part of the range name which is not in the element name is the path
    const path = contextRange.name.slice(element.elemID.getFullName().length + 1)
    return { element, path, isList }
  }
  return undefined
}

const getPositionContextType = (
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

const flattenBlueprintRanges = (
  sourceMap: SourceMap
): NamedRange[] => wu(sourceMap.entries())
  .map(([name, ranges]) => ranges.map(range => ({ name, range })))
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
  refElements: Element[],
  fileContent: string,
  range: NamedRange,
  encapsulatedRanges: NamedRange[],
  parent?: PositionContext
): PositionContext => {
  const buildChildren = (ranges: NamedRange[]): PositionContext[] => {
    const child = ranges[0]
    const rest = ranges.slice(1)
    const encapsulatedByChild = rest.filter(r => isContained(r.range, child.range))
    const childCtx = buildPositionContext(refElements, fileContent, child, encapsulatedByChild)
    childCtx.children = (childCtx.children || []).map(c => {
      c.parent = childCtx
      return c
    })
    const notEncapsulated = _.without(rest, ...encapsulatedByChild)
    return _.isEmpty(notEncapsulated) ? [childCtx] : [childCtx, ...buildChildren(notEncapsulated)]
  }

  const ref = getContextReference(fileContent, refElements || [], range)
  const context: PositionContext = {
    parent,
    ref,
    range: range.range,
    type: getPositionContextType(ref),
  }
  context.children = _.isEmpty(encapsulatedRanges) ? [] : buildChildren(encapsulatedRanges)
  return context
}

const extractFields = (elements: readonly Element[]): Element[] => (
  _(elements).map(e => (
    (isObjectType(e)) ? [..._.values(e.fields), e] : [e]
  )).flatten().value()
)

export const buildDefinitionsTree = (
  fileContent: string,
  sourceMap: SourceMap,
  elements: ReadonlyArray<Element>,
): PositionContext => {
  const startPosComparator = (left: NamedRange, right: NamedRange): number => (
    (left.range.start.line === right.range.start.line)
      ? left.range.start.col - right.range.start.col
      : left.range.start.line - right.range.start.line
  )

  return buildPositionContext(
    extractFields(elements),
    fileContent,
    GLOBAL_RANGE,
    flattenBlueprintRanges(sourceMap).sort(startPosComparator)
  )
}

const getFullElement = (elements: ReadonlyArray<Element>, partial: Element): Element => {
  const fullElement = findElement(extractFields(elements || []), partial.elemID)
  return fullElement || partial
}

const getPositionFromTree = (
  treeBase: PositionContext,
  position: EditorPosition
): PositionContext => {
  const range = { start: position, end: position }
  const [nextBase] = (treeBase.children || []).filter(child => isContained(range, child.range))
  return (nextBase) ? getPositionFromTree(nextBase, position) : treeBase
}

export const getPositionContext = async (
  workspace: EditorWorkspace,
  filename: string,
  position: EditorPosition
): Promise<PositionContext> => {
  const definitionsTree = buildDefinitionsTree(
    // TODO: check what to do if buffer is undefined
    (await workspace.getBlueprint(filename))?.buffer as string,
    await workspace.getSourceMap(filename),
    await workspace.getElements(filename),
  )
  const partialContext = getPositionFromTree(definitionsTree, position)
  const fullRef = (partialContext.ref)
    ? { ...partialContext.ref,
      element: getFullElement(await workspace.elements,
        partialContext.ref.element) }
    : undefined
  return { ...partialContext, ref: fullRef }
}
