/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  Change,
  ElemID,
  getChangeData,
  InstanceElement,
  isEqualValues,
  isModificationChange,
  Value,
  isReferenceExpression,
  areReferencesEqual,
  compareSpecialValues,
  isTemplateExpression,
  isObjectType,
  isPrimitiveType,
  isInstanceElement,
  isField,
  isVariable,
  BuiltinTypesByFullName,
  compareElementIDs, ReadOnlyElementsSource, CompareOptions, ChangeDataType,
} from '@salto-io/adapter-api'
import { resolvePath, setPath, walkOnElement, WALK_NEXT_STEP } from '@salto-io/adapter-utils'
import { collections, values } from '@salto-io/lowerdash'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { DiffNode } from '@salto-io/dag'
import { IDFilter } from './plan'

const { awu, iterateTogether } = collections.asynciterable
type BeforeAfter<T> = collections.asynciterable.BeforeAfter<T>

const log = logger(module)

const removePath = (instance: InstanceElement, path: ElemID): void => {
  setPath(instance, path, undefined)
  const parentPath = path.createParentID()
  if (path.nestingLevel > 1 && _.isEmpty(_.pickBy(resolvePath(instance, parentPath), values.isDefined))) {
    removePath(instance, parentPath)
  }
}

export const getDiffInstance = (change: Change<InstanceElement>): InstanceElement => {
  const instance = getChangeData(change)

  const diffInstance = instance.clone()

  if (isModificationChange(change)) {
    walkOnElement({
      element: change.data.before,
      func: ({ value, path }) => {
        if (_.isPlainObject(value) || Array.isArray(value)) {
          return WALK_NEXT_STEP.RECURSE
        }

        const valueAfter = resolvePath(instance, path)

        if (isEqualValues(value, valueAfter)) {
          removePath(diffInstance, path)
          return WALK_NEXT_STEP.SKIP
        }

        return WALK_NEXT_STEP.RECURSE
      },
    })
  }

  return diffInstance
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

export const calculateDiff = (
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
