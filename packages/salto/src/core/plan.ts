import _ from 'lodash'
import wu from 'wu'
import {
  ObjectType, Element, ElemID, isObjectType, isInstanceElement,
  Field, isField, InstanceElement, Change, getChangeElement,
} from 'adapter-api'
import {
  buildDiffGraph, buildGroupedGraph, Group, DataNodeMap, NodeId,
} from '@salto/dag'
import State from '../state/state'

export type PlanItemId = NodeId
export type PlanItem = Group<Change> & {parent: () => Change}
export type Plan = DataNodeMap<Group<Change>> & {itemsByEvalOrder: () => Iterable<PlanItem>
  getItem: (id: PlanItemId) => PlanItem | undefined}

/**
 * Util function that returns string id based on elemId
 */
const id = (elemId: ElemID): string => elemId.getFullName()

// Node in the elements graph (elements graph -> diff graph -> group graph)
type Node = ObjectType | InstanceElement | Field
/**
 * Check if 2 nodes in the DAG are equals or not
 */
const isEqualsNode = (node1: Node | undefined, node2: Node | undefined): boolean => {
  if (isObjectType(node1) && isObjectType(node2)) {
    // We would like to check equality only on type level prop (annotations) and not fields
    return node1.isAnnotationsEqual(node2)
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
const toNodeMap = (elements: Element[]): DataNodeMap<Node> => {
  const nodeMap = new DataNodeMap<Node>()

  elements.filter(e => !e.elemID.isConfig()).filter(isObjectType).forEach(obj => {
    // Add object type
    nodeMap.addNode(id(obj.elemID), [], obj)
    // Add object type fields
    // TODO: once we move to '.' seprator we can remove FIELD perfix, see:
    // https://github.com/salto-io/salto/pull/118
    Object.values(obj.fields).forEach(field => nodeMap.addNode(`FIELD_${id(field.elemID)}`,
      [id(obj.elemID)], field))
  })

  elements.filter(e => !e.elemID.isConfig()).filter(isInstanceElement).forEach(inst => {
    // Add instance elements
    nodeMap.addNode(id(inst.elemID), [id(inst.type.elemID)], inst)
    // We are not adding the fields values because unlike types, values are objects with hirerchy
    // and we cannot just cut them on the first level. For types, subtypes declared outside.
  })
  return nodeMap
}

export const getPlan = async (state: State, allElements: Element[]): Promise<Plan> => {
  // getPlan
  const before = toNodeMap(await state.get())
  const after = toNodeMap(allElements)
  // Calculate the diff
  const diffGraph = buildDiffGraph(before, after,
    nodeId => isEqualsNode(before.getData(nodeId), after.getData(nodeId)))

  // Build the plan
  const groupKey = (nodeId: NodeId): string => {
    const diffNode = diffGraph.getData(nodeId)
    if (_.isUndefined(diffNode)) return '*undefined*'
    const element = getChangeElement(diffNode)
    if (isField(element)) {
      return id(element.parentID)
    }
    // if element is not field it's ObjectType or InstanceElement
    return id(element.elemID)
  }

  const addParentAccessor = (group: Group<Change>|undefined): PlanItem | undefined => {
    if (group === undefined) return undefined
    const planItem = group as PlanItem
    planItem.parent = (): Change => wu(group.items.values()).find(change =>
      getChangeElement(change).elemID.getFullName() === group.groupKey)
      || {
        action: 'modify',
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        data: { before: before.getData(group.groupKey)!, after: after.getData(group.groupKey)! },
      }
    return planItem
  }

  const addPlanFunctions = (groupGraph: DataNodeMap<Group<Change>>): Plan => {
    const result = groupGraph as Plan
    result.itemsByEvalOrder = (): Iterable<PlanItem> => wu(groupGraph.evaluationOrder())
      .map(item => result.getData(item))
      .reject(_.isUndefined)
      .map(addParentAccessor) as Iterable<PlanItem>
    result.getItem = (planItemId: PlanItemId): PlanItem | undefined =>
      addParentAccessor(result.getData(planItemId))
    return result
  }

  return addPlanFunctions(buildGroupedGraph(diffGraph, groupKey))
}
