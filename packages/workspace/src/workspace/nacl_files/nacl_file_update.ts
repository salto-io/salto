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
import path from 'path'
import { logger } from '@salto-io/logging'
import {
  getChangeData,
  isElement,
  isField,
  ObjectType,
  ElemID,
  Element,
  isType,
  isAdditionChange,
  DetailedChange,
  Value,
  StaticFile,
  isStaticFile,
  TypeReference,
  isTypeReference,
  isIndexPathPart,
} from '@salto-io/adapter-api'
import { AdditionDiff, ActionName } from '@salto-io/dag'
import { inspectValue, getPath, walkOnElement, WalkOnFunc, WALK_NEXT_STEP, resolvePath } from '@salto-io/adapter-utils'
import { collections, values } from '@salto-io/lowerdash'
import { parser } from '@salto-io/parser'

const { awu } = collections.asynciterable
const { isDefined } = values

const log = logger(module)

// Declared again to prevent cyclic dependency
const FILE_EXTENSION = '.nacl'

export type Location = parser.SourceRange & {
  indexInParent?: number
  newInParent?: boolean
}

export type DetailedChangeWithSource = DetailedChange & {
  location: Location
  requiresIndent?: boolean
}

const createFileNameFromPath = (pathParts?: ReadonlyArray<string>): string =>
  `${path.join(...(pathParts ?? ['unsorted']))}${FILE_EXTENSION}`

type PositionInParent = {
  followingElementIDs: ElemID[]
  indexInParent?: number
}

const getChangeId = (change: DetailedChange): ElemID =>
  (change.action === 'remove' ? change.elemIDs?.before : change.elemIDs?.after) ?? change.id

const getPositionInParent = (change: DetailedChange): PositionInParent => {
  if (change.baseChange === undefined) {
    log.warn('No base change: %s', inspectValue(change))
    return { followingElementIDs: [] }
  }

  const changeId = getChangeId(change)
  const changeData = getChangeData(change)
  const parent = isField(changeData) ? changeData.parent : getChangeData(change.baseChange)
  const pathInParent = getPath(parent, changeId)
  if (pathInParent === undefined) {
    log.warn('Could not get path for %s in parent: %s', changeId.getFullName(), inspectValue(parent))
    return { followingElementIDs: [] }
  }
  if (pathInParent.length === 0) {
    // This is a top level element
    return { followingElementIDs: [] }
  }

  const container = _.get(parent, pathInParent.slice(0, -1))
  if (!_.isObjectLike(container)) {
    log.warn(
      'Got non object container at path %s: %s',
      changeId.createParentID().getFullName(),
      inspectValue(container),
    )
    return { followingElementIDs: [] }
  }

  const elementName = changeId.name
  const containerKeys = Object.keys(container)
  const index = containerKeys.indexOf(elementName)
  if (index === -1) {
    log.warn('Element %s not found in container: %s', elementName, inspectValue(container))
    return { followingElementIDs: [] }
  }

  return {
    followingElementIDs: containerKeys.slice(index + 1).map(k => changeId.createSiblingID(k)),
    indexInParent: index,
  }
}

const fixLastListItemChange = (
  change: DetailedChangeWithSource,
  sourceMap: ReadonlyMap<string, parser.SourceRange[]>,
): DetailedChangeWithSource[] => {
  const { baseChange } = change
  if (baseChange === undefined) {
    log.warn('No base change: %s', inspectValue(change))
    return [change]
  }

  if (baseChange.action !== 'modify') {
    return [change]
  }

  if (change.elemIDs === undefined) {
    return [change]
  }

  const beforeChangeId = change.elemIDs.before
  const afterChangeId = change.elemIDs.after

  if (beforeChangeId === undefined) {
    return [change]
  }

  if (!isIndexPathPart(beforeChangeId.name) || (afterChangeId !== undefined && !isIndexPathPart(afterChangeId.name))) {
    return [change]
  }

  const parentId = beforeChangeId.createParentID()
  const beforeContainer = resolvePath(baseChange.data.before, parentId)
  const afterContainer = resolvePath(baseChange.data.after, parentId)

  if (!_.isArray(beforeContainer) || !_.isArray(afterContainer)) {
    return [change]
  }

  if (afterContainer.length >= beforeContainer.length) {
    return [change]
  }

  /*
  when the total length of the containing list is decreased, we need to delete all of the commas
  alongside with the removed items. this is not trivial because the location of each item doesn't
  includes the comma (from `start` to `end`) and the way to do it is to have a change of the new
  last item in the list, with a location that includes all of the removed items at the end of the list.
  
  for example:
    before list = [
      {
        item = 1
      },
      {
        item = 2
      },
      {
        item = 3
      },
      {
        item = 4
      },
    ]
  
    after list = [
      {
        item = 1
      },
      {
        item = 2
      },
    ]
  
  in this case, we want a change with the value "{ item = 2 }", with a location from the start of
  "{ item = 2 }" to the end of "{ item = 4 }". this way, applying the change will replace
  "{ item = 2 }, { item = 3 }, { item = 4 }" with "{ item = 2 }", leaving only the last comma.
  */

  const beforeIndex = Number(beforeChangeId.name)
  const afterIndex = afterChangeId !== undefined ? Number(afterChangeId.name) : undefined
  const beforeLastItemIndex = beforeContainer.length - 1
  const afterLastItemIndex = afterContainer.length - 1

  if (beforeIndex < beforeLastItemIndex) {
    // we ignore the new last item change and the following removed items
    if ((afterIndex ?? beforeIndex) >= afterLastItemIndex) {
      return []
    }

    return [change]
  }

  if (afterContainer.length === 0) {
    const [containerLocation] = sourceMap.get(parentId.getFullName()) ?? []
    if (containerLocation === undefined) {
      log.warn('missing location for %s', parentId.getFullName())
      return [change]
    }

    return [
      {
        id: parentId,
        action: 'modify',
        data: {
          before: beforeContainer,
          after: afterContainer,
        },
        baseChange,
        location: containerLocation,
      },
    ]
  }

  const afterLastItemChangeId = parentId.createNestedID(String(afterLastItemIndex))
  const [beforeLastItemLocation] = sourceMap.get(beforeChangeId.getFullName()) ?? []
  const [afterLastItemLocation] = sourceMap.get(afterLastItemChangeId.getFullName()) ?? []

  if (afterLastItemLocation === undefined || beforeLastItemLocation === undefined) {
    log.warn(
      'missing location for %s',
      [
        afterLastItemLocation === undefined ? afterLastItemChangeId.getFullName() : undefined,
        beforeLastItemLocation === undefined ? beforeChangeId.getFullName() : undefined,
      ]
        .filter(id => id !== undefined)
        .join(', '),
    )
    return [change]
  }

  const fixedLocation = { ...afterLastItemLocation, end: beforeLastItemLocation.end }
  const afterLastItemChangeWithFixedLocation: DetailedChangeWithSource = {
    id: afterLastItemChangeId,
    action: 'modify',
    data: {
      before: beforeContainer[afterLastItemIndex],
      after: afterContainer[afterLastItemIndex],
    },
    baseChange,
    location: fixedLocation,
  }

  // in case that the last item moved up in the list we want to return the original change too
  if (afterIndex !== undefined && afterIndex < afterLastItemIndex) {
    return [change, afterLastItemChangeWithFixedLocation]
  }

  return [afterLastItemChangeWithFixedLocation]
}

const lastNestedLocation = (parentScope: parser.SourceRange): parser.SourceRange => {
  // We want to insert just before the scope's closing bracket, so we place the change
  // one byte before the closing bracket.
  const nestedPosition = {
    line: parentScope.end.line,
    col: parentScope.start.col,
    byte: parentScope.end.byte - 1,
  }
  return {
    filename: parentScope.filename,
    start: nestedPosition,
    end: nestedPosition,
  }
}

export const getChangeLocations = (
  change: DetailedChange,
  sourceMap: ReadonlyMap<string, parser.SourceRange[]>,
): DetailedChangeWithSource[] => {
  const changeId = getChangeId(change)
  if (
    sourceMap.has(changeId.getFullName()) &&
    // when a part of type is written to a new file, there's a type addition change (see wrapAdditions).
    // that change shouldn't go into this `if` scope, although it exist in `sourceMap`.
    !(change.action === 'add' && changeId.idType === 'type')
  ) {
    // We want to get the location of the existing element
    const possibleLocations = sourceMap.get(changeId.getFullName()) ?? []
    if (change.action === 'remove') {
      return possibleLocations
        .map(location => ({
          ...change,
          location,
        }))
        .flatMap(c => fixLastListItemChange(c, sourceMap))
    }
    if (possibleLocations.length > 0) {
      // TODO: figure out how to choose the correct location if there is more than one option
      return fixLastListItemChange({ ...change, location: possibleLocations[0] }, sourceMap)
    }
  } else if (!changeId.isTopLevel()) {
    const fileName = createFileNameFromPath(change.path)
    const { followingElementIDs, indexInParent } = getPositionInParent(change)
    const possibleFollowingElementsRange = followingElementIDs
      .flatMap(elemID => sourceMap.get(elemID.getFullName()))
      .filter(isDefined)
      .find(sr => sr.filename === fileName)
    if (possibleFollowingElementsRange !== undefined) {
      // Returning the start location of the first element following the one we are adding in the same file
      return [
        {
          ...change,
          location: {
            filename: fileName,
            start: possibleFollowingElementsRange.start,
            end: possibleFollowingElementsRange.start,
            indexInParent,
          },
        },
      ]
    }

    // If we can't find an element after this one in the parent we put it at the end
    const parentID = changeId.createParentID()
    const possibleLocations = sourceMap.get(parentID.getFullName()) ?? []
    if (possibleLocations.length > 0) {
      const foundInPath = possibleLocations.find(sr => sr.filename === fileName)
      // When adding a nested change we need to increase one level of indentation because
      // we get the placement of the closing brace of the next line. The closing brace will
      // be indented one line less then wanted change.
      // TODO: figure out how to choose the correct location if there is more than one option
      return [
        {
          ...change,
          location: { ...lastNestedLocation(foundInPath ?? possibleLocations[0]), indexInParent, newInParent: true },
          requiresIndent: true,
        },
      ]
    }
    log.error('No possible locations found for %s.', parentID.getFullName())
  }
  // Fallback to using the path from the element itself
  const naclFilePath = change.path ?? getChangeData(change).path
  const endOfFileLocation = { col: 1, line: Infinity, byte: Infinity }
  return [
    {
      ...change,
      location: {
        filename: createFileNameFromPath(naclFilePath),
        start: endOfFileLocation,
        end: endOfFileLocation,
      },
    },
  ]
}

const fixEdgeIndentation = (data: string, action: ActionName, initialIndentationLevel: number): string => {
  if (action === 'remove' || initialIndentationLevel === 0) return data
  const lines = data.split('\n')
  const [firstLine] = lines
  const lastLine = lines.pop()
  if (lastLine !== undefined && lastLine !== '') {
    // This currently never happens. The last line that is returned from hclDump is empty.
    lines.push(lastLine)
  }
  if (action === 'add') {
    // When adding the placement we are given is right before following member or the closing bracket of the parent.
    // The string that dump gave us has an empty last line, meaning we have to recreate the
    // indentation that was there previously. We also have to slice from the beginning of the first
    // line the initial indentation that was there in the beginning.
    return [
      firstLine.slice(initialIndentationLevel),
      ...lines.slice(1),
      firstLine.slice(0, initialIndentationLevel),
    ].join('\n')
  }
  // If we reached here we are handling modify.
  // The first line is already indented. We need to remove the excess indentation in the first line.
  return [firstLine.trimLeft(), ...lines.slice(1)].join('\n')
}

type DetailedAddition = AdditionDiff<Element> & {
  id: ElemID
  path: string[]
}

export const groupAnnotationTypeChanges = (
  fileChanges: DetailedChange[],
  existingFileSourceMap?: parser.SourceMap,
): DetailedChange[] => {
  const isAnnotationTypeAddChange = (change: DetailedChange): boolean =>
    change.id.isAnnotationTypeID() && isAdditionChange(change)

  const objectHasAnnotationTypesBlock = (topLevelIdFullName: string): boolean =>
    !_.isUndefined(existingFileSourceMap) &&
    existingFileSourceMap.has(ElemID.fromFullName(topLevelIdFullName).createNestedID('annotation').getFullName())

  const createGroupedAddAnnotationTypesChange = (annotationTypesAddChanges: DetailedChange[]): DetailedChange => {
    const change = annotationTypesAddChanges[0]
    return {
      id: new ElemID(change.id.adapter, change.id.typeName, 'annotation'),
      action: 'add',
      data: {
        after: _(annotationTypesAddChanges as DetailedAddition[])
          .map(c => [c.id.name, c.data.after])
          .fromPairs()
          .value(),
      },
    }
  }

  const [annotationTypesAddChanges, otherChanges] = _.partition(fileChanges, c => isAnnotationTypeAddChange(c))
  const topLevelIdToAnnoTypeAddChanges = _.groupBy(annotationTypesAddChanges, change =>
    change.id.createTopLevelParentID().parent.getFullName(),
  )
  const transformedAnnotationTypeChanges = _(topLevelIdToAnnoTypeAddChanges)
    .entries()
    .map(([topLevelIdFullName, objectAnnotationTypesAddChanges]) => {
      if (objectHasAnnotationTypesBlock(topLevelIdFullName)) {
        return objectAnnotationTypesAddChanges
      }
      return [createGroupedAddAnnotationTypesChange(objectAnnotationTypesAddChanges)]
    })
    .flatten()
    .value()
  return [...otherChanges, ...transformedAnnotationTypeChanges]
}

const removeBracketLines = (dumpedObject: string): string =>
  // We remove the first line that has the opening bracket and the two last lines, the second
  // to last has the closing bracket, and the last line is always an empty line
  dumpedObject.split('\n').slice(1, -2).join('\n').concat('\n')

export const updateNaclFileData = async (
  currentData: string,
  changes: DetailedChangeWithSource[],
  functions: parser.Functions,
): Promise<string> => {
  type BufferChange = {
    newData: string
    start: number
    end: number
    indexInParent?: number
    action?: DetailedChange['action']
  }

  const toBufferChange = async (change: DetailedChangeWithSource): Promise<BufferChange> => {
    const elem = change.action === 'remove' ? undefined : change.data.after
    const changeKey = change.id.name
    const isListElement =
      !change.id.isAnnotationTypeID() &&
      !change.id.isBaseID() &&
      !change.id.createParentID().isBaseID() &&
      isIndexPathPart(changeKey)

    const initialIndentationWidth = change.location.start.col - 1
    const indentationLevel = initialIndentationWidth / 2 + (change.requiresIndent ? 1 : 0)

    const innerGetNewData = async (): Promise<string> => {
      if (change.id.isAnnotationTypeID()) {
        if (isType(elem) || isTypeReference(elem)) {
          return parser.dumpSingleAnnotationType(changeKey, new TypeReference(elem.elemID), indentationLevel)
        }
        return parser.dumpAnnotationTypes(elem, indentationLevel)
      }
      if (isElement(elem)) {
        const data = await parser.dumpElements([elem], functions, indentationLevel)
        if (change.action === 'modify') {
          // When replacing entire elements we already have a newline after the block so we don't need another one
          return data.trimEnd()
        }
        return data
      }
      // We create a "dummy object" as the scope in which we are going to write this value
      // We do this because we need to dump the key as well as the value and this is the easiest
      // way to ensure we remain consistent
      const dumpedObj = await parser.dumpValues({ [changeKey]: elem }, functions, indentationLevel - 1)
      // once we have the "new scope", we want to take just the serialized values because the
      // brackets already exist in the original scope.
      return removeBracketLines(dumpedObj)
    }

    const getNewData = async (): Promise<string> => {
      if (isListElement) {
        if (elem === undefined) {
          return `\n${parser.createIndentation(indentationLevel)}`
        }
        return fixEdgeIndentation(
          await parser.dumpValues(elem, functions, indentationLevel, change.location.newInParent ? ',\n' : ''),
          change.location.newInParent ? 'add' : 'modify',
          initialIndentationWidth,
        )
      }
      if (elem === undefined) {
        return ''
      }
      return fixEdgeIndentation(await innerGetNewData(), change.action, initialIndentationWidth)
    }

    return {
      newData: await getNewData(),
      start: change.location.start.byte,
      end: change.location.end.byte,
      indexInParent: change.location.indexInParent,
      action: change.action,
    }
  }

  const bufferChanges = await awu(changes).map(toBufferChange).toArray()

  const sortedChanges = _.sortBy(bufferChanges, ['start', 'indexInParent'])
  const allBufferParts = sortedChanges
    // Add empty change at the end of the file to make sure we keep the current content
    // that appears after the last change
    .concat([{ start: Infinity, end: Infinity, newData: '' }])
    .reduce(
      (parts, change) => {
        const lastPartEnd = parts.slice(-1)[0].end
        const nextChangeStart = change.start
        if (lastPartEnd !== nextChangeStart) {
          // Add slice from the current data to fill the gap between the last part and the next
          let data = currentData.slice(lastPartEnd, nextChangeStart)

          if (change.action === 'remove') {
            // For removals, dropping newline and indent at the end of the block to avoid empty lines
            data = data.trimEnd()
          }

          parts.push({
            start: lastPartEnd,
            end: nextChangeStart,
            newData: data,
          })
        }
        parts.push(change)
        return parts
      },
      // Add empty change at the beginning of the file to make sure we keep the current content
      // that appears before the first change
      [{ start: 0, end: 0, newData: '' }],
    )

  return allBufferParts.map(part => part.newData).join('')
}

const wrapAdditions = (nestedAdditions: DetailedAddition[]): DetailedAddition => {
  const createObjectTypeFromNestedAdditions = (additions: DetailedAddition[]): ObjectType =>
    new ObjectType(
      additions.reduce(
        (prev, addition) => {
          switch (addition.id.idType) {
            case 'field':
              return {
                ...prev,
                fields: {
                  ...prev.fields,
                  [addition.id.name]: addition.data.after,
                },
              }
            case 'attr':
              return {
                ...prev,
                annotations: {
                  ...prev.annotations,
                  [addition.id.name]: addition.data.after,
                },
              }
            case 'annotation': {
              return {
                ...prev,
                annotationRefsOrTypes: {
                  ...prev.annotationRefsOrTypes,
                  [addition.id.name]: addition.data.after,
                },
              }
            }
            default:
              return prev
          }
        },
        {
          elemID: additions[0].id.createTopLevelParentID().parent,
          fields: {},
          annotationRefsOrTypes: {},
          annotations: {},
        },
      ),
    )
  const wrapperObject = createObjectTypeFromNestedAdditions(nestedAdditions)
  return {
    action: 'add',
    id: wrapperObject.elemID,
    path: nestedAdditions[0].path,
    data: {
      after: wrapperObject as Element,
    },
  } as DetailedAddition
}

const parentElementExistsInPath = (dc: DetailedChange, sourceMap: parser.SourceMap): boolean => {
  const { parent } = dc.id.createTopLevelParentID()
  return _.some(sourceMap.get(parent.getFullName())?.map(range => range.filename === createFileNameFromPath(dc.path)))
}

export const getChangesToUpdate = (changes: DetailedChange[], sourceMap: parser.SourceMap): DetailedChange[] => {
  const isNestedAddition = (dc: DetailedChange): boolean =>
    (dc.path || false) &&
    dc.action === 'add' &&
    dc.id.idType !== 'instance' &&
    dc.id.nestingLevel === (dc.id.isAnnotationTypeID() ? 2 : 1) &&
    !parentElementExistsInPath(dc, sourceMap)

  const [nestedAdditionsWithPath, otherChanges] = _.partition(changes, isNestedAddition) as [
    DetailedAddition[],
    DetailedChange[],
  ]
  const wrappedNestedAdditions: DetailedAddition[] = _(nestedAdditionsWithPath)
    .groupBy(addition => [addition.path, addition.id.createTopLevelParentID().parent])
    .values()
    .map(wrapAdditions)
    .value()
  return groupAnnotationTypeChanges(_.concat(otherChanges, wrappedNestedAdditions), sourceMap)
}

export const getNestedStaticFiles = (value: Value): StaticFile[] => {
  if (isElement(value)) {
    const allStaticFiles = new Set<StaticFile>()
    const func: WalkOnFunc = ({ value: val }) => {
      if (isStaticFile(val)) {
        allStaticFiles.add(val)
        return WALK_NEXT_STEP.SKIP
      }
      return WALK_NEXT_STEP.RECURSE
    }
    walkOnElement({ element: value, func })
    return Array.from(allStaticFiles.values())
  }
  if (_.isArray(value)) {
    return value.flatMap(getNestedStaticFiles)
  }
  if (_.isPlainObject(value)) {
    return Object.values(value).flatMap(getNestedStaticFiles)
  }
  if (isStaticFile(value)) {
    return [value]
  }
  return []
}
