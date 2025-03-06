/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  Element,
  Change,
  isEqualElements,
  toChange,
  ElemID,
  isContainerType,
  SaltoError,
  ReadOnlyElementsSource,
  getChangeData,
  isAdditionOrModificationChange,
  isRemovalChange,
  isAdditionChange,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { collections, values } from '@salto-io/lowerdash'

import _ from 'lodash'
import AsyncLock from 'async-lock'
import { MergeError, MergeResult } from '../../merger'
import { ElementsSource } from '../elements_source'
import { RemoteMap, RemoteMapEntry, RemoteMapCreator } from '../remote_map'

const { awu } = collections.asynciterable
const log = logger(module)
const MERGER_LOCK = 'MERGER_LOCK'
const FLUSH_IN_PROGRESS = 'FLUSHING'
const MAX_LOG_ON_MERGE = 100
export const REBUILD_ON_RECOVERY = 'rebuild'
const MERGE_MANAGER_SUFFIX = 'merge_manager'
export type MergedRecoveryMode = 'rebuild' | 'clearOnly'

export type ChangeSet<Change> = {
  changes: Change[]
  cacheValid: boolean
  preChangeHash?: string
  postChangeHash?: string
}

export type RecoveryOverrideFunc = (
  src1RecElements: AsyncIterable<ElemID>,
  src2RecElements: AsyncIterable<ElemID>,
  src2: ReadOnlyElementsSource,
) => Promise<{
  src1ElementsToMerge: AsyncIterable<ElemID>
  src2ElementsToMerge: AsyncIterable<ElemID>
}>

type CacheChangeSetUpdate = {
  src1Changes?: ChangeSet<Change<Element>>
  src2Changes?: ChangeSet<Change<Element>>
  recoveryOverride?: RecoveryOverrideFunc
  src1Prefix: string
  src2Prefix: string
  mergeFunc: (elements: AsyncIterable<Element>) => Promise<MergeResult>
  currentElements: ElementsSource
  currentErrors: RemoteMap<SaltoError[]>
}

const getSourceHashKey = (prefix: string): string => `${prefix}_source_hash`
const getMergedHashKey = (prefix1: string, prefix2: string): string => `${prefix1}_${prefix2}_merged_hash`

export const createEmptyChangeSet = (preChangeHash?: string): ChangeSet<Change> => ({
  changes: [],
  preChangeHash,
  postChangeHash: preChangeHash,
  cacheValid: true,
})

const getElementsToMergeFromChanges = (
  srcChanges: ChangeSet<Change<Element>>,
  idsExistingOnSecondSourceChanges: Set<string>,
  otherSrcChanges: ReadOnlyElementsSource,
): AsyncIterable<Element> =>
  awu(srcChanges.changes).flatMap(async change => {
    const elementsToMerge: Element[] = []
    const element = getChangeData(change)
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
    return elementsToMerge
  })

const getChangeAndDeleteIds = (
  changeSet: ChangeSet<Change<Element>>,
): {
  changeIds: Set<string>
  potentialDeletedIds: Set<string>
} => {
  const changeIds = new Set<string>()
  const potentialDeletedIds = new Set<string>()
  changeSet.changes.forEach(change => {
    const id = getChangeData(change).elemID
    if (isRemovalChange(change)) {
      potentialDeletedIds.add(id.getFullName())
    }
    changeIds.add(id.getFullName())
  })
  return { changeIds, potentialDeletedIds }
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
  const mergedChanges = await awu(newMergedElementsResult.merged.values())
    .map(async element => {
      const id = element.elemID
      const fullname = id.getFullName()
      if (!sieve.has(fullname)) {
        sieve.add(fullname)
        const before = await currentElements.get(id)
        const relevantMergeError = await newMergedElementsResult.errors.get(fullname)
        if (relevantMergeError !== undefined) {
          mergeErrors.push({ value: relevantMergeError, key: fullname })
        } else {
          noErrorMergeIds.push(fullname)
        }
        if (!isEqualElements(before, element)) {
          return toChange({ before, after: element })
        }
      }
      return undefined
    })
    .filter(values.isDefined)
    .toArray()
  return { mergedChanges, mergeErrors, noErrorMergeIds }
}

const createFreshChangeSet = async (
  mergeResult: MergeResult,
  preChangeHash: string | undefined,
  postChangeHash: string | undefined,
  cacheValid = false,
): Promise<{
  mergedChanges: ChangeSet<Change>
  mergeErrors: AsyncIterable<RemoteMapEntry<MergeError[], string>>
  noErrorMergeIds: string[]
}> => ({
  mergedChanges: {
    changes: await Promise.all(
      await awu(mergeResult.merged.values())
        .map(async element => toChange({ after: element }) as Change)
        .toArray(),
    ),
    preChangeHash,
    postChangeHash,
    cacheValid,
  },
  mergeErrors: awu(mergeResult.errors.entries()),
  noErrorMergeIds: [],
})

const getContainerTypeChangeIDs = (changes: Change<Element>[]): ElemID[] =>
  changes
    .map(getChangeData)
    .filter(isContainerType)
    .map(elem => elem.elemID)

const getRecoveryElementIDs = async (
  src: ReadOnlyElementsSource,
  srcChanges: Change<Element>[],
  recoveryOperation: MergedRecoveryMode | undefined,
): Promise<AsyncIterable<ElemID>> =>
  src && recoveryOperation === 'rebuild' ? awu(await src.list()).concat(getContainerTypeChangeIDs(srcChanges)) : awu([])

const getElementsToMerge = async ({
  src1Changes,
  src2Changes,
  src1,
  src2,
  cacheValid,
  namespace,
  recoveryOperation,
  recoveryOverride,
}: {
  src1Changes: ChangeSet<Change<Element>>
  src2Changes: ChangeSet<Change<Element>>
  src1: ReadOnlyElementsSource
  src2: ReadOnlyElementsSource
  cacheValid: boolean
  namespace: string
  recoveryOperation: MergedRecoveryMode | undefined
  recoveryOverride: RecoveryOverrideFunc | undefined
}): Promise<{
  src1ElementsToMerge: AsyncIterable<Element>
  src2ElementsToMerge: AsyncIterable<Element>
  potentialDeletedIds: Set<string>
}> => {
  if (cacheValid) {
    const { changeIds: src1ChangeIDs, potentialDeletedIds: deleted1 } = getChangeAndDeleteIds(src1Changes)
    const { changeIds: src2ChangeIDs, potentialDeletedIds: deleted2 } = getChangeAndDeleteIds(src2Changes)

    return {
      src1ElementsToMerge: getElementsToMergeFromChanges(src1Changes, src2ChangeIDs, src2),
      src2ElementsToMerge: getElementsToMergeFromChanges(src2Changes, src1ChangeIDs, src1),
      potentialDeletedIds: new Set(Array.from(deleted1).concat(Array.from(deleted2))),
    }
  }

  log.warn(`Invalid data detected in local cache ${namespace}. Rebuilding cache.`)
  const src1ElementsToMerge = await getRecoveryElementIDs(src1, src1Changes.changes, recoveryOperation)
  const src2ElementsToMerge = await getRecoveryElementIDs(src2, src2Changes.changes, recoveryOperation)

  const elementsToMerge =
    recoveryOverride !== undefined
      ? await recoveryOverride(src1ElementsToMerge, src2ElementsToMerge, src2)
      : { src1ElementsToMerge, src2ElementsToMerge }

  const src1AfterElements = _.keyBy(
    src1Changes.changes.filter(isAdditionOrModificationChange).map(getChangeData),
    elem => elem.elemID.getFullName(),
  )

  const src2AfterElements = _.keyBy(
    src2Changes.changes.filter(isAdditionOrModificationChange).map(getChangeData),
    elem => elem.elemID.getFullName(),
  )

  return {
    src1ElementsToMerge: awu(elementsToMerge.src1ElementsToMerge).map(
      elemID => src1AfterElements[elemID.getFullName()] ?? src1.get(elemID),
    ),
    src2ElementsToMerge: awu(elementsToMerge.src2ElementsToMerge).map(
      elemID => src2AfterElements[elemID.getFullName()] ?? src2.get(elemID),
    ),
    potentialDeletedIds: new Set(),
  }
}

export interface Flushable {
  flush: () => Promise<boolean | void>
  clear: () => Promise<void>
}

export interface ElementMergeManager {
  flush: () => Promise<boolean>
  clear: () => Promise<void>
  mergeComponents: (updateParams: CacheChangeSetUpdate) => Promise<ChangeSet<Change>>
  // Hash access functions used when hash is, for some reason, calculated outside of update
  getHash: (prefix: string) => Promise<string | undefined>
}

const namespaceToManager: Record<string, ElementMergeManager> = {}

export const createMergeManager = async (
  flushables: Flushable[],
  sources: Record<string, ReadOnlyElementsSource>,
  mapCreator: RemoteMapCreator,
  namespace: string,
  persistent: boolean,
  recoveryOperation?: MergedRecoveryMode,
): Promise<ElementMergeManager> => {
  let initiated = false
  const fullNamespace = namespace + MERGE_MANAGER_SUFFIX
  // should this be `namespaceToManager[fullNamespace] !== undefined` ?
  if (Object.keys(fullNamespace).includes(fullNamespace)) {
    return namespaceToManager[fullNamespace]
  }

  const hashes = await mapCreator.create<string>({
    namespace: fullNamespace,
    persistent,
    serialize: async s => s,
    deserialize: async s => s,
  })

  const updateCache = async ({
    src1Changes: possibleSrc1Changes,
    src2Changes: possibleSrc2Changes,
    src1Prefix,
    src2Prefix,
    recoveryOverride,
    mergeFunc,
    currentElements,
  }: CacheChangeSetUpdate): Promise<{
    mergedChanges: ChangeSet<Change>
    mergeErrors: AsyncIterable<RemoteMapEntry<MergeError[], string>>
    noErrorMergeIds: string[]
  }> => {
    const src1Changes = possibleSrc1Changes ?? createEmptyChangeSet(await hashes.get(getSourceHashKey(src1Prefix)))
    const src2Changes = possibleSrc2Changes ?? createEmptyChangeSet(await hashes.get(getSourceHashKey(src2Prefix)))

    const preChangeHash = (src1Changes.preChangeHash || '') + (src2Changes.preChangeHash || '')
    const mergedHashKey = getMergedHashKey(src1Prefix, src2Prefix)
    const cachePreChangeHash = (await hashes.get(mergedHashKey)) ?? ''

    const cacheValid = preChangeHash === cachePreChangeHash && src1Changes.cacheValid && src2Changes.cacheValid
    if (!src1Changes.cacheValid) {
      log.debug(`Invalid cache: ${src1Prefix}`)
    }
    if (!src2Changes.cacheValid) {
      log.debug(`Invalid cache: ${src2Prefix}`)
    }
    if (!(preChangeHash === cachePreChangeHash)) {
      log.debug(`Invalid cache merge between ${src1Prefix} and ${src2Prefix}`)
      log.debug(`Prechange hash: ${cachePreChangeHash} and update merged hash: ${preChangeHash}`)
    }

    const postChangeHash = (src1Changes.postChangeHash || '') + (src2Changes.postChangeHash || '')
    log.debug('Setting hash %s::%s to %s', fullNamespace, mergedHashKey, postChangeHash)
    await hashes.set(mergedHashKey, postChangeHash)

    const { src1ElementsToMerge, src2ElementsToMerge, potentialDeletedIds } = await getElementsToMerge({
      src1Changes,
      src2Changes,
      src1: sources[src1Prefix],
      src2: sources[src2Prefix],
      cacheValid,
      namespace,
      recoveryOperation,
      recoveryOverride,
    })

    const elementsToMerge = awu(src1ElementsToMerge).concat(src2ElementsToMerge)
    const newMergedElementsResult = await mergeFunc(elementsToMerge.filter(values.isDefined))
    const hasCurrentElements = !(await awu(await currentElements.list()).isEmpty())
    if (!hasCurrentElements || !cacheValid) {
      return createFreshChangeSet(newMergedElementsResult, preChangeHash, postChangeHash, cacheValid)
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

    return {
      mergeErrors: awu(mergeErrors),
      mergedChanges: {
        changes: mergedChanges.concat(deleteChanges),
        preChangeHash: cachePreChangeHash,
        cacheValid,
        postChangeHash,
      },
      noErrorMergeIds,
    }
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
    const logChanges = (changes: Change<Element>[]): void => {
      const numIdsToLog = Math.min(changes.length, MAX_LOG_ON_MERGE)
      if (numIdsToLog > 0) {
        log.debug(
          `Change type: ${changes[0].action}, on ${changes.length} elements. The first ${numIdsToLog} ids are: ${changes
            .splice(0, numIdsToLog)
            .map(change => getChangeData(change).elemID.getFullName())
            .join(', ')}`,
        )
      }
    }
    const currentMergeErrors = mergedChanges.cacheValid
      ? Object.fromEntries(
          await awu(currentErrors.entries())
            .map(e => [e.key, e.value] as [string, SaltoError[]])
            .toArray(),
        )
      : {}
    if (!mergedChanges.cacheValid) {
      log.debug('Clearing due to cache invalidation')
      await currentErrors.clear()
      await currentElements.clear()
    } else {
      const removalChanges = mergedChanges.changes.filter(isRemovalChange)
      const removedIds = removalChanges.map(change => getChangeData(change).elemID)
      await currentElements.deleteAll(removedIds)
      logChanges(removalChanges)
      await currentErrors.deleteAll(
        removedIds
          .map(id => id.getFullName())
          .concat(noErrorMergeIds)
          .filter(id => !_.isEmpty(currentMergeErrors[id])),
      )
    }
    await currentErrors.setAll(awu(mergeErrors).filter(err => !_.isEqual(err.value, currentMergeErrors[err.key])))
    const additionOrModificationChanges = mergedChanges.changes.filter(isAdditionOrModificationChange)
    const [additionChanges, modificationChanges] = _.partition(additionOrModificationChanges, isAdditionChange)
    await currentElements.setAll(additionOrModificationChanges.map(change => getChangeData(change)))
    logChanges(additionChanges)
    logChanges(modificationChanges)
  }

  const lock = new AsyncLock()

  const clearImpl = async (): Promise<void> => {
    await Promise.all(flushables.map(async f => f.clear()))
    await hashes.clear()
  }

  const ensureInitiated =
    <TArgs extends unknown[], TReturn>(
      func: (...args: TArgs) => Promise<TReturn>,
    ): ((...args: TArgs) => Promise<TReturn>) =>
    async (...args: TArgs) => {
      if (!initiated) {
        await lock.acquire(MERGER_LOCK, async () => {
          if ((await hashes.get(MERGER_LOCK)) === FLUSH_IN_PROGRESS) {
            log.warn(`Clearing all databases under namespace: ${namespace} due to previous incomplete operation.`)
            await clearImpl()
          }
        })
        initiated = true
      }
      return func(...args)
    }

  const mergeManager: ElementMergeManager = {
    clear: ensureInitiated(() => lock.acquire(MERGER_LOCK, clearImpl)),
    flush: ensureInitiated(() =>
      log.timeDebug(
        () =>
          lock.acquire(MERGER_LOCK, async () => {
            const timeoutId = setTimeout(
              () => {
                log.error('Flushing hashes under namespace %s is taking more than 10 minutes.', namespace)
              },
              10 * 60 * 1000, // 10 minutes
            )

            try {
              await hashes.set(MERGER_LOCK, FLUSH_IN_PROGRESS)
              await hashes.flush()
              const flushResults = await awu(flushables)
                .map(f => f.flush())
                .toArray()
              const hasChanged = flushResults.some(b => typeof b !== 'boolean' || b)

              await hashes.delete(MERGER_LOCK)
              await hashes.flush()
              return hasChanged
            } finally {
              clearTimeout(timeoutId)
            }
          }),
        'mergeManager.flush %s',
        namespace,
      ),
    ),
    mergeComponents: ensureInitiated(async (cacheUpdate: CacheChangeSetUpdate) =>
      lock.acquire(MERGER_LOCK, async () => {
        log.debug(`Merging components: ${cacheUpdate.src1Prefix}, ${cacheUpdate.src2Prefix}`)
        const changeResult = await updateCache(cacheUpdate)
        if (cacheUpdate.src1Changes?.postChangeHash) {
          log.debug(
            'Setting %s source hash in namespace %s to %s',
            cacheUpdate.src1Prefix,
            fullNamespace,
            cacheUpdate.src1Changes.postChangeHash,
          )
          await hashes.set(getSourceHashKey(cacheUpdate.src1Prefix), cacheUpdate.src1Changes.postChangeHash)
        }
        if (cacheUpdate.src2Changes?.postChangeHash) {
          log.debug(
            'Setting %s source hash in namespace %s to %s',
            cacheUpdate.src2Prefix,
            fullNamespace,
            cacheUpdate.src2Changes.postChangeHash,
          )
          await hashes.set(getSourceHashKey(cacheUpdate.src2Prefix), cacheUpdate.src2Changes.postChangeHash)
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
    ),
    getHash: ensureInitiated((prefix: string) => hashes.get(getSourceHashKey(prefix))),
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

  const [noCurrentElements, noCurrentErrors] = await Promise.all([currentElements.isEmpty(), currentErrors.isEmpty()])
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
      if (!isEqualElements(before, mergedItem)) {
        if (mergedItem !== undefined) {
          await currentElements.set(mergedItem)
        } else if (before !== undefined) {
          await currentElements.delete(id)
        }
        changes.push(toChange({ before, after: mergedItem }))
      }
      if (!_.isEqual(beforeErrors, mergeErrors)) {
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
