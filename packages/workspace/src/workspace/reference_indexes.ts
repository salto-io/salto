/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { Change, ElemID, getChangeData, isReferenceExpression, Element, isModificationChange, toChange, isObjectTypeChange, isRemovalOrModificationChange, isAdditionOrModificationChange } from '@salto-io/adapter-api'
import { walkOnElement, WALK_NEXT_STEP } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { ElementsSource } from './elements_source'
import { RemoteMap, RemoteMapEntry } from './remote_map'

const { awu } = collections.asynciterable

const log = logger(module)
export const REFERENCE_INDEXES_VERSION = 1
export const REFERENCE_INDEXES_KEY = 'reference_indexes'

type ReferenceDetails = {
  referenceSource: ElemID
  referenceTarget: ElemID
}

type ChangeReferences = {
  removed: ReferenceDetails[]
  currentAndNew: ReferenceDetails[]
}

const getReferences = (element: Element): ReferenceDetails[] => {
  const references: ReferenceDetails[] = []
  walkOnElement({
    element,
    func: ({ value, path: referenceSource }) => {
      if (isReferenceExpression(value)) {
        references.push({ referenceSource, referenceTarget: value.elemID })
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

const getReferenceTargetIndexUpdates = (
  change: Change<Element>,
  changeToReferences: Record<string, ChangeReferences>,
): RemoteMapEntry<ElemID[]>[] => {
  const indexUpdates: RemoteMapEntry<ElemID[]>[] = []

  const references = changeToReferences[getChangeData(change).elemID.getFullName()]
    .currentAndNew
  const baseIdToReferences = _(references)
    .groupBy(reference => reference.referenceSource.createBaseID().parent.getFullName())
    .mapValues(referencesGroup => referencesGroup.map(ref => ref.referenceTarget))
    .value()

  if (isObjectTypeChange(change)) {
    const type = getChangeData(change)

    const allFields = isModificationChange(change)
      ? {
        ...change.data.before.fields,
        ...type.fields,
      }
      : type.fields

    indexUpdates.push(
      ...Object.values(allFields)
        .map(field => ({
          key: field.elemID.getFullName(),
          value: baseIdToReferences[field.elemID.getFullName()] ?? [],
        }))
    )
  }
  const elemId = getChangeData(change).elemID.getFullName()
  indexUpdates.push({
    key: elemId,
    value: changeToReferences[elemId].currentAndNew
      .map(ref => ref.referenceTarget),
  })

  return indexUpdates
}

const updateReferenceTargetsIndex = async (
  changes: Change<Element>[],
  index: RemoteMap<ElemID[]>,
  changeToReferences: Record<string, ChangeReferences>
): Promise<void> => {
  const updates = changes.flatMap(
    change => getReferenceTargetIndexUpdates(change, changeToReferences)
  )

  await updateUniqueIndex(index, updates)
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

const getAllElementsChanges = async (
  currentChanges: Change<Element>[],
  elementsSource: ElementsSource,
): Promise<Change<Element>[]> => awu(elementsSource.getAll())
  .map(element => toChange({ after: element }))
  .concat(currentChanges)
  .toArray()

export const updateReferenceIndexes = async (
  changes: Change<Element>[],
  referenceTargetsIndex: RemoteMap<ElemID[]>,
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

  await updateReferenceTargetsIndex(
    relevantChanges,
    referenceTargetsIndex,
    changeToReferences,
  )
  await updateReferenceSourcesIndex(
    relevantChanges,
    referenceSourcesIndex,
    changeToReferences,
    initialIndex,
  )
}, 'updating references indexes')
