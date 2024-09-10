/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import wu from 'wu'
import {
  Element,
  ChangeValidator,
  Change,
  ChangeError,
  DependencyChanger,
  ChangeGroupIdFunction,
  ElemID,
  CompareOptions,
} from '@salto-io/adapter-api'
import { GroupDAG } from '@salto-io/dag'
import { logger } from '@salto-io/logging'
import { PlanItem, addPlanItemAccessors, PlanItemId } from './plan_item'
import { buildGroupedGraphFromDiffGraph, getCustomGroupIds } from './group'
import { filterInvalidChanges } from './filter'
import {
  addNodeDependencies,
  addFieldToObjectDependency,
  addTypeDependency,
  addAfterRemoveDependency,
  addReferencesDependency,
  addInstanceToFieldsDependency,
} from './dependency'
import { buildGraphFromChanges } from './common'
import { getDiffChanges, GetDiffChangesParameters, resolveNodeElements } from '../diff'

const log = logger(module)

export type IDFilter = (id: ElemID) => boolean | Promise<boolean>

export type Plan = GroupDAG<Change> & {
  itemsByEvalOrder: () => Iterable<PlanItem>
  getItem: (id: PlanItemId) => PlanItem
  changeErrors: ReadonlyArray<ChangeError>
}

const addPlanFunctions = (
  groupGraph: GroupDAG<Change>,
  changeErrors: ReadonlyArray<ChangeError>,
  compareOptions?: CompareOptions,
): Plan =>
  Object.assign(groupGraph, {
    itemsByEvalOrder(): Iterable<PlanItem> {
      return wu(groupGraph.evaluationOrder())
        .map(group => groupGraph.getData(group))
        .map(group => addPlanItemAccessors(group, compareOptions))
    },

    getItem(planItemId: PlanItemId): PlanItem {
      return addPlanItemAccessors(groupGraph.getData(planItemId), compareOptions)
    },
    changeErrors,
  })

export const defaultDependencyChangers = [
  addAfterRemoveDependency,
  addTypeDependency,
  addFieldToObjectDependency,
  addReferencesDependency,
  addInstanceToFieldsDependency,
]

export type AdditionalResolveContext = {
  before: ReadonlyArray<Element>
  after: ReadonlyArray<Element>
}

type GetPlanParameters = {
  changeValidators?: Record<string, ChangeValidator>
  dependencyChangers?: ReadonlyArray<DependencyChanger>
  customGroupIdFunctions?: Record<string, ChangeGroupIdFunction>
  additionalResolveContext?: ReadonlyArray<Element>
} & GetDiffChangesParameters

type BuildPlanParameters = GetPlanParameters & { diffChanges: Iterable<Change> }

const buildPlan = async ({
  before,
  after,
  changeValidators = {},
  dependencyChangers = defaultDependencyChangers,
  customGroupIdFunctions = {},
  compareOptions,
  diffChanges,
}: BuildPlanParameters): Promise<Plan> =>
  log.timeDebug(async () => {
    const diffGraphFromChanges = buildGraphFromChanges(diffChanges)
    const diffGraph = await addNodeDependencies(dependencyChangers)(diffGraphFromChanges)
    const filterResult = await filterInvalidChanges(before, after, diffGraph, changeValidators)

    // If the graph was replaced during filtering we need to resolve the graph again to account
    // for nodes that may have changed during the filter.
    if (filterResult.replacedGraph) {
      // Note - using "after" here may be incorrect because filtering could create different
      // "after" elements
      await resolveNodeElements(before, after)(filterResult.validDiffGraph)
    }

    const { changeGroupIdMap, disjointGroups } = await getCustomGroupIds(
      filterResult.validDiffGraph,
      customGroupIdFunctions,
    )
    // build graph
    const groupedGraph = buildGroupedGraphFromDiffGraph(filterResult.validDiffGraph, changeGroupIdMap, disjointGroups)
    // build plan
    return addPlanFunctions(groupedGraph, filterResult.changeErrors, compareOptions)
  }, 'buildPlan')

export const getPlan = async ({
  before,
  after,
  changeValidators = {},
  dependencyChangers = defaultDependencyChangers,
  customGroupIdFunctions = {},
  topLevelFilters = [],
  compareOptions,
}: GetPlanParameters): Promise<Plan> => {
  const diffChanges = await getDiffChanges({ before, after, topLevelFilters, compareOptions })
  return buildPlan({
    before,
    after,
    changeValidators,
    dependencyChangers,
    customGroupIdFunctions,
    compareOptions,
    diffChanges,
  })
}
