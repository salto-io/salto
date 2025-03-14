/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import wu from 'wu'
import { logger } from '@salto-io/logging'
import {
  CompareOptions,
  DetailedChange,
  DetailedChangeWithBaseChange,
  ElemID,
  isRemovalChange,
} from '@salto-io/adapter-api'
import {
  ElementSelector,
  selectElementIdsByTraversal,
  elementSource,
  Workspace,
  remoteMap,
  ReferenceIndexEntry,
  flags,
} from '@salto-io/workspace'
import { getDetailedChanges as getDetailedChangesFromChange } from '@salto-io/adapter-utils'
import { collections, values } from '@salto-io/lowerdash'
import { getPlan, IDFilter } from './plan/plan'
import { ChangeWithDetails } from './plan'
import { calculateDiff } from './plan/diff'

const log = logger(module)
const { awu } = collections.asynciterable
const { getSaltoFlagBool, WORKSPACE_FLAGS } = flags

const getFilteredIds = (
  selectors: ElementSelector[],
  source: elementSource.ElementsSource,
  referenceSourcesIndex: remoteMap.ReadOnlyRemoteMap<ReferenceIndexEntry[]>,
): Promise<ElemID[]> =>
  log.timeDebug(
    async () =>
      awu(
        await selectElementIdsByTraversal({
          selectors,
          source,
          referenceSourcesIndex,
        }),
      ).toArray(),
    'diff.getFilteredIds',
  )

const createMatchers = async (
  beforeElementsSrc: elementSource.ElementsSource,
  afterElementsSrc: elementSource.ElementsSource,
  referenceSourcesIndex: remoteMap.ReadOnlyRemoteMap<ReferenceIndexEntry[]>,
  elementSelectors: ElementSelector[],
): Promise<{
  isChangeMatchSelectors: (change: DetailedChange) => boolean
  isTopLevelElementMatchSelectors: (elemID: ElemID) => boolean
}> => {
  const beforeMatchingElemIDs = await getFilteredIds(elementSelectors, beforeElementsSrc, referenceSourcesIndex)
  const afterMatchingElemIDs = await getFilteredIds(elementSelectors, afterElementsSrc, referenceSourcesIndex)

  const allMatchingTopLevelElemIDsSet = new Set<string>(
    beforeMatchingElemIDs.concat(afterMatchingElemIDs).map(id => id.createTopLevelParentID().parent.getFullName()),
  )
  const isTopLevelElementMatchSelectors = (elemID: ElemID): boolean =>
    allMatchingTopLevelElemIDsSet.has(elemID.getFullName())

  // skipping change matching filtering when all selectors are top level
  if (beforeMatchingElemIDs.every(id => id.isTopLevel()) && afterMatchingElemIDs.every(id => id.isTopLevel())) {
    log.debug('all selectors are top level. skipping change matching filtering')
    return {
      isTopLevelElementMatchSelectors,
      isChangeMatchSelectors: () => true,
    }
  }

  // this set will be used to check if a change is a child of a selector-matched elemID
  const beforeMatchingElemIDsSet = new Set(beforeMatchingElemIDs.map(elemId => elemId.getFullName()))
  const afterMatchingElemIDsSet = new Set(afterMatchingElemIDs.map(elemId => elemId.getFullName()))

  // this set will be used to check if a change is equal/parent of a selector-matched elemID
  const beforeAllParentsMatchingElemIDsSet = new Set(
    beforeMatchingElemIDs.flatMap(elemId => elemId.createAllElemIdParents()).map(elemId => elemId.getFullName()),
  )
  const afterAllParentsMatchingElemIDsSet = new Set(
    afterMatchingElemIDs.flatMap(elemId => elemId.createAllElemIdParents()).map(elemId => elemId.getFullName()),
  )

  const isChangeIdChildOfMatchingElemId = (change: DetailedChange): boolean => {
    const matchingElemIDsSet = isRemovalChange(change) ? beforeMatchingElemIDsSet : afterMatchingElemIDsSet
    return change.id
      .createParentID()
      .createAllElemIdParents()
      .some(elemId => matchingElemIDsSet.has(elemId.getFullName()))
  }

  const isChangeIdEqualOrParentOfMatchingElemId = (change: DetailedChange): boolean => {
    const allParentsMatchingElemIDsSet = isRemovalChange(change)
      ? beforeAllParentsMatchingElemIDsSet
      : afterAllParentsMatchingElemIDsSet
    return allParentsMatchingElemIDsSet.has(change.id.getFullName())
  }

  // A change is matched if its ID matches exactly or is nested under an ID that was matched
  // by the selectors. A change is also matched if it is a parent of one of the IDs that were
  // matched by the selectors - this is correct because if an ID was matched, it means it exists,
  // and therefore a change to the parent must contain the matched value.
  const isChangeMatchSelectors = (change: DetailedChange): boolean =>
    isChangeIdEqualOrParentOfMatchingElemId(change) || isChangeIdChildOfMatchingElemId(change)

  return {
    isChangeMatchSelectors,
    isTopLevelElementMatchSelectors,
  }
}

async function createDiffChangesWithCalculateDiff({
  toElementsSrc,
  fromElementsSrc,
  referenceSourcesIndex = new remoteMap.InMemoryRemoteMap<ReferenceIndexEntry[]>(),
  elementSelectors = [],
  topLevelFilters = [],
  compareOptions,
  resultType = 'detailedChanges',
}: {
  toElementsSrc: elementSource.ElementsSource
  fromElementsSrc: elementSource.ElementsSource
  referenceSourcesIndex?: remoteMap.ReadOnlyRemoteMap<ReferenceIndexEntry[]>
  elementSelectors?: ElementSelector[]
  topLevelFilters?: IDFilter[]
  compareOptions?: CompareOptions
  resultType?: 'changes' | 'detailedChanges'
}): Promise<DetailedChangeWithBaseChange[] | ChangeWithDetails[]> {
  const hasSelectors = elementSelectors.length > 0
  const matchers = await createMatchers(toElementsSrc, fromElementsSrc, referenceSourcesIndex, elementSelectors)
  const changes = await calculateDiff({
    before: toElementsSrc,
    after: fromElementsSrc,
    topLevelFilters: hasSelectors ? topLevelFilters.concat(matchers.isTopLevelElementMatchSelectors) : topLevelFilters,
    compareOptions,
  })
  return resultType === 'changes'
    ? awu(changes)
        .map(change => {
          if (!hasSelectors) {
            return { ...change, detailedChanges: () => getDetailedChangesFromChange(change, compareOptions) }
          }
          const filteredDetailedChanges = getDetailedChangesFromChange(change, compareOptions).filter(
            matchers.isChangeMatchSelectors,
          )
          if (filteredDetailedChanges.length > 0) {
            // we return the whole change even if only some of the detailed changes match the selectors.
            return { ...change, detailedChanges: () => filteredDetailedChanges }
          }
          return undefined
        })
        .filter(values.isDefined)
        .toArray()
    : awu(changes)
        .flatMap(change => getDetailedChangesFromChange(change, compareOptions))
        .filter(matchers.isChangeMatchSelectors)
        .toArray()
}

// TODO(SALTO-7272): Remove this function once the calculateDiff version is stable in production.
async function createDiffChangesWithGetPlan({
  toElementsSrc,
  fromElementsSrc,
  referenceSourcesIndex = new remoteMap.InMemoryRemoteMap<ReferenceIndexEntry[]>(),
  elementSelectors = [],
  topLevelFilters = [],
  compareOptions,
  resultType = 'detailedChanges',
}: {
  toElementsSrc: elementSource.ElementsSource
  fromElementsSrc: elementSource.ElementsSource
  referenceSourcesIndex?: remoteMap.ReadOnlyRemoteMap<ReferenceIndexEntry[]>
  elementSelectors?: ElementSelector[]
  topLevelFilters?: IDFilter[]
  compareOptions?: CompareOptions
  resultType?: 'changes' | 'detailedChanges'
}): Promise<DetailedChangeWithBaseChange[] | ChangeWithDetails[]> {
  if (elementSelectors.length > 0) {
    const matchers = await createMatchers(toElementsSrc, fromElementsSrc, referenceSourcesIndex, elementSelectors)
    const plan = await getPlan({
      before: toElementsSrc,
      after: fromElementsSrc,
      dependencyChangers: [],
      topLevelFilters: topLevelFilters.concat(matchers.isTopLevelElementMatchSelectors),
      compareOptions,
    })
    return resultType === 'changes'
      ? awu(plan.itemsByEvalOrder())
          .flatMap(item => item.changes())
          .map(change => {
            const filteredDetailedChanges = change.detailedChanges().filter(matchers.isChangeMatchSelectors)
            if (filteredDetailedChanges.length > 0) {
              // we return the whole change even if only some of the detailed changes match the selectors.
              return { ...change, detailedChanges: () => filteredDetailedChanges }
            }
            return undefined
          })
          .filter(values.isDefined)
          .toArray()
      : awu(plan.itemsByEvalOrder())
          .flatMap(item => item.detailedChanges())
          .filter(matchers.isChangeMatchSelectors)
          .toArray()
  }
  const plan = await getPlan({
    before: toElementsSrc,
    after: fromElementsSrc,
    dependencyChangers: [],
    topLevelFilters,
    compareOptions,
  })
  return wu(plan.itemsByEvalOrder())
    .map(item => item[resultType]())
    .flatten()
    .toArray()
}

export function createDiffChanges(params: {
  toElementsSrc: elementSource.ElementsSource
  fromElementsSrc: elementSource.ElementsSource
  referenceSourcesIndex?: remoteMap.ReadOnlyRemoteMap<ReferenceIndexEntry[]>
  elementSelectors?: ElementSelector[]
  topLevelFilters?: IDFilter[]
  compareOptions?: CompareOptions
  resultType: 'changes'
}): Promise<ChangeWithDetails[]>
export function createDiffChanges(params: {
  toElementsSrc: elementSource.ElementsSource
  fromElementsSrc: elementSource.ElementsSource
  referenceSourcesIndex?: remoteMap.ReadOnlyRemoteMap<ReferenceIndexEntry[]>
  elementSelectors?: ElementSelector[]
  topLevelFilters?: IDFilter[]
  compareOptions?: CompareOptions
  resultType?: 'detailedChanges'
}): Promise<DetailedChangeWithBaseChange[]>
export async function createDiffChanges({
  toElementsSrc,
  fromElementsSrc,
  referenceSourcesIndex = new remoteMap.InMemoryRemoteMap<ReferenceIndexEntry[]>(),
  elementSelectors = [],
  topLevelFilters = [],
  compareOptions,
  resultType = 'detailedChanges',
}: {
  toElementsSrc: elementSource.ElementsSource
  fromElementsSrc: elementSource.ElementsSource
  referenceSourcesIndex?: remoteMap.ReadOnlyRemoteMap<ReferenceIndexEntry[]>
  elementSelectors?: ElementSelector[]
  topLevelFilters?: IDFilter[]
  compareOptions?: CompareOptions
  resultType?: 'changes' | 'detailedChanges'
}): Promise<DetailedChangeWithBaseChange[] | ChangeWithDetails[]> {
  if (getSaltoFlagBool(WORKSPACE_FLAGS.replaceGetPlanWithCalculateDiff)) {
    return createDiffChangesWithCalculateDiff({
      toElementsSrc,
      fromElementsSrc,
      referenceSourcesIndex,
      elementSelectors,
      topLevelFilters,
      compareOptions,
      resultType,
    })
  }
  return createDiffChangesWithGetPlan({
    toElementsSrc,
    fromElementsSrc,
    referenceSourcesIndex,
    elementSelectors,
    topLevelFilters,
    compareOptions,
    resultType,
  })
}

export const getEnvsDeletionsDiff = async (
  workspace: Workspace,
  sourceElemIds: ElemID[],
  envs: ReadonlyArray<string>,
  selectors: ElementSelector[],
): Promise<Record<string, ElemID[]>> =>
  log.timeDebug(async () => {
    const envsElemIds: Record<string, ElemID[]> = Object.fromEntries(
      await awu(envs)
        .map(async env => [
          env,
          await awu(
            await workspace.getElementIdsBySelectors(selectors, { source: 'env', envName: env }, true),
          ).toArray(),
        ])
        .toArray(),
    )

    const sourceElemIdsSet = new Set(sourceElemIds.map(id => id.getFullName()))
    return _(envsElemIds)
      .mapValues(ids => ids.filter(id => !sourceElemIdsSet.has(id.getFullName())))
      .entries()
      .filter(([_env, ids]) => ids.length !== 0)
      .fromPairs()
      .value()
  }, 'getEnvsDeletionsDiff')
