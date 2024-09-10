/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { logger } from '@salto-io/logging'
import {
  isObjectType,
  isInstanceElement,
  ChangeDataType,
  isField,
  isPrimitiveType,
  ReadOnlyElementsSource,
  ElemID,
  isVariable,
  Value,
  isReferenceExpression,
  compareSpecialValues,
  BuiltinTypesByFullName,
  isAdditionChange,
  isModificationChange,
  isRemovalChange,
  changeId,
  isTemplateExpression,
  areReferencesEqual,
  CompareOptions,
  compareElementIDs,
  DetailedChange,
  DetailedChangeWithBaseChange,
  Change,
} from '@salto-io/adapter-api'
import {
  ElementSelector,
  selectElementIdsByTraversal,
  elementSource,
  expressions,
  Workspace,
  remoteMap,
  ReferenceIndexEntry,
} from '@salto-io/workspace'
import { collections, values } from '@salto-io/lowerdash'
import { DataNodeMap, DiffGraph, DiffNode } from '@salto-io/dag'
import wu from 'wu'
import _ from 'lodash'
import { IDFilter, getPlan } from './plan/plan'
import { ChangeWithDetails } from './plan/plan_item'
import { PlanTransformer } from './plan/common'

const log = logger(module)

const { awu, iterateTogether } = collections.asynciterable
const { resolve } = expressions

const getFilteredIds = (
  selectors: ElementSelector[],
  source: elementSource.ElementsSource,
  referenceSourcesIndex: remoteMap.ReadOnlyRemoteMap<ReferenceIndexEntry[]>,
): Promise<ElemID[]> =>
  log.timeDebug(
    async () =>
      awu(
        await selectElementIdsByTraversal({
          selectors,
          source,
          referenceSourcesIndex,
        }),
      ).toArray(),
    'diff.getFilteredIds',
  )

const createMatchers = async (
  beforeElementsSrc: elementSource.ElementsSource,
  afterElementsSrc: elementSource.ElementsSource,
  referenceSourcesIndex: remoteMap.ReadOnlyRemoteMap<ReferenceIndexEntry[]>,
  elementSelectors: ElementSelector[],
): Promise<{
  isChangeMatchSelectors: (change: DetailedChange) => boolean
  isTopLevelElementMatchSelectors: (elemID: ElemID) => boolean
}> => {
  const beforeMatchingElemIDs = await getFilteredIds(elementSelectors, beforeElementsSrc, referenceSourcesIndex)
  const afterMatchingElemIDs = await getFilteredIds(elementSelectors, afterElementsSrc, referenceSourcesIndex)

  const allMatchingTopLevelElemIDsSet = new Set<string>(
    beforeMatchingElemIDs.concat(afterMatchingElemIDs).map(id => id.createTopLevelParentID().parent.getFullName()),
  )
  const isTopLevelElementMatchSelectors = (elemID: ElemID): boolean =>
    allMatchingTopLevelElemIDsSet.has(elemID.getFullName())

  // skipping change matching filtering when all selectors are top level
  if (beforeMatchingElemIDs.every(id => id.isTopLevel()) && afterMatchingElemIDs.every(id => id.isTopLevel())) {
    log.debug('all selectors are top level. skipping change matching filtering')
    return {
      isTopLevelElementMatchSelectors,
      isChangeMatchSelectors: () => true,
    }
  }

  // this set will be used to check if a change is a child of a selector-matched elemID
  const beforeMatchingElemIDsSet = new Set(beforeMatchingElemIDs.map(elemId => elemId.getFullName()))
  const afterMatchingElemIDsSet = new Set(afterMatchingElemIDs.map(elemId => elemId.getFullName()))

  // this set will be used to check if a change is equal/parent of a selector-matched elemID
  const beforeAllParentsMatchingElemIDsSet = new Set(
    beforeMatchingElemIDs.flatMap(elemId => elemId.createAllElemIdParents()).map(elemId => elemId.getFullName()),
  )
  const afterAllParentsMatchingElemIDsSet = new Set(
    afterMatchingElemIDs.flatMap(elemId => elemId.createAllElemIdParents()).map(elemId => elemId.getFullName()),
  )

  const isChangeIdChildOfMatchingElemId = (change: DetailedChange): boolean => {
    const matchingElemIDsSet = isRemovalChange(change) ? beforeMatchingElemIDsSet : afterMatchingElemIDsSet
    return change.id
      .createParentID()
      .createAllElemIdParents()
      .some(elemId => matchingElemIDsSet.has(elemId.getFullName()))
  }

  const isChangeIdEqualOrParentOfMatchingElemId = (change: DetailedChange): boolean => {
    const allParentsMatchingElemIDsSet = isRemovalChange(change)
      ? beforeAllParentsMatchingElemIDsSet
      : afterAllParentsMatchingElemIDsSet
    return allParentsMatchingElemIDsSet.has(change.id.getFullName())
  }

  // A change is matched if its ID matches exactly or is nested under an ID that was matched
  // by the selectors. A change is also matched if it is a parent of one of the IDs that were
  // matched by the selectors - this is correct because if an ID was matched, it means it exists,
  // and therefore a change to the parent must contain the matched value.
  const isChangeMatchSelectors = (change: DetailedChange): boolean =>
    isChangeIdEqualOrParentOfMatchingElemId(change) || isChangeIdChildOfMatchingElemId(change)

  return {
    isChangeMatchSelectors,
    isTopLevelElementMatchSelectors,
  }
}

export type GetDiffChangesParameters = {
  before: ReadOnlyElementsSource
  after: ReadOnlyElementsSource
  topLevelFilters?: IDFilter[]
  compareOptions?: CompareOptions
}

export type BeforeAfter<T> = collections.asynciterable.BeforeAfter<T>
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
          outputGraph.addNode(changeId(change), [], change)
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
        return outputGraph
      },
      'add nodes to graph with for %d elements',
      numElements,
    )

export const resolveNodeElements =
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

const buildDiffGraph = (...transforms: ReadonlyArray<PlanTransformer>): Promise<DiffGraph<ChangeDataType>> =>
  transforms.reduce(
    async (graph, transform) => transform(await graph),
    Promise.resolve(new DataNodeMap<DiffNode<ChangeDataType>>()),
  )
export const getDiffChanges = async ({
  before,
  after,
  topLevelFilters = [],
  compareOptions,
}: GetDiffChangesParameters): Promise<Iterable<Change>> => {
  const numBeforeElements = await awu(await before.list()).length()
  const numAfterElements = await awu(await after.list()).length()
  return log.timeDebug(
    async () => {
      const diffGraph = await buildDiffGraph(
        addDifferentElements(before, after, topLevelFilters, numBeforeElements + numAfterElements, compareOptions),
        resolveNodeElements(before, after),
      )
      return wu(diffGraph.keys()).map(key => diffGraph.getData(key))
    },
    'get diff changes with %o -> %o elements',
    numBeforeElements,
    numAfterElements,
  )
}

export function createDiffChanges(params: {
  toElementsSrc: elementSource.ElementsSource
  fromElementsSrc: elementSource.ElementsSource
  referenceSourcesIndex?: remoteMap.ReadOnlyRemoteMap<ReferenceIndexEntry[]>
  elementSelectors?: ElementSelector[]
  topLevelFilters?: IDFilter[]
  compareOptions?: CompareOptions
  resultType: 'changes'
}): Promise<ChangeWithDetails[]>
export function createDiffChanges(params: {
  toElementsSrc: elementSource.ElementsSource
  fromElementsSrc: elementSource.ElementsSource
  referenceSourcesIndex?: remoteMap.ReadOnlyRemoteMap<ReferenceIndexEntry[]>
  elementSelectors?: ElementSelector[]
  topLevelFilters?: IDFilter[]
  compareOptions?: CompareOptions
  resultType?: 'detailedChanges'
}): Promise<DetailedChangeWithBaseChange[]>
export async function createDiffChanges({
  toElementsSrc,
  fromElementsSrc,
  referenceSourcesIndex = new remoteMap.InMemoryRemoteMap<ReferenceIndexEntry[]>(),
  elementSelectors = [],
  topLevelFilters = [],
  compareOptions,
  resultType = 'detailedChanges',
}: {
  toElementsSrc: elementSource.ElementsSource
  fromElementsSrc: elementSource.ElementsSource
  referenceSourcesIndex?: remoteMap.ReadOnlyRemoteMap<ReferenceIndexEntry[]>
  elementSelectors?: ElementSelector[]
  topLevelFilters?: IDFilter[]
  compareOptions?: CompareOptions
  resultType?: 'changes' | 'detailedChanges'
}): Promise<DetailedChangeWithBaseChange[] | ChangeWithDetails[]> {
  if (elementSelectors.length > 0) {
    const matchers = await createMatchers(toElementsSrc, fromElementsSrc, referenceSourcesIndex, elementSelectors)
    const plan = await getPlan({
      before: toElementsSrc,
      after: fromElementsSrc,
      dependencyChangers: [],
      topLevelFilters: topLevelFilters.concat(matchers.isTopLevelElementMatchSelectors),
      compareOptions,
    })
    return resultType === 'changes'
      ? awu(plan.itemsByEvalOrder())
          .flatMap(item => item.changes())
          .map(change => {
            const filteredDetailedChanges = change.detailedChanges().filter(matchers.isChangeMatchSelectors)
            if (filteredDetailedChanges.length > 0) {
              // we return the whole change even if only some of the detailed changes match the selectors.
              return { ...change, detailedChanges: () => filteredDetailedChanges }
            }
            return undefined
          })
          .filter(values.isDefined)
          .toArray()
      : awu(plan.itemsByEvalOrder())
          .flatMap(item => item.detailedChanges())
          .filter(matchers.isChangeMatchSelectors)
          .toArray()
  }
  const plan = await getPlan({
    before: toElementsSrc,
    after: fromElementsSrc,
    dependencyChangers: [],
    topLevelFilters,
    compareOptions,
  })
  return wu(plan.itemsByEvalOrder())
    .map(item => item[resultType]())
    .flatten()
    .toArray()
}

export const getEnvsDeletionsDiff = async (
  workspace: Workspace,
  sourceElemIds: ElemID[],
  envs: ReadonlyArray<string>,
  selectors: ElementSelector[],
): Promise<Record<string, ElemID[]>> =>
  log.timeDebug(async () => {
    const envsElemIds: Record<string, ElemID[]> = Object.fromEntries(
      await awu(envs)
        .map(async env => [
          env,
          await awu(
            await workspace.getElementIdsBySelectors(selectors, { source: 'env', envName: env }, true),
          ).toArray(),
        ])
        .toArray(),
    )

    const sourceElemIdsSet = new Set(sourceElemIds.map(id => id.getFullName()))
    return _(envsElemIds)
      .mapValues(ids => ids.filter(id => !sourceElemIdsSet.has(id.getFullName())))
      .entries()
      .filter(([_env, ids]) => ids.length !== 0)
      .fromPairs()
      .value()
  }, 'getEnvsDeletionsDiff')
