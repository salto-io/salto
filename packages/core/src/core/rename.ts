/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ElemID,
  Element,
  isElement,
  InstanceElement,
  DetailedChangeWithBaseChange,
  toChange,
} from '@salto-io/adapter-api'
import { collections, values } from '@salto-io/lowerdash'
import { references as referencesUtils, detailedCompare, setPath, getDetailedChanges } from '@salto-io/adapter-utils'
import { ElementsSource, getElementsPathHints, PathIndex, splitElementByPath, Workspace } from '@salto-io/workspace'

const { awu } = collections.asynciterable
const { isDefined } = values
const { getReferences, getUpdatedReference } = referencesUtils

export class RenameElementIdError extends Error {
  constructor(message: string) {
    super(message)
    Object.setPrototypeOf(this, RenameElementIdError.prototype)
  }
}

export const renameChecks = async (workspace: Workspace, sourceElemId: ElemID, targetElemId: ElemID): Promise<void> => {
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
    throw new RenameElementIdError(
      `Currently supporting InstanceElement only (${sourceElemId.getFullName()} is of type '${sourceElemId.idType}')`,
    )
  }

  if (
    sourceElemId.adapter !== targetElemId.adapter ||
    sourceElemId.typeName !== targetElemId.typeName ||
    sourceElemId.idType !== targetElemId.idType
  ) {
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
  sourceElements: InstanceElement[],
): DetailedChangeWithBaseChange[] => {
  const removeChanges = getDetailedChanges(toChange({ before: sourceElements[0] }))

  const newElements = sourceElements.map(
    element =>
      new InstanceElement(targetElemId.name, element.refType, element.value, element.path, element.annotations),
  )

  newElements.forEach(element =>
    getReferences(element, sourceElemId).forEach(({ path, value }) =>
      setPath(element, path, getUpdatedReference(value, targetElemId)),
    ),
  )

  const addChanges = newElements.flatMap(element => getDetailedChanges(toChange({ after: element })))

  return removeChanges.concat(addChanges)
}

const getRenameReferencesChanges = async (
  elementsSource: ElementsSource,
  sourceElemId: ElemID,
  targetElemId: ElemID,
): Promise<DetailedChangeWithBaseChange[]> =>
  awu(await elementsSource.getAll())
    // filtering the renamed element - its references are taken care in getRenameElementChanges
    .filter(element => !sourceElemId.isEqual(element.elemID))
    .flatMap(async element => {
      const references = getReferences(element, sourceElemId)
      if (references.length === 0) {
        return []
      }
      const cloned = element.clone()
      references.forEach(({ path, value }) => setPath(cloned, path, getUpdatedReference(value, targetElemId)))
      return detailedCompare(element, cloned, { createFieldChanges: true })
    })
    .toArray()

const renameElementPathIndex = async (
  index: PathIndex,
  elementFragments: Element[],
  targetElemId: ElemID,
): Promise<void> => {
  // The renamed element will be located according to the element's path and not the actual
  // locations in the nacl. Such that if the user renamed the file before renaming the Element,
  // the renamed element will be placed in the original file name. This is because we use and update
  // the pathIndex and not the ChangeLocation (SourceMap) logic in the current implementation.
  const pathHints = getElementsPathHints(elementFragments)

  await Promise.all(pathHints.map(entry => index.delete(entry.key)))
  await Promise.all(
    pathHints.map(entry => {
      // this implementation works on InstanceElement only
      // it won't work on Field elements because they aren't top-level elements
      const elemId = targetElemId.createNestedID(...ElemID.fromFullName(entry.key).createTopLevelParentID().path)
      return index.set(elemId.getFullName(), entry.value)
    }),
  )
}

export const renameElement = async (
  elementsSource: ElementsSource,
  sourceElemId: ElemID,
  targetElemId: ElemID,
  index?: PathIndex,
): Promise<DetailedChangeWithBaseChange[]> => {
  const source = await elementsSource.get(sourceElemId)
  const elements = isDefined(index) ? await splitElementByPath(source, index) : [source]

  const elementChanges = getRenameElementChanges(sourceElemId, targetElemId, elements)
  const referencesChanges = await getRenameReferencesChanges(elementsSource, sourceElemId, targetElemId)

  if (isDefined(index)) {
    await renameElementPathIndex(index, elements, targetElemId)
  }

  return [...elementChanges, ...referencesChanges]
}
