import _ from 'lodash'
import wu from 'wu'
import {
  Element, isField, isType, isObjectType,
} from 'adapter-api'
import { SaltoWorkspace } from './workspace'

type PositionContextPart = 'body'|'definition'
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
}

export interface PositionContext {
  range: EditorRange
  part: PositionContextPart
  type: PositionContextType
  ref?: ContextReference
  parent?: PositionContext
}

const GLOBAL_CONTEXT: PositionContext = {
  range: {
    start: { line: 0, col: 0 },
    end: { line: Number.MAX_VALUE, col: Number.MAX_VALUE },
  },
  part: 'body',
  type: 'global',
}


// Creates the reference for the context by locating the element with the smallest
// scope in which contains the ref, and its internal path
const getContextReference = (
  mergedElements: Element[],
  rangeName: string
): ContextReference | undefined => {
  // The context can be a type, field, or instance. fields are not a part of the mergedElements
  // array so we need to extract them out.
  const elementAndFields = _.reduce(mergedElements,
    (acc, e) => (isObjectType(e) ? [...acc, ..._.values(e.fields), e] : [...acc, e]),
    [] as Element[])

  // If the range is contained in the element, then the elementID is a prefix of the refName
  const candidates = elementAndFields.filter(e => rangeName.startsWith(e.elemID.getFullName()))

  // Now all we need is to find the element with the longest fullName
  const element = _.maxBy(candidates, e => e.elemID.getFullName().length)
  if (element) {
    // The part of the range rangeName which is not in the element rangeName is the path
    const path = rangeName.slice(element.elemID.getFullName().length + 1)
    return { element, path }
  }
  return undefined
}

const getPositionConextPart = (
  contextRange: NamedRange,
  position: EditorPosition,
  ref?: ContextReference
): PositionContextPart => {
  if (ref && ref.path.length > 0) {
    return 'body'
  }
  return (position.line === contextRange.range.start.line) ? 'definition' : 'body'
}

const getPositionConextType = (ref?: ContextReference): PositionContextType => {
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
const buildPositionContext = (
  workspace: SaltoWorkspace,
  ranges: NamedRange[],
  position: EditorPosition,
  parent: PositionContext = GLOBAL_CONTEXT,
): PositionContext => {
  if (ranges.length === 0) {
    return parent
  }

  const range = ranges[0]
  const encapsulatedRanges = ranges.slice(1)
  const ref = getContextReference(workspace.mergedElements || [], range.name)
  const context = {
    parent,
    ref,
    range: range.range,
    part: getPositionConextPart(range, position, ref),
    type: getPositionConextType(ref),
  }

  return (encapsulatedRanges.length > 0)
    ? buildPositionContext(workspace, encapsulatedRanges, position, context) : context
}

export const getPositionContext = (
  workspace: SaltoWorkspace,
  filename: string,
  position: EditorPosition
): PositionContext => {
  const isContained = (inner: EditorRange, outter: EditorRange): boolean => {
    const startsBefore = (outter.start.line !== inner.start.line)
      ? outter.start.line < inner.start.line : outter.start.col <= inner.start.col
    const endsAfter = (outter.end.line !== inner.end.line)
      ? outter.end.line > inner.end.line : outter.end.col >= inner.end.col
    return startsBefore && endsAfter
  }

  // A sorter for position contexts. Sorts by containment.
  const encapsulationComparator = (left: NamedRange, right: NamedRange): number => {
    if (isContained(left.range, right.range) && isContained(right.range, left.range)) return 0
    if (isContained(left.range, right.range)) return 1
    return -1
  }

  const parsedBlueprint = workspace.parsedBlueprints[filename]
  const cursorRange = { start: position, end: position }

  const flatRanges = _.flatten(
    wu(parsedBlueprint.sourceMap.keys()).toArray().map(name =>
      parsedBlueprint.sourceMap.get(name).map(range => ({ name, range })))
  )

  // We created a list of sorted NamedRanges which contains the cursor in them
  // and are sorted so that each range contains all of the following ranges in the array
  const encapsulatingRanges = flatRanges.filter(
    r => isContained(cursorRange, r.range)
  ).sort(encapsulationComparator)
  return buildPositionContext(workspace, encapsulatingRanges, position)
}
