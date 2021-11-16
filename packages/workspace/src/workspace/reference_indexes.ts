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
import { Change, ElemID, getChangeElement, isReferenceExpression, isRemovalChange, Element, isObjectType, isModificationChange, ModificationChange, toChange } from '@salto-io/adapter-api'
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
  referenceBy: ElemID
  reference: ElemID
}

const getReferences = (element: Element): ReferenceDetails[] => {
  const references: ReferenceDetails[] = []
  walkOnElement({
    element,
    func: ({ value, path: referenceBy }) => {
      if (isReferenceExpression(value)) {
        references.push({ referenceBy, reference: value.elemID })
      }
      return WALK_NEXT_STEP.RECURSE
    },
  })
  return references
}

const updateIndex = (index: RemoteMap<ElemID[]>, id: string, values: ElemID[]): Promise<void> => (
  values.length !== 0
    ? index.set(id, _.uniqBy(values, elemId => elemId.getFullName()))
    : index.delete(id)
)

const updateReferencesIndex = async (
  changes: Change<Element>[],
  index: RemoteMap<ElemID[]>,
  elementToReferences: Record<string, ReferenceDetails[]>
): Promise<void> => {
  await Promise.all(changes.map(async change => {
    const element = getChangeElement(change)

    const references = elementToReferences[element.elemID.getFullName()]
    const baseIdToReferences = !isRemovalChange(change) ? _(references)
      .groupBy(reference => reference.referenceBy.createBaseID().parent.getFullName())
      .mapValues(referencesGroup => referencesGroup.map(ref => ref.reference))
      .value() : {}

    if (isObjectType(element)) {
      await Promise.all(
        Object.values(element.fields)
          .map(async field => updateIndex(
            index,
            field.elemID.getFullName(),
            baseIdToReferences[field.elemID.getFullName()] ?? []
          ))
      )
    }
    await updateIndex(
      index,
      element.elemID.getFullName(),
      !isRemovalChange(change)
        ? elementToReferences[element.elemID.getFullName()].map(ref => ref.reference)
        : []
    )
  }))
}

const updateIdOfReferenceByIndex = async (
  id: string,
  referencesGroup: ReferenceDetails[],
  index: RemoteMap<ElemID[]>,
  elementToReferences: Record<string, ReferenceDetails[]>,
  idToAction: Record<string, string>,
): Promise<void> => {
  const oldReferencedBy = await index.get(id) ?? []

  const referenceByGroup = new Set(
    referencesGroup.map(ref => ref.referenceBy.createTopLevelParentID().parent.getFullName())
  )

  const newReferencedBy = oldReferencedBy.filter(
    elemId => !referenceByGroup.has(elemId.createTopLevelParentID().parent.getFullName())
  )

  newReferencedBy.push(
    ...Array.from(referenceByGroup)
      .flatMap(elemId => (idToAction[elemId] !== 'remove' ? elementToReferences[elemId] : []))
      .filter(ref => ElemID.fromFullName(id).isParentOf(ref.reference)
        || ElemID.fromFullName(id).isEqual(ref.reference))
      .map(ref => ref.referenceBy)
  )

  await updateIndex(index, id, _.uniq(newReferencedBy))
}

const getRemovedReferencesFromChange = (
  change: ModificationChange<Element>,
  elementToReferences: Record<string, ReferenceDetails[]>,
): ReferenceDetails[] => {
  const beforeReferences = getReferences(change.data.before)
  const afterReferences = elementToReferences[getChangeElement(change).elemID.getFullName()]
  return _.differenceBy(beforeReferences, afterReferences, ref => `${ref.reference.getFullName()} - ${ref.referenceBy.getFullName()}`)
}

const getRemovedReferences = (
  changes: Change<Element>[],
  elementToReferences: Record<string, ReferenceDetails[]>
): ReferenceDetails[] => changes
  .filter(isModificationChange)
  .flatMap(change => getRemovedReferencesFromChange(change, elementToReferences))

const updateReferencedByIndex = async (
  changes: Change<Element>[],
  index: RemoteMap<ElemID[]>,
  elementToReferences: Record<string, ReferenceDetails[]>
): Promise<void> => {
  const idToAction = _(changes)
    .keyBy(change => getChangeElement(change).elemID.getFullName())
    .mapValues(change => change.action)
    .value()

  const removedReferences = getRemovedReferences(changes, elementToReferences)

  const referenceByChanges = _(elementToReferences)
    .values()
    .concat(removedReferences)
    .flatten()
    .groupBy(({ reference }) => reference.createBaseID().parent.getFullName())
    .value()

  // Add to a type its fields references
  Object.entries(referenceByChanges).forEach(([id, referencesGroup]) => {
    const elemId = ElemID.fromFullName(id)
    if (elemId.idType === 'field') {
      const topLevelId = elemId.createTopLevelParentID().parent.getFullName()
      if (referenceByChanges[topLevelId] === undefined) {
        referenceByChanges[topLevelId] = []
      }
      referenceByChanges[topLevelId].push(...referencesGroup)
    }
  })

  await Promise.all(
    _(referenceByChanges)
      .entries()
      .map(async ([id, referencesGroup]) => {
        await updateIdOfReferenceByIndex(
          id,
          referencesGroup,
          index,
          elementToReferences,
          idToAction,
        )
      })
      .value()
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
  referencesIndex: RemoteMap<ElemID[]>,
  referencedByIndex: RemoteMap<ElemID[]>,
  mapsVersions: RemoteMap<number>,
  elementsSource: ElementsSource,
  isCacheValid: boolean,
): Promise<void> => {
  log.debug('Starting to update reference indexes')

  let relevantChanges = changes
  const isVersionMatch = await mapsVersions.get(REFERENCE_INDEXES_KEY) === REFERENCE_INDEXES_VERSION
  if (!isCacheValid || !isVersionMatch) {
    if (!isVersionMatch) {
      log.info('references indexes maps are out of date, re-indexing')
    }
    if (!isCacheValid) {
      log.info('cache is invalid, re-indexing references indexes')
    }
    await Promise.all([
      referencesIndex.clear(),
      referencedByIndex.clear(),
      mapsVersions.set(REFERENCE_INDEXES_KEY, REFERENCE_INDEXES_VERSION),
    ])
    relevantChanges = await getAllElementsChanges(changes, elementsSource)
  }

  const elementToReferences = Object.fromEntries(relevantChanges
    .map(getChangeElement)
    .map(element => [element.elemID.getFullName(), getReferences(element)]))

  await updateReferencesIndex(
    relevantChanges,
    referencesIndex,
    elementToReferences,
  )

  await updateReferencedByIndex(
    relevantChanges,
    referencedByIndex,
    elementToReferences,
  )
  log.debug('Finished to update reference indexes')
}
