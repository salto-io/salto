/*
 * Copyright 2024 Salto Labs Ltd.
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
  Value,
  isReferenceExpression,
  areReferencesEqual,
  compareSpecialValues,
  isTemplateExpression,
  isObjectType, isPrimitiveType, isInstanceElement, isField, isVariable, BuiltinTypesByFullName, compareElementIDs,
} from '@salto-io/adapter-api'
import { DataNodeMap, DiffNode, DiffGraph, GroupDAG } from '@salto-io/dag'
import { logger } from '@salto-io/logging'
import { expressions } from '@salto-io/workspace'
import { collections, values } from '@salto-io/lowerdash'
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

const { awu, iterateTogether } = collections.asynciterable
type BeforeAfter<T> = collections.asynciterable.BeforeAfter<T>
const { resolve } = expressions

const log = logger(module)

export type IDFilter = (id: ElemID) => boolean | Promise<boolean>

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
    const referencesCompareResult = areReferencesEqual({
      first,
      second,
      firstSrc,
      secondSrc,
      firstVisitedReferences: firstVisited,
      secondVisitedReferences: secondVisited,
      compareOptions,
    })
    if (referencesCompareResult.returnCode === 'return') {
      return referencesCompareResult.returnValue
    }
    const { firstValue, secondValue } = referencesCompareResult.returnValue
    return compareValuesAndLazyResolveRefs(
      await firstValue,
      await secondValue,
      firstSrc,
      secondSrc,
      compareOptions,
      firstVisited,
      secondVisited,
    )
  }

  const specialCompareRes = compareSpecialValues(first, second, compareOptions)
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
      async (value, index) =>
        !(await compareValuesAndLazyResolveRefs(
          value,
          second[index],
          firstSrc,
          secondSrc,
          compareOptions,
          firstVisitedReferences,
          secondVisitedReferences,
        )),
    ))
  }

  if (_.isPlainObject(first) && _.isPlainObject(second)) {
    const firstKeys = Object.keys(first)
    const secondKeys = Object.keys(second)
    if (firstKeys.length !== secondKeys.length) {
      return false
    }
    const secondKeysSet = new Set(secondKeys)
    if (firstKeys.some(k => !secondKeysSet.has(k))) {
      return false
    }
    return !(await awu(firstKeys).some(
      async key =>
        !(await compareValuesAndLazyResolveRefs(
          first[key],
          second[key],
          firstSrc,
          secondSrc,
          compareOptions,
          firstVisitedReferences,
          secondVisitedReferences,
        )),
    ))
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
    // Theoretically we should return true if both are undefined, but practically
    // this makes no sense, so we return false,
    return false
  }

  if (!node1.elemID.isEqual(node2.elemID)) {
    log.warn(
      'attempted to compare the values of two elements with different elemID (%o and %o)',
      node1.elemID.getFullName(),
      node2.elemID.getFullName(),
    )
    return false
  }

  if (!node1.isAnnotationsTypesEqual(node2)) {
    return false
  }
  if (!(await compareValuesAndLazyResolveRefs(node1.annotations, node2.annotations, src1, src2, compareOptions))) {
    return false
  }

  if (isObjectType(node1) && isObjectType(node2)) {
    // We don't check fields for object types since they have their own nodes.
    return node1.isMetaTypeEqual(node2)
  }

  if (isPrimitiveType(node1) && isPrimitiveType(node2)) {
    return node1.primitive === node2.primitive
  }
  if (isInstanceElement(node1) && isInstanceElement(node2)) {
    return (
      node1.refType.elemID.isEqual(node2.refType.elemID) &&
      compareValuesAndLazyResolveRefs(node1.value, node2.value, src1, src2, compareOptions)
    )
  }
  if (isField(node1) && isField(node2)) {
    return node1.refType.elemID.isEqual(node2.refType.elemID)
  }
  return _.isEqual(node1, node2)
}

const calculateDiff =
  (
    before: ReadOnlyElementsSource,
    after: ReadOnlyElementsSource,
    topLevelFilters: IDFilter[],
    numElements: number,
    compareOptions?: CompareOptions,
  ): Promise<DiffNode<ChangeDataType>[]> =>
    log.timeDebug(
      async () => {
        const changes: DiffNode<ChangeDataType>[] = []
        const sieve = new Set<string>()

        const toChange = (beforeElem?: ChangeDataType, afterElem?: ChangeDataType): DiffNode<ChangeDataType> => {
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

        const addElemToOutputGraph = (beforeElem?: ChangeDataType, afterElem?: ChangeDataType): void => {
          const change = toChange(beforeElem, afterElem)
          changes.push(change)
        }

        const addNodeIfDifferent = async (beforeNode?: ChangeDataType, afterNode?: ChangeDataType): Promise<void> => {
          // We can cast to string, at least one of the nodes should be defined.
          const fullName = beforeNode?.elemID.getFullName() ?? (afterNode?.elemID.getFullName() as string)
          if (!sieve.has(fullName)) {
            sieve.add(fullName)
            if (!(await isEqualsNode(beforeNode, afterNode, before, after, compareOptions))) {
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
          const beforeFields = isObjectType(beforeElement) ? beforeElement.fields : {}
          const afterFields = isObjectType(afterElement) ? afterElement.fields : {}
          const allFieldNames = [...Object.keys(beforeFields), ...Object.keys(afterFields)]
          await Promise.all(
            allFieldNames.map(fieldName =>
              addNodeIfDifferent(
                // We check `hasOwnProperty` and don't just do `beforeFields[fieldName]`
                // because fieldName might be a builtin function name such as
                // `toString` and in that case `beforeFields[fieldName]` will
                // unexpectedly return a function
                Object.prototype.hasOwnProperty.call(beforeFields, fieldName) ? beforeFields[fieldName] : undefined,
                Object.prototype.hasOwnProperty.call(afterFields, fieldName) ? afterFields[fieldName] : undefined,
              ),
            ),
          )
        }

        const isSpecialId = (id: ElemID): boolean =>
          BuiltinTypesByFullName[id.getFullName()] !== undefined || id.getContainerPrefixAndInnerType() !== undefined
        /**
         * Ids that represent types or containers need to be handled separately,
         * because they would not necessary be included in getAll.
         */
        const handleSpecialIds = async (
          elementPair: BeforeAfter<ChangeDataType>,
        ): Promise<BeforeAfter<ChangeDataType>> => {
          const id = elementPair.before?.elemID ?? elementPair.after?.elemID
          if (id !== undefined && isSpecialId(id)) {
            return {
              before: elementPair.before ?? (await before.get(id)),
              after: elementPair.after ?? (await after.get(id)),
            }
          }
          return elementPair
        }
        const getFilteredElements = async (source: ReadOnlyElementsSource): Promise<AsyncIterable<ChangeDataType>> =>
          (topLevelFilters.length === 0
            ? await source.getAll()
            : awu(await source.list())
              .filter(async id => _.every(await Promise.all(topLevelFilters.map(filter => filter(id)))))
              .map(id => source.get(id))) as AsyncIterable<ChangeDataType>

        const cmp = (e1: ChangeDataType, e2: ChangeDataType): number => compareElementIDs(e1.elemID, e2.elemID)

        await awu(iterateTogether(await getFilteredElements(before), await getFilteredElements(after), cmp))
          .map(handleSpecialIds)
          .forEach(addElementsNodes)
        return changes
      },
      'add nodes to graph with for %d elements',
      numElements,
    )


const addDifferentElements =
  (
    before: ReadOnlyElementsSource,
    after: ReadOnlyElementsSource,
    topLevelFilters: IDFilter[],
    numElements: number,
    compareOptions?: CompareOptions,
  ): PlanTransformer =>
  graph =>
    log.timeDebug(
      async () => {
        const outputGraph = graph.clone()
        const changes = await calculateDiff(before, after, topLevelFilters, numElements, compareOptions)
        changes.forEach(change => {
          outputGraph.addNode(changeId(change), [], change)
        })
        return outputGraph
      },
      'add nodes to graph with for %d elements',
      numElements,
    )

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
  return log.timeDebug(
    async () => {
      const diffGraph = await buildDiffGraph(
        addDifferentElements(before, after, topLevelFilters, numBeforeElements + numAfterElements, compareOptions),
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
