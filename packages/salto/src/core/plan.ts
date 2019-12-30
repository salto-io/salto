import _ from 'lodash'
import wu from 'wu'
import {
  Element, ElemID, isObjectType, isInstanceElement, Value, Values, ChangeDataType, isField, Change,
  getChangeElement, isEqualElements, isPrimitiveType, ObjectType, PrimitiveType, ChangeError,
  ChangeValidator, InstanceElement, Type, isRemovalDiff,
} from 'adapter-api'
import {
  buildDiffGraph, buildGroupedGraph, Group, DataNodeMap, NodeId, GroupedNodeMap,
  AdditionDiff, ModificationDiff, RemovalDiff,
} from '@salto/dag'
import { logger } from '@salto/logging'
import { resolve } from './expressions'
import { createElementsMap, ElementMap } from './search'

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

const getOrCreateGroupLevelChange = (group: Group<Change>, beforeElementsMap: ElementMap,
  afterElementsMap: ElementMap): Change =>
  findGroupLevelChange(group) || {
    action: 'modify',
    data: { before: beforeElementsMap[group.groupKey] as ChangeDataType,
      after: afterElementsMap[group.groupKey] as ChangeDataType },
  }

const addPlanItemAccessors = (group: Group<Change>, beforeElementsMap: Record<NodeId, Element>,
  afterElementsMap: Record<NodeId, Element>): PlanItem => Object.assign(group, {
  parent() {
    return getOrCreateGroupLevelChange(group, beforeElementsMap, afterElementsMap)
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

    // If we have a change in the annotation type we will mark the entire element as changed
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
  validAfterElementsMap: ElementMap
}

type TopLevelElement = InstanceElement | Type

const filterInvalidChanges = async (beforeElementsMap: ElementMap, afterElementsMap: ElementMap,
  diffGraph: DataNodeMap<Change>, changeValidators: Record<string, ChangeValidator>):
  Promise<FilterResult> => {
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
    const elemIdFullNamesToOmit = new Set(elemIdsToOmit.map(id))
    if (_.isUndefined(beforeTopLevelElem)
      && elemIdFullNamesToOmit.has(id(afterTopLevelElem.elemID))) {
      // revert the invalid creation of a new top-level element
      return undefined
    }
    if (_.isUndefined(afterTopLevelElem)
      || elemIdFullNamesToOmit.has(id(afterTopLevelElem.elemID))) {
      // revert the invalid deletion of a top-level element OR
      // modification of a top level element that should be reverted as a whole
      return beforeTopLevelElem.clone()
    }
    // ObjectType's fields changes
    const beforeObj = beforeTopLevelElem as ObjectType
    const afterObj = afterTopLevelElem as ObjectType
    const afterFieldNames = afterObj ? Object.keys(afterObj.fields) : []
    const beforeFieldNames = beforeObj ? Object.keys(beforeObj.fields) : []
    const allFieldNames = [...new Set([...beforeFieldNames, ...afterFieldNames])]
    const validFields = _(allFieldNames)
      .map(name => {
        const beforeField = beforeObj?.fields[name]
        const afterField = afterObj?.fields[name]
        const { elemID } = afterField ?? beforeField
        const validField = elemIdFullNamesToOmit.has(id(elemID)) ? beforeField : afterField
        return validField === undefined ? undefined : [name, validField.clone()]
      })
      .filter(field => field !== undefined)
      .fromPairs()
      .value()

    return new ObjectType({
      elemID: afterObj.elemID,
      fields: validFields,
      annotationTypes: _.clone(afterObj.annotationTypes),
      annotations: _.cloneDeep(afterObj.annotations),
    })
  }

  const createValidAfterElementsMap = (invalidChanges: ChangeError[]): ElementMap => {
    const topLevelNodeIdToInvalidElemIds = _(invalidChanges)
      .map(c => c.elemID)
      .groupBy(elemId => id(elemId.createTopLevelParentID().parent))

    const beforeElementNames = Object.keys(beforeElementsMap)
    const afterElementNames = Object.keys(afterElementsMap)
    const allElementNames = [...new Set([...beforeElementNames, ...afterElementNames])]
    return _(allElementNames)
      .map(name => {
        const beforeElem = beforeElementsMap[name]
        const afterElem = afterElementsMap[name]
        const { elemID } = afterElem ?? beforeElem
        const validElement = topLevelNodeIdToInvalidElemIds.has(id(elemID))
          ? createValidTopLevelElem(beforeElem as TopLevelElement, afterElem as TopLevelElement,
            topLevelNodeIdToInvalidElemIds.get(id(elemID)))
          : afterElem
        return validElement === undefined ? undefined : [name, validElement]
      })
      .filter(elem => elem !== undefined)
      .fromPairs()
      .value()
  }

  const isParentInvalidObjectRemoval = (change: Change, nodeIdsToOmit: Set<string>): boolean => {
    const parentId = id(getChangeElement(change).elemID.createTopLevelParentID().parent)
    return nodeIdsToOmit.has(parentId) && !afterElementsMap[parentId]
  }

  const buildValidDiffGraph = (nodeIdsToOmit: Set<string>, validAfterElementsMap: ElementMap):
    DataNodeMap<Change<ChangeDataType>> => {
    const validDiffGraph = new DataNodeMap<Change<ChangeDataType>>()
    try {
      diffGraph.walkSync(nodeId => {
        const change = diffGraph.getData(nodeId)
        const { elemID } = getChangeElement(change)
        if (nodeIdsToOmit.has(id(elemID))
          // HACK until SALTO-447 is implemented - We want all fields to be omitted if the object is
          // omitted. this doesn't work now because field removal has the wrong type of dependency
          // on the object, once this is fixed we can remove this check
          || isParentInvalidObjectRemoval(change, nodeIdsToOmit)) {
          // in case this is an invalid node throw error so the walk will skip the dependent nodes
          throw new Error()
        }
        const validChange = isRemovalDiff(change) ? change : { ...change,
          data: {
            ...change.data,
            after: validAfterElementsMap[id(elemID)] || change.data.after,
          } } as Change<ChangeDataType>
        validDiffGraph.addNode(nodeId, diffGraph.get(nodeId), validChange)
      })
    } catch (e) {
      // do nothing, we may have errors since we may skip nodes that depends on invalid nodes
    }
    return validDiffGraph
  }

  const groupedGraph = buildGroupedGraphFromDiffGraph(diffGraph)
  const changeErrors: ChangeError[] = _.flatten(await Promise.all(
    wu(groupedGraph.keys())
      .map((groupId: NodeId) => {
        const group = groupedGraph.getData(groupId)
        const groupLevelChange = getOrCreateGroupLevelChange(group, beforeElementsMap,
          afterElementsMap)
        return validateChanges(groupLevelChange, group)
      })
  ))

  const invalidChanges = changeErrors.filter(v => v.level === 'ERROR')
  const nodeIdsToOmit = new Set(invalidChanges.map(change => id(change.elemID)))
  const validAfterElementsMap = createValidAfterElementsMap(invalidChanges)
  const validDiffGraph = buildValidDiffGraph(nodeIdsToOmit, validAfterElementsMap)
  return { changeErrors, validDiffGraph, validAfterElementsMap }
}

const createPlan = async (
  beforeElements: readonly Element[],
  afterElements: readonly Element[],
  beforeNodes: DataNodeMap<ChangeDataType>,
  afterNodes: DataNodeMap<ChangeDataType>,
  changeValidators: Record<string, ChangeValidator> = {},
): Promise<Plan> => {
  // Calculate the diff
  const diffGraph = buildDiffGraph(beforeNodes, afterNodes,
    nodeId => isEqualsNode(beforeNodes.getData(nodeId), afterNodes.getData(nodeId)))

  const beforeElementsMap = createElementsMap(beforeElements)
  const afterElementsMap = createElementsMap(afterElements)
  // filter invalid changes from the graph and the after elements
  const filterResult = await filterInvalidChanges(beforeElementsMap, afterElementsMap, diffGraph,
    changeValidators)
  // build graph
  const groupedGraph = buildGroupedGraphFromDiffGraph(filterResult.validDiffGraph)
  // build plan
  return addPlanFunctions(groupedGraph, filterResult.changeErrors, beforeElementsMap,
    filterResult.validAfterElementsMap)
}

export const getFetchPlan = async (
  beforeElements: readonly Element[],
  afterElements: readonly Element[],
): Promise<Plan> => log.time(async () => {
  const before = toNodeMap(beforeElements, false)
  const after = toNodeMap(afterElements, false)
  return createPlan(beforeElements, afterElements, before, after)
}, 'get fetch changes %o -> %o elements', beforeElements.length, afterElements.length)

export const getDeployPlan = async (
  beforeElements: readonly Element[],
  afterElements: readonly Element[],
  changeValidators: Record<string, ChangeValidator> = {}
): Promise<Plan> => log.time(async () => {
  const resolvedBefore = resolve(beforeElements)
  const resolvedAfter = resolve(afterElements)
  const before = toNodeMap(resolvedBefore)
  const after = toNodeMap(resolvedAfter)
  return createPlan(resolvedBefore, resolvedAfter, before, after, changeValidators)
}, 'get deploy changes %o -> %o elements', beforeElements.length, afterElements.length)
