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
import { Element, Change, isEqualElements, toChange, ElemID, SaltoError, ReadOnlyElementsSource, getChangeElement, isAdditionOrModificationChange, isRemovalChange } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { collections, values, hash } from '@salto-io/lowerdash'

import _ from 'lodash'
import { MergeError, MergeResult } from '../../merger'
import { ElementsSource } from '../elements_source'
import { RemoteMap, RemoteMapEntry } from '../remote_map'

const { awu } = collections.asynciterable
const { toMD5 } = hash
const log = logger(module)

export const EMPTY_CHANGE_SET = { changes: [], cacheValid: true }

export type ChangeSet<Change> = {
  changes: Change[]
  cacheValid: boolean
  preChangeHash?: string
  postChangeHash?: string
}

export const buildNewMergedElementsAndErrors = async ({
  afterElements,
  currentElements,
  currentErrors,
  relevantElementIDs,
  mergeFunc,
}: {
  afterElements: AsyncIterable<Element>
  currentElements: ElementsSource
  currentErrors: RemoteMap<SaltoError[]>
  relevantElementIDs: AsyncIterable<ElemID>
  mergeFunc: (elements: AsyncIterable<Element>) => Promise<MergeResult>
}): Promise<Change[]> => {
  log.info('going to merge new elements to the existing elements')
  const changes: Change[] = []
  const newMergedElementsResult = await mergeFunc(afterElements)
  const hasCurrentElements = !(await currentElements.isEmpty())
  const hasCurrentErrors = !(await currentErrors.isEmpty())
  if (!hasCurrentElements && !hasCurrentErrors) {
    await awu(newMergedElementsResult.merged.values()).forEach(async element => {
      changes.push(toChange({ after: element }) as Change)
      await currentElements.set(element)
    })
    await currentErrors.setAll(newMergedElementsResult.errors.entries())
    return changes
  }
  const sieve = new Set<string>()

  await awu(relevantElementIDs).forEach(async id => {
    const fullname = id.getFullName()
    if (!sieve.has(fullname)) {
      sieve.add(fullname)
      const before = await currentElements.get(id)
      const mergedItem = await newMergedElementsResult.merged.get(fullname)
      if (!isEqualElements(before, mergedItem)) {
        if (mergedItem !== undefined) {
          await currentElements.set(mergedItem)
        } else if (before !== undefined) {
          await currentElements.delete(id)
        }
        changes.push(toChange({ before, after: mergedItem }))
        const mergeErrors = await newMergedElementsResult.errors.get(fullname)
        if (mergeErrors !== undefined) {
          await currentErrors.set(fullname, mergeErrors)
        }
      }
    }
  })
  return changes
}

export const getAfterElements = async ({
  src1Changes,
  src2Changes,
  src1,
  src2,
}: {
  src1Changes: Change<Element>[]
  src2Changes: Change<Element>[]
  src1: ReadOnlyElementsSource
  src2: ReadOnlyElementsSource
}): Promise<{
  afterElements: AsyncIterable<Element>
  relevantElementIDs: AsyncIterable<ElemID>
}> => {
  const relevantElementIDs = _.uniqBy(
    [src1Changes, src2Changes]
      .flat()
      .map(getChangeElement)
      .map(e => e.elemID),
    id => id.getFullName()
  )

  const src1ChangesByID = _.keyBy(
    src1Changes,
    change => getChangeElement(change).elemID.getFullName()
  )
  const src2ChangesByID = _.keyBy(
    src2Changes,
    change => getChangeElement(change).elemID.getFullName()
  )

  const changeAfterElements = [...src1Changes, ...src2Changes]
    .filter(isAdditionOrModificationChange)
    .map(getChangeElement)
    .filter(values.isDefined)

  const unmodifiedFragments = awu(relevantElementIDs).map(async id => {
    const sr1Change = src1ChangesByID[id.getFullName()]
    const src2Change = src2ChangesByID[id.getFullName()]
    if (values.isDefined(sr1Change) && values.isDefined(src2Change)) {
      return undefined
    }
    return values.isDefined(sr1Change)
      ? src2.get(id)
      : src1.get(id)
  }).filter(values.isDefined)
  return {
    afterElements: awu(changeAfterElements).concat(unmodifiedFragments),
    relevantElementIDs: awu(relevantElementIDs),
  }
}

export const applyChanges = async ({
  mergedChanges,
  mergeErrors,
  currentElements,
  currentErrors,
}: {
  mergedChanges: ChangeSet<Change<Element>>
  mergeErrors: AsyncIterable<RemoteMapEntry<MergeError[], string>>
  currentElements: ElementsSource
  currentErrors: RemoteMap<SaltoError[]>
}): Promise<void> => {
  await currentErrors.setAll(mergeErrors)
  await currentElements.setAll(awu(mergedChanges.changes).filter(isAdditionOrModificationChange)
    .map(change => getChangeElement(change)))
  await currentElements.deleteAll(awu(mergedChanges.changes).filter(isRemovalChange)
    .map(change => getChangeElement(change).elemID))
}

const applyFirstSourceChanges = async (
  src1Changes: ChangeSet<Change<Element>>,
  src2ChangesByID: _.Dictionary<Change<Element>>,
  src2: ReadOnlyElementsSource): Promise<{
    elementsToMerge: Element[]
    deletedIds: ElemID[]
  }> => {
  const elementsToMerge: (Element | undefined)[] = []
  const deletedIds: ElemID[] = []
  await Promise.all(src1Changes.changes.map(async change => {
    const element = getChangeElement(change)
    const id = element.elemID
    const src2Change = src2ChangesByID[id.getFullName()]
    if (isAdditionOrModificationChange(change)) {
      elementsToMerge.push(element)
    }
    if (src2Change === undefined) {
      const unmodifiedFragment = await src2.get(id)
      if (unmodifiedFragment !== undefined) {
        elementsToMerge.push(unmodifiedFragment)
      } else if (isRemovalChange(change)) {
        // the element was removed from one source and doesn't exist on the other, so it's deleted
        deletedIds.push(id)
      }
    } else if (isAdditionOrModificationChange(src2Change)) {
      elementsToMerge.push(getChangeElement(src2Change))
    } else if (isRemovalChange(change)) {
      // the element was removed from both sources, so it's deleted
      deletedIds.push(id)
    }
    // This change has been handled, we can clear it
    delete src2ChangesByID[id.getFullName()]
  }))
  return { elementsToMerge: elementsToMerge.filter(values.isDefined), deletedIds }
}

const calculateMergedChanges = async (
  newMergedElementsResult: MergeResult,
  currentElements: ElementsSource,
  deletedIds: ElemID[]): Promise<{
    mergedChanges: Change[]
    mergeErrors: RemoteMapEntry<MergeError[], string>[]
  }> => {
  const mergeErrors: RemoteMapEntry<MergeError[], string>[] = []
  const sieve = new Set<string>()
  return { mergedChanges: await awu(newMergedElementsResult.merged.values()).map(async element => {
    const id = element.elemID
    const fullname = id.getFullName()
    if (!sieve.has(fullname)) {
      sieve.add(fullname)
      const before = await currentElements.get(id)
      if (!isEqualElements(before, element)) {
        const relevantMergeError = await newMergedElementsResult.errors.get(fullname)
        if (relevantMergeError) {
          mergeErrors.push({ value: relevantMergeError, key: fullname })
        }
        return toChange({ before, after: element })
      }
    }
    return undefined
  }).filter(values.isDefined).concat(await awu(await Promise.all(deletedIds
    .map(async id => toChange({ before: await currentElements.get(id), after: undefined })))))
    .toArray(),
  mergeErrors }
}

const applyRemainingSourceChanges = async (src2ChangesByID: _.Dictionary<Change<Element>>,
  src1: ReadOnlyElementsSource,
  elementsToMerge: Element[],
  deletedIds: ElemID[]
): Promise<void> => {
  // By now src2ChangesById will only contain changes that don't appear in src1 changes
  await Promise.all(Object.entries(src2ChangesByID).map(async ([id, change]) => {
    const unmodifiedFragment = await src1.get(ElemID.fromFullName(id))
    if (isAdditionOrModificationChange(change)) {
      elementsToMerge.push(getChangeElement(change))
    } else if (unmodifiedFragment === undefined) {
      // Removed from src2, non-existant on src1
      deletedIds.push(ElemID.fromFullName(id))
    }
    // push the unmodified fragment
    elementsToMerge.push(unmodifiedFragment)
  }))
}

const createFreshChangeSet = async (
  mergeResult: MergeResult,
  preChangeHash: string | undefined,
  postChangeHash: string | undefined,
  cachePreChangeHash: string | undefined,
): Promise<{
  mergedChanges: ChangeSet<Change<Element>>
  mergeErrors: AsyncIterable<RemoteMapEntry<MergeError[], string>>
}> => ({
  mergedChanges: {
    changes: await (Promise.all(await awu(mergeResult.merged.values())
      .map(async element => toChange({ after: element }) as Change).toArray())),
    preChangeHash,
    postChangeHash,
    cacheValid: preChangeHash === cachePreChangeHash,
  },
  mergeErrors: awu(mergeResult.errors.entries()),
})

export const mergeChanges = async ({
  src1Changes,
  src2Changes,
  src1,
  src2,
  currentElements,
  cachePreChangeHash,
  mergeFunc,
}: {
  src1Changes: ChangeSet<Change<Element>>
  src2Changes: ChangeSet<Change<Element>>
  src1: ReadOnlyElementsSource
  src2: ReadOnlyElementsSource
  currentElements: ElementsSource
  cachePreChangeHash: string | undefined
  mergeFunc: (elements: AsyncIterable<Element>) => Promise<MergeResult>
}): Promise<{
  mergedChanges: ChangeSet<Change<Element>>
  mergeErrors: AsyncIterable<RemoteMapEntry<MergeError[], string>>
}> => {
  const src2ChangesByID = _.keyBy(
    src2Changes.changes,
    change => getChangeElement(change).elemID.getFullName()
  )
  const preChangeHash = toMD5((src1Changes.postChangeHash || '')
    + (src2ChangesByID.postChangeHash || ''))
  const postChangeHash = toMD5((src1Changes.postChangeHash || '')
    + (src2ChangesByID.postChangeHash || ''))
  const { elementsToMerge, deletedIds } = await applyFirstSourceChanges(src1Changes,
    src2ChangesByID, src2)
  await applyRemainingSourceChanges(src2ChangesByID, src1, elementsToMerge, deletedIds)
  const newMergedElementsResult = await mergeFunc(awu(elementsToMerge).filter(values.isDefined))
  const hasCurrentElements = !(await currentElements.isEmpty())
  if (!hasCurrentElements) {
    return createFreshChangeSet(
      newMergedElementsResult, preChangeHash, postChangeHash, cachePreChangeHash
    )
  }
  const { mergedChanges, mergeErrors } = await calculateMergedChanges(
    newMergedElementsResult,
    currentElements,
    deletedIds,
  )
  return { mergeErrors: awu(mergeErrors),
    mergedChanges: {
      changes: mergedChanges,
      preChangeHash: cachePreChangeHash,
      cacheValid: preChangeHash === cachePreChangeHash,
      postChangeHash,
    } }
}
