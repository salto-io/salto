/*
*                      Copyright 2021 Salto Labs Ltd.
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
import {
  Element, isObjectType, isInstanceElement, ChangeDataType, isField, isPrimitiveType,
  ChangeValidator, Change, ChangeError, DependencyChanger, ChangeGroupIdFunction, getChangeElement,
  isAdditionOrRemovalChange, isFieldChange, ReadOnlyElementsSource, ElemID, isVariable,
  Value, isReferenceExpression, compareSpecialValues, BuiltinTypesByFullName,
} from '@salto-io/adapter-api'
import { DataNodeMap, GroupedNodeMap, DiffNode, mergeNodesToModify, DiffGraph, Group } from '@salto-io/dag'
import { logger } from '@salto-io/logging'
import { expressions, elementSource } from '@salto-io/workspace'
import { collections, values } from '@salto-io/lowerdash'
import { PlanItem, addPlanItemAccessors, PlanItemId } from './plan_item'
import { buildGroupedGraphFromDiffGraph, getCustomGroupIds } from './group'
import { filterInvalidChanges } from './filter'
import {
  addNodeDependencies, addFieldToObjectDependency, addTypeDependency, addAfterRemoveDependency,
  addReferencesDependency,
} from './dependency'
import { PlanTransformer, changeId } from './common'

const { awu, iterateTogether } = collections.asynciterable
type BeforeAfter<T> = collections.asynciterable.BeforeAfter<T>
const { resolve, resolveReferenceExpression } = expressions

const log = logger(module)

export type IDFilter = (id: ElemID) => boolean | Promise<boolean>
/**
 * Check if 2 nodes in the DAG are equals or not
 */
const compareValuesAndLazyResolveRefs = async (
  first: Value,
  second: Value,
  firstSrc: ReadOnlyElementsSource,
  secondSrc: ReadOnlyElementsSource
): Promise<boolean> => {
  const shouldResolve = (value: Value): boolean => isReferenceExpression(value)
    && (!(value.elemID.isTopLevel() || value.elemID.idType === 'field')
      || value.elemID.idType === 'var')
    && value.value === undefined

  const resolvedFirst = shouldResolve(first)
    ? await resolveReferenceExpression(first, firstSrc, {})
    : first
  const resolvedSecond = shouldResolve(second)
    ? await resolveReferenceExpression(second, secondSrc, {})
    : second

  const specialCompareRes = compareSpecialValues(resolvedFirst, resolvedSecond)
  if (specialCompareRes === false) {
    compareSpecialValues(resolvedFirst, resolvedSecond)
  }
  if (values.isDefined(specialCompareRes)) {
    return specialCompareRes
  }

  if (_.isArray(resolvedFirst) && _.isArray(resolvedSecond)) {
    if (resolvedFirst.length !== resolvedSecond.length) {
      return false
    }
    // The double negation and the double await might seem like this was created using a random
    // code generator, but its here in order for the method to "fail fast" as some
    // can stop when the first non equal values are encountered.
    return !(await awu(resolvedFirst).some(
      async (value, index) => !await compareValuesAndLazyResolveRefs(
        value,
        resolvedSecond[index],
        firstSrc,
        secondSrc
      )
    ))
  }

  if (_.isPlainObject(resolvedFirst) && _.isPlainObject(resolvedSecond)) {
    if (!_.isEqual(new Set(Object.keys(resolvedFirst)), new Set(Object.keys(resolvedSecond)))) {
      return false
    }
    return !await awu(Object.keys(resolvedFirst)).some(
      async key => !await compareValuesAndLazyResolveRefs(
        resolvedFirst[key],
        resolvedSecond[key],
        firstSrc,
        secondSrc
      )
    )
  }

  return _.isEqual(first, second)
}
/**
 * Check if 2 nodes in the DAG are equals or not
 */
const isEqualsNode = async (
  node1: ChangeDataType | undefined,
  node2: ChangeDataType | undefined,
  src1: ReadOnlyElementsSource,
  src2: ReadOnlyElementsSource,
): Promise<boolean> => {
  if (!values.isDefined(node1) || !values.isDefined(node2)) {
    // Theoratically we should return true if both are undefined, but pratically
    // this makes no sense, so we return false,
    return false
  }

  if (!node1.elemID.isEqual(node2.elemID)) {
    log.warn(
      'attempted to compare the values of two elements with different elemID (%o and %o)',
      node1.elemID.getFullName(),
      node2.elemID.getFullName()
    )
    return false
  }

  if (!node1.isAnnotationsTypesEqual(node2)) {
    return false
  }
  if (!await compareValuesAndLazyResolveRefs(
    node1.annotations,
    node2.annotations,
    src1,
    src2
  )) {
    return false
  }

  if (isObjectType(node1) && isObjectType(node2)) {
    // We don't check fields for object types since they have their own nodes.
    return true
  }

  if (isPrimitiveType(node1) && isPrimitiveType(node2)) {
    return node1.primitive === node2.primitive
  }
  if (isInstanceElement(node1) && isInstanceElement(node2)) {
    return node1.refType.elemID.isEqual(node2.refType.elemID)
      && compareValuesAndLazyResolveRefs(
        node1.value,
        node2.value,
        src1,
        src2
      )
  }
  if (isField(node1) && isField(node2)) {
    return node1.refType.elemID.isEqual(node2.refType.elemID)
  }

  return _.isEqual(node1, node2)
}

const addDifferentElements = (
  before: elementSource.ElementsSource,
  after: elementSource.ElementsSource,
  topLevelFilters: IDFilter[]
): PlanTransformer => graph => log.time(async () => {
  const outputGraph = graph.clone()
  const sieve = new Set<string>()
  const toChange = (
    elem: ChangeDataType,
    action: Change['action'] & ('add' | 'remove')
  ): DiffNode<ChangeDataType> => {
    if (action === 'add') {
      return { originalId: elem.elemID.getFullName(), action, data: { after: elem } }
    }
    return { originalId: elem.elemID.getFullName(), action, data: { before: elem } }
  }

  const addElemToOutputGraph = (
    elem: ChangeDataType,
    action: Change['action'] & ('add' | 'remove')
  ): void => {
    outputGraph.addNode(changeId(elem, action), [], toChange(elem, action))
  }

  const addNodeIfDifferent = async (
    beforeNode?: ChangeDataType,
    afterNode?: ChangeDataType
  ): Promise<void> => {
    // We can cast to string, at least one of the nodes should be defined.
    const fullname = beforeNode?.elemID.getFullName()
      ?? afterNode?.elemID.getFullName() as string
    if (!sieve.has(fullname)) {
      sieve.add(fullname)
      if (!await isEqualsNode(beforeNode, afterNode, before, after)) {
        if (values.isDefined(beforeNode)) {
          addElemToOutputGraph(beforeNode, 'remove')
        }
        if (values.isDefined(afterNode)) {
          addElemToOutputGraph(afterNode, 'add')
        }
      }
    }
  }

  const addElementsNodes = async (comparison: BeforeAfter<ChangeDataType>): Promise<void> => {
    const beforeElement = comparison.before
    const afterElement = comparison.after
    if (!isVariable(beforeElement) && !isVariable(afterElement)) {
      await addNodeIfDifferent(beforeElement, afterElement)
    }
    const beforeFields = (isObjectType(beforeElement)) ? beforeElement.fields : {}
    const afterFields = (isObjectType(afterElement)) ? afterElement.fields : {}
    const allFieldNames = [...Object.keys(beforeFields), ...Object.keys(afterFields)]
    allFieldNames.forEach(
      fieldName => addNodeIfDifferent(
        beforeFields[fieldName],
        afterFields[fieldName]
      )
    )
  }
  const isSpecialId = (id: string): boolean => (BuiltinTypesByFullName[id] !== undefined
    || elementSource.shouldResolveAsContainerType(id))
  /**
   * Ids that represent types or containers need to be handled separately,
   * because they would not necessary be included in getAll.
   */
  const handleSpecialIds = async (
    elementPair: BeforeAfter<ChangeDataType>
  ): Promise<BeforeAfter<ChangeDataType>> => {
    if (elementPair.before && isSpecialId(elementPair.before.elemID.getFullName())) {
      return { before: elementPair.before, after: await after.get(elementPair.before.elemID) }
    }
    if (elementPair.after && isSpecialId(elementPair.after.elemID.getFullName())) {
      return { before: await before.get(elementPair.after.elemID), after: elementPair.after }
    }
    return elementPair
  }
  const getFilteredElements = async (source: elementSource.ElementsSource):
    Promise<AsyncIterable<ChangeDataType>> =>
    (awu(await source.getAll()).filter(async elem =>
      _.every(await Promise.all(
        topLevelFilters.map(filter => filter(elem.elemID))
      )))) as AsyncIterable<ChangeDataType>
  const cmp = (e1: ChangeDataType, e2: ChangeDataType): number => {
    if (e1.elemID.getFullName() < e2.elemID.getFullName()) {
      return -1
    }
    if (e1.elemID.getFullName() > e2.elemID.getFullName()) {
      return 1
    }
    return 0
  }
  await awu(iterateTogether(await getFilteredElements(before), await getFilteredElements(after),
    cmp)).map(handleSpecialIds).forEach(addElementsNodes)
  return outputGraph
}, 'add nodes to graph with action %s for %d elements')

const resolveNodeElements = (
  before: elementSource.ElementsSource,
  after: elementSource.ElementsSource,
): PlanTransformer => async graph => {
  const beforeItemsToResolve: ChangeDataType[] = []
  const afterItemsToResolve: ChangeDataType[] = []
  graph.walkSync(id => {
    const change = graph.getData(id)
    if (change.action !== 'add') {
      beforeItemsToResolve.push(change.data.before)
    }
    if (change.action !== 'remove') {
      afterItemsToResolve.push(change.data.after)
    }
  })
  await resolve(beforeItemsToResolve, before, true)
  await resolve(afterItemsToResolve, after, true)
  return graph
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
          .filter(isAdditionOrRemovalChange)
          .map(getChangeElement)
          .filter(isObjectType)
          .map(obj => obj.elemID.getFullName())
      )
      const isRedundantFieldChange = (change: Change<ChangeDataType>): boolean => (
        isAdditionOrRemovalChange(change)
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

export type AdditionalResolveContext = {
  before: ReadonlyArray<Element>
  after: ReadonlyArray<Element>
}

type GetPlanParameters = {
  before: elementSource.ElementsSource
  after: elementSource.ElementsSource
  changeValidators?: Record<string, ChangeValidator>
  dependencyChangers?: ReadonlyArray<DependencyChanger>
  customGroupIdFunctions?: Record<string, ChangeGroupIdFunction>
  additionalResolveContext?: ReadonlyArray<Element>
  topLevelFilters?: IDFilter[]
}
export const getPlan = async ({
  before,
  after,
  changeValidators = {},
  dependencyChangers = defaultDependencyChangers,
  customGroupIdFunctions = {},
  topLevelFilters = [],
}: GetPlanParameters): Promise<Plan> => log.time(async () => {
  const diffGraph = await buildDiffGraph(
    addDifferentElements(before, after, topLevelFilters),
    resolveNodeElements(before, after),
    addModifyNodes(addNodeDependencies(dependencyChangers)),
  )

  const filterResult = await filterInvalidChanges(
    before, after, diffGraph, changeValidators,
  )
  const customGroupKeys = await getCustomGroupIds(
    // We need to resolve the fileted graph again.
    // Will be removed once the everything will use element source.
    await resolveNodeElements(before, after)(
      filterResult.validDiffGraph
    ),
    customGroupIdFunctions,
  )
  // build graph
  const groupedGraph = removeRedundantFieldChanges(
    buildGroupedGraphFromDiffGraph(filterResult.validDiffGraph, customGroupKeys)
  )
  // build plan
  return addPlanFunctions(groupedGraph, filterResult.changeErrors)
}, 'get plan with %o -> %o elements')
