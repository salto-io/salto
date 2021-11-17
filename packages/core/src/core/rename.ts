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
import { ElemID, Element, isElement, InstanceElement, DetailedChange,
  isReferenceExpression, ReferenceExpression, getChangeElement, isRemovalOrModificationChange,
  isAdditionOrModificationChange } from '@salto-io/adapter-api'
import { collections, values } from '@salto-io/lowerdash'
import { applyDetailedChanges, walkOnElement, WalkOnFunc, WALK_NEXT_STEP } from '@salto-io/adapter-utils'
import { ElementsSource, getElementsPathHints, PathIndex, splitElementByPath, State, Workspace } from '@salto-io/workspace'

const { awu } = collections.asynciterable
const { isDefined } = values

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
    throw new RenameElementIdError('Source element should be top level')
  }

  if (!targetElemId.isTopLevel()) {
    throw new RenameElementIdError('Target element should be top level')
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
  if (!isDefined(sourceElement) || !isElement(sourceElement)) {
    throw new RenameElementIdError(`Did not find any matches for element ${sourceElemId.getFullName()}`)
  }

  if (isDefined(await workspace.getValue(targetElemId))) {
    throw new RenameElementIdError(`Element ${targetElemId.getFullName()} already exists`)
  }

  if (await workspace.state().has(targetElemId)) {
    throw new RenameElementIdError(`Cannot rename to the removed element id ${targetElemId.getFullName()}`)
  }
}

const getRenameElementChanges = (
  sourceElemId: ElemID,
  targetElemId: ElemID,
  sourceElements: InstanceElement[]
): DetailedChange[] => {
  const removeChange = {
    id: sourceElemId,
    action: 'remove' as const,
    data: {
      before: sourceElements[0],
    },
  }

  const addChanges = sourceElements.map(element => ({
    id: targetElemId,
    action: 'add' as const,
    data: {
      after: new InstanceElement(
        targetElemId.name,
        element.refType,
        element.value,
        element.path,
        element.annotations
      ),
    },
  }))

  return [removeChange, ...addChanges]
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
      targetElemId.createNestedID(...reference.value.elemID.createTopLevelParentID().path),
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
  elementFragments: Element[],
  targetElemId: ElemID
): Promise<void> => {
  // The renamed element will be located according to the element's path and not the actual
  // locations in the nacl. Such that if the user renamed the file before renaming the Element,
  // the renamed element will be placed in the original file name. This is because we use and update
  // the pathIndex and not the ChangeLocation (SourceMap) logic in the current implementation.
  const pathHints = getElementsPathHints(elementFragments)

  await Promise.all(pathHints.map(entry => index.delete(entry.key)))
  await Promise.all(pathHints.map(entry => {
    // this implementation works on InstanceElement only
    // it won't work on Field elements because they aren't top-level elements
    const elemId = targetElemId.createNestedID(...ElemID.fromFullName(entry.key)
      .createTopLevelParentID().path)
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
  const elements = isDefined(index)
    ? await splitElementByPath(source, index)
    : [source]

  const elementChanges = getRenameElementChanges(sourceElemId, targetElemId, elements)
  const referencesChanges = await getRenameReferencesChanges(
    elementsSource,
    sourceElemId,
    targetElemId
  )

  if (isDefined(index)) {
    await renameElementPathIndex(index, elements, targetElemId)
  }

  return [...elementChanges, ...referencesChanges]
}

const getUpdatedTopLevelElements = async (
  elementsSource: ElementsSource,
  changes: DetailedChange[]
): Promise<Element[]> => {
  const changesByTopLevelElemId = _.groupBy(
    changes, change => change.id.createTopLevelParentID().parent.getFullName()
  )

  const topLevelElements = await Promise.all(
    Object.entries(changesByTopLevelElemId).map(async ([elemId, changesInTopLevelElement]) => {
      const topLevelElem = await elementsSource.get(ElemID.fromFullName(elemId))
      if (isDefined(topLevelElem)) {
        applyDetailedChanges(topLevelElem, changesInTopLevelElement)
      }
      return topLevelElem
    })
  )

  return topLevelElements.filter(isDefined)
}

export const updateStateElements = async (
  stateSource: State,
  changes: DetailedChange[]
): Promise<void> => {
  const [topLevelElementsChanges, nestedElementsChanges] = _.partition(
    changes, change => change.id.isTopLevel()
  )

  await Promise.all(topLevelElementsChanges.filter(isRemovalOrModificationChange)
    .map(change => stateSource.remove(change.id)))
  await Promise.all(topLevelElementsChanges.filter(isAdditionOrModificationChange)
    .map(change => stateSource.set(getChangeElement(change))))

  const updatedElements = await getUpdatedTopLevelElements(stateSource, nestedElementsChanges)
  await Promise.all(updatedElements.map(element => stateSource.set(element)))
}
