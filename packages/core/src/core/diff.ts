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
import { DetailedChange, ElemID, getChangeData, isRemovalChange } from '@salto-io/adapter-api'
import { WalkOnFunc, walkOnValue, WALK_NEXT_STEP } from '@salto-io/adapter-utils'
import { ElementSelector, selectElementIdsByTraversal, elementSource, Workspace, remoteMap } from '@salto-io/workspace'
import wu from 'wu'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { IDFilter, getPlan } from './plan/plan'

const log = logger(module)
const { awu } = collections.asynciterable

const isChangeIdRelevant = ({ id }: DetailedChange, relevantIds: ElemID[]): boolean =>
  relevantIds.some(elemId =>
    id.isParentOf(elemId) || elemId.isEqual(id) || elemId.isParentOf(id))

const isChangeValueRelevant = (
  change: DetailedChange,
  relevantIds: ElemID[]
): boolean => {
  let isMatch = false
  const func: WalkOnFunc = ({ path }) => {
    if (relevantIds.some(elemId => elemId.isEqual(path) || elemId.isParentOf(path))) {
      isMatch = true
      return WALK_NEXT_STEP.EXIT
    }
    return WALK_NEXT_STEP.RECURSE
  }
  walkOnValue({ elemId: change.id, value: getChangeData(change), func })
  return isMatch
}

const getFilteredIds = async (
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

  const isChangeMatchSelectors = (change: DetailedChange): boolean => {
    const relevantIds = isRemovalChange(change) ? beforeMatchingElemIDs : afterMatchingElemIDs
    return isChangeIdRelevant(change, relevantIds) && isChangeValueRelevant(change, relevantIds)
  }

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
