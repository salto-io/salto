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
import { setPath, walkOnElement, WalkOnFunc, WALK_NEXT_STEP } from '@salto-io/adapter-utils'
import { ElementsSource, getElementsPathHints, PathIndex, splitElementByPath, State, Workspace } from '@salto-io/workspace'

const { awu } = collections.asynciterable

export class RenameElementIdError extends Error {
  constructor(message: string) {
    super(message)
    Object.setPrototypeOf(this, RenameElementIdError.prototype)
  }
}

export const renameChecks = async (
  workspace: Workspace,
  sourceElemId: ElemID,
  targetElemId: ElemID
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

  if (sourceElemId.idType !== 'instance') {
    throw new RenameElementIdError(`Currently supporting InstanceElement only (${sourceElemId.getFullName()} is of type '${sourceElemId.idType}')`)
  }

  if (sourceElemId.adapter !== targetElemId.adapter
    || sourceElemId.typeName !== targetElemId.typeName
    || sourceElemId.idType !== targetElemId.idType) {
    throw new RenameElementIdError('Only instance name renaming is allowed')
  }

  const sourceElement = await workspace.getValue(sourceElemId)
  if (sourceElement === undefined || !isElement(sourceElement)) {
    throw new RenameElementIdError(`Did not find any matches for element ${sourceElemId.getFullName()}`)
  }

  if (!isInstanceElement(sourceElement)) {
    throw new RenameElementIdError(`Currently supporting InstanceElement only (${sourceElemId.getFullName()} is of type '${sourceElemId.idType}')`)
  }

  if (await workspace.getValue(targetElemId) !== undefined) {
    throw new RenameElementIdError(`Element ${targetElemId.getFullName()} already exists`)
  }
}

const getRenameElementChanges = (
  sourceElemId: ElemID,
  targetElemId: ElemID,
  sourceElements: InstanceElement[]
): DetailedChange[] => {
  const removeChanges = sourceElements.map(element => ({
    id: sourceElemId,
    action: 'remove',
    data: {
      before: element,
    },
  })) as DetailedChange[]

  const addChanges = sourceElements.map(element => ({
    id: targetElemId,
    action: 'add',
    data: {
      after: new InstanceElement(
        targetElemId.name,
        element.refType,
        element.value,
        element.path,
        element.annotations
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
  const getReferences = (element: Element): { path: ElemID; value: ReferenceExpression }[] => {
    const references: { path: ElemID; value: ReferenceExpression }[] = []
    const func: WalkOnFunc = ({ path, value }) => {
      if (isReferenceExpression(value)
      && (sourceElemId.isEqual(value.elemID) || sourceElemId.isParentOf(value.elemID))) {
        references.push({ path, value })
        return WALK_NEXT_STEP.SKIP
      }
      return WALK_NEXT_STEP.RECURSE
    }
    walkOnElement({ element, func })
    return references
  }

  const references = await awu(await elementsSource.getAll())
    .flatMap(element => getReferences(element)).toArray()

  return references.map(reference => {
    const targetReference = new ReferenceExpression(
      new ElemID(
        sourceElemId.adapter,
        sourceElemId.typeName,
        sourceElemId.idType,
        targetElemId.name,
        ...reference.value.elemID.createTopLevelParentID().path
      ),
      reference.value.value,
      reference.value.topLevelParent
    )
    return {
      id: reference.path,
      action: 'modify',
      data: {
        before: reference.value,
        after: targetReference,
      },
    }
  })
}

const renameElementPathIndex = async (
  index: PathIndex,
  splittedElement: Element[],
  sourceElemId: ElemID,
  targetElemId: ElemID
): Promise<void> => {
  // The renamed element will be located according to the element's path and not the actual
  // locations in the nacl. Such that if the user renamed the file before she renamed the Element,
  // the renamed element will be placed in the original file name. This is because we use and update
  // the pathIndex and not the ChangeLocation (SourceMap) logic in the current implementation.
  const pathHints = getElementsPathHints(splittedElement)

  await Promise.all(pathHints.map(entry => index.delete(entry.key)))
  await Promise.all(pathHints.map(entry => {
    const elemId = new ElemID(
      sourceElemId.adapter,
      sourceElemId.typeName,
      sourceElemId.idType,
      targetElemId.name,
      // this implementation works on InstanceElement only
      // it won't work on Field elements because they aren't top-level elements
      ...ElemID.fromFullName(entry.key).createTopLevelParentID().path
    )
    return index.set(elemId.getFullName(), entry.value)
  }))
}

export const renameElement = async (
  elementsSource: ElementsSource,
  sourceElemId: ElemID,
  targetElemId: ElemID,
  index?: PathIndex
): Promise<DetailedChange[]> => {
  const source = await elementsSource.get(sourceElemId)
  const elements = index === undefined
    ? [source]
    : await splitElementByPath(source, index) as InstanceElement[]

  const elementChanges = getRenameElementChanges(sourceElemId, targetElemId, elements)
  const referencesChanges = await getRenameReferencesChanges(elementsSource, sourceElemId,
    targetElemId)

  if (index !== undefined) {
    await renameElementPathIndex(index, elements, sourceElemId, targetElemId)
  }

  return [...elementChanges, ...referencesChanges]
}

const getUpdatedTopLevelElements = async (
  elementsSource: ElementsSource,
  changes: DetailedChange[]
): Promise<Element[]> => {
  const changesByTopLevelElemId = _.groupBy(
    changes, r => r.id.createTopLevelParentID().parent.getFullName()
  )

  return Promise.all(
    Object.entries(changesByTopLevelElemId).map(async ([elemId, changesInTopLevelElement]) => {
      const topLevelElem = await elementsSource.get(ElemID.fromFullName(elemId))
      changesInTopLevelElement.forEach(change =>
        setPath(topLevelElem, change.id, getChangeElement(change)))
      return topLevelElem
    })
  )
}

export const updateStateElements = async (
  stateSource: State,
  changes: DetailedChange[]
): Promise<number> => {
  const topLevelElementsChanges = changes.filter(change => change.id.isTopLevel())
  await Promise.all(topLevelElementsChanges.filter(change => ['remove', 'modify'].includes(change.action))
    .map(change => stateSource.remove(getChangeElement(change).elemID)))
  await Promise.all(topLevelElementsChanges.filter(change => ['add', 'modify'].includes(change.action))
    .map(change => stateSource.set(getChangeElement(change))))

  // Currently only modifying non-top-elements, not removing or adding
  const nestedElementsChanges = changes.filter(change => !change.id.isTopLevel() && change.action === 'modify')
  const updatedElements = await getUpdatedTopLevelElements(stateSource, nestedElementsChanges)
  await Promise.all(updatedElements.map(element => stateSource.set(element)))
  return topLevelElementsChanges.length + updatedElements.length
}
