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
import { ElemID, Element, isElement, isInstanceElement, InstanceElement, DetailedChange, isReferenceExpression, ReferenceExpression, getChangeElement } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { setPath, walkOnElement, WalkOnFunc, WalkOnFuncArgs, WALK_NEXT_STEP } from '@salto-io/adapter-utils'
import { ElementsSource, PathIndex, splitElementByPath, State } from '@salto-io/workspace'

const { awu } = collections.asynciterable

export class RenameElementIdError extends Error {
  constructor(message: string) {
    super(message)
    Object.setPrototypeOf(this, RenameElementIdError.prototype)
  }
}

export type RenameElementResult = {
  naclFilesChangesCount: number
  stateElementsChangesCount: number
}

export const renameChecks = async (
  sourceElemId: ElemID,
  targetElemId: ElemID,
  elementsSource: ElementsSource
): Promise<void> => {
  if (sourceElemId.isEqual(targetElemId)) {
    throw new RenameElementIdError(`Source and target element ids are the same: ${sourceElemId.getFullName()}`)
  }

  if (!sourceElemId.isTopLevel()) {
    throw new RenameElementIdError(`Source element should be top level (${sourceElemId.createTopLevelParentID().parent.getFullName()})`)
  }

  if (!targetElemId.isTopLevel()) {
    throw new RenameElementIdError(`Target element should be top level (${targetElemId.createTopLevelParentID().parent.getFullName()})`)
  }

  if (sourceElemId.adapter !== targetElemId.adapter
    || sourceElemId.typeName !== targetElemId.typeName
    || sourceElemId.idType !== targetElemId.idType
    || !ElemID.TOP_LEVEL_ID_TYPES_WITH_NAME.includes(sourceElemId.idType)) {
    throw new RenameElementIdError('Currently supporting renaming the instance name only')
  }

  const sourceElement = await elementsSource.get(sourceElemId)
  if (sourceElement === undefined || !isElement(sourceElement)) {
    throw new RenameElementIdError(`Did not find any matches for element ${sourceElemId.getFullName()}`)
  }

  if (!isInstanceElement(sourceElement)) {
    throw new RenameElementIdError(`Currently supporting InstanceElement only (${sourceElemId.getFullName()} is of type '${sourceElemId.idType}')`)
  }

  if (await elementsSource.get(targetElemId) !== undefined) {
    throw new RenameElementIdError(`Element ${targetElemId.getFullName()} already exists`)
  }
}

const getRenameElementChanges = (
  sourceElemId: ElemID,
  targetElemId: ElemID,
  sourceElements: InstanceElement[]
): DetailedChange[] => {
  const removeChanges = sourceElements.map(e => ({
    id: sourceElemId,
    action: 'remove',
    data: {
      before: e,
    },
  })) as DetailedChange[]

  const addChanges = sourceElements.map(e => ({
    id: targetElemId,
    action: 'add',
    data: {
      after: new InstanceElement(
        targetElemId.name,
        e.refType,
        e.value,
        e.path,
        e.annotations
      ),
    },
  })) as DetailedChange[]

  return [...removeChanges, ...addChanges]
}

const getRenameReferencesChanges = async (
  elementsSource: ElementsSource,
  sourceElemId: ElemID,
  targetElemId: ElemID
): Promise<DetailedChange[]> => {
  const getReferences = (element: Element): WalkOnFuncArgs[] => {
    const references: WalkOnFuncArgs[] = []
    const func: WalkOnFunc = ({ value, path }) => {
      if (isReferenceExpression(value)
      && (sourceElemId.isEqual(value.elemID) || sourceElemId.isParentOf(value.elemID))) {
        references.push({ value, path })
        return WALK_NEXT_STEP.SKIP
      }
      return WALK_NEXT_STEP.RECURSE
    }
    walkOnElement({ element, func })
    return references
  }

  const references = await awu(await elementsSource.getAll())
    .flatMap(elem => getReferences(elem)).toArray()

  return references.map(r => {
    const targetReference = new ReferenceExpression(
      new ElemID(
        sourceElemId.adapter,
        sourceElemId.typeName,
        sourceElemId.idType,
        targetElemId.name,
        ...r.value.elemID.createTopLevelParentID().path
      ),
      r.value.resValue,
      r.value.topLevelParent
    )
    return {
      id: r.path,
      action: 'modify',
      data: {
        before: r.value,
        after: targetReference,
      },
    }
  })
}

export const renameElement = async <T>(
  elementsSource: ElementsSource,
  sourceElemId: ElemID,
  targetElemId: ElemID,
  applyChanges: (changes: DetailedChange[]) => Promise<T>,
  index?: PathIndex,
): Promise<{ elementChangesResult: T; referencesChangesResult: T }> => {
  const source = await elementsSource.get(sourceElemId)
  const elements = index === undefined
    ? [source]
    : await splitElementByPath(source, index) as InstanceElement[]

  const elementChanges = getRenameElementChanges(sourceElemId, targetElemId, elements)
  const elementChangesResult = await applyChanges(elementChanges)

  const referencesChanges = await getRenameReferencesChanges(elementsSource, sourceElemId,
    targetElemId)
  const referencesChangesResult = await applyChanges(referencesChanges)

  return { elementChangesResult, referencesChangesResult }
}

const getUpdatedTopLevelElements = async (
  elementsSource: ElementsSource,
  changes: DetailedChange[]
): Promise<Element[]> => {
  const changesByTopLevelElemId = _.groupBy(
    changes, r => r.id.createTopLevelParentID().parent.getFullName()
  )

  return Promise.all(
    Object.entries(changesByTopLevelElemId).map(async ([e, changesInTopLevelElement]) => {
      const topLevelElem = await elementsSource.get(ElemID.fromFullName(e))
      changesInTopLevelElement.forEach(c => setPath(topLevelElem, c.id, getChangeElement(c)))
      return topLevelElem
    })
  )
}

export const updateStateElements = async (
  stateSource: State,
  changes: DetailedChange[]
): Promise<number> => {
  const topLevelElementsChanges = changes.filter(c => c.id.isTopLevel())
  await Promise.all(topLevelElementsChanges.filter(e => ['remove', 'modify'].includes(e.action))
    .map(e => stateSource.remove(getChangeElement(e).elemID)))
  await Promise.all(topLevelElementsChanges.filter(e => ['add', 'modify'].includes(e.action))
    .map(e => stateSource.set(getChangeElement(e))))

  // Currently only modifying non-top-elements, not removing or adding
  const nestedElementsChanges = changes.filter(c => !c.id.isTopLevel() && c.action === 'modify')
  const updatedElements = await getUpdatedTopLevelElements(stateSource, nestedElementsChanges)
  await Promise.all(updatedElements.map(e => stateSource.set(e)))
  return topLevelElementsChanges.length + updatedElements.length
}

export const renameElementPathIndex = async (
  index: PathIndex,
  sourceElemId: ElemID,
  targetElemId: ElemID
): Promise<void> => {
  // The renamed element will be located according to the element's path and not the actual
  // locations in the nacl. Such that if the user renamed the file before she renamed the Element,
  // the renamed element will be placed in the original file name. This is because we use and update
  // the pathIndex and not the ChangeLocation (SourceMap) logic in the current implementation.
  const elemIdsToPaths = await awu(index.entries())
    .filter(e => {
      const elemId = ElemID.fromFullName(e.key)
      return sourceElemId.isEqual(elemId) || sourceElemId.isParentOf(elemId)
    }).toArray()

  await Promise.all(elemIdsToPaths.map(e => index.delete(e.key)))
  await Promise.all(elemIdsToPaths.map(e => {
    const elemId = new ElemID(
      sourceElemId.adapter,
      sourceElemId.typeName,
      sourceElemId.idType,
      targetElemId.name,
      // this implementation works on InstanceElement only
      // it won't work on Field elements because they aren't top-level elements
      ...ElemID.fromFullName(e.key).createTopLevelParentID().path
    )
    return index.set(elemId.getFullName(), e.value)
  }))
}
