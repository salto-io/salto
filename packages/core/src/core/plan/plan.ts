/*
*                      Copyright 2023 Salto Labs Ltd.
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
  ChangeValidator, Change, ChangeError, DependencyChanger, ChangeGroupIdFunction,
  ReadOnlyElementsSource, ElemID, isVariable,
  Value, isReferenceExpression, compareSpecialValues, BuiltinTypesByFullName, isAdditionChange,
  isModificationChange, isRemovalChange, ReferenceExpression, changeId,
  shouldResolve,
  isTemplateExpression,
  CompareOptions,
} from '@salto-io/adapter-api'
import { DataNodeMap, DiffNode, DiffGraph, GroupDAG } from '@salto-io/dag'
import { logger } from '@salto-io/logging'
import { expressions } from '@salto-io/workspace'
import { collections, values } from '@salto-io/lowerdash'
import { PlanItem, addPlanItemAccessors, PlanItemId } from './plan_item'
import { buildGroupedGraphFromDiffGraph, getCustomGroupIds } from './group'
import { filterInvalidChanges } from './filter'
import { addNodeDependencies, addFieldToObjectDependency, addTypeDependency, addAfterRemoveDependency, addReferencesDependency, addInstanceToFieldsDependency } from './dependency'
import { PlanTransformer } from './common'

const { awu, iterateTogether } = collections.asynciterable
type BeforeAfter<T> = collections.asynciterable.BeforeAfter<T>
const { resolve } = expressions

const log = logger(module)

type ReferenceCompareReturnValue = {
  returnCode: 'return'
  returnValue: boolean
} | {
  returnCode: 'recurse'
  returnValue: {
    firstValue: Value
    secondValue: Value
  }
}

export type IDFilter = (id: ElemID) => boolean | Promise<boolean>


const getReferenceValue = async (
  reference: ReferenceExpression,
  elementsSource: ReadOnlyElementsSource,
  visitedReferences: Set<string>,
): Promise<Value> => {
  const targetId = reference.elemID.getFullName()
  if (visitedReferences.has(targetId)) {
    // Circular reference, to avoid infinite recursion we need to return something
    // the chosen behavior for now is to return "undefined"
    // this may cause circular references to compare equal if we compare to undefined
    // but this shouldn't matter much as we assume the user has already seen the warning
    // about having a circular reference before getting to this point
    return undefined
  }
  visitedReferences.add(targetId)
  const refValue = reference.value ?? await elementsSource.get(reference.elemID)
  return isVariable(refValue) ? refValue.value : refValue
}


const areReferencesEqual = async (
  first: Value,
  second: Value,
  firstSrc: ReadOnlyElementsSource,
  secondSrc: ReadOnlyElementsSource,
  firstVisitedReferences: Set<string>,
  secondVisitedReferences: Set<string>,
  compareOptions?: CompareOptions,
): Promise<ReferenceCompareReturnValue> => {
  if (compareOptions?.compareReferencesByValue && shouldResolve(first) && shouldResolve(second)) {
    const shouldResolveFirst = isReferenceExpression(first)

    const firstValue = shouldResolveFirst
      ? await getReferenceValue(first, firstSrc, firstVisitedReferences)
      : first

    const shouldResolveSecond = isReferenceExpression(second)

    const secondValue = shouldResolveSecond
      ? await getReferenceValue(second, secondSrc, secondVisitedReferences)
      : second

    if (shouldResolveFirst || shouldResolveSecond) {
      return {
        returnCode: 'recurse',
        returnValue: {
          firstValue,
          secondValue,
        },
      }
    }
  }

  if (isReferenceExpression(first) && isReferenceExpression(second)) {
    return {
      returnCode: 'return',
      returnValue: first.elemID.isEqual(second.elemID),
    }
  }

  // if we got here, as we assume that one of the compared values is a ReferenceExpression,
  // we need to return false because a non-resolved reference isn't equal to a non-reference value
  return {
    returnCode: 'return',
    returnValue: false,
  }
}

/**
 * Check if 2 nodes in the DAG are equals or not
 */
const compareValuesAndLazyResolveRefs = async (
  first: Value,
  second: Value,
  firstSrc: ReadOnlyElementsSource,
  secondSrc: ReadOnlyElementsSource,
  compareOptions?: CompareOptions,
  firstVisitedReferences = new Set<string>(),
  secondVisitedReferences = new Set<string>(),
): Promise<boolean> => {
  // compareSpecialValues doesn't compare nested references right if they are not recursively
  // resolved. We are using here lazy resolving so we can't use compareSpecialValues to compare
  // references
  if (isReferenceExpression(first) || isReferenceExpression(second)) {
    // The following call to areReferencesEqual will potentially modify the visited sets.
    // we want to avoid affecting the visited sets above this recursion level so we have
    // to make a copy here
    const firstVisited = new Set(firstVisitedReferences)
    const secondVisited = new Set(secondVisitedReferences)
    const referencesCompareResult = await areReferencesEqual(
      first, second, firstSrc, secondSrc, firstVisited, secondVisited, compareOptions
    )
    if (referencesCompareResult.returnCode === 'return') {
      return referencesCompareResult.returnValue
    }
    const { firstValue, secondValue } = referencesCompareResult.returnValue
    return compareValuesAndLazyResolveRefs(
      firstValue,
      secondValue,
      firstSrc,
      secondSrc,
      compareOptions,
      firstVisited,
      secondVisited,
    )
  }

  const specialCompareRes = compareSpecialValues(first, second)
  if (values.isDefined(specialCompareRes)) {
    return specialCompareRes
  }

  if (_.isArray(first) && _.isArray(second)) {
    if (first.length !== second.length) {
      return false
    }
    // The double negation and the double await might seem like this was created using a random
    // code generator, but its here in order for the method to "fail fast" as some
    // can stop when the first non equal values are encountered.
    return !(await awu(first).some(
      async (value, index) => !await compareValuesAndLazyResolveRefs(
        value,
        second[index],
        firstSrc,
        secondSrc,
        compareOptions,
        firstVisitedReferences,
        secondVisitedReferences,
      )
    ))
  }

  if (_.isPlainObject(first) && _.isPlainObject(second)) {
    if (!_.isEqual(new Set(Object.keys(first)), new Set(Object.keys(second)))) {
      return false
    }
    return !await awu(Object.keys(first)).some(
      async key => !await compareValuesAndLazyResolveRefs(
        first[key],
        second[key],
        firstSrc,
        secondSrc,
        compareOptions,
        firstVisitedReferences,
        secondVisitedReferences,
      )
    )
  }

  if (isTemplateExpression(first) && isTemplateExpression(second)) {
    return compareValuesAndLazyResolveRefs(
      first.parts,
      second.parts,
      firstSrc,
      secondSrc,
      compareOptions,
      firstVisitedReferences,
      secondVisitedReferences,
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
  compareOptions?: CompareOptions,
): Promise<boolean> => {
  if (!values.isDefined(node1) || !values.isDefined(node2)) {
    // Theoratically we should return true if both are undefined, but practically
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
    src2,
    compareOptions,
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
        src2,
        compareOptions,
      )
  }
  if (isField(node1) && isField(node2)) {
    return node1.refType.elemID.isEqual(node2.refType.elemID)
  }
  return _.isEqual(node1, node2)
}

const addDifferentElements = (
  before: ReadOnlyElementsSource,
  after: ReadOnlyElementsSource,
  topLevelFilters: IDFilter[],
  numElements: number,
  compareOptions?: CompareOptions,
): PlanTransformer => graph => log.time(async () => {
  const outputGraph = graph.clone()
  const sieve = new Set<string>()

  const toChange = (
    beforeElem?: ChangeDataType,
    afterElem?: ChangeDataType
  ): DiffNode<ChangeDataType> => {
    if (beforeElem !== undefined && afterElem !== undefined) {
      if (!beforeElem.elemID.isEqual(afterElem.elemID)) {
        throw new Error('Can not compare elements with different Elem Ids')
      }
      return {
        originalId: beforeElem.elemID.getFullName(),
        action: 'modify',
        data: { before: beforeElem, after: afterElem },
      }
    }
    if (beforeElem !== undefined) {
      return {
        originalId: beforeElem.elemID.getFullName(),
        action: 'remove',
        data: { before: beforeElem },
      }
    }
    if (afterElem !== undefined) {
      return {
        originalId: afterElem.elemID.getFullName(),
        action: 'add',
        data: { after: afterElem },
      }
    }
    throw new Error('either before or after needs to be defined')
  }

  const addElemToOutputGraph = (
    beforeElem? : ChangeDataType,
    afterElem?: ChangeDataType
  ): void => {
    const change = toChange(beforeElem, afterElem)
    outputGraph.addNode(changeId(change), [], change)
  }

  const addNodeIfDifferent = async (
    beforeNode?: ChangeDataType,
    afterNode?: ChangeDataType,
  ): Promise<void> => {
    // We can cast to string, at least one of the nodes should be defined.
    const fullname = beforeNode?.elemID.getFullName()
      ?? afterNode?.elemID.getFullName() as string
    if (!sieve.has(fullname)) {
      sieve.add(fullname)
      if (!await isEqualsNode(beforeNode, afterNode, before, after, compareOptions)) {
        addElemToOutputGraph(beforeNode, afterNode)
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
    await Promise.all(allFieldNames.map(
      fieldName => addNodeIfDifferent(
        // We check `hasOwnProperty` and don't just do `beforeFields[fieldName]`
        // because fieldName might be a builtin function name such as
        // `toString` and in that case `beforeFields[fieldName]` will
        // unexpectedly return a function
        Object.prototype.hasOwnProperty.call(beforeFields, fieldName)
          ? beforeFields[fieldName]
          : undefined,
        Object.prototype.hasOwnProperty.call(afterFields, fieldName)
          ? afterFields[fieldName]
          : undefined
      )
    ))
  }

  const isSpecialId = (id: ElemID): boolean => (
    BuiltinTypesByFullName[id.getFullName()] !== undefined
    || id.getContainerPrefixAndInnerType() !== undefined
  )
  /**
   * Ids that represent types or containers need to be handled separately,
   * because they would not necessary be included in getAll.
   */
  const handleSpecialIds = async (
    elementPair: BeforeAfter<ChangeDataType>
  ): Promise<BeforeAfter<ChangeDataType>> => {
    const id = elementPair.before?.elemID ?? elementPair.after?.elemID
    if (id !== undefined && isSpecialId(id)) {
      return {
        before: elementPair.before ?? await before.get(id),
        after: elementPair.after ?? await after.get(id),
      }
    }
    return elementPair
  }
  const getFilteredElements = async (source: ReadOnlyElementsSource):
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
    cmp))
    .map(handleSpecialIds)
    .forEach(addElementsNodes)
  return outputGraph
}, 'add nodes to graph with for %d elements', numElements)

const resolveNodeElements = (
  before: ReadOnlyElementsSource,
  after: ReadOnlyElementsSource,
): PlanTransformer => graph => log.time(async () => {
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
    await log.time(
      () => resolve(beforeItemsToResolve, before),
      'Resolving before items',
    ),
    e => e.elemID.getFullName()
  ) as Record<string, ChangeDataType>

  const resolvedAfter = _.keyBy(
    await log.time(
      () => resolve(afterItemsToResolve, after),
      'Resolving after items',
    ),
    e => e.elemID.getFullName()
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
}, 'resolve node elements for %d nodes', graph.size)

export type Plan = GroupDAG<Change> & {
  itemsByEvalOrder: () => Iterable<PlanItem>
  getItem: (id: PlanItemId) => PlanItem
  changeErrors: ReadonlyArray<ChangeError>
}

const addPlanFunctions = (
  groupGraph: GroupDAG<Change>,
  changeErrors: ReadonlyArray<ChangeError>,
  compareOptions?: CompareOptions,
): Plan => Object.assign(groupGraph,
  {
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
  addInstanceToFieldsDependency,
]

export type AdditionalResolveContext = {
  before: ReadonlyArray<Element>
  after: ReadonlyArray<Element>
}

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
  return log.time(async () => {
    const diffGraph = await buildDiffGraph(
      addDifferentElements(
        before,
        after,
        topLevelFilters,
        numBeforeElements + numAfterElements,
        compareOptions
      ),
      resolveNodeElements(before, after),
      addNodeDependencies(dependencyChangers),
    )
    const filterResult = await filterInvalidChanges(
      before, after, diffGraph, changeValidators,
    )

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
    const groupedGraph = buildGroupedGraphFromDiffGraph(
      filterResult.validDiffGraph,
      changeGroupIdMap,
      disjointGroups
    )
    // build plan
    return addPlanFunctions(groupedGraph, filterResult.changeErrors, compareOptions)
  }, 'get plan with %o -> %o elements', numBeforeElements, numAfterElements)
}
