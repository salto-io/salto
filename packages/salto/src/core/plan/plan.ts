import wu from 'wu'
import _ from 'lodash'
import {
  Element, ElemID, isObjectType, isInstanceElement, ChangeDataType, isField, isPrimitiveType,
  ChangeValidator,
  Change,
  ChangeError,
  ElementMap,
} from 'adapter-api'
import {
  buildDiffGraph, DataNodeMap, GroupedNodeMap,
} from '@salto/dag'
import { logger } from '@salto/logging'
import { resolve } from '../expressions'
import { createElementsMap } from '../search'
import { PlanItem, addPlanItemAccessors, PlanItemId } from './plan_item'
import { buildGroupedGraphFromDiffGraph, findGroupLevelChange } from './group'
import { filterInvalidChanges } from './filter'

const log = logger(module)
/**
 * Util function that returns string id based on elemId
 */
const id = (elemId: ElemID): string => elemId.getFullName()

// Node in the elements graph (elements graph -> diff graph -> group graph)
type Node = ChangeDataType
/**
 * Check if 2 nodes in the DAG are equals or not
 */
const isEqualsNode = (node1: Node, node2: Node): boolean => {
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

/**
 * Get list of elements and create DAG based on it
 */
const toNodeMap = (
  elements: readonly Element[],
  withDependencies = true
): DataNodeMap<Node> => log.time(() => {
  const nodeMap = new DataNodeMap<Node>()

  elements.filter(isObjectType).forEach(obj => {
    // Add object type
    nodeMap.addNode(id(obj.elemID), [], obj)
    // Add object type fields
    const fieldDependencies = withDependencies ? [id(obj.elemID)] : []
    Object.values(obj.fields).forEach(
      field => nodeMap.addNode(id(field.elemID), fieldDependencies, field)
    )
  })

  elements.filter(isInstanceElement).forEach(inst => {
    // Add instance elements
    const instanceDependencies = withDependencies ? [id(inst.type.elemID)] : []
    nodeMap.addNode(id(inst.elemID), instanceDependencies, inst)
    // We are not adding the fields values because unlike types, values are objects with hierarchy
    // and we cannot just cut them on the first level. For types, subtypes declared outside.
  })

  elements.filter(isPrimitiveType).forEach(type => {
    nodeMap.addNode(id(type.elemID), [], type)
  })
  return nodeMap
}, 'build node map for %s for %o elements', withDependencies ? 'deploy' : 'fetch', elements.length)


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
  // getPlan
  const resolvedBefore = resolve(beforeElements)
  const resolvedAfter = resolve(afterElements)
  const before = toNodeMap(resolvedBefore, withDependencies)
  const after = toNodeMap(resolvedAfter, withDependencies)
  const diffGraph = buildDiffGraph(before, after,
    nodeId => isEqualsNode(before.getData(nodeId), after.getData(nodeId)))
  const beforeElementsMap = createElementsMap(resolvedBefore)
  const afterElementsMap = createElementsMap(resolvedAfter)
  // filter invalid changes from the graph and the after elements
  const filterResult = await filterInvalidChanges(beforeElementsMap, afterElementsMap, diffGraph,
    changeValidators)
  // build graph
  const groupedGraph = buildGroupedGraphFromDiffGraph(filterResult.validDiffGraph)
  // build plan
  return addPlanFunctions(groupedGraph, filterResult.changeErrors, beforeElementsMap,
    filterResult.validAfterElementsMap)
}, 'get %s changes %o -> %o elements', withDependencies ? 'deploy' : 'fetch',
beforeElements.length, afterElements.length)
