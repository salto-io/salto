import _ from 'lodash'
import wu from 'wu'
import {
  Element, ElemID, isObjectType, isInstanceElement, Value, Values, ChangeDataType, isField, Change,
  getChangeElement, isEqualElements, isPrimitiveType, ObjectType, PrimitiveType, ChangeError,
  ChangeValidator, InstanceElement, Type,
} from 'adapter-api'
import {
  buildDiffGraph, buildGroupedGraph, Group, DataNodeMap, NodeId, GroupedNodeMap,
  AdditionDiff, ModificationDiff, RemovalDiff,
} from '@salto/dag'
import { logger } from '@salto/logging'
import { resolve } from './expressions'

const log = logger(module)

export type DetailedChange<T = ChangeDataType | Values | Value> =
  (AdditionDiff<T> | ModificationDiff<T> | RemovalDiff<T>) & {
    id: ElemID
    path?: string[]
  }

export type PlanItemId = NodeId
export type PlanItem = Group<Change> & {
  parent: () => Change
  changes: () => Iterable<Change>
  detailedChanges: () => Iterable<DetailedChange>
  getElementName: () => string
}
export type Plan = GroupedNodeMap<Change> & {
  itemsByEvalOrder: () => Iterable<PlanItem>
  getItem: (id: PlanItemId) => PlanItem
  changeErrors: ReadonlyArray<ChangeError>
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
    // This is because we cannot serialize addition / deletion from a list properly
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

  elements.filter(e => !e.elemID.isConfig()).filter(isObjectType).forEach(obj => {
    // Add object type
    nodeMap.addNode(id(obj.elemID), [], obj)
    // Add object type fields
    const fieldDependencies = withDependencies ? [id(obj.elemID)] : []
    Object.values(obj.fields).forEach(
      field => nodeMap.addNode(id(field.elemID), fieldDependencies, field)
    )
  })

  elements.filter(e => !e.elemID.isConfig()).filter(isInstanceElement).forEach(inst => {
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

const findGroupLevelChange = (group: Group<Change>): Change | undefined =>
  wu(group.items.values()).find(
    change => getChangeElement(change).elemID.getFullName() === group.groupKey
  )

const getOrCreateGroupLevelChange = (group: Group<Change>,
  idToBeforeElement: Record<NodeId, Element>, idToAfterElement: Record<NodeId, Element>): Change =>
  findGroupLevelChange(group) || {
    action: 'modify',
    data: { before: idToBeforeElement[group.groupKey] as ChangeDataType,
      after: idToAfterElement[group.groupKey] as ChangeDataType },
  }

const addPlanItemAccessors = (group: Group<Change>, idToBeforeElement: Record<NodeId, Element>,
  idToAfterElement: Record<NodeId, Element>): PlanItem => Object.assign(group, {
  parent() {
    return getOrCreateGroupLevelChange(group, idToBeforeElement, idToAfterElement)
  },
  changes() {
    return group.items.values()
  },
  detailedChanges() {
    const hasAnnotationTypeChange = (change: ModificationDiff<ChangeDataType>): boolean => {
      const hasAnnotationTypes = (elem: ChangeDataType): elem is ObjectType | PrimitiveType =>
        isObjectType(elem) || isPrimitiveType(elem)
      if (hasAnnotationTypes(change.data.before) && hasAnnotationTypes(change.data.after)) {
        return !change.data.before.isAnnotationsTypesEqual(change.data.after)
      }
      return false
    }

    // If we have change in the annotation type we will mark the entire element as changes
    // due to: SALTO-333
    const topLevelChange = findGroupLevelChange(group)
    if (topLevelChange && topLevelChange.action === 'modify'
      && hasAnnotationTypeChange(topLevelChange)) {
      return [{ ...topLevelChange, id: topLevelChange.data.after.elemID }]
    }

    return wu(group.items.values())
      .map(change => {
        const elem = getChangeElement(change)
        if (change.action !== 'modify') {
          return { ...change, id: elem.elemID }
        }

        // A special case to handle isList changes in fields.
        // should only happen if we misidentified the type
        // in fetch. See SALTO-322
        if (isField(change.data.before)
          && isField(change.data.after)
          && change.data.after.isList !== change.data.before.isList) {
          return { ...change, id: elem.elemID }
        }

        if (isInstanceElement(change.data.before) && isInstanceElement(change.data.after)) {
          return getValuesChanges(elem.elemID, change.data.before.value, change.data.after.value)
        }

        return getValuesChanges(
          elem.elemID.isTopLevel() ? elem.elemID.createNestedID('attr') : elem.elemID,
          change.data.before.annotations, change.data.after.annotations
        )
      })
      .flatten()
  },
  getElementName() {
    return id(getChangeElement(this.parent()).elemID)
  },
})

const addPlanFunctions = (groupGraph: GroupedNodeMap<Change>,
  changeErrors: ReadonlyArray<ChangeError>, idToBeforeElement: Record<NodeId, Element>,
  idToAfterElement: Record<NodeId, Element>): Plan => Object.assign(groupGraph,
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
        .map(group => addPlanItemAccessors(group, idToBeforeElement, idToAfterElement))
    },

    getItem(planItemId: PlanItemId): PlanItem {
      return addPlanItemAccessors(groupGraph.getData(planItemId), idToBeforeElement,
        idToAfterElement)
    },
    changeErrors,
  })

const buildGroupedGraphFromDiffGraph = (diffGraph: DataNodeMap<Change>): GroupedNodeMap<Change> => {
  const groupKey = (nodeId: NodeId): string => {
    const diffNode = diffGraph.getData(nodeId)
    const element = getChangeElement(diffNode)
    const elemId = isField(element) ? element.parentID : element.elemID
    return id(elemId)
  }

  return buildGroupedGraph(diffGraph, groupKey)
}

type FilterResult = {
  changeErrors: ChangeError[]
  validDiffGraph: DataNodeMap<Change>
  idToValidAfterElement: Record<NodeId, Element>
}

type TopLevelElement = InstanceElement | Type

const filterInvalidChanges = async (idToBeforeElement: Record<NodeId, Element>,
  idToAfterElement: Record<NodeId, Element>, diffGraph: DataNodeMap<Change>,
  changeValidators: Record<string, ChangeValidator>): Promise<FilterResult> => {
  const validateChanges = async (groupLevelChange: Change, group: Group<Change>):
    Promise<ReadonlyArray<ChangeError>> => {
    const changeValidator = changeValidators[getChangeElement(groupLevelChange).elemID.adapter]
    if (_.isUndefined(changeValidator)) {
      return []
    }
    switch (groupLevelChange.action) {
      case 'modify':
        return changeValidator.onUpdate([...group.items.values()])
      case 'remove':
        return changeValidator.onRemove(getChangeElement(groupLevelChange))
      case 'add':
        return changeValidator.onAdd(getChangeElement(groupLevelChange))
      default:
        throw new Error('Unknown action type')
    }
  }

  const createValidTopLevelElem = (beforeTopLevelElem: TopLevelElement,
    afterTopLevelElem: TopLevelElement, elemIdsToOmit: ElemID[]): Element | undefined => {
    if (_.isUndefined(beforeTopLevelElem)) {
      // revert the invalid creation of a new top-level element
      return undefined
    }
    if (_.isUndefined(afterTopLevelElem) || isInstanceElement(afterTopLevelElem)
      || isPrimitiveType(afterTopLevelElem)) {
      // revert the invalid deletion of a top-level element OR
      // modification of an instance/primitive that should be reverted as a whole
      return beforeTopLevelElem.clone()
    }
    // ObjectType's fields and/or annotations modification
    const beforeObj = beforeTopLevelElem as ObjectType
    const afterObj = afterTopLevelElem as ObjectType

    const validFields = _.clone(afterObj.fields)
    const afterFieldIds = new Set(Object.values(afterObj.fields)
      .map(field => id(field.elemID)))
    elemIdsToOmit
      .filter(elemId => !elemId.isTopLevel()) // only field changes
      .forEach(elemId => {
        const beforeField = beforeObj.fields[elemId.name]
        if (afterFieldIds.has(id(elemId))) {
          if (beforeField) {
            // revert the invalid modification of a field
            validFields[elemId.name] = beforeField.clone()
          } else {
            // revert the invalid creation of a field
            delete validFields[elemId.name]
          }
        } else {
          // revert the invalid deletion of a field
          validFields[elemId.name] = beforeField.clone()
        }
      })
    // identify whether the annotations changes should be reverted
    const annotationsSource = elemIdsToOmit.some(e => e.isTopLevel()) ? beforeObj : afterObj
    return new ObjectType({
      elemID: afterObj.elemID,
      fields: validFields,
      annotationTypes: _.clone(annotationsSource.annotationTypes),
      annotations: _.clone(annotationsSource.annotations),
    })
  }

  const isParentInvalidObjectRemoval = (change: Change, nodeIdsToOmit: Set<string>): boolean => {
    const parentId = id(getChangeElement(change).elemID.createTopLevelParentID().parent)
    return nodeIdsToOmit.has(parentId) && !idToAfterElement[parentId]
  }

  const groupedGraph = buildGroupedGraphFromDiffGraph(diffGraph)

  const changeErrors: ChangeError[] = _.flatten(await Promise.all(
    wu(groupedGraph.keys())
      .map((groupId: NodeId) => {
        const group = groupedGraph.getData(groupId)
        const groupLevelChange = getOrCreateGroupLevelChange(group, idToBeforeElement,
          idToAfterElement)
        return validateChanges(groupLevelChange, group)
      })
  ))

  const invalidChanges = changeErrors
    .filter(v => v.level === 'ERROR')
  const nodeIdsToOmit = new Set(invalidChanges
    .map(change => id(change.elemID)))

  const validDiffGraph = new DataNodeMap<Change<ChangeDataType>>()
  try {
    diffGraph.walkSync(nodeId => {
      const data = diffGraph.getData(nodeId)
      if (nodeIdsToOmit.has(id(getChangeElement(data).elemID))
      // hack until Salto-447 will be implemented. we wan't all the field nodes to be omitted
      // in case the object is removed. Once we will dependency between the field and the object,
      // this check can be removed
        || isParentInvalidObjectRemoval(data, nodeIdsToOmit)) {
        // in case this is an invalid node we throw error so the walk will skip the dependent nodes
        throw new Error()
      }
      validDiffGraph.addNode(nodeId, diffGraph.get(nodeId), data)
    })
    // eslint-disable-next-line no-empty
  } catch (e) {} // do nothing, we have errors since we may skip nodes that depends on invalid nodes


  const topLevelNodeIdToElemIds = _(invalidChanges)
    .map(c => c.elemID)
    .groupBy(elemId => id(elemId.createTopLevelParentID().parent))

  const idToValidAfterElement = _.clone(idToAfterElement)

  topLevelNodeIdToElemIds
    .entries()
    .forEach(([topLevelNodeId, elemIds]) => {
      const validTopLevelElem = createValidTopLevelElem(idToBeforeElement[topLevelNodeId] as
          TopLevelElement, idToAfterElement[topLevelNodeId] as TopLevelElement, elemIds)
      if (validTopLevelElem) {
        idToValidAfterElement[topLevelNodeId] = validTopLevelElem
      } else {
        delete idToValidAfterElement[topLevelNodeId]
      }
    })
  return { changeErrors, validDiffGraph, idToValidAfterElement }
}

const getIdToElement = (elements: readonly Element[]): Record<NodeId, Element> =>
  _(elements)
    .map(elem => [id(elem.elemID), elem])
    .fromPairs()
    .value()

export const getPlan = async (
  beforeElements: readonly Element[],
  afterElements: readonly Element[],
  changeValidators?: Record<string, ChangeValidator>,
  withDependencies = true
): Promise<Plan> => log.time(async () => {
  // getPlan
  const resolvedBefore = resolve(beforeElements)
  const resolvedAfter = resolve(afterElements)
  const before = toNodeMap(resolvedBefore, withDependencies)
  const after = toNodeMap(resolvedAfter, withDependencies)
  // Calculate the diff
  const diffGraph = buildDiffGraph(before, after,
    nodeId => isEqualsNode(before.getData(nodeId), after.getData(nodeId)))

  const idToBeforeElement = getIdToElement(beforeElements)
  const idToAfterElement = getIdToElement(afterElements)
  // filter invalid changes from the graph and the after elements
  const { changeErrors, validDiffGraph, idToValidAfterElement } = changeValidators
    ? await filterInvalidChanges(idToBeforeElement, idToAfterElement, diffGraph, changeValidators)
    : { changeErrors: [], validDiffGraph: diffGraph, idToValidAfterElement: idToAfterElement }
  // build graph
  const groupedGraph = buildGroupedGraphFromDiffGraph(validDiffGraph)
  // build plan
  return addPlanFunctions(groupedGraph, changeErrors, idToBeforeElement, idToValidAfterElement)
}, 'get %s changes %o -> %o elements', withDependencies ? 'deploy' : 'fetch',
beforeElements.length, afterElements.length)
