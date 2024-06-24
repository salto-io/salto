/*
 *                      Copyright 2024 Salto Labs Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import _ from 'lodash'
import wu from 'wu'
import { Element, isField, isType, isObjectType, ElemID, ReadOnlyElementsSource } from '@salto-io/adapter-api'
import { resolvePath } from '@salto-io/adapter-utils'
import { parser } from '@salto-io/parser'

type PositionContextType = 'global' | 'instance' | 'type' | 'field'

export interface EditorPosition {
  line: number
  col: number
}

export interface EditorRange {
  start: EditorPosition
  end: EditorPosition
  filePath?: string
}

interface NamedRange {
  range: EditorRange
  name: string
}

export interface ContextReference {
  element: Element
  path: string[]
  isList: boolean
  id: ElemID
}

export interface PositionContext {
  range: EditorRange
  type: PositionContextType
  ref?: ContextReference
  parent?: PositionContext
  children?: PositionContext[]
}

export const GLOBAL_RANGE: NamedRange = {
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
  refElements: Record<string, Element>,
  contextRange: NamedRange,
): ContextReference | undefined => {
  const rangeContent = getText(fileContent, contextRange.range)
  const isList = _.last(rangeContent) === ']' || _.takeRight(rangeContent, 2).join('') === '],'
  const elemID = ElemID.fromFullName(contextRange.name)
  const { parent, path } = elemID.createBaseID()
  const element = refElements[parent.getFullName()]
  if (element) {
    return { element, path: [...path], isList, id: elemID }
  }
  return undefined
}

const getPositionContextType = (ref?: ContextReference): PositionContextType => {
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

const flattenNaclFileRanges = (sourceMap: parser.SourceMap): NamedRange[] =>
  wu(sourceMap.entries())
    .map(([name, ranges]) => ranges.map(range => ({ name, range })))
    .flatten()
    .toArray()

const isContained = (inner: EditorRange, outter: EditorRange): boolean => {
  const startsBefore =
    outter.start.line !== inner.start.line ? outter.start.line < inner.start.line : outter.start.col <= inner.start.col
  const endsAfter =
    outter.end.line !== inner.end.line ? outter.end.line > inner.end.line : outter.end.col >= inner.end.col
  return startsBefore && endsAfter
}

const buildPositionContext = (
  refElements: Record<string, Element>,
  fileContent: string,
  range: NamedRange,
  encapsulatedRanges: NamedRange[],
  parent?: PositionContext,
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

  const ref = getContextReference(fileContent, refElements, range)
  const context: PositionContext = {
    parent,
    ref,
    range: range.range,
    type: getPositionContextType(ref),
  }
  context.children = _.isEmpty(encapsulatedRanges) ? [] : buildChildren(encapsulatedRanges)
  return context
}

const extractFields = (elements: readonly Element[]): Record<string, Element> =>
  _(elements)
    .map(e => (isObjectType(e) ? [..._.values(e.fields), e] : [e]))
    .flatten()
    .keyBy(e => e.elemID.getFullName())
    .value()

export const buildDefinitionsTree = (
  fileContent: string,
  sourceMap: parser.SourceMap,
  elements: ReadonlyArray<Element>,
): PositionContext => {
  const startPosComparator = (left: NamedRange, right: NamedRange): number =>
    left.range.start.line === right.range.start.line
      ? left.range.start.col - right.range.start.col
      : left.range.start.line - right.range.start.line

  return buildPositionContext(
    extractFields(elements),
    fileContent,
    GLOBAL_RANGE,
    flattenNaclFileRanges(sourceMap).sort(startPosComparator),
  )
}

const getFullElement = async (elements: ReadOnlyElementsSource, partial: Element): Promise<Element> => {
  const { parent } = partial.elemID.createTopLevelParentID()
  const topLevelElement = await elements.get(parent)
  return (topLevelElement && resolvePath(topLevelElement, partial.elemID)) || partial
}

const getPositionFromTree = (treeBase: PositionContext, position: EditorPosition): PositionContext => {
  const range = { start: position, end: position }
  const [nextBase] = (treeBase.children || []).filter(child => isContained(range, child.range))
  return nextBase ? getPositionFromTree(nextBase, position) : treeBase
}

export const getPositionContext = async (
  filename: string,
  position: EditorPosition,
  definitionsTree: PositionContext,
  fullElementSource?: ReadOnlyElementsSource,
): Promise<PositionContext> => {
  const partialContext = getPositionFromTree(definitionsTree, position)
  const fullRef =
    partialContext.ref && fullElementSource !== undefined
      ? {
          ...partialContext.ref,
          element: await getFullElement(fullElementSource, partialContext.ref.element),
        }
      : partialContext.ref
  return { ...partialContext, ref: fullRef, range: { ...partialContext.range, filePath: filename } }
}
