/*
*                      Copyright 2020 Salto Labs Ltd.
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
import wu from 'wu'
import _ from 'lodash'
import { Element, isObjectType, isInstanceElement, ChangeDataType, isField, isPrimitiveType, ChangeValidator, Change, ChangeError, DependencyChanger, ChangeGroupIdFunction, getChangeElement, isAdditionOrRemovalDiff, isFieldChange } from '@salto-io/adapter-api'
import { DataNodeMap, GroupedNodeMap, DiffNode, mergeNodesToModify, removeEqualNodes, DiffGraph, Group } from '@salto-io/dag'
import { logger } from '@salto-io/logging'
import { expressions } from '@salto-io/workspace'
import { PlanItem, addPlanItemAccessors, PlanItemId } from './plan_item'
import { buildGroupedGraphFromDiffGraph, getCustomGroupIds } from './group'
import { filterInvalidChanges } from './filter'
import {
  addNodeDependencies, addFieldToObjectDependency, addTypeDependency, addAfterRemoveDependency,
  addReferencesDependency,
} from './dependency'
import { PlanTransformer, changeId } from './common'

const { resolve } = expressions

const log = logger(module)

/**
 * Add elements to a diff graph as changes
 */
const addElements = (
  elements: ReadonlyArray<Element>,
  action: Change['action'] & ('add' | 'remove'),
): PlanTransformer => graph => log.time(async () => {
  const outputGraph = graph.clone()

  // Helper functions
  const toChange = (elem: ChangeDataType): DiffNode<ChangeDataType> => {
    if (action === 'add') {
      return { originalId: elem.elemID.getFullName(), action, data: { after: elem } }
    }
    return { originalId: elem.elemID.getFullName(), action, data: { before: elem } }
  }

  const addElemToOutputGraph = (elem: ChangeDataType): void => {
    outputGraph.addNode(changeId(elem, action), [], toChange(elem))
  }

  const isTopLevelElement = (elem: Element): elem is ChangeDataType => (
    isObjectType(elem) || isPrimitiveType(elem) || isInstanceElement(elem)
  )

  // Add top level elements to the graph
  elements.filter(isTopLevelElement).forEach(addElemToOutputGraph)

  // We add fields to the graph separately from their object types to allow for better granularity
  // of cycle avoidance
  _(elements)
    .filter(isObjectType)
    .map(obj => Object.values(obj.fields))
    .flatten()
    .forEach(addElemToOutputGraph)

  return outputGraph
}, 'add nodes to graph with action %s for %d elements', action, elements.length)

/**
 * Check if 2 nodes in the DAG are equals or not
 */
const isEqualsNode = (node1: ChangeDataType, node2: ChangeDataType): boolean => {
  if (isObjectType(node1) && isObjectType(node2)) {
    // We would like to check equality only on type level prop (annotations) and not fields
    return node1.isAnnotationsEqual(node2)
  }
  if (isPrimitiveType(node1) && isPrimitiveType(node2)) {
    return node1.isEqual(node2)
  }
  if (isInstanceElement(node1) && isInstanceElement(node2)) {
    return node1.isEqual(node2)
  }
  if (isField(node1) && isField(node2)) {
    return node1.isEqual(node2)
  }
  // Assume we shouldn't reach this point
  return _.isEqual(node1, node2)
}

const addPlanFunctions = (
  groupGraph: GroupedNodeMap<Change>, changeErrors: ReadonlyArray<ChangeError>
): Plan => Object.assign(groupGraph,
  {
    itemsByEvalOrder(): Iterable<PlanItem> {
      return wu(groupGraph.evaluationOrder())
        .map(group => groupGraph.getData(group))
        .map(group => addPlanItemAccessors(group))
    },

    getItem(planItemId: PlanItemId): PlanItem {
      return addPlanItemAccessors(groupGraph.getData(planItemId))
    },
    changeErrors,
  })

export type Plan = GroupedNodeMap<Change> & {
  itemsByEvalOrder: () => Iterable<PlanItem>
  getItem: (id: PlanItemId) => PlanItem
  changeErrors: ReadonlyArray<ChangeError>
}

const buildDiffGraph = (
  ...transforms: ReadonlyArray<PlanTransformer>
): Promise<DiffGraph<ChangeDataType>> => (
  transforms.reduce(
    async (graph, transform) => transform(await graph),
    Promise.resolve(new DataNodeMap<DiffNode<ChangeDataType>>()),
  )
)

export const defaultDependencyChangers = [
  addAfterRemoveDependency,
  addTypeDependency,
  addFieldToObjectDependency,
  addReferencesDependency,
]

const addModifyNodes = (
  addDependencies: PlanTransformer
): PlanTransformer => {
  const runMergeStep: PlanTransformer = async stepGraph => {
    const mergedGraph = await addDependencies(stepGraph)
    mergeNodesToModify(mergedGraph)
    if (stepGraph.size !== mergedGraph.size) {
      // Some of the nodes were merged, this may enable other nodes to be merged
      // Note that with each iteration that changes the size we merge at least one node pair
      // so if we have N node pairs this recursion will run at most N times
      mergedGraph.clearEdges()
      return runMergeStep(mergedGraph)
    }
    return mergedGraph
  }
  return runMergeStep
}

const removeRedundantFieldChanges = (
  graph: GroupedNodeMap<Change<ChangeDataType>>
): GroupedNodeMap<Change<ChangeDataType>> => (
  // If we add / remove an object type, we can omit all the field add / remove
  // changes from the same group since they are included in the parent change
  new DataNodeMap<Group<Change<ChangeDataType>>>(
    graph.entries(),
    new Map(wu(graph.keys()).map(key => {
      const group = graph.getData(key)
      const objTypeAddOrRemove = new Set(
        wu(group.items.values())
          .filter(isAdditionOrRemovalDiff)
          .map(getChangeElement)
          .filter(isObjectType)
          .map(obj => obj.elemID.getFullName())
      )
      const isRedundantFieldChange = (change: Change<ChangeDataType>): boolean => (
        isAdditionOrRemovalDiff(change)
        && isFieldChange(change)
        && objTypeAddOrRemove.has(getChangeElement(change).parent.elemID.getFullName())
      )
      const filteredItems = new Map(
        wu(group.items.entries()).filter(([_id, change]) => !isRedundantFieldChange(change))
      )
      return [key, { groupKey: group.groupKey, items: filteredItems }]
    }))
  )
)

type GetPlanParameters = {
  before: ReadonlyArray<Element>
  after: ReadonlyArray<Element>
  changeValidators?: Record<string, ChangeValidator>
  dependencyChangers?: ReadonlyArray<DependencyChanger>
  customGroupIdFunctions?: Record<string, ChangeGroupIdFunction>
  additionalResolveContext?: ReadonlyArray<Element>
}
export const getPlan = async ({
  before,
  after,
  changeValidators = {},
  dependencyChangers = defaultDependencyChangers,
  customGroupIdFunctions = {},
  additionalResolveContext,
}: GetPlanParameters): Promise<Plan> => log.time(async () => {
  // Resolve elements before adding them to the graph
  const resolvedBefore = resolve(before, additionalResolveContext)
  const resolvedAfter = resolve(after, additionalResolveContext)

  const diffGraph = await buildDiffGraph(
    addElements(resolvedBefore, 'remove'),
    addElements(resolvedAfter, 'add'),
    removeEqualNodes(isEqualsNode),
    addModifyNodes(addNodeDependencies(dependencyChangers)),
  )

  // filter invalid changes from the graph and the after elements
  const beforeElementsMap = _.keyBy(resolvedBefore, e => e.elemID.getFullName())
  const afterElementsMap = _.keyBy(resolvedAfter, e => e.elemID.getFullName())
  const filterResult = await filterInvalidChanges(
    beforeElementsMap, afterElementsMap, diffGraph, changeValidators,
  )

  const customGroupKeys = await getCustomGroupIds(
    filterResult.validDiffGraph, customGroupIdFunctions,
  )

  // build graph
  const groupedGraph = removeRedundantFieldChanges(
    buildGroupedGraphFromDiffGraph(filterResult.validDiffGraph, customGroupKeys)
  )

  // build plan
  return addPlanFunctions(groupedGraph, filterResult.changeErrors)
}, 'get plan with %o -> %o elements', before.length, after.length)
