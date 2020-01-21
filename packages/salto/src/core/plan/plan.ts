import wu from 'wu'
import _ from 'lodash'
import {
  Element, isObjectType, isInstanceElement, ChangeDataType, isField, isPrimitiveType,
  ChangeValidator, Change, ChangeError, ElementMap,
} from 'adapter-api'
import {
  DataNodeMap, GroupedNodeMap, DiffGraph, DiffNode, mergeNodesToModify, removeEqualNodes,
} from '@salto/dag'
import { logger } from '@salto/logging'
import { resolve } from '../expressions'
import { createElementsMap } from '../search'
import { PlanItem, addPlanItemAccessors, PlanItemId } from './plan_item'
import { buildGroupedGraphFromDiffGraph, findGroupLevelChange } from './group'
import { filterInvalidChanges } from './filter'
import { addNodeDependencies, typeDependencyProvider, objectDependencyProvider } from './dependecy'
import { DiffGraphTransformer, changeId } from './common'

const log = logger(module)

// Node in the elements graph (elements graph -> diff graph -> group graph)
type Node = ChangeDataType

/**
 * Get list of elements and add them to a diff DAG
 *
 * TODO:ORI - move this to a different file
 */
const addElements = (
  elements: ReadonlyArray<Element>,
  action: Change['action'] & ('add' | 'remove'),
): DiffGraphTransformer => graph => log.time(() => {
  const outputGraph = graph.clone()

  // Helper functions
  const toChange = (elem: Node): DiffNode<Node> => {
    if (action === 'add') {
      return { originalId: elem.elemID.getFullName(), action, data: { after: elem } }
    }
    return { originalId: elem.elemID.getFullName(), action, data: { before: elem } }
  }

  const addElemToOutputGraph = (elem: Node): void => {
    outputGraph.addNode(changeId(elem, action), [], toChange(elem))
  }

  // Add top level elements to the graph
  elements.filter(isObjectType).forEach(addElemToOutputGraph)
  elements.filter(isPrimitiveType).forEach(addElemToOutputGraph)
  elements.filter(isInstanceElement).forEach(addElemToOutputGraph)

  // We add fields to the graph seperately from their object types to allow for better granularity
  // of cycle aviodance
  _(elements)
    .filter(isObjectType)
    .map(obj => Object.values(obj.fields))
    .flatten()
    .forEach(addElemToOutputGraph)

  return outputGraph
}, 'add node to graph with action %s for %d elements', action, elements.length)

/**
 * Check if 2 nodes in the DAG are equals or not
 */
const isEqualsNode = (node1?: Node, node2?: Node): boolean => {
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
  // If we got here, at least one of the nodes is undefined
  return _.isEqual(node1, node2)
}

// TODO:ORI - move the transform interface to a more reasonable place (dag package?)
type MyGraph = {
  graph: DiffGraph<Node>
  transform: (transformer: DiffGraphTransformer) => MyGraph
}
const myGraph = (graph: DiffGraph<Node>): MyGraph => ({
  graph,
  transform: transformer => myGraph(transformer(graph)),
})

const addPlanFunctions = (groupGraph: GroupedNodeMap<Change>,
  changeErrors: ReadonlyArray<ChangeError>, beforeElementsMap: ElementMap,
  afterElementsMap: ElementMap): Plan => Object.assign(groupGraph,
  {
    itemsByEvalOrder(): Iterable<PlanItem> {
      return wu(groupGraph.evaluationOrder())
        .map(group => groupGraph.getData(group))
        .map(group => {
          // If we add / remove a "group level" element it already contains all the information
          // about its sub changes so we can keep only the group level change
          const groupLevelChange = findGroupLevelChange(group)
          return groupLevelChange !== undefined && groupLevelChange.action !== 'modify'
            ? { ...group, items: new Map([[group.groupKey, groupLevelChange]]) }
            : group
        })
        .map(group => addPlanItemAccessors(group, beforeElementsMap, afterElementsMap))
    },

    getItem(planItemId: PlanItemId): PlanItem {
      return addPlanItemAccessors(groupGraph.getData(planItemId), beforeElementsMap,
        afterElementsMap)
    },
    changeErrors,
  })

export type Plan = GroupedNodeMap<Change> & {
  itemsByEvalOrder: () => Iterable<PlanItem>
  getItem: (id: PlanItemId) => PlanItem
  changeErrors: ReadonlyArray<ChangeError>
}

export const getPlan = async (
  beforeElements: readonly Element[],
  afterElements: readonly Element[],
  changeValidators: Record<string, ChangeValidator> = {},
  withDependencies = true
): Promise<Plan> => log.time(async () => {
  // Resolve elements before adding them to the graph
  const resolvedBefore = resolve(beforeElements)
  const resolvedAfter = resolve(afterElements)

  // For function interface backwards compatibility we build the provider list here
  // TODO:ORI - change the function interface to get the list of providers
  const dependecyProviders = withDependencies
    ? [typeDependencyProvider, objectDependencyProvider]
    : []

  const diffGraph = myGraph(new DataNodeMap<DiffNode<Node>>())
    .transform(addElements(resolvedBefore, 'remove'))
    .transform(addElements(resolvedAfter, 'add'))
    .transform(removeEqualNodes(isEqualsNode))
    .transform(addNodeDependencies(dependecyProviders))
    .transform(mergeNodesToModify)
    .graph

  // filter invalid changes from the graph and the after elements
  const beforeElementsMap = createElementsMap(resolvedBefore)
  const afterElementsMap = createElementsMap(resolvedAfter)
  const filterResult = await filterInvalidChanges(
    beforeElementsMap, afterElementsMap, diffGraph, changeValidators,
  )

  // build graph
  const groupedGraph = buildGroupedGraphFromDiffGraph(filterResult.validDiffGraph)
  // build plan
  return addPlanFunctions(groupedGraph, filterResult.changeErrors, beforeElementsMap,
    filterResult.validAfterElementsMap)
}, 'get plan with %o -> %o elements', beforeElements.length, afterElements.length)
