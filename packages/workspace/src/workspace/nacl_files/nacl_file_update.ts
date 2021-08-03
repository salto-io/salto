/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { getChangeElement, isElement, ObjectType, ElemID, Element, isType, isAdditionChange, DetailedChange, Value, StaticFile, isStaticFile, isReferenceExpression, placeholderReadonlyElementsSource, ReferenceType } from '@salto-io/adapter-api'
import { AdditionDiff, ActionName } from '@salto-io/dag'
import { TransformFunc, transformElement } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { SourceRange, SourceMap } from '../../parser'

import {
  dumpAnnotationTypes, dumpElements, dumpSingleAnnotationType, dumpValues,
} from '../../parser/dump'
import { Functions } from '../../parser/functions'

const { awu } = collections.asynciterable

// Declared again to prevent cyclic dependency
const FILE_EXTENSION = '.nacl'

export type DetailedChangeWithSource = DetailedChange & { location: SourceRange }

const createFileNameFromPath = (pathParts?: ReadonlyArray<string>): string => (
  `${path.join(...(pathParts ?? ['unsorted']))}${FILE_EXTENSION}`
)

export const getChangeLocations = (
  change: DetailedChange,
  sourceMap: ReadonlyMap<string, SourceRange[]>,
): DetailedChangeWithSource[] => {
  const lastNestedLocation = (parentScope: SourceRange): SourceRange => {
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
    const naclFilePath = change.path ?? getChangeElement(change).path
    const endOfFileLocation = { col: 1, line: Infinity, byte: Infinity }
    return [{
      filename: createFileNameFromPath(naclFilePath),
      start: endOfFileLocation,
      end: endOfFileLocation,
    }]
  }

  return findLocations().map(location => ({ ...change, location }))
}

const fixEdgeIndentation = (
  data: string,
  action: ActionName,
  initialIndentationLevel: number,
): string => {
  if (action === 'remove' || initialIndentationLevel === 0) return data
  const lines = data.split('\n')
  const [firstLine] = lines
  const lastLine = lines.pop()
  if (lastLine !== undefined && lastLine !== '') {
    /* This currently never happens. The last line that is returned from hclDump is empty.
    */
    lines.push(lastLine)
  }
  if (action === 'add') {
    /* When adding the placement we are given is right before the closing bracket.
    * The string that dump gave us has an empty last line, meaning we have to recreate the
    * indentation that was there previously. We also have to slice from the beggining of the first
    * line the initial indentation that was there in the begginging.
    */
    return [
      firstLine.slice(initialIndentationLevel),
      ...lines.slice(1),
      firstLine.slice(0, initialIndentationLevel),
    ].join('\n')
  }
  /*
  * If we reached here we are handling modify.
  * The first line is already indented. We need to remove the excess indentation in the first line.
  */
  return [
    firstLine.trimLeft(),
    ...lines.slice(1),
  ].join('\n')
}

type DetailedAddition = AdditionDiff<Element> & {
  id: ElemID
  path: string[]
}

export const groupAnnotationTypeChanges = (fileChanges: DetailedChange[],
  existingFileSourceMap?: SourceMap): DetailedChange[] => {
  const isAnnotationTypeAddChange = (change: DetailedChange): boolean =>
    change.id.isAnnotationTypeID() && isAdditionChange(change)

  const objectHasAnnotationTypesBlock = (topLevelIdFullName: string): boolean =>
    !_.isUndefined(existingFileSourceMap)
    && existingFileSourceMap
      .has(ElemID.fromFullName(topLevelIdFullName).createNestedID('annotation').getFullName())

  const createGroupedAddAnnotationTypesChange = (annotationTypesAddChanges:
    DetailedChange[]): DetailedChange => {
    const change = annotationTypesAddChanges[0]
    return {
      id: new ElemID(change.id.adapter, change.id.typeName, 'annotation'),
      action: 'add',
      data: { after: _(annotationTypesAddChanges as DetailedAddition[])
        .map(c => [c.id.name, c.data.after])
        .fromPairs()
        .value() },
    }
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

const removeBracketLines = (dumpedObject: string): string => (
  // We remove the first line that has the opening bracket and the two last lines, the second
  // to last has the closing bracket, and the last line is always an empty line
  dumpedObject.split('\n').slice(1, -2).join('\n').concat('\n')
)

export const updateNaclFileData = async (
  currentData: string,
  changes: DetailedChangeWithSource[],
  functions: Functions,
): Promise<string> => {
  type BufferChange = {
    newData: string
    start: number
    end: number
  }

  const toBufferChange = async (change: DetailedChangeWithSource): Promise<BufferChange> => {
    const elem = change.action === 'remove' ? undefined : change.data.after
    let newData: string
    let indentationLevel = (change.location.start.col - 1) / 2
    /* When adding a nested change we need to increase one level of indentation because
    * we get the placement of the closing brace of the next line. The closing brace will
    * be indented one line less then wanted change.
    */
    if (change.action === 'add' && !change.id.isTopLevel()) {
      indentationLevel += 1
    }
    if (elem !== undefined) {
      const changeKey = change.id.name
      const isListElement = changeKey.match(/^\d+$/) !== null
      if (change.id.isAnnotationTypeID()) {
        if (isType(elem) || isReferenceExpression(elem)) {
          newData = dumpSingleAnnotationType(
            changeKey,
            new ReferenceType(elem.elemID),
            indentationLevel
          )
        } else {
          newData = dumpAnnotationTypes(elem, indentationLevel)
        }
      } else if (isElement(elem)) {
        newData = await dumpElements([elem], functions, indentationLevel)
      } else if (isListElement) {
        newData = await dumpValues(elem, functions, indentationLevel)
      } else {
        // We create a "dummy object" as the scope in which we are going to write this value
        // We do this because we need to dump the key as well as the value and this is the easiest
        // way to ensure we remain consistent
        const dumpedObj = await dumpValues({ [changeKey]: elem }, functions, indentationLevel - 1)
        // once we have the "new scope", we want to take just the serialized values because the
        // brackets already exist in the original scope.
        newData = removeBracketLines(dumpedObj)
      }
      newData = fixEdgeIndentation(
        newData,
        change.action,
        change.location.start.col - 1,
      )
    } else {
      // This is a removal, we want to replace the original content with an empty string
      newData = ''
    }
    return { newData, start: change.location.start.byte, end: change.location.end.byte }
  }

  const replaceBufferPart = (data: string, change: BufferChange): string => (
    data.slice(0, change.start) + change.newData + data.slice(change.end)
  )
  const bufferChanges = await awu(changes).map(toBufferChange).toArray()

  // We want to replace buffers from last to first, that way we won't have to re-calculate
  // the source locations after every change
  const sortedChanges = _.sortBy(bufferChanges, change => change.start).reverse()
  const ret = sortedChanges.reduce(replaceBufferPart, currentData)
  return ret
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
        case 'annotation': {
          return { ...prev,
            annotationRefsOrTypes: {
              ...prev.annotationRefsOrTypes,
              [addition.id.name]: addition.data.after,
            } }
        }
        default: return prev
      }
    }, {
      elemID: additions[0].id.createTopLevelParentID().parent,
      fields: {},
      annotationRefsOrTypes: {},
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
  sourceMap: SourceMap
): boolean => {
  const { parent } = dc.id.createTopLevelParentID()
  return _.some(sourceMap.get(parent.getFullName())?.map(
    range => range.filename === createFileNameFromPath(dc.path)
  ))
}
export const getChangesToUpdate = (
  changes: DetailedChange[],
  sourceMap: SourceMap
): DetailedChange[] => {
  const isNestedAddition = (dc: DetailedChange): boolean => (dc.path || false)
    && dc.action === 'add'
    && dc.id.idType !== 'instance'
    && dc.id.nestingLevel === (dc.id.isAnnotationTypeID() ? 2 : 1)
    && !parentElementExistsInPath(dc, sourceMap)

  const [nestedAdditionsWithPath, otherChanges] = _.partition(
    changes,
    isNestedAddition
  ) as [DetailedAddition[], DetailedChange[]]
  const wrappedNestedAdditions: DetailedAddition[] = _(nestedAdditionsWithPath)
    .groupBy(addition => [addition.path, addition.id.createTopLevelParentID().parent])
    .values()
    .map(wrapAdditions)
    .value()
  return groupAnnotationTypeChanges(_.concat(otherChanges, wrappedNestedAdditions), sourceMap)
}

export const getNestedStaticFiles = async (value: Value): Promise<StaticFile[]> => {
  if (isElement(value)) {
    const allStaticFiles = new Set<StaticFile>()
    const transformFunc: TransformFunc = ({ value: val }) => {
      if (isStaticFile(val)) {
        allStaticFiles.add(val)
      }
      return val
    }
    await transformElement({
      element: value,
      transformFunc,
      strict: false,
      // This transformElement does not need to types so this can be used
      // Long term we should replace this with not using transformElement
      elementsSource: placeholderReadonlyElementsSource,
    })
    return Array.from(allStaticFiles.values())
  }
  if (_.isArray(value)) {
    return awu(value).flatMap(getNestedStaticFiles).toArray()
  }
  if (_.isPlainObject(value)) {
    return awu(Object.values(value)).flatMap(getNestedStaticFiles).toArray()
  }
  if (isStaticFile(value)) {
    return [value]
  }
  return []
}
