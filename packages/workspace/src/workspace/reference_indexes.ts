/*
*                      Copyright 2023 Salto Labs Ltd.
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
import {
  Change,
  ElemID,
  getChangeData,
  isReferenceExpression,
  Element,
  isModificationChange,
  isRemovalOrModificationChange,
  isAdditionOrModificationChange,
  isTemplateExpression,
  ReferenceMapping,
  isObjectTypeChange,
} from '@salto-io/adapter-api'
import { walkOnElement, WALK_NEXT_STEP } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import { ElementsSource } from './elements_source'
import { getAllElementsChanges } from './index_utils'
import { RemoteMap, RemoteMapEntry } from './remote_map'

const log = logger(module)
export const REFERENCE_INDEXES_VERSION = 4
export const REFERENCE_INDEXES_KEY = 'reference_indexes'

type ChangeReferences = {
  removed: ReferenceMapping[]
  currentAndNew: ReferenceMapping[]
}

const getReferences = (element: Element): ReferenceMapping[] => {
  const references: ReferenceMapping[] = []
  walkOnElement({
    element,
    func: ({ value, path: source }) => {
      if (isReferenceExpression(value)) {
        references.push({ source, target: value.elemID })
      }
      if (isTemplateExpression(value)) {
        value.parts.forEach(part => {
          if (isReferenceExpression(part)) {
            references.push({ source, target: part.elemID })
          }
        })
      }
      return WALK_NEXT_STEP.RECURSE
    },
  })
  return references
}

const getReferenceDetailsIdentifier = (referenceDetails: ReferenceMapping): string =>
  `${referenceDetails.target.getFullName()} - ${referenceDetails.source.getFullName()}`

const getReferencesFromChange = (change: Change<Element>): ChangeReferences => {
  const before = isRemovalOrModificationChange(change) ? getReferences(change.data.before) : []
  const after = isAdditionOrModificationChange(change) ? getReferences(change.data.after) : []

  const afterIds = new Set(after.map(getReferenceDetailsIdentifier))
  const removedReferences = before.filter(ref => !afterIds.has(getReferenceDetailsIdentifier(ref)))
  return {
    removed: removedReferences,
    currentAndNew: after,
  }
}

const createReferenceTree = (references: ReferenceMapping[], rootFields = false): collections.treeMap.TreeMap<ElemID> =>
  new collections.treeMap.TreeMap<ElemID>(
    references.map(
      ref => {
        // In case we are creating a reference tree for a type object, the fields path is not relevant
        // This is because a request for the field's references will be to the field itself, and not through the object
        const key = rootFields && ref.source.idType === 'field'
          ? ''
          : ref.source.createBaseID().path.join(ElemID.NAMESPACE_SEPARATOR)
        return [key, [ref.target]]
      }
    ),
    ElemID.NAMESPACE_SEPARATOR
  )

const getReferenceTargetIndexUpdates = (
  change: Change<Element>,
  changeToReferences: Record<string, ChangeReferences>,
): RemoteMapEntry<collections.treeMap.TreeMap<ElemID>>[] => {
  const indexUpdates: RemoteMapEntry<collections.treeMap.TreeMap<ElemID>>[] = []

  if (isObjectTypeChange(change)) {
    const objectType = getChangeData(change)
    const elemId = objectType.elemID.getFullName()

    const baseIdToReferences = _.groupBy(
      changeToReferences[elemId].currentAndNew,
      reference => reference.source.createBaseID().parent.getFullName()
    )

    const allFields = isModificationChange(change)
      ? {
        ...change.data.before.fields,
        ...objectType.fields,
      }
      : objectType.fields

    indexUpdates.push(
      ...Object.values(allFields)
        .map(field => ({
          key: field.elemID.getFullName(),
          value: createReferenceTree(baseIdToReferences[field.elemID.getFullName()] ?? []),
        }))
    )
  }
  const elemId = getChangeData(change).elemID.getFullName()
  indexUpdates.push({
    key: elemId,
    value: createReferenceTree(changeToReferences[elemId].currentAndNew, true),
  })

  return indexUpdates
}

const updateReferenceTargetsIndex = async (
  changes: Change<Element>[],
  referenceTargetsIndex: RemoteMap<collections.treeMap.TreeMap<ElemID>>,
  changeToReferences: Record<string, ChangeReferences>,
): Promise<void> => {
  const changesTrees = changes.flatMap(change => getReferenceTargetIndexUpdates(change, changeToReferences))
  const [toAdd, toDelete] = _.partition(changesTrees, change => change.value.size > 0)

  await Promise.all([
    referenceTargetsIndex.setAll(toAdd),
    referenceTargetsIndex.deleteAll(toDelete.map(change => change.key)),
  ])
}

const updateIdOfReferenceSourcesIndex = (
  id: string,
  addedSources: ElemID[],
  oldSources: ElemID[],
  allChangedReferenceSources: Set<string>,
): RemoteMapEntry<ElemID[]> => {
  const unchangedReferenceSources = oldSources.filter(
    elemId => !allChangedReferenceSources.has(elemId.createTopLevelParentID().parent.getFullName())
  )

  return { key: id, value: _.concat(unchangedReferenceSources, addedSources) }
}

const getReferenceSourcesMap = (
  references: ReferenceMapping[],
): Record<string, ElemID[]> => {
  const referenceSourcesChanges = _(references)
    .groupBy(({ target }) => target.createBaseID().parent.getFullName())
    .mapValues(refs => refs.map(ref => ref.source))
    .value()

  // Add to a type its fields references
  Object.entries(referenceSourcesChanges).forEach(([targetId, sourceIds]) => {
    const elemId = ElemID.fromFullName(targetId)
    if (elemId.idType === 'field') {
      const topLevelId = elemId.createTopLevelParentID().parent.getFullName()
      if (referenceSourcesChanges[topLevelId] === undefined) {
        referenceSourcesChanges[topLevelId] = []
      }
      referenceSourcesChanges[topLevelId].push(...sourceIds)
    }
  })
  return referenceSourcesChanges
}

const updateReferenceSourcesIndex = async (
  changes: Change<Element>[],
  index: RemoteMap<ElemID[]>,
  changeToReferences: Record<string, ChangeReferences>,
  initialIndex: boolean
): Promise<void> => {
  const removedReferences = Object.values(changeToReferences).flatMap(change => change.removed)
  const addedReferences = Object.values(changeToReferences).flatMap(change => change.currentAndNew)

  const referenceSourcesAdditions = getReferenceSourcesMap(addedReferences)
  const referenceSourcesRemovals = getReferenceSourcesMap(removedReferences)

  const changedReferenceSources = new Set(
    changes
      .map(getChangeData)
      .map(elem => elem.elemID.getFullName())
  )

  const relevantKeys = _(referenceSourcesAdditions)
    .keys()
    .concat(Object.keys(referenceSourcesRemovals))
    .uniq()
    .value()

  const oldReferencesSources = initialIndex
    ? {}
    : _(await index.getMany(relevantKeys))
      .map((ids, i) => ({ ids, i }))
      .keyBy(({ i }) => relevantKeys[i])
      .mapValues(({ ids }) => ids)
      .value()

  const updates = relevantKeys
    .map(id =>
      updateIdOfReferenceSourcesIndex(
        id,
        referenceSourcesAdditions[id] ?? [],
        oldReferencesSources[id] ?? [],
        changedReferenceSources,
      ))

  const [deletions, modifications] = _.partition(updates, update => update.value.length === 0)
  const uniqueModification = modifications.map(modification => ({
    ...modification,
    value: _.uniqBy(modification.value, id => id.getFullName()),
  }))
  await Promise.all([
    modifications.length !== 0 ? index.setAll(uniqueModification) : undefined,
    deletions.length !== 0 ? index.deleteAll(deletions.map(deletion => deletion.key)) : undefined,
  ])
}

export const updateReferenceIndexes = async (
  changes: Change<Element>[],
  referenceTargetsIndex: RemoteMap<collections.treeMap.TreeMap<ElemID>>,
  referenceSourcesIndex: RemoteMap<ElemID[]>,
  mapVersions: RemoteMap<number>,
  elementsSource: ElementsSource,
  isCacheValid: boolean,
): Promise<void> => log.time(async () => {
  let relevantChanges = changes
  let initialIndex = false
  const isVersionMatch = await mapVersions.get(REFERENCE_INDEXES_KEY) === REFERENCE_INDEXES_VERSION
  if (!isCacheValid || !isVersionMatch) {
    if (!isVersionMatch) {
      relevantChanges = await getAllElementsChanges(changes, elementsSource)
      log.info('references indexes maps are out of date, re-indexing')
    }
    if (!isCacheValid) {
      // When cache is invalid, changes will include all of the elements in the workspace.
      log.info('cache is invalid, re-indexing references indexes')
    }
    await Promise.all([
      referenceTargetsIndex.clear(),
      referenceSourcesIndex.clear(),
      mapVersions.set(REFERENCE_INDEXES_KEY, REFERENCE_INDEXES_VERSION),
    ])
    initialIndex = true
  }

  const changeToReferences = Object.fromEntries(relevantChanges
    .map(change => [
      getChangeData(change).elemID.getFullName(),
      getReferencesFromChange(change),
    ]))

  // Outgoing references
  await updateReferenceTargetsIndex(
    relevantChanges,
    referenceTargetsIndex,
    changeToReferences,
  )
  // Incoming references
  await updateReferenceSourcesIndex(
    relevantChanges,
    referenceSourcesIndex,
    changeToReferences,
    initialIndex,
  )
}, 'updating references indexes')
