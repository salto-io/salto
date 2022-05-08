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
import { logger } from '@salto-io/logging'
import { DetailedChange, ElemID, isRemovalChange } from '@salto-io/adapter-api'
import { ElementSelector, selectElementIdsByTraversal, elementSource, Workspace, remoteMap } from '@salto-io/workspace'
import wu from 'wu'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { IDFilter, getPlan } from './plan/plan'

const log = logger(module)
const { awu } = collections.asynciterable

const getFilteredIds = (
  selectors: ElementSelector[],
  source: elementSource.ElementsSource,
  referenceSourcesIndex: remoteMap.ReadOnlyRemoteMap<ElemID[]>,
): Promise<ElemID[]> => (
  log.time(async () => awu(await selectElementIdsByTraversal({
    selectors,
    source,
    referenceSourcesIndex,
  })).toArray(), 'diff.getFilteredIds')
)

const createMatchers = async (
  beforeElementsSrc: elementSource.ElementsSource,
  afterElementsSrc: elementSource.ElementsSource,
  referenceSourcesIndex: remoteMap.ReadOnlyRemoteMap<ElemID[]>,
  elementSelectors: ElementSelector[]
): Promise<{
  isChangeMatchSelectors: (change: DetailedChange) => boolean
  isTopLevelElementMatchSelectors: (elemID: ElemID) => boolean
}> => {
  const beforeMatchingElemIDs = await getFilteredIds(
    elementSelectors,
    beforeElementsSrc,
    referenceSourcesIndex,
  )
  const afterMatchingElemIDs = await getFilteredIds(
    elementSelectors,
    afterElementsSrc,
    referenceSourcesIndex,
  )

  const allMatchingTopLevelElemIDsSet = new Set<string>(
    beforeMatchingElemIDs.concat(afterMatchingElemIDs)
      .map(id => id.createTopLevelParentID().parent.getFullName())
  )
  const isTopLevelElementMatchSelectors = (elemID: ElemID): boolean =>
    allMatchingTopLevelElemIDsSet.has(elemID.getFullName())

  // skipping change matching filtering when all selectors are top level
  if (beforeMatchingElemIDs.every(id => id.isTopLevel())
    && afterMatchingElemIDs.every(id => id.isTopLevel())) {
    log.debug('all selectors are top level. skipping change matching filtering')
    return {
      isTopLevelElementMatchSelectors,
      isChangeMatchSelectors: () => true,
    }
  }

  // this set will be used to check if a change is a child of a selector-matched elemID
  const beforeMatchingElemIDsSet = new Set(beforeMatchingElemIDs
    .map(elemId => elemId.getFullName()))
  const afterMatchingElemIDsSet = new Set(afterMatchingElemIDs
    .map(elemId => elemId.getFullName()))

  // this set will be used to check if a change is equal/parent of a selector-matched elemID
  const beforeAllParentsMatchingElemIDsSet = new Set(beforeMatchingElemIDs
    .flatMap(elemId => elemId.createAllElemIdParents())
    .map(elemId => elemId.getFullName()))
  const afterAllParentsMatchingElemIDsSet = new Set(afterMatchingElemIDs
    .flatMap(elemId => elemId.createAllElemIdParents())
    .map(elemId => elemId.getFullName()))

  const isChangeIdChildOfMatchingElemId = (change: DetailedChange): boolean => {
    const matchingElemIDsSet = isRemovalChange(change)
      ? beforeMatchingElemIDsSet
      : afterMatchingElemIDsSet
    return change.id.createParentID().createAllElemIdParents()
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
    isChangeIdEqualOrParentOfMatchingElemId(change)
      || isChangeIdChildOfMatchingElemId(change)

  return {
    isChangeMatchSelectors,
    isTopLevelElementMatchSelectors,
  }
}

export const createDiffChanges = async (
  toElementsSrc: elementSource.ElementsSource,
  fromElementsSrc: elementSource.ElementsSource,
  referenceSourcesIndex: remoteMap.ReadOnlyRemoteMap<ElemID[]>,
  elementSelectors: ElementSelector[] = [],
  topLevelFilters: IDFilter[] = []
): Promise<DetailedChange[]> => {
  if (elementSelectors.length > 0) {
    const matchers = await createMatchers(
      toElementsSrc,
      fromElementsSrc,
      referenceSourcesIndex,
      elementSelectors
    )
    const plan = await getPlan({
      before: toElementsSrc,
      after: fromElementsSrc,
      dependencyChangers: [],
      topLevelFilters: topLevelFilters.concat(matchers.isTopLevelElementMatchSelectors),
    })
    return awu(plan.itemsByEvalOrder())
      .flatMap(item => item.detailedChanges())
      .filter(matchers.isChangeMatchSelectors)
      .toArray()
  }
  const plan = await getPlan({
    before: toElementsSrc,
    after: fromElementsSrc,
    dependencyChangers: [],
    topLevelFilters,
  })
  return wu(plan.itemsByEvalOrder())
    .map(item => item.detailedChanges())
    .flatten()
    .toArray()
}

export const getEnvsDeletionsDiff = async (
  workspace: Workspace,
  sourceElemIds: ElemID[],
  envs: ReadonlyArray<string>,
  selectors: ElementSelector[]
): Promise<Record<string, ElemID[]>> => {
  const envsElemIds: Record<string, ElemID[]> = Object.fromEntries(await (awu(envs)).map(
    async env =>
      [
        env,
        await awu(await workspace.getElementIdsBySelectors(
          selectors,
          { source: 'env', envName: env },
          true
        )).toArray(),
      ]
  ).toArray())

  const sourceElemIdsSet = new Set(sourceElemIds.map(id => id.getFullName()))
  return _(envsElemIds)
    .mapValues(ids => ids.filter(id => !sourceElemIdsSet.has(id.getFullName())))
    .entries()
    .filter(([_env, ids]) => ids.length !== 0)
    .fromPairs()
    .value()
}
