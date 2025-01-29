/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import wu from 'wu'
import _ from 'lodash'
import {
  Element,
  ChangeDataType,
  ChangeValidator,
  Change,
  ChangeError,
  DependencyChanger,
  ChangeGroupIdFunction,
  ReadOnlyElementsSource,
  ElemID,
  isAdditionChange,
  isModificationChange,
  isRemovalChange,
  changeId,
  CompareOptions,
  getChangeData,
} from '@salto-io/adapter-api'
import { DataNodeMap, DiffNode, DiffGraph, GroupDAG } from '@salto-io/dag'
import { logger } from '@salto-io/logging'
import { expressions } from '@salto-io/workspace'
import { collections } from '@salto-io/lowerdash'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { PlanItem, addPlanItemAccessors, PlanItemId } from './plan_item'
import { buildGroupedGraphFromDiffGraph, getCustomGroupIds } from './group'
import { createCircularDependencyError, filterInvalidChanges, getChangeErrors, FilterResult } from './filter'
import {
  addNodeDependencies,
  addFieldToObjectDependency,
  addTypeDependency,
  addAfterRemoveDependency,
  addReferencesDependency,
  addInstanceToFieldsDependency,
} from './dependency'
import { PlanTransformer } from './common'
import { calculateDiff } from './diff'

const { awu } = collections.asynciterable
const { resolve } = expressions

const log = logger(module)

export type IDFilter = (id: ElemID) => boolean | Promise<boolean>

const changeToDiffNode = (change: Change<ChangeDataType>): DiffNode<ChangeDataType> => ({
  ...change,
  originalId: getChangeData(change).elemID.getFullName(),
})

const addDifferentElements =
  (
    before: ReadOnlyElementsSource,
    after: ReadOnlyElementsSource,
    topLevelFilters: IDFilter[],
    compareOptions?: CompareOptions,
  ): PlanTransformer =>
  async graph =>
    log.timeDebug(async () => {
      const outputGraph = graph.clone()
      const changes = await calculateDiff({
        before,
        after,
        topLevelFilters,
        compareOptions: { ...compareOptions, createFieldChanges: true },
      })
      await awu(changes).forEach(change => {
        outputGraph.addNode(changeId(change), [], changeToDiffNode(change))
      })
      return outputGraph
    }, 'add nodes to graph')

const resolveNodeElements =
  (before: ReadOnlyElementsSource, after: ReadOnlyElementsSource): PlanTransformer =>
  graph =>
    log.timeDebug(
      async () => {
        const beforeItemsToResolve: ChangeDataType[] = []
        const afterItemsToResolve: ChangeDataType[] = []
        wu(graph.keys()).forEach(id => {
          const change = graph.getData(id)
          if (change.action !== 'add') {
            beforeItemsToResolve.push(change.data.before)
          }
          if (change.action !== 'remove') {
            afterItemsToResolve.push(change.data.after)
          }
        })

        const resolvedBefore = _.keyBy(
          await log.timeDebug(() => resolve(beforeItemsToResolve, before), 'Resolving before items'),
          e => e.elemID.getFullName(),
        ) as Record<string, ChangeDataType>

        const resolvedAfter = _.keyBy(
          await log.timeDebug(() => resolve(afterItemsToResolve, after), 'Resolving after items'),
          e => e.elemID.getFullName(),
        ) as Record<string, ChangeDataType>

        wu(graph.keys()).forEach(id => {
          const change = graph.getData(id)
          if (isAdditionChange(change)) {
            change.data.after = resolvedAfter[change.data.after.elemID.getFullName()]
          }
          if (isModificationChange(change)) {
            change.data.after = resolvedAfter[change.data.after.elemID.getFullName()]
            change.data.before = resolvedBefore[change.data.before.elemID.getFullName()]
          }
          if (isRemovalChange(change)) {
            change.data.before = resolvedBefore[change.data.before.elemID.getFullName()]
          }
          graph.setData(id, change)
        })

        return graph
      },
      'resolve node elements for %d nodes',
      graph.size,
    )

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

const buildDiffGraph = (...transforms: ReadonlyArray<PlanTransformer>): Promise<DiffGraph<ChangeDataType>> =>
  transforms.reduce(
    async (graph, transform) => transform(await graph),
    Promise.resolve(new DataNodeMap<DiffNode<ChangeDataType>>()),
  )

const buildGroupedGraphFromFilterResult = async (
  before: ReadOnlyElementsSource,
  after: ReadOnlyElementsSource,
  filterResult: FilterResult,
  customGroupIdFunctions: Record<string, ChangeGroupIdFunction>,
): Promise<{ groupedGraph: GroupDAG<Change>; removedCycles: collections.set.SetId[][] }> => {
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

  const { graph: groupedGraph, removedCycles } = buildGroupedGraphFromDiffGraph(
    filterResult.validDiffGraph,
    changeGroupIdMap,
    disjointGroups,
  )
  return { groupedGraph, removedCycles }
}

const createGroupedGraphAndChangeErrors = async (
  before: ReadOnlyElementsSource,
  after: ReadOnlyElementsSource,
  filterResult: FilterResult,
  customGroupIdFunctions: Record<string, ChangeGroupIdFunction>,
): Promise<{ groupedGraph: GroupDAG<Change>; changeErrors: ChangeError[] }> => {
  const { groupedGraph: firstIterationGraph, removedCycles } = await buildGroupedGraphFromFilterResult(
    before,
    after,
    filterResult,
    customGroupIdFunctions,
  )
  if (removedCycles.length === 0) {
    return { groupedGraph: firstIterationGraph, changeErrors: filterResult.changeErrors }
  }

  log.error('detected circular dependencies in plan, rebuilding graph after cycles were removed')

  const circularDependencyErrors = removedCycles.flatMap(cycle => {
    const cycleIds = cycle.map(id => getChangeData(filterResult.validDiffGraph.getData(id)).elemID)
    return cycleIds.map(id => createCircularDependencyError(id, cycleIds))
  })

  const filteredCircularNodesResult = await filterInvalidChanges(
    before,
    after,
    filterResult.validDiffGraph,
    circularDependencyErrors,
  )

  const { groupedGraph: secondIterationGraph, removedCycles: additionalCycles } =
    await buildGroupedGraphFromFilterResult(before, after, filteredCircularNodesResult, customGroupIdFunctions)

  // shouldn't happen, as all cycles were removed in the first iteration
  if (additionalCycles.length > 0) {
    log.error(
      'detected circular dependencies in plan after cycles were removed in the first iteration. detected cycles: %s. failing plan',
      safeJsonStringify(additionalCycles),
    )
    throw new Error('Failed to remove circular dependencies from plan')
  }

  return {
    groupedGraph: secondIterationGraph,
    changeErrors: filterResult.changeErrors.concat(filteredCircularNodesResult.changeErrors),
  }
}

export const defaultDependencyChangers = [
  addAfterRemoveDependency,
  addTypeDependency,
  addFieldToObjectDependency,
  addReferencesDependency,
  addInstanceToFieldsDependency,
]

type GetPlanParameters = {
  before: ReadOnlyElementsSource
  after: ReadOnlyElementsSource
  changeValidators?: Record<string, ChangeValidator>
  dependencyChangers?: ReadonlyArray<DependencyChanger>
  customGroupIdFunctions?: Record<string, ChangeGroupIdFunction>
  additionalResolveContext?: ReadonlyArray<Element>
  topLevelFilters?: IDFilter[]
  compareOptions?: CompareOptions
}
export const getPlan = async ({
  before,
  after,
  changeValidators = {},
  dependencyChangers = defaultDependencyChangers,
  customGroupIdFunctions = {},
  topLevelFilters = [],
  compareOptions,
}: GetPlanParameters): Promise<Plan> => {
  const numBeforeElements = await awu(await before.list()).length()
  const numAfterElements = await awu(await after.list()).length()
  return log.timeDebug(
    async () => {
      const diffGraph = await buildDiffGraph(
        addDifferentElements(before, after, topLevelFilters, compareOptions),
        resolveNodeElements(before, after),
        addNodeDependencies(dependencyChangers),
      )
      const validatorsErrors = await getChangeErrors(after, diffGraph, changeValidators)
      const filterResult = await filterInvalidChanges(before, after, diffGraph, validatorsErrors)

      // build graph and add additional errors
      const { groupedGraph, changeErrors } = await createGroupedGraphAndChangeErrors(
        before,
        after,
        filterResult,
        customGroupIdFunctions,
      )
      // build plan
      return addPlanFunctions(groupedGraph, changeErrors, compareOptions)
    },
    'get plan with %o -> %o elements',
    numBeforeElements,
    numAfterElements,
  )
}
