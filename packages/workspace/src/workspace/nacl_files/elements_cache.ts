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
import { Element, Change, isEqualElements, toChange, ElemID, isContainerType, SaltoError, ReadOnlyElementsSource, getChangeElement, isAdditionOrModificationChange, isRemovalChange, isAdditionChange } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { collections, values } from '@salto-io/lowerdash'
import { ThenableIterable } from '@salto-io/lowerdash/src/collections/asynciterable'

import _ from 'lodash'
import AsyncLock from 'async-lock'
import { MergeError, MergeResult } from '../../merger'
import { ElementsSource, mapReadOnlyElementsSource } from '../elements_source'
import { RemoteMap, RemoteMapEntry, RemoteMapCreator } from '../remote_map'

const { awu } = collections.asynciterable
const log = logger(module)
const MERGER_LOCK = 'MERGER_LOCK'
const FLUSH_IN_PROGRESS = 'FLUSHING'
export const MAX_LOG_ON_MERGE = 100
export const REBUILD_ON_RECOVERY = 'rebuild'
export const CLEAR_ON_RECOVERY = 'clearOnly'
export const MERGE_MANAGER_SUFFIX = 'merge_manager'
export type MergedRecoveryMode = 'rebuild' | 'clearOnly'


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
  src1Changes?: ChangeSet<Change<Element>>
  src2Changes?: ChangeSet<Change<Element>>
  src1Overrides?: Record<string, Element>
  src2Overrides?: Record<string, Element>
  src1Prefix: string
  src2Prefix: string
  mergeFunc: (elements: AsyncIterable<Element>) => Promise<MergeResult>
  currentElements: ElementsSource
  currentErrors: RemoteMap<SaltoError[]>
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

export interface Flushable {
  flush: () => Promise<boolean | void>
  clear: () => Promise<void>
}

export interface ElementMergeManager {
  init: () => Promise<void>
  flush: () => Promise<boolean>
  clear: () => Promise<void>
  mergeComponents: (updateParams: CacheChangeSetUpdate) => Promise<ChangeSet<Change>>
  // Hash access functions used when hash is, for some reason, calculated outside of update
  getHash: (prefix: string) => Promise<string | undefined>
  setHash: (prefix: string, value: string) => Promise<void>
}

const namespaceToManager: Record<string, ElementMergeManager> = {}

export const createMergeManager = async (flushables: Flushable[],
  sources: Record<string, ReadOnlyElementsSource>,
  mapCreator: RemoteMapCreator, namespace: string, persistent: boolean,
  recoveryOperation?: string): Promise<ElementMergeManager> => {
  const fullNamespace = namespace + MERGE_MANAGER_SUFFIX
  if (Object.keys(fullNamespace).includes(fullNamespace)) {
    return namespaceToManager[fullNamespace]
  }
  const hashes = await mapCreator<string>({
    namespace: fullNamespace,
    persistent,
    serialize: s => s,
    deserialize: async s => s,
  })
  const getSourceHashKey = (prefix: string): string => `${prefix}_source_hash`
  const getMergedHashKey = (prefix1: string,
    prefix2: string): string => `${prefix1}_${prefix2}_merged_hash`
  const clearImpl = async (): Promise<void> => {
    await Promise.all(flushables.map(async f => f.clear()))
    await hashes.clear()
  }
  const updateCache = async (cacheUpdate: CacheChangeSetUpdate): Promise<{
    mergedChanges: ChangeSet<Change>
    mergeErrors: AsyncIterable<RemoteMapEntry<MergeError[], string>>
    noErrorMergeIds: string[]
  }> => {
    const { src1Changes: possibleSrc1Changes, src2Changes: possibleSrc2Changes } = cacheUpdate
    const src1 = values.isDefined(cacheUpdate.src1Overrides)
      ? mapReadOnlyElementsSource(
        sources[cacheUpdate.src1Prefix],
        async elem => elem && (cacheUpdate.src1Overrides?.[elem.elemID.getFullName()] ?? elem)
      )
      : sources[cacheUpdate.src1Prefix]
    const src2 = values.isDefined(cacheUpdate.src2Overrides)
      ? mapReadOnlyElementsSource(
        sources[cacheUpdate.src2Prefix],
        async elem => elem && (cacheUpdate.src2Overrides?.[elem.elemID.getFullName()] ?? elem)
      ) : sources[cacheUpdate.src2Prefix]
    const src1Changes = possibleSrc1Changes ?? createEmptyChangeSet(
      await hashes.get(getSourceHashKey(cacheUpdate.src1Prefix))
    )
    const src2Changes = possibleSrc2Changes ?? createEmptyChangeSet(
      await hashes.get(getSourceHashKey(cacheUpdate.src2Prefix))
    )
    const preChangeHash = (((src1Changes.preChangeHash || '')
      + (src2Changes.preChangeHash || '')))
    const postChangeHash = ((src1Changes.postChangeHash || '')
      + (src2Changes.postChangeHash || ''))
    const cachePreChangeHash = await hashes.get(getMergedHashKey(cacheUpdate.src1Prefix,
      cacheUpdate.src2Prefix)) ?? ''
    await hashes.set(getMergedHashKey(cacheUpdate.src1Prefix, cacheUpdate.src2Prefix),
      postChangeHash)
    const cacheValid = ((!preChangeHash && !cachePreChangeHash)
      || preChangeHash === cachePreChangeHash)
      && src1Changes.cacheValid && src2Changes.cacheValid
    if (!src1Changes.cacheValid) {
      log.debug(`Invalid cache: ${cacheUpdate.src1Prefix}`)
    }
    if (!src2Changes.cacheValid) {
      log.debug(`Invalid cache: ${cacheUpdate.src2Prefix}`)
    }
    if (!(preChangeHash === cachePreChangeHash)) {
      log.debug(`Invalid cache merge between ${cacheUpdate.src1Prefix} and ${cacheUpdate.src2Prefix}`)
      log.debug(`Prechange hash: ${cachePreChangeHash} and update merged hash: ${preChangeHash}`)
    }
    const getElementsToMerge = async (): Promise<{
      src1ElementsToMerge: ThenableIterable<Element>
      src2ElementsToMerge: ThenableIterable<Element>
      potentialDeletedIds: Set<string>
    }> => {
      let src1ElementsToMerge: ThenableIterable<Element>
      let src2ElementsToMerge: ThenableIterable<Element>
      const getChangeAndDeleteIds = (changeSet: ChangeSet<Change<Element>>): {
        changeIds: Set<string>
        potentialDeletedIds: Set<string>
       } => {
        const changeIds = new Set<string>()
        const potentialDeletedIds = new Set<string>()
        changeSet.changes.forEach(change => {
          const id = getChangeElement(change).elemID
          if (isRemovalChange(change)) {
            potentialDeletedIds.add(id.getFullName())
          }
          changeIds.add(id.getFullName())
        })
        return { changeIds, potentialDeletedIds }
      }
      const potentialDeletedIds = new Set<string>()
      if (cacheValid) {
        const { changeIds: src1ChangeIDs,
          potentialDeletedIds: deleted1 } = getChangeAndDeleteIds(src1Changes)
        const { changeIds: src2ChangeIDs,
          potentialDeletedIds: deleted2 } = getChangeAndDeleteIds(src2Changes)
        deleted1.forEach(d => potentialDeletedIds.add(d))
        deleted2.forEach(d => potentialDeletedIds.add(d))
        src1ElementsToMerge = await awu(await getElementsToMergeFromChanges(
          src1Changes,
          src2ChangeIDs,
          src2,
        ))
        src2ElementsToMerge = await awu(await getElementsToMergeFromChanges(
          src2Changes, src1ChangeIDs, src1,
        ))
      } else {
        log.warn(`Invalid data detected in local cache ${namespace}. Rebuilding cache.`)
        src1ElementsToMerge = (src1 && recoveryOperation === REBUILD_ON_RECOVERY)
          ? (awu(await src1.getAll()).concat(await getContainerTypeChanges(src1Changes.changes)))
          : []
        src2ElementsToMerge = (src2 && recoveryOperation === REBUILD_ON_RECOVERY)
          ? (awu(await src2.getAll()).concat(await getContainerTypeChanges(src2Changes.changes)))
          : []
      }
      return { src1ElementsToMerge, src2ElementsToMerge, potentialDeletedIds }
    }
    const { src1ElementsToMerge, src2ElementsToMerge,
      potentialDeletedIds } = await getElementsToMerge()
    const elementsToMerge = awu(src1ElementsToMerge).concat(src2ElementsToMerge)
    const newMergedElementsResult = await cacheUpdate.mergeFunc(elementsToMerge
      .filter(values.isDefined))
    const hasCurrentElements = !(await awu(await cacheUpdate
      .currentElements.list()).isEmpty())
    if (!hasCurrentElements || !cacheValid) {
      return createFreshChangeSet(
        newMergedElementsResult, preChangeHash, postChangeHash, cacheValid
      )
    }
    const deleteChanges = await awu(potentialDeletedIds)
      .filter(async id => !(await newMergedElementsResult.merged.has(id)))
      .map(async id => {
        const currentElement = await cacheUpdate.currentElements.get(ElemID.fromFullName(id))
        return currentElement ? toChange({ before: currentElement, after: undefined }) : undefined
      })
      .filter(values.isDefined)
      .toArray()
    const { mergedChanges, mergeErrors, noErrorMergeIds } = await calculateMergedChanges(
      newMergedElementsResult,
      cacheUpdate.currentElements,
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

  const applyChanges = async ({
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
    log.debug('Applying merged changes to cache.')
    if (!mergedChanges.cacheValid) {
      log.debug('Clearing due to cache invalidation')
      await currentErrors.clear()
      await currentElements.clear()
    } else {
      const deletedIds: string[] = []
      let numDeleted = 0
      await currentElements.deleteAll(awu(mergedChanges.changes).filter(isRemovalChange)
        .map(change => {
          const { elemID } = getChangeElement(change)
          if (numDeleted < MAX_LOG_ON_MERGE) {
            deletedIds.push(elemID.getFullName())
          }
          numDeleted += 1
          return elemID
        }))
      if (numDeleted !== 0) {
        log.debug(`Deleted ${numDeleted} elements. The first ${deletedIds.length} ids are: ${deletedIds.join(', ')}`)
      }
      await currentErrors.deleteAll(awu(noErrorMergeIds))
    }
    await currentErrors.setAll(awu(mergeErrors))
    const addedIds: string[] = []
    let numAdded = 0
    const modifiedIds: string[] = []
    let numModified = 0
    await currentElements.setAll(awu(mergedChanges.changes).filter(isAdditionOrModificationChange)
      .map(change => {
        const elem = getChangeElement(change)
        if (isAdditionChange(change)) {
          if (numAdded < MAX_LOG_ON_MERGE) {
            addedIds.push(elem.elemID.getFullName())
          }
          numAdded += 1
        } else {
          if (numModified < MAX_LOG_ON_MERGE) {
            modifiedIds.push(elem.elemID.getFullName())
          }
          numModified += 1
        }
        return elem
      }))
    if (numModified !== 0) {
      log.debug(`Modified ${numModified} elements. The first ${modifiedIds.length} ids are: ${modifiedIds.join(', ')}`)
    }
    if (numAdded !== 0) {
      log.debug(`Added ${numAdded} elements. The first ${addedIds.length} ids are: ${addedIds.join(', ')}`)
    }
  }
  const lock = new AsyncLock()
  const mergeManager = {
    init: async () => lock.acquire(MERGER_LOCK, async () => {
      if (await hashes.get(MERGER_LOCK) === FLUSH_IN_PROGRESS) {
        log.warn(`Clearing all databases under namespace: ${namespace} due to previous incomplete operation.`)
        await clearImpl()
      }
    }),
    clear: () => lock.acquire(MERGER_LOCK, clearImpl),
    flush: async () =>
      lock.acquire(MERGER_LOCK, async () => {
        log.debug(`Started flushing hashes under namespace ${namespace}.`)
        await hashes.set(MERGER_LOCK, FLUSH_IN_PROGRESS)
        await hashes.flush()
        const hasChanged = (await Promise.all(flushables.map(async f => f.flush())))
          .some(b => (typeof b !== 'boolean' || b))
        await hashes.delete(MERGER_LOCK)
        await hashes.flush()
        log.debug(`Successfully flushed hashes under namespace ${namespace}.`)
        return hasChanged
      }),
    mergeComponents: async (cacheUpdate: CacheChangeSetUpdate) => lock.acquire(MERGER_LOCK,
      async () => {
        log.debug(`Merging components: ${cacheUpdate.src1Prefix}, ${cacheUpdate.src2Prefix}`)
        const changeResult = await updateCache(cacheUpdate)
        if (cacheUpdate.src1Changes?.postChangeHash) {
          await hashes.set(getSourceHashKey(cacheUpdate.src1Prefix),
            cacheUpdate.src1Changes.postChangeHash)
        }
        if (cacheUpdate.src2Changes?.postChangeHash) {
          await hashes.set(getSourceHashKey(cacheUpdate.src2Prefix),
            cacheUpdate.src2Changes.postChangeHash)
        }
        await applyChanges({
          mergedChanges: changeResult.mergedChanges,
          mergeErrors: changeResult.mergeErrors,
          noErrorMergeIds: changeResult.noErrorMergeIds,
          currentElements: cacheUpdate.currentElements,
          currentErrors: cacheUpdate.currentErrors,
        })
        return changeResult.mergedChanges
      }),
    getHash: (prefix: string) => hashes.get(getSourceHashKey(prefix)),
    setHash: (prefix: string, value: string) => hashes.set(getSourceHashKey(prefix), value),
  }
  namespaceToManager[fullNamespace] = mergeManager
  return mergeManager
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
      const [before, beforeErrors, mergedItem, mergeErrors] = await Promise.all([
        currentElements.get(id),
        currentErrors.get(fullname),
        newMergedElementsResult.merged.get(fullname),
        newMergedElementsResult.errors.get(fullname),
      ])
      if (!isEqualElements(before, mergedItem) || !_.isEqual(beforeErrors, mergeErrors)) {
        if (mergedItem !== undefined) {
          await currentElements.set(mergedItem)
        } else if (before !== undefined) {
          await currentElements.delete(id)
        }
        changes.push(toChange({ before, after: mergedItem }))
        if (mergeErrors !== undefined) {
          await currentErrors.set(fullname, mergeErrors ?? [])
        } else {
          await currentErrors.delete(fullname)
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
