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
import { Change, ElemID, getChangeElement, isReferenceExpression, Element, isModificationChange, toChange, isObjectTypeChange, isRemovalOrModificationChange, isAdditionOrModificationChange } from '@salto-io/adapter-api'
import { walkOnElement, WALK_NEXT_STEP } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { ElementsSource } from './elements_source'
import { RemoteMap } from './remote_map'

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

const updateIndex = (index: RemoteMap<ElemID[]>, id: string, values: ElemID[]): Promise<void> => (
  values.length !== 0
    ? index.set(id, _.uniqBy(values, elemId => elemId.getFullName()))
    : index.delete(id)
)

const updateReferenceTargetsIndex = async (
  changes: Change<Element>[],
  index: RemoteMap<ElemID[]>,
  changeToReferences: Record<string, ChangeReferences>
): Promise<void> => {
  await Promise.all(changes.map(async change => {
    const references = changeToReferences[getChangeElement(change).elemID.getFullName()]
      .currentAndNew
    const baseIdToReferences = _(references)
      .groupBy(reference => reference.referenceSource.createBaseID().parent.getFullName())
      .mapValues(referencesGroup => referencesGroup.map(ref => ref.referenceTarget))
      .value()

    if (isObjectTypeChange(change)) {
      const type = getChangeElement(change)

      const allFields = isModificationChange(change)
        ? {
          ...change.data.before.fields,
          ...type.fields,
        }
        : type.fields
      await Promise.all(
        Object.values(allFields)
          .map(async field => updateIndex(
            index,
            field.elemID.getFullName(),
            baseIdToReferences[field.elemID.getFullName()] ?? []
          ))
      )
    }
    const elemId = getChangeElement(change).elemID.getFullName()
    await updateIndex(
      index,
      elemId,
      changeToReferences[elemId].currentAndNew
        .map(ref => ref.referenceTarget),
    )
  }))
}

const updateIdOfReferenceSourcesIndex = async (
  id: string,
  referenceSourcesGroup: ElemID[],
  allChangedReferenceSources: Set<string>,
  index: RemoteMap<ElemID[]>,
  changeToReferences: Record<string, ChangeReferences>,
): Promise<void> => {
  const oldReferenceSources = await index.get(id) ?? []

  const unchangedReferenceSources = oldReferenceSources.filter(
    elemId => !allChangedReferenceSources.has(elemId.createTopLevelParentID().parent.getFullName())
  )

  const currentId = ElemID.fromFullName(id)
  const changedReferenceSources = referenceSourcesGroup
    .flatMap(elemId => changeToReferences[elemId.getFullName()].currentAndNew)
    .filter(ref => currentId.isParentOf(ref.referenceTarget)
        || currentId.isEqual(ref.referenceTarget))
    .map(ref => ref.referenceSource)

  await updateIndex(index, id, _.concat(unchangedReferenceSources, changedReferenceSources))
}

const updateReferenceSourcesIndex = async (
  changes: Change<Element>[],
  index: RemoteMap<ElemID[]>,
  changeToReferences: Record<string, ChangeReferences>
): Promise<void> => {
  const removedReferences = Object.values(changeToReferences).flatMap(change => change.removed)
  const addedReferences = Object.values(changeToReferences).flatMap(change => change.currentAndNew)

  const referenceSourcesChanges = _(addedReferences)
    .concat(removedReferences)
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

  const changedReferenceSources = new Set(
    changes
      .map(getChangeElement)
      .map(elem => elem.elemID.getFullName())
  )

  await Promise.all(
    Object.entries(referenceSourcesChanges)
      .map(async ([id, referenceSourcesGroup]) => {
        await updateIdOfReferenceSourcesIndex(
          id,
          _.uniqBy(
            referenceSourcesGroup.map(elemId => elemId.createTopLevelParentID().parent),
            elemId => elemId.getFullName()
          ),
          changedReferenceSources,
          index,
          changeToReferences,
        )
      })
  )
}

const getAllElementsChanges = async (
  currentChanges: Change<Element>[],
  elementsSource: ElementsSource,
): Promise<Change<Element>[]> => awu(await elementsSource.getAll())
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
  }

  const changeToReferences = Object.fromEntries(relevantChanges
    .map(change => [
      getChangeElement(change).elemID.getFullName(),
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
  )
}, 'updating references indexes')
