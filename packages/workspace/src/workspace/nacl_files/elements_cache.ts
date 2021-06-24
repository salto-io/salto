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
import { Element, Change, isEqualElements, toChange, ElemID, isContainerType, SaltoError, ReadOnlyElementsSource, getChangeElement, isAdditionOrModificationChange, isRemovalChange } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { collections, values } from '@salto-io/lowerdash'
import { ThenableIterable } from '@salto-io/lowerdash/src/collections/asynciterable'

import _ from 'lodash'
import { MergeError, MergeResult } from '../../merger'
import { ElementsSource } from '../elements_source'
import { RemoteMap, RemoteMapEntry } from '../remote_map'

const { awu } = collections.asynciterable
const log = logger(module)

export type ChangeSet<Change> = {
  changes: Change[]
  cacheValid: boolean
  preChangeHash?: string
  postChangeHash?: string
}

export const createEmptyChangeSet = (preChangeHash?: string): ChangeSet<Change> => ({
  changes: [],
  preChangeHash,
  postChangeHash: preChangeHash,
  cacheValid: true,
})

export type CacheUpdate = {
  src1Changes: Change[]
  src2Changes: Change[]
  src1: ReadOnlyElementsSource
  src2: ReadOnlyElementsSource
}

export type CacheChangeSetUpdate = {
  src1Changes: ChangeSet<Change<Element>>
  src2Changes: ChangeSet<Change<Element>>
  src1: ReadOnlyElementsSource
  src2: ReadOnlyElementsSource
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

  const [noCurrentElements, noCurrentErrors] = await Promise.all(
    [currentElements.isEmpty(), currentErrors.isEmpty()]
  )
  if (noCurrentElements && noCurrentErrors) {
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
      const [before, mergedItem, mergeErrors] = await Promise.all([
        currentElements.get(id),
        newMergedElementsResult.merged.get(fullname),
        newMergedElementsResult.errors.get(fullname),
      ])
      if (!isEqualElements(before, mergedItem) || !_.isEmpty(mergeErrors)) {
        if (mergedItem !== undefined) {
          await currentElements.set(mergedItem)
        } else if (before !== undefined) {
          await currentElements.delete(id)
        }
        changes.push(toChange({ before, after: mergedItem }))
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
}: CacheUpdate): Promise<{
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
  noErrorMergeIds,
  currentElements,
  currentErrors,
}: {
  mergedChanges: ChangeSet<Change<Element>>
  mergeErrors: AsyncIterable<RemoteMapEntry<MergeError[], string>>
  noErrorMergeIds: string[]
  currentElements: ElementsSource
  currentErrors: RemoteMap<SaltoError[]>
}): Promise<void> => {
  if (!mergedChanges.cacheValid) {
    await currentErrors.clear()
    await currentElements.clear()
  } else {
    await currentElements.deleteAll(awu(mergedChanges.changes).filter(isRemovalChange)
      .map(change => getChangeElement(change).elemID))
    await currentErrors.deleteAll(awu(noErrorMergeIds))
  }
  await currentErrors.setAll(awu(mergeErrors))
  await currentElements.setAll(awu(mergedChanges.changes).filter(isAdditionOrModificationChange)
    .map(change => getChangeElement(change)))
}

const getElementsToMergeFromChanges = async (
  srcChanges: ChangeSet<Change<Element>>,
  idsExistingOnSecondSourceChanges: Set<string>,
  otherSrcChanges: ReadOnlyElementsSource
): Promise<Element[]> => {
  const elementsToMerge: (Element | undefined)[] = []
  await Promise.all(srcChanges.changes.map(async change => {
    const element = getChangeElement(change)
    const id = element.elemID
    if (isAdditionOrModificationChange(change)) {
      elementsToMerge.push(element)
    }
    if (!idsExistingOnSecondSourceChanges.has(id.getFullName())) {
      const unmodifiedFragment = await otherSrcChanges.get(id)
      if (unmodifiedFragment !== undefined) {
        elementsToMerge.push(unmodifiedFragment)
      }
    }
  }))
  return elementsToMerge.filter(values.isDefined)
}

const calculateMergedChanges = async (
  newMergedElementsResult: MergeResult,
  currentElements: ReadOnlyElementsSource,
): Promise<{
    mergedChanges: Change[]
    mergeErrors: RemoteMapEntry<MergeError[], string>[]
    noErrorMergeIds: string[]
  }> => {
  const mergeErrors: RemoteMapEntry<MergeError[], string>[] = []
  const sieve = new Set<string>()
  const noErrorMergeIds: string[] = []
  const mergedChanges = (await awu(newMergedElementsResult.merged.values()).map(async element => {
    const id = element.elemID
    const fullname = id.getFullName()
    if (!sieve.has(fullname)) {
      sieve.add(fullname)
      const before = await currentElements.get(id)
      if (!isEqualElements(before, element)) {
        const relevantMergeError = await newMergedElementsResult.errors.get(fullname)
        if (relevantMergeError) {
          mergeErrors.push({ value: relevantMergeError, key: fullname })
        } else {
          noErrorMergeIds.push(fullname)
        }
        return toChange({ before, after: element })
      }
    }
    return undefined
  }).filter(values.isDefined)
    .toArray())
  return { mergedChanges, mergeErrors, noErrorMergeIds }
}

const createFreshChangeSet = async (
  mergeResult: MergeResult,
  preChangeHash: string | undefined,
  postChangeHash: string | undefined,
  cacheValid = false
): Promise<{
  mergedChanges: ChangeSet<Change>
  mergeErrors: AsyncIterable<RemoteMapEntry<MergeError[], string>>
  noErrorMergeIds: string[]
}> => ({
  mergedChanges: {
    changes: await (Promise.all(await awu(mergeResult.merged.values())
      .map(async element => toChange({ after: element }) as Change).toArray())),
    preChangeHash,
    postChangeHash,
    cacheValid,
  },
  mergeErrors: awu(mergeResult.errors.entries()),
  noErrorMergeIds: [],
})

export const getContainerTypeChanges = async (changes: Change<Element>[]): Promise<Element[]> =>
  awu(changes).map(change => getChangeElement(change))
    .filter(element => isContainerType(element)).toArray()

export const mergeChanges = async ({
  cacheUpdate,
  currentElements,
  cachePreChangeHash,
  mergeFunc,
}: {
  cacheUpdate: CacheChangeSetUpdate
  currentElements: ReadOnlyElementsSource
  cachePreChangeHash: string | undefined
  mergeFunc: (elements: AsyncIterable<Element>) => Promise<MergeResult>
}): Promise<{
  mergedChanges: ChangeSet<Change>
  mergeErrors: AsyncIterable<RemoteMapEntry<MergeError[], string>>
  noErrorMergeIds: string[]
}> => {
  const { src1Changes, src2Changes, src1, src2 } = cacheUpdate
  const potentialDeletedIds = new Set<string>()
  const src1ChangeIDs = new Set<string>()
  const preChangeHash = (((src1Changes.preChangeHash || '')
    + (src2Changes.preChangeHash || '')))
  const postChangeHash = ((src1Changes.postChangeHash || '')
    + (src2Changes.postChangeHash || ''))
  const cacheValid = ((!preChangeHash && !cachePreChangeHash)
    || preChangeHash === cachePreChangeHash)
    && src1Changes.cacheValid && src2Changes.cacheValid

  let src1ElementsToMerge: ThenableIterable<Element>
  let src2ElementsToMerge: ThenableIterable<Element>
  if (cacheValid) {
    src1Changes.changes.forEach(change => {
      const id = getChangeElement(change).elemID
      if (isRemovalChange(change)) {
        potentialDeletedIds.add(id.getFullName())
      }
      src1ChangeIDs.add(id.getFullName())
    })
    const src2ChangeIDs = new Set<string>()
    src2Changes.changes.forEach(change => {
      const id = getChangeElement(change).elemID
      if (isRemovalChange(change)) {
        potentialDeletedIds.add(id.getFullName())
      }
      src2ChangeIDs.add(id.getFullName())
    })
    src1ElementsToMerge = await awu(await getElementsToMergeFromChanges(
      src1Changes, src2ChangeIDs, src2,
    ))
    src2ElementsToMerge = await awu(await getElementsToMergeFromChanges(
      src2Changes, src1ChangeIDs, src1,
    ))
  } else {
    src1ElementsToMerge = src1 ? (awu(await src1.getAll()).concat(
      await getContainerTypeChanges(src1Changes.changes)
    )) : []
    src2ElementsToMerge = src2 ? (awu(await src2.getAll()).concat(
      await getContainerTypeChanges(src2Changes.changes)
    )) : []
  }
  const elementsToMerge = awu(src1ElementsToMerge).concat(src2ElementsToMerge)
  const newMergedElementsResult = await mergeFunc(elementsToMerge.filter(values.isDefined))
  const hasCurrentElements = !(await awu(await currentElements.list()).isEmpty())
  if (!hasCurrentElements || !cacheValid) {
    return createFreshChangeSet(
      newMergedElementsResult, preChangeHash, postChangeHash, cacheValid
    )
  }
  const deleteChanges = await awu(potentialDeletedIds)
    .filter(async id => !(await newMergedElementsResult.merged.has(id)))
    .map(async id => {
      const currentElement = await currentElements.get(ElemID.fromFullName(id))
      return currentElement ? toChange({ before: currentElement, after: undefined }) : undefined
    })
    .filter(values.isDefined)
    .toArray()
  const { mergedChanges, mergeErrors, noErrorMergeIds } = await calculateMergedChanges(
    newMergedElementsResult,
    currentElements,
  )
  return { mergeErrors: awu(mergeErrors),
    mergedChanges: {
      changes: mergedChanges.concat(deleteChanges),
      preChangeHash: cachePreChangeHash,
      cacheValid,
      postChangeHash,
    },
    noErrorMergeIds }
}
