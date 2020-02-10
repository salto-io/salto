import _ from 'lodash'
import path from 'path'
import {
  getChangeElement, isElement, ObjectType, ElemID, Element, isType, isAdditionDiff,
} from 'adapter-api'
import { AdditionDiff } from '@salto/dag'
import { DetailedChange } from '../../core/plan'
import { SourceMap, SourceRange } from '../../parser/parse'
import {
  dumpAnnotationTypes, dumpElements, dumpSingleAnnotationType, dumpValues,
} from '../../parser/dump'

// Declared again to prevent cyclic dependency
const BP_EXTENSION = '.bp'

export type DetailedChangeWithSource = DetailedChange & { location: SourceRange }

const createFileNameFromPath = (pathParts?: string[]): string =>
  (pathParts
    ? `${path.join(...pathParts)}${BP_EXTENSION}`
    : '')

export const getChangeLocations = (
  change: DetailedChange,
  sourceMap: ReadonlyMap<string, SourceRange[]>,
): DetailedChangeWithSource[] => {
  const lastNestedLocation = (parentScope: SourceRange): SourceRange => {
    // We want to insert just before the scope's closing bracket, so we place the change
    // one byte before the closing bracket.
    // We also want one indentation level into the scope so we take the starting column + 2
    const nestedPosition = {
      line: parentScope.end.line,
      col: parentScope.start.col + 2,
      byte: parentScope.end.byte - 1,
    }
    return {
      filename: parentScope.filename,
      start: nestedPosition,
      end: nestedPosition,
    }
  }

  const findLocations = (): SourceRange[] => {
    if (change.action !== 'add') {
      // We want to get the location of the existing element
      const possibleLocations = sourceMap.get(change.id.getFullName()) || []
      if (change.action === 'remove') {
        return possibleLocations
      }
      if (possibleLocations.length > 0) {
        // TODO: figure out how to choose the correct location if there is more than one option
        return [possibleLocations[0]]
      }
    } else if (!change.id.isTopLevel()) {
      // We add new values / elements as the last part of a parent scope unless the parent scope
      // is a config element
      const parentID = change.id.createParentID()
      const possibleLocations = sourceMap.get(parentID.getFullName()) || []
      if (possibleLocations.length > 0) {
        const foundInPath = possibleLocations.find(sr =>
          sr.filename === createFileNameFromPath(change.path))
        // TODO: figure out how to choose the correct location if there is more than one option
        return [lastNestedLocation(foundInPath || possibleLocations[0])]
      }
    }
    // Fallback to using the path from the element itself
    const bpPath = change.path || getChangeElement(change).path
    return [{
      filename: createFileNameFromPath(bpPath),
      start: { col: 1, line: 1, byte: 0 },
      end: { col: 1, line: 1, byte: 0 },
    }]
  }

  return findLocations().map(location => ({ ...change, location }))
}

const indent = (data: string, indentLevel: number, newValue: boolean): string => {
  const indentLines = (lines: string[], level: number): string[] => (
    lines.map(line => _.repeat(' ', level) + line)
  )
  const lines = data.split('\n')

  if (indentLevel > 0 && newValue && lines.length > 1) {
    // New values start one character before the closing bracket of the scope.
    // That means the first line needs only one level of indentation.
    // It also means the empty line at the end needs to re-create the original indentation
    // (so that the closing bracket doesn't move), so the last line should be indented
    // one level less
    return [
      ...indentLines(lines.slice(0, 1), 2),
      ...indentLines(lines.slice(1, -1), indentLevel),
      ...indentLines(lines.slice(-1), indentLevel - 2),
    ].join('\n')
  }
  // If this is not a new value we are at the original value's start position so we don't have
  // to indent the first line
  return [
    ...lines.slice(0, 1),
    ...indentLines(lines.slice(1), indentLevel),
  ].join('\n')
}

export const groupAnnotationTypeChanges = (fileChanges: DetailedChangeWithSource[],
  existingFileSourceMap?: SourceMap): DetailedChangeWithSource[] => {
  const isAnnotationTypeAddChange = (change: DetailedChangeWithSource): boolean =>
    change.id.idType === 'annotation' && isAdditionDiff(change)

  const objectHasAnnotationTypesBlock = (topLevelIdFullName: string): boolean =>
    !_.isUndefined(existingFileSourceMap)
    && existingFileSourceMap
      .has(ElemID.fromFullName(topLevelIdFullName).createNestedID('annotation').getFullName())

  const createGroupedAddAnnotationTypesChange = (annotationTypesAddChanges:
    DetailedChangeWithSource[]): DetailedChangeWithSource => {
    const change = annotationTypesAddChanges[0]
    const groupedChange: DetailedChange = {
      id: new ElemID(change.id.adapter, change.id.typeName, 'annotation'),
      action: 'add',
      data: { after: _(annotationTypesAddChanges as DetailedAddition[])
        .map(c => [c.id.name, c.data.after])
        .fromPairs()
        .value() },
    }
    // we should find a new location for the grouped change
    return getChangeLocations(groupedChange, existingFileSourceMap
      ?? {} as ReadonlyMap<string, SourceRange[]>)[0]
  }

  const [annotationTypesAddChanges, otherChanges] = _.partition(fileChanges,
    c => isAnnotationTypeAddChange(c))
  const topLevelIdToAnnoTypeAddChanges = _.groupBy(annotationTypesAddChanges,
    change => change.id.createTopLevelParentID().parent.getFullName())
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

export const updateBlueprintData = (
  currentData: string,
  changes: DetailedChangeWithSource[]
): string => {
  type BufferChange = {
    newData: string
    start: number
    end: number
  }
  const addLeadingLineBreak = (data: string): string =>
    // We need a leading line break if we are in an empty scope (otherwise we get values
    // in the same line as the opening bracket), since finding out whether we are in an empty
    // scope isn't easy and adding a line break where we don't need it doesn't actually do
    // harm, we add the leading line break anyway
    `\n${data}`

  const toBufferChange = (change: DetailedChangeWithSource): BufferChange => {
    const elem = change.action === 'remove' ? undefined : change.data.after
    let newData: string
    if (elem !== undefined) {
      const changeKey = change.id.name
      const isListElement = changeKey.match(/^\d+$/) !== null
      if (change.id.idType === 'annotation') {
        if (isType(elem)) {
          newData = dumpSingleAnnotationType(changeKey, elem)
        } else {
          newData = dumpAnnotationTypes(elem)
        }
        newData = addLeadingLineBreak(newData)
      } else if (isElement(elem)) {
        newData = dumpElements([elem])
      } else if (isListElement) {
        newData = dumpValues(elem)
      } else {
        // When dumping values (attributes) we need to dump the key as well
        newData = dumpValues({ [changeKey]: elem })
      }
      if (change.action === 'modify' && newData.slice(-1)[0] === '\n') {
        // Trim trailing newline (the original value already has one)
        newData = newData.slice(0, -1)
      }
      newData = indent(newData, change.location.start.col - 1, change.action === 'add')
    } else {
      // This is a removal, we want to replace the original content with an empty string
      newData = ''
    }
    return { newData, start: change.location.start.byte, end: change.location.end.byte }
  }

  const replaceBufferPart = (data: string, change: BufferChange): string => (
    data.slice(0, change.start) + change.newData + data.slice(change.end)
  )

  const bufferChanges = changes.map(toBufferChange)
  // We want to replace buffers from last to first, that way we won't have to re-calculate
  // the source locations after every change
  const sortedChanges = _.sortBy(bufferChanges, change => change.start).reverse()
  const ret = sortedChanges.reduce(replaceBufferPart, currentData)
  return ret
}

type DetailedAddition = AdditionDiff<Element> & {
  id: ElemID
  path: string[]
}

const wrapAdditions = (nestedAdditions: DetailedAddition[]): DetailedAddition => {
  const createObjectTypeFromNestedAdditions = (additions: DetailedAddition[]): ObjectType =>
    new ObjectType(additions.reduce((prev, addition) => {
      switch (addition.id.idType) {
        case 'field': return { ...prev,
          fields: {
            ...prev.fields,
            [addition.id.name]: addition.data.after,
          } }
        case 'attr': return { ...prev,
          annotations: {
            ...prev.annotations,
            [addition.id.name]: addition.data.after,
          } }
        case 'annotation': return { ...prev,
          annotationTypes: {
            ...prev.annotationTypes,
            [addition.id.name]: addition.data.after,
          } }
        default: return prev
      }
    }, {
      elemID: additions[0].id.createTopLevelParentID().parent,
      fields: {},
      annotationTypes: {},
      annotations: {},
    }))
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

const parentElementExistsInPath = (
  dc: DetailedChange,
  elementsIndex: Record<string, string[]>
): boolean => {
  const { parent } = dc.id.createTopLevelParentID()
  return (elementsIndex[parent.getFullName()] || [])
    .includes(createFileNameFromPath(dc.path))
}
export const getChangesToUpdate = (
  changes: DetailedChange[],
  elementsIndex: Record<string, string[]>
): DetailedChange[] => {
  const isNestedAddition = (dc: DetailedChange): boolean => (dc.path || false)
    && dc.action === 'add'
    && dc.id.nestingLevel === (dc.id.idType === 'annotation' ? 2 : 1)
    && !parentElementExistsInPath(dc, elementsIndex)

  const [nestedAdditionsWithPath, otherChanges] = _.partition(
    changes,
    isNestedAddition
  ) as [DetailedAddition[], DetailedChange[]]

  const wrappedNestedAdditions: DetailedAddition[] = _(nestedAdditionsWithPath)
    .groupBy(addition => [addition.path, addition.id.createTopLevelParentID().parent])
    .values()
    .map(wrapAdditions)
    .value()

  return _.concat(otherChanges, wrappedNestedAdditions)
}
