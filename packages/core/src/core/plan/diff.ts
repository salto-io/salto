/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  areReferencesEqual,
  BuiltinTypesByFullName,
  Change,
  ChangeDataType,
  compareElementIDs,
  CompareOptions,
  compareSpecialValues,
  ElemID,
  getChangeData,
  InstanceElement,
  isEqualValues,
  isField,
  isInstanceElement,
  isModificationChange,
  isObjectType,
  isPrimitiveType,
  isReferenceExpression,
  isTemplateExpression,
  isVariable,
  ReadOnlyElementsSource,
  toChange,
  Value,
} from '@salto-io/adapter-api'
import { resolvePath, setPath, walkOnElement, WALK_NEXT_STEP } from '@salto-io/adapter-utils'
import { collections, values } from '@salto-io/lowerdash'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { IDFilter } from './plan'

type BeforeAfter<T> = collections.asynciterable.BeforeAfter<T>

const { awu, iterateTogether } = collections.asynciterable
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
 * Compare two values recursively.
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
    // code generator, but it's here in order for the method to "fail fast" as some
    // can stop when the first non-equal values are encountered.
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
 * Check if 2 change data types are equal
 */
const isEqualChangeDataType = async (
  changeData1: ChangeDataType | undefined,
  changeData2: ChangeDataType | undefined,
  src1: ReadOnlyElementsSource,
  src2: ReadOnlyElementsSource,
  compareOptions?: CompareOptions,
): Promise<boolean> => {
  if (!values.isDefined(changeData1) || !values.isDefined(changeData2)) {
    // Theoretically we should return true if both are undefined, but practically
    // this makes no sense, so we return false,
    return false
  }

  if (!changeData1.elemID.isEqual(changeData2.elemID)) {
    log.warn(
      'attempted to compare the values of two elements with different elemID (%o and %o)',
      changeData1.elemID.getFullName(),
      changeData2.elemID.getFullName(),
    )
    return false
  }

  if (!changeData1.elemID.isEqual(changeData2.elemID)) {
    log.warn(
      'attempted to compare the values of two elements with different elemID (%o and %o)',
      changeData1.elemID.getFullName(),
      changeData2.elemID.getFullName(),
    )
    return false
  }

  if (!changeData1.isAnnotationsTypesEqual(changeData2)) {
    return false
  }
  if (
    !(await compareValuesAndLazyResolveRefs(
      changeData1.annotations,
      changeData2.annotations,
      src1,
      src2,
      compareOptions,
    ))
  ) {
    return false
  }

  if (isObjectType(changeData1) && isObjectType(changeData2)) {
    // We don't check fields for object types since they have their own changes.
    return changeData1.isMetaTypeEqual(changeData2)
  }

  if (isPrimitiveType(changeData1) && isPrimitiveType(changeData2)) {
    return changeData1.primitive === changeData2.primitive
  }
  if (isInstanceElement(changeData1) && isInstanceElement(changeData2)) {
    return (
      changeData1.refType.elemID.isEqual(changeData2.refType.elemID) &&
      compareValuesAndLazyResolveRefs(changeData1.value, changeData2.value, src1, src2, compareOptions)
    )
  }
  if (isField(changeData1) && isField(changeData2)) {
    return changeData1.refType.elemID.isEqual(changeData2.refType.elemID)
  }
  return _.isEqual(changeData1, changeData2)
}

const getFilteredElements = async (
  source: ReadOnlyElementsSource,
  topLevelFilters: IDFilter[],
): Promise<AsyncIterable<ChangeDataType>> =>
  (topLevelFilters.length === 0
    ? await source.getAll()
    : awu(await source.list())
        .filter(async id => _.every(await Promise.all(topLevelFilters.map(filter => filter(id)))))
        .map(id => source.get(id))) as AsyncIterable<ChangeDataType>

const compareChangeDataType = (e1: ChangeDataType, e2: ChangeDataType): number =>
  compareElementIDs(e1.elemID, e2.elemID)

const isSpecialId = (id: ElemID): boolean =>
  BuiltinTypesByFullName[id.getFullName()] !== undefined || id.getContainerPrefixAndInnerType() !== undefined

export const calculateDiff = async (
  before: ReadOnlyElementsSource,
  after: ReadOnlyElementsSource,
  topLevelFilters: IDFilter[],
  numElements: number,
  compareOptions?: CompareOptions,
  removeRedundantChanges = false,
): Promise<Change<ChangeDataType>[]> =>
  log.timeDebug(
    async () => {
      const sieve = new Set<string>()
      const changes: Change<ChangeDataType>[] = []

      const addChangeIfDifferent = async (beforeData?: ChangeDataType, afterData?: ChangeDataType): Promise<void> => {
        // We can cast to string, at least one of the changes should be defined.
        const fullName = beforeData?.elemID.getFullName() ?? (afterData?.elemID.getFullName() as string)
        if (!sieve.has(fullName)) {
          sieve.add(fullName)
          if (!(await isEqualChangeDataType(beforeData, afterData, before, after, compareOptions))) {
            changes.push(toChange({ before: beforeData, after: afterData }))
          }
        }
      }

      const addElementsNodes = async (comparison: BeforeAfter<ChangeDataType>): Promise<void> => {
        const beforeElement = comparison.before
        const afterElement = comparison.after
        if (!isVariable(beforeElement) && !isVariable(afterElement)) {
          await addChangeIfDifferent(beforeElement, afterElement)
        }
        if (
          removeRedundantChanges &&
          (beforeElement === undefined || afterElement === undefined) &&
          (isObjectType(beforeElement) || isObjectType(afterElement))
        ) {
          // When the entire element was either added or removed, there's no need
          // to create changes for individual fields.
          return
        }
        const beforeFields = isObjectType(beforeElement) ? beforeElement.fields : {}
        const afterFields = isObjectType(afterElement) ? afterElement.fields : {}
        const allFieldNames = [...Object.keys(beforeFields), ...Object.keys(afterFields)]
        await Promise.all(
          allFieldNames.map(fieldName =>
            addChangeIfDifferent(
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

      /**
       * Ids that represent types or containers need to be handled separately,
       * because they would not necessarily be included in getAll.
       */
      await awu(
        iterateTogether(
          await getFilteredElements(before, topLevelFilters),
          await getFilteredElements(after, topLevelFilters),
          compareChangeDataType,
        ),
      )
        .map(handleSpecialIds)
        .forEach(addElementsNodes)
      return changes
    },
    'calculate diff between element sources as a list of changes for %d elements',
    numElements,
  )
