/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
  StaticFile,
  isStaticFile,
  ReferenceType,
  REFERENCE_TYPES,
  REFERENCE_SOURCE_SCOPES,
  ReferenceSourceScope,
  isObjectType,
  isField,
  TypeReference,
  GLOBAL_ADAPTER,
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

export const REFERENCE_INDEXES_VERSION = 12
const REFERENCE_INDEXES_KEY = 'reference_indexes'

type ChangeReferences = {
  removed: ReferenceInfo[]
  currentAndNew: ReferenceInfo[]
}

export type ReferenceIndexEntry = {
  id: ElemID
} & Pick<ReferenceInfo, 'type' | 'sourceScope'>

type SerializedReferenceIndexEntry = {
  id: string
} & Pick<ReferenceInfo, 'type' | 'sourceScope'>

const isValidReferenceSourceScope = (value: unknown): value is ReferenceSourceScope | undefined =>
  value === undefined || (_.isString(value) && (REFERENCE_SOURCE_SCOPES as ReadonlyArray<string>).includes(value))

const isValidReferenceType = (value: unknown): value is ReferenceType =>
  _.isString(value) && (REFERENCE_TYPES as ReadonlyArray<string>).includes(value)

export const isSerliazedReferenceIndexEntry = (value: unknown): value is SerializedReferenceIndexEntry =>
  _.isString(_.get(value, 'id')) &&
  isValidReferenceType(_.get(value, 'type')) &&
  isValidReferenceSourceScope(_.get(value, 'sourceScope'))

export type ReferenceTargetIndexValue = collections.treeMap.TreeMap<ReferenceIndexEntry>

export type ReferenceIndexesGetCustomReferencesFunc = (elements: Element[]) => Promise<ReferenceInfo[]>

const getReferenceDetailsIdentifier = (referenceDetails: ReferenceInfo): string =>
  `${referenceDetails.target.getFullName()} - ${referenceDetails.source.getFullName()}`

const toRefTypeReference = ({
  elemID,
  refType,
}: {
  elemID: ElemID
  refType: TypeReference
}): ReferenceInfo | undefined => {
  const target = ElemID.getTypeOrContainerTypeID(refType.elemID)
  if (target.adapter !== GLOBAL_ADAPTER) {
    return { source: elemID, target, type: 'strong' }
  }
  return undefined
}

const getReferencesFromFieldRefTypes = (element: Element): ReferenceInfo[] => {
  if (isField(element)) {
    const reference = toRefTypeReference(element)
    return reference !== undefined ? [reference] : []
  }
  if (isObjectType(element)) {
    return Object.values(element.fields).flatMap(field => toRefTypeReference(field) ?? [])
  }
  return []
}

const getReferencesFromAnnotationRefTypes = (element: Element): ReferenceInfo[] =>
  Object.entries(element.annotationRefTypes).flatMap(
    ([annoName, refType]) =>
      toRefTypeReference({
        elemID: element.elemID.createNestedID('annotation', annoName),
        refType,
      }) ?? [],
  )

const getReferenceFromMetaType = (element: Element): ReferenceInfo | undefined => {
  if (isObjectType(element) && element.metaType !== undefined) {
    return toRefTypeReference({ elemID: element.elemID, refType: element.metaType })
  }
  return undefined
}

const getReferencesFromTemplateStaticFile = async ({
  value,
  source,
}: {
  value: StaticFile
  source: ElemID
}): Promise<ReferenceInfo[]> => {
  const templateExpression = await parserUtils.staticFileToTemplateExpression(value)
  if (templateExpression !== undefined) {
    return templateExpression.parts
      .filter(isReferenceExpression)
      .map(ref => ({ source, target: ref.elemID, type: 'strong' }))
  }
  return []
}

const getReferences = async (element: Element, customReferences: ReferenceInfo[]): Promise<ReferenceInfo[]> => {
  const referenceInfos: ReferenceInfo[] = []
  const templateStaticFiles: { value: StaticFile; source: ElemID }[] = []
  walkOnElement({
    element,
    func: ({ value, path: source }) => {
      if (isReferenceExpression(value)) {
        referenceInfos.push({ source, target: value.elemID, type: 'strong' })
      }
      if (isTemplateExpression(value)) {
        value.parts.filter(isReferenceExpression).forEach(ref => {
          referenceInfos.push({ source, target: ref.elemID, type: 'strong' })
        })
      }
      if (isStaticFile(value) && value.isTemplate) {
        templateStaticFiles.push({ value, source })
      }
      return WALK_NEXT_STEP.RECURSE
    },
  })

  const templateExpressionReferences = await Promise.all(templateStaticFiles.map(getReferencesFromTemplateStaticFile))

  const fieldRefTypesReferences = getReferencesFromFieldRefTypes(element)
  const annotationRefTypesReferences = getReferencesFromAnnotationRefTypes(element)
  const metaTypeRefTypeReference = getReferenceFromMetaType(element) ?? []

  return _.uniqBy(
    // `customReferences` should be the first on this list, so in case that a referenceInfo appears more than
    // once we'll take it from `customReferences` (uniqBy keeps the first occurrence of each unique item).
    customReferences
      .concat(templateExpressionReferences.flat())
      .concat(referenceInfos)
      .concat(fieldRefTypesReferences)
      .concat(annotationRefTypesReferences)
      .concat(metaTypeRefTypeReference),
    getReferenceDetailsIdentifier,
  )
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

const createReferenceTree = (references: ReferenceInfo[], rootFields = false): ReferenceTargetIndexValue => {
  const toReferenceTargetIndexEntry = (referenceInfo: ReferenceInfo): ReferenceIndexEntry =>
    referenceInfo.sourceScope
      ? { id: referenceInfo.target, type: referenceInfo.type, sourceScope: referenceInfo.sourceScope }
      : { id: referenceInfo.target, type: referenceInfo.type }
  return new collections.treeMap.TreeMap(
    references.map(ref => {
      // In case we are creating a reference tree for a type object, the fields path is not relevant
      // This is because a request for the field's references will be to the field itself, and not through the object
      const key =
        rootFields && ref.source.idType === 'field'
          ? ''
          : ref.source.createBaseID().path.join(ElemID.NAMESPACE_SEPARATOR)
      return [key, [toReferenceTargetIndexEntry(ref)]]
    }),
    ElemID.NAMESPACE_SEPARATOR,
  )
}

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
  addedSources: ReferenceIndexEntry[],
  oldSources: ReferenceIndexEntry[],
  allChangedReferenceSources: Set<string>,
): RemoteMapEntry<ReferenceIndexEntry[]> => {
  const unchangedReferenceSources = oldSources.filter(
    entry => !allChangedReferenceSources.has(entry.id.createTopLevelParentID().parent.getFullName()),
  )

  return { key: id, value: _.concat(unchangedReferenceSources, addedSources) }
}

const getReferenceSourcesMap = (references: ReferenceInfo[]): Record<string, ReferenceIndexEntry[]> => {
  const toReferenceSourcesIndexEntry = (referenceInfo: ReferenceInfo): ReferenceIndexEntry =>
    referenceInfo.sourceScope
      ? { id: referenceInfo.source, type: referenceInfo.type, sourceScope: referenceInfo.sourceScope }
      : { id: referenceInfo.source, type: referenceInfo.type }
  const referenceSourcesChanges: Record<string, ReferenceIndexEntry[]> = _(references)
    .groupBy(({ target }) => target.createBaseID().parent.getFullName())
    .mapValues(refs => refs.map(toReferenceSourcesIndexEntry))
    .value()

  // Add to a type its fields references
  Object.entries(referenceSourcesChanges).forEach(([targetId, sourceIds]) => {
    const elemId = ElemID.fromFullName(targetId)
    if (elemId.idType === 'field') {
      const topLevelId = elemId.createTopLevelParentID().parent.getFullName()
      if (referenceSourcesChanges[topLevelId] === undefined) {
        referenceSourcesChanges[topLevelId] = []
      }
      referenceSourcesChanges[topLevelId] = referenceSourcesChanges[topLevelId].concat(sourceIds)
    }
  })
  return referenceSourcesChanges
}

const updateReferenceSourcesIndex = async (
  changes: Change<Element>[],
  index: RemoteMap<ReferenceIndexEntry[]>,
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
    value: _.uniqBy(modification.value, entry => entry.id.getFullName()),
  }))
  await Promise.all([
    modifications.length !== 0 ? index.setAll(uniqueModification) : undefined,
    deletions.length !== 0 ? index.deleteAll(deletions.map(deletion => deletion.key)) : undefined,
  ])
}

const getIdToCustomReferences = async (
  getCustomReferences: ReferenceIndexesGetCustomReferencesFunc,
  changes: Change<Element>[],
): Promise<{ before: Record<string, ReferenceInfo[]>; after: Record<string, ReferenceInfo[]> }> =>
  log.timeDebug(
    async () => {
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
    },
    'getIdToCustomReferences for %d changes',
    changes.length,
  )

export const updateReferenceIndexes = async (
  changes: Change<Element>[],
  referenceTargetsIndex: RemoteMap<ReferenceTargetIndexValue>,
  referenceSourcesIndex: RemoteMap<ReferenceIndexEntry[]>,
  mapVersions: RemoteMap<number>,
  elementsSource: ElementsSource,
  isCacheValid: boolean,
  getCustomReferences: ReferenceIndexesGetCustomReferencesFunc,
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

    const customReferences = await getIdToCustomReferences(getCustomReferences, relevantChanges)

    const changeToReferences = Object.fromEntries(
      await awu(relevantChanges)
        .map(async change => [
          getChangeData(change).elemID.getFullName(),
          await getReferencesFromChange(change, customReferences),
        ])
        .toArray(),
    )
    log.debug('calculated references for %d changes, updating indexes', relevantChanges.length)

    // Outgoing references
    await updateReferenceTargetsIndex(relevantChanges, referenceTargetsIndex, changeToReferences)
    // Incoming references
    await updateReferenceSourcesIndex(relevantChanges, referenceSourcesIndex, changeToReferences, initialIndex)
  }, 'updating references indexes')
