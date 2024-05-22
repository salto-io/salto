/*
 *                      Copyright 2024 Salto Labs Ltd.
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
  isObjectTypeChange,
  ReferenceInfo,
  ReferenceType,
  TemplateExpression,
  StaticFile,
  isStaticFile,
} from '@salto-io/adapter-api'
import { walkOnElement, WALK_NEXT_STEP } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import { parserUtils } from '@salto-io/parser'
import { ElementsSource } from './elements_source'
import { getAllElementsChanges } from './index_utils'
import { RemoteMap, RemoteMapEntry } from './remote_map'

const log = logger(module)
const { awu } = collections.asynciterable

export const REFERENCE_INDEXES_VERSION = 9
export const REFERENCE_INDEXES_KEY = 'reference_indexes'

type ChangeReferences = {
  removed: ReferenceInfo[]
  currentAndNew: ReferenceInfo[]
}

export type ReferenceTargetIndexValue = collections.treeMap.TreeMap<{ id: ElemID; type: ReferenceType }>

type GetCustomReferencesFunc = (elements: Element[]) => Promise<ReferenceInfo[]>

const getReferenceDetailsIdentifier = (referenceDetails: ReferenceInfo): string =>
  `${referenceDetails.target.getFullName()} - ${referenceDetails.source.getFullName()}`

const getReferences = async (element: Element, customReferences: ReferenceInfo[]): Promise<ReferenceInfo[]> => {
  const references: Record<string, ReferenceInfo> = {}
  const templateStaticFiles: { value: StaticFile; source: ElemID }[] = []
  const getReferencesFromTemplateExpression = (source: ElemID, template?: TemplateExpression): void => {
    template?.parts.forEach(part => {
      if (isReferenceExpression(part)) {
        const refInfo = { source, target: part.elemID, type: 'strong' as const }
        references[getReferenceDetailsIdentifier(refInfo)] = refInfo
      }
    })
  }
  walkOnElement({
    element,
    func: ({ value, path: source }) => {
      if (isReferenceExpression(value)) {
        const refInfo = { source, target: value.elemID, type: 'strong' as const }
        references[getReferenceDetailsIdentifier(refInfo)] = refInfo
      }
      if (isTemplateExpression(value)) {
        getReferencesFromTemplateExpression(source, value)
      }
      if (isStaticFile(value) && value.isTemplate) {
        templateStaticFiles.push({ value, source })
      }
      return WALK_NEXT_STEP.RECURSE
    },
  })

  customReferences.forEach(refInfo => {
    references[getReferenceDetailsIdentifier(refInfo)] = refInfo
  })
  const templateExpressions = await Promise.all(
    templateStaticFiles.map(async fileObj => {
      const expression = await parserUtils.staticFileToTemplateExpression(fileObj.value)
      return { expression, source: fileObj.source }
    }),
  )
  templateExpressions.forEach(fileObj => {
    getReferencesFromTemplateExpression(fileObj.source, fileObj.expression)
  })

  return Object.values(references)
}

const getReferencesFromChange = async (
  change: Change<Element>,
  customReferences: { before: Record<string, ReferenceInfo[]>; after: Record<string, ReferenceInfo[]> },
): Promise<ChangeReferences> => {
  const fullName = getChangeData(change).elemID.getFullName()

  const before = isRemovalOrModificationChange(change)
    ? await getReferences(change.data.before, customReferences.before[fullName] ?? [])
    : []
  const after = isAdditionOrModificationChange(change)
    ? await getReferences(change.data.after, customReferences.after[fullName] ?? [])
    : []

  const afterIds = new Set(after.map(getReferenceDetailsIdentifier))
  const removedReferences = before.filter(ref => !afterIds.has(getReferenceDetailsIdentifier(ref)))
  return {
    removed: removedReferences,
    currentAndNew: after,
  }
}

const createReferenceTree = (references: ReferenceInfo[], rootFields = false): ReferenceTargetIndexValue =>
  new collections.treeMap.TreeMap(
    references.map(ref => {
      // In case we are creating a reference tree for a type object, the fields path is not relevant
      // This is because a request for the field's references will be to the field itself, and not through the object
      const key =
        rootFields && ref.source.idType === 'field'
          ? ''
          : ref.source.createBaseID().path.join(ElemID.NAMESPACE_SEPARATOR)
      return [key, [{ id: ref.target, type: ref.type }]]
    }),
    ElemID.NAMESPACE_SEPARATOR,
  )

const getReferenceTargetIndexUpdates = (
  change: Change<Element>,
  changeToReferences: Record<string, ChangeReferences>,
): RemoteMapEntry<ReferenceTargetIndexValue>[] => {
  const indexUpdates: RemoteMapEntry<ReferenceTargetIndexValue>[] = []

  if (isObjectTypeChange(change)) {
    const objectType = getChangeData(change)
    const elemId = objectType.elemID.getFullName()

    const baseIdToReferences = _.groupBy(changeToReferences[elemId].currentAndNew, reference =>
      reference.source.createBaseID().parent.getFullName(),
    )

    const allFields = isModificationChange(change)
      ? {
          ...change.data.before.fields,
          ...objectType.fields,
        }
      : objectType.fields

    indexUpdates.push(
      ...Object.values(allFields).map(field => ({
        key: field.elemID.getFullName(),
        value: createReferenceTree(baseIdToReferences[field.elemID.getFullName()] ?? []),
      })),
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
  referenceTargetsIndex: RemoteMap<ReferenceTargetIndexValue>,
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
    elemId => !allChangedReferenceSources.has(elemId.createTopLevelParentID().parent.getFullName()),
  )

  return { key: id, value: _.concat(unchangedReferenceSources, addedSources) }
}

const getReferenceSourcesMap = (references: ReferenceInfo[]): Record<string, ElemID[]> => {
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
  initialIndex: boolean,
): Promise<void> => {
  const removedReferences = Object.values(changeToReferences).flatMap(change => change.removed)
  const addedReferences = Object.values(changeToReferences).flatMap(change => change.currentAndNew)

  const referenceSourcesAdditions = getReferenceSourcesMap(addedReferences)
  const referenceSourcesRemovals = getReferenceSourcesMap(removedReferences)

  const changedReferenceSources = new Set(changes.map(getChangeData).map(elem => elem.elemID.getFullName()))

  const relevantKeys = _(referenceSourcesAdditions).keys().concat(Object.keys(referenceSourcesRemovals)).uniq().value()

  const oldReferencesSources = initialIndex
    ? {}
    : _(await index.getMany(relevantKeys))
        .map((ids, i) => ({ ids, i }))
        .keyBy(({ i }) => relevantKeys[i])
        .mapValues(({ ids }) => ids)
        .value()

  const updates = relevantKeys.map(id =>
    updateIdOfReferenceSourcesIndex(
      id,
      referenceSourcesAdditions[id] ?? [],
      oldReferencesSources[id] ?? [],
      changedReferenceSources,
    ),
  )

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

const getIdToCustomReferences = async (
  getCustomReferences: GetCustomReferencesFunc,
  changes: Change<Element>[],
): Promise<{ before: Record<string, ReferenceInfo[]>; after: Record<string, ReferenceInfo[]> }> => {
  const customReferencesAfter = await getCustomReferences(
    changes.filter(isAdditionOrModificationChange).map(change => change.data.after),
  )

  const customReferencesBefore = await getCustomReferences(
    changes.filter(isRemovalOrModificationChange).map(change => change.data.before),
  )

  return {
    before: _.groupBy(customReferencesBefore, ref => ref.source.createTopLevelParentID().parent.getFullName()),
    after: _.groupBy(customReferencesAfter, ref => ref.source.createTopLevelParentID().parent.getFullName()),
  }
}

export const updateReferenceIndexes = async (
  changes: Change<Element>[],
  referenceTargetsIndex: RemoteMap<ReferenceTargetIndexValue>,
  referenceSourcesIndex: RemoteMap<ElemID[]>,
  mapVersions: RemoteMap<number>,
  elementsSource: ElementsSource,
  isCacheValid: boolean,
  getCustomReferences: GetCustomReferencesFunc,
): Promise<void> =>
  log.timeDebug(async () => {
    let relevantChanges = changes
    let initialIndex = false
    const isVersionMatch = (await mapVersions.get(REFERENCE_INDEXES_KEY)) === REFERENCE_INDEXES_VERSION
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

    const customReferences = await getIdToCustomReferences(getCustomReferences, changes)

    const changeToReferences = Object.fromEntries(
      await awu(relevantChanges)
        .map(async change => [
          getChangeData(change).elemID.getFullName(),
          await getReferencesFromChange(change, customReferences),
        ])
        .toArray(),
    )

    // Outgoing references
    await updateReferenceTargetsIndex(relevantChanges, referenceTargetsIndex, changeToReferences)
    // Incoming references
    await updateReferenceSourcesIndex(relevantChanges, referenceSourcesIndex, changeToReferences, initialIndex)
  }, 'updating references indexes')
