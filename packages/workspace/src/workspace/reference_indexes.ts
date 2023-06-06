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
  isRemovalChange,
  isObjectType,
  isField,
} from '@salto-io/adapter-api'
import { walkOnElement, WALK_NEXT_STEP } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import { ElementsSource } from './elements_source'
import { getAllElementsChanges } from './index_utils'
import { RemoteMap, RemoteMapEntry } from './remote_map'

const { awu } = collections.asynciterable

const log = logger(module)
export const REFERENCE_INDEXES_VERSION = 2
export const REFERENCE_INDEXES_KEY = 'reference_indexes'

type ReferenceDetails = {
  referenceSource: ElemID
  referenceTarget: ElemID
}

type ChangeReferences = {
  removed: ReferenceDetails[]
  currentAndNew: ReferenceDetails[]
}

/**
 * Walks over an element and map each reference to the path it is in inside the element
 * In case of an element inside the element (eg. object type field), a new tree is created for it
 */
const getReferencesTrees = (element: Element): Record<string, collections.treeMap.TreeMap<ElemID>> => {
  const currentElementTree = new collections.treeMap.TreeMap<ElemID>()
  // Because object type fields are elements themselves, each of them will be a separate index entry
  const elemFullNameToReferencesTree = {
    [element.elemID.getFullName()]: currentElementTree,
  }
  walkOnElement({
    element,
    func: ({ value, path }) => {
      if (isObjectType(element) && isField(value)) {
        const fieldReferencesTrees = getReferencesTrees(value)
        Object.assign(elemFullNameToReferencesTree, fieldReferencesTrees)
        return WALK_NEXT_STEP.SKIP
      }
      if (isReferenceExpression(value)) {
        currentElementTree.push(path.getFullName(), value.elemID)
        return WALK_NEXT_STEP.SKIP
      }
      if (isTemplateExpression(value)) {
        value.parts.forEach(part => {
          if (isReferenceExpression(part)) {
            currentElementTree.push(path.getFullName(), part.elemID)
          }
        })
        return WALK_NEXT_STEP.SKIP
      }
      return WALK_NEXT_STEP.RECURSE
    },
  })
  return elemFullNameToReferencesTree
}

const getReferences = (element: Element): ReferenceDetails[] => {
  const references: ReferenceDetails[] = []
  walkOnElement({
    element,
    func: ({ value, path: referenceSource }) => {
      if (isReferenceExpression(value)) {
        references.push({ referenceSource, referenceTarget: value.elemID })
      }
      if (isTemplateExpression(value)) {
        value.parts.forEach(part => {
          if (isReferenceExpression(part)) {
            references.push({ referenceSource, referenceTarget: part.elemID })
          }
        })
      }
      return WALK_NEXT_STEP.RECURSE
    },
  })
  return references
}

const getReferenceDetailsIdentifier = (referenceDetails: ReferenceDetails): string =>
  `${referenceDetails.referenceTarget.getFullName()} - ${referenceDetails.referenceSource.getFullName()}`

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

const updateUniqueIndex = async (
  index: RemoteMap<ElemID[]>,
  updates: RemoteMapEntry<ElemID[]>[]
): Promise<void> => {
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

const updateReferenceTargetsIndex = async (
  changes: Change<Element>[],
  index: RemoteMap<collections.treeMap.TreeMap<ElemID>>,
): Promise<void> => {
  const referencesToDelete: string[] = []
  const referencesToSet: RemoteMapEntry<collections.treeMap.TreeMap<ElemID>>[] = []

  await awu(changes).forEach(async change => {
    if (isRemovalChange(change)) {
      referencesToDelete.push(change.data.before.elemID.getFullName())
      // Removal of object type also requires the removal of all its fields
      if (isObjectType(change.data.before)) {
        change.data.before.getFieldsElemIDsFullName().forEach(fieldFullName => {
          referencesToDelete.push(fieldFullName)
        })
      }
    } else {
      const afterFullNameToReferencesTrees = getReferencesTrees(change.data.after)
      // Addition and modification are the same in this case
      Object.entries(afterFullNameToReferencesTrees).forEach(([ref, referencesTree]) => {
        if (referencesTree.size > 0) {
          referencesToSet.push({ key: ref, value: referencesTree })
        }
      })

      // In case of a modification change, we also need to delete object's field references that no longer exists
      if (isModificationChange(change)) {
        const beforeFullNameToReferencesTrees = getReferencesTrees(change.data.before)

        const beforeFullNames = new Set(Object.keys(beforeFullNameToReferencesTrees))
        const afterFullNames = new Set(Object.keys(afterFullNameToReferencesTrees))

        beforeFullNames.forEach(fullName => {
          if (!afterFullNames.has(fullName)) {
            referencesToDelete.push(fullName)
          }
        })
      }
    }
  })

  await index.deleteAll(referencesToDelete)
  await index.setAll(referencesToSet)
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
  references: ReferenceDetails[],
): Record<string, ElemID[]> => {
  const referenceSourcesChanges = _(references)
    .groupBy(({ referenceTarget }) => referenceTarget.createBaseID().parent.getFullName())
    .mapValues(refs => refs.map(ref => ref.referenceSource))
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

  await updateUniqueIndex(index, updates)
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
  )

  // Incoming references
  await updateReferenceSourcesIndex(
    relevantChanges,
    referenceSourcesIndex,
    changeToReferences,
    initialIndex,
  )
}, 'updating references indexes')
