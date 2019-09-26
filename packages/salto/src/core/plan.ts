import _ from 'lodash'
import wu from 'wu'
import {
  Element, ElemID, isObjectType, isInstanceElement, Value, Values, ChangeDataType,
  isField, Change, getChangeElement, isEqualElements, isPrimitiveType,
} from 'adapter-api'
import {
  buildDiffGraph, buildGroupedGraph, Group, DataNodeMap, NodeId, GroupedNodeMap,
  AdditionDiff, ModificationDiff, RemovalDiff,
} from '@salto/dag'

export type DetailedChange<T = ChangeDataType | Values | Value> =
  (AdditionDiff<T> | ModificationDiff<T> | RemovalDiff<T>) & { id: ElemID }

export type PlanItemId = NodeId
export type PlanItem = Group<Change> & {
  parent: () => Change
  changes: () => Iterable<Change>
  detailedChanges: () => Iterable<DetailedChange>
}
export type Plan = GroupedNodeMap<Change> & {
  itemsByEvalOrder: () => Iterable<PlanItem>
  getItem: (id: PlanItemId) => PlanItem
}

/**
 * Create detailed changes from change data (before and after values)
 */
const getValuesChanges = (id: ElemID, before: Value, after: Value): DetailedChange[] => {
  if (isEqualElements(before, after) || _.isEqual(before, after)) {
    return []
  }
  if (before === undefined) {
    return [{ id, action: 'add', data: { after } }]
  }
  if (after === undefined) {
    return [{ id, action: 'remove', data: { before } }]
  }
  if (_.isPlainObject(before) && _.isPlainObject(after)) {
    return _(before).keys()
      .union(_.keys(after))
      .map(key => getValuesChanges(id.createNestedID(key), before[key], after[key]))
      .flatten()
      .value()
  }
  if (_.isArray(before) && _.isArray(after)) {
    // If there is an addition or deletion in the list we treat the whole list as changed
    // This is because we cannot serialize addtion / deletion from a list properly
    if (before.length === after.length) {
      return _.flatten(
        _.times(before.length).map(
          i => getValuesChanges(id.createNestedID(i.toString()), before[i], after[i])
        )
      )
    }
  }
  return [{ id, action: 'modify', data: { before, after } }]
}

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

  elements.filter(isPrimitiveType).forEach(type => {
    nodeMap.addNode(id(type.elemID), [], type)
  })
  return nodeMap
}

export const getPlan = (beforeElements: Element[], afterElements: Element[]): Plan => {
  // getPlan
  const before = toNodeMap(beforeElements)
  const after = toNodeMap(afterElements)
  // Calculate the diff
  const diffGraph = buildDiffGraph(before, after,
    nodeId => isEqualsNode(before.getData(nodeId), after.getData(nodeId)))

  // Build the plan
  const groupKey = (nodeId: NodeId): string => {
    const diffNode = diffGraph.getData(nodeId)
    const element = getChangeElement(diffNode)
    const elemId = isField(element) ? element.parentID : element.elemID
    return id(elemId)
  }

  const getGroupLevelChange = (group: Group<Change>): Change|undefined =>
    wu(group.items.values()).find(
      change => getChangeElement(change).elemID.getFullName() === group.groupKey
    )

  const addParentAccessor = (group: Group<Change>): PlanItem => Object.assign(group, {
    parent() {
      return getGroupLevelChange(group) || {
        action: 'modify',
        data: { before: before.getData(group.groupKey), after: after.getData(group.groupKey) },
      }
    },
    changes() {
      return group.items.values()
    },
    detailedChanges() {
      return wu(group.items.values())
        .map(change => {
          const elem = getChangeElement(change)
          if (change.action !== 'modify') {
            return { ...change, id: elem.elemID }
          }
          if (isInstanceElement(change.data.before) && isInstanceElement(change.data.after)) {
            return getValuesChanges(elem.elemID, change.data.before.value, change.data.after.value)
          }
          return getValuesChanges(
            elem.elemID,
            change.data.before.annotations,
            change.data.after.annotations,
          )
        })
        .flatten()
    },
  })

  const addPlanFunctions = (groupGraph: GroupedNodeMap<Change>): Plan => Object.assign(
    groupGraph,
    {
      itemsByEvalOrder(): Iterable<PlanItem> {
        return wu(groupGraph.evaluationOrder())
          .map(group => groupGraph.getData(group))
          .map(group => {
            // If we add / remove a "group level" element it already contains all the information
            // about its sub changes so we can keep only the group level change
            const groupLevelChange = getGroupLevelChange(group)
            return groupLevelChange !== undefined && groupLevelChange.action !== 'modify'
              ? { ...group, items: new Map([[group.groupKey, groupLevelChange]]) }
              : group
          })
          .map(addParentAccessor)
      },

      getItem(planItemId: PlanItemId): PlanItem {
        return addParentAccessor(groupGraph.getData(planItemId))
      },
    },
  )

  return addPlanFunctions(buildGroupedGraph(diffGraph, groupKey))
}
