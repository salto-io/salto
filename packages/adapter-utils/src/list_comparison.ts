/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import objectHash from 'object-hash'
import {
  Element,
  DetailedChange,
  Value,
  isReferenceExpression,
  isPrimitiveValue,
  isStaticFile,
  isIndexPathPart,
  ReferenceExpression,
  isTemplateExpression,
  PrimitiveValue,
  TemplateExpression,
  StaticFile,
  isModificationChange,
  ElemID,
  isRemovalChange,
} from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'
import wu from 'wu'
import { resolvePath, setPath } from './utils'

type KeyFunction = (value: Value) => string

type LeafValue = PrimitiveValue | ReferenceExpression | TemplateExpression | StaticFile

type IndexMappingItem = {
  beforeIndex?: number
  afterIndex?: number
}

type ListChange<T> =
  | {
      action: 'remove'
      beforeIndex: number
    }
  | {
      action: 'add'
      afterIndex: number
      afterValue: T
    }
  | {
      action: 'modify'
      beforeIndex: number
      afterIndex: number
      afterValue: T
    }

export const getChangeRealId = (change: DetailedChange): ElemID =>
  (isRemovalChange(change) ? change.elemIDs?.before : change.elemIDs?.after) ?? change.id

/**
 * Returns whether a change contains a moving of an item in a list for one index to another
 */
export const isOrderChange = (change: DetailedChange): boolean =>
  isIndexPathPart(change.id.name) &&
  isIndexPathPart(change.elemIDs?.before?.name ?? '') &&
  isIndexPathPart(change.elemIDs?.after?.name ?? '') &&
  change.elemIDs?.before?.name !== change.elemIDs?.after?.name

/**
 * Calculate a string to represent an item in a list based on all of its values
 *
 * Note: this function ignores the value of compareReferencesByValue and always looks at the reference id
 */
export const getListItemExactKey: KeyFunction = value =>
  objectHash(value, {
    replacer: val => {
      if (isReferenceExpression(val)) {
        // Returning without the reference value
        return new ReferenceExpression(val.elemID)
      }
      return val
    },
  })

const isValidLeafValue = (value: unknown): value is LeafValue =>
  isPrimitiveValue(value) || isReferenceExpression(value) || isTemplateExpression(value) || isStaticFile(value)

/**
 * Note: this function ignores the value of compareReferencesByValue and always looks at the reference id
 */
const getSingleValueKey = (value: LeafValue): string => {
  if (isReferenceExpression(value)) {
    return value.elemID.getFullName()
  }
  if (isStaticFile(value)) {
    return value.filepath
  }
  if (isTemplateExpression(value)) {
    return value.parts.map(getSingleValueKey).join('')
  }
  return value?.toString() ?? ''
}

/**
 * Calculate a string to represent an item in the list
 * based only on its leaf values (without lists/objects)
 *
 * Based on experiments, we found looking only on the leaf values
 * to be a good heuristic for representing an item in a list
 */
const getListItemTopLevelKey: KeyFunction = value => {
  if (_.isPlainObject(value) || Array.isArray(value)) {
    return Object.keys(value)
      .filter(key => isValidLeafValue(value[key]))
      .sort()
      .flatMap(key => [key, ':', getSingleValueKey(value[key])])
      .join('')
  }

  if (isValidLeafValue(value)) {
    return getSingleValueKey(value)
  }

  // When there aren't any leaf values
  return ''
}

const buildKeyToIndicesMap = (list: Value[], keyFunc: KeyFunction): Record<string, number[]> => {
  const keyToIndex = list.map((value, index) => ({ key: keyFunc(value), index }))
  return _.mapValues(
    _.groupBy(keyToIndex, ({ key }) => key),
    indices => indices.map(({ index }) => index),
  )
}

/**
 * For comparing lists, this function creates the mapping between the indexes
 * of the items in the old list to the indexes of the mapping in the after
 * list based on a heuristic we created.
 *
 * How it works:
 * 1. Assume the items with the same key and different indexes were moved
 *   a. First try with a key that is based on the entire item
 *   b. Then try with a key that is based only on the top level values of the item
 * 2. Assume the items with different key and the same indexes were modified
 * 3. Match the rest of items with the following heuristic
 *   - For an item I1 in the before list, match it to an item I2 in the after list such that
 *     for each item J, if beforeIndex(J) < beforeIndex(I1) then afterIndex(J) < afterIndex(I2)
 * 4. The unmatched items in the before list are assumed to be items that were removed from the list
 * 5. The unmatched items in the after list are assumed to be items that were added to the list
 *
 * Notes about the output of this function:
 * - All the before indexes will have a match (either to an index or to undefined (if they were removed))
 * - All the after indexes will have a match (either to an index or to undefined (if they were added))
 * - Each before and after index will appear exactly once in the mapping
 * - The mapping items are sorted such that:
 *   - The modification and addition changes will be sorted by their after index
 *   - The removal changes will be in the index of their before index
 *
 * Any implementation that satisfies these properties would work with the rest of the code
 */
export const getArrayIndexMapping = (before: Value[], after: Value[]): IndexMappingItem[] => {
  const afterIndexExactMap = buildKeyToIndicesMap(after, getListItemExactKey)
  const afterIndexTopLevelMap = buildKeyToIndicesMap(after, getListItemTopLevelKey)

  const matchedAfterIndexes = new Set<number>()

  // We want to maintain the following invariant in our mapping:
  // - let A and B be indices in the before array that do not have an exact match
  //   then A<B implies afterIndex(A)<afterIndex(B)
  //
  // In order the maintain this, we need to keep track of the possible indices for comparison.
  // so for each before index, we maintain the highest after index that was seen before it, meaning
  // that before index cannot be matched with an after index lower than that value
  let maxAfterIndexMatched = -1
  const matchesAfterExactKeyMatch = before.map((value, beforeIndex) => {
    const key = getListItemExactKey(value)
    const matchedAfterIndex = (afterIndexExactMap[key] ?? []).shift()

    // this is a re-order
    if (matchedAfterIndex !== undefined) {
      maxAfterIndexMatched = Math.max(maxAfterIndexMatched, matchedAfterIndex)
      matchedAfterIndexes.add(matchedAfterIndex)
    }
    return {
      beforeIndex,
      afterIndex: matchedAfterIndex,
      // The min after index is the max  after index we matched to so far
      minAfterIndex: maxAfterIndexMatched,
      beforeValue: value,
    }
  })

  maxAfterIndexMatched = -1
  // We now try to match the before and after matches based
  // on the fallback key function that looks only at the top level values
  const matchesAfterKeyMatch = matchesAfterExactKeyMatch.map(
    ({ beforeIndex, afterIndex, minAfterIndex, beforeValue }) => {
      if (afterIndex !== undefined) {
        maxAfterIndexMatched = Math.max(maxAfterIndexMatched, minAfterIndex)
        return { beforeIndex, afterIndex, minAfterIndex }
      }

      const key = getListItemTopLevelKey(beforeValue)
      const matchedAfterIndex = (afterIndexTopLevelMap[key] ?? []).shift()

      // this is a re-order
      if (matchedAfterIndex !== undefined && !matchedAfterIndexes.has(matchedAfterIndex)) {
        maxAfterIndexMatched = Math.max(maxAfterIndexMatched, matchedAfterIndex, minAfterIndex)
        matchedAfterIndexes.add(matchedAfterIndex)
        return {
          beforeIndex,
          afterIndex: matchedAfterIndex,
          // The min after index is the max after index we matched to so far
          minAfterIndex: maxAfterIndexMatched,
        }
      }

      return {
        beforeIndex,
        afterIndex: undefined,
        // The min after index is the max  after index we matched to so far
        minAfterIndex: maxAfterIndexMatched,
      }
    },
  )

  maxAfterIndexMatched = -1
  // After finding matches by key, we prefer matching equal indices because they provide
  // the clearest difference (only value difference with no index difference)
  const matchesAfterIndexMatch = matchesAfterKeyMatch.map(({ beforeIndex, afterIndex, minAfterIndex }) => {
    if (!matchedAfterIndexes.has(beforeIndex) && afterIndex === undefined && beforeIndex < after.length) {
      matchedAfterIndexes.add(beforeIndex)
      maxAfterIndexMatched = beforeIndex
      return { beforeIndex, afterIndex: beforeIndex, minAfterIndex }
    }

    return { beforeIndex, afterIndex, minAfterIndex: Math.max(maxAfterIndexMatched, minAfterIndex) }
  })

  const afterIndexes = _.times(after.length).reverse()

  let maxPossibleAfterIndex = after.length
  const matches: IndexMappingItem[] = matchesAfterIndexMatch
    .reverse()
    .map(({ beforeIndex, afterIndex, minAfterIndex }) => {
      if (afterIndex !== undefined) {
        maxPossibleAfterIndex = Math.min(afterIndex, maxPossibleAfterIndex)
        return { beforeIndex, afterIndex }
      }

      const reversedMaxPossibleAfterIndex = after.length - maxPossibleAfterIndex
      const reversedMinAfterIndex = after.length - minAfterIndex

      const selectedAfterIndex =
        reversedMinAfterIndex - reversedMaxPossibleAfterIndex > 0
          ? wu(afterIndexes)
              .slice(reversedMaxPossibleAfterIndex, reversedMinAfterIndex)
              .find(index => !matchedAfterIndexes.has(index))
          : undefined

      if (selectedAfterIndex === undefined) {
        return { beforeIndex, afterIndex }
      }

      matchedAfterIndexes.add(selectedAfterIndex)
      maxPossibleAfterIndex = selectedAfterIndex
      return { beforeIndex, afterIndex: selectedAfterIndex }
    })

  // Make sure all after indices are mapped to something - all the remaining indices
  // at this point will be marked as additions
  _.times(after.length)
    .filter(index => !matchedAfterIndexes.has(index))
    .forEach(afterIndex => matches.push({ afterIndex, beforeIndex: undefined }))

  // Sort mapping to maintain that items appear in a consistent order according to their
  // location in the after array.
  const orderedItems = _(matches)
    .filter(item => item.afterIndex !== undefined)
    .sortBy(item => item.afterIndex)
    .value()

  // Insert remove changes in their original location in the array, this seems to give
  // to most intuitive result
  _(matches)
    .filter((item): item is { beforeIndex: number } => item.beforeIndex !== undefined && item.afterIndex === undefined)
    .sortBy(item => item.beforeIndex)
    .forEach(removal => {
      orderedItems.splice(removal.beforeIndex, 0, removal)
    })

  return orderedItems
}

const hasBeforeIndex = <T>(change: ListChange<T>): change is ListChange<T> & { action: 'remove' | 'modify' } =>
  change.action !== 'add'

const hasAfterIndex = <T>(change: ListChange<T>): change is ListChange<T> & { action: 'add' | 'modify' } =>
  change.action !== 'remove'

const toListChange = <T>(change: DetailedChange<T>): ListChange<T> => {
  switch (change.action) {
    case 'remove': {
      return { action: change.action, beforeIndex: Number(change.elemIDs?.before?.name) }
    }
    case 'add': {
      return { action: change.action, afterIndex: Number(change.elemIDs?.after?.name), afterValue: change.data.after }
    }
    default: {
      return {
        action: change.action,
        beforeIndex: Number(change.elemIDs?.before?.name),
        afterIndex: Number(change.elemIDs?.after?.name),
        afterValue: change.data.after,
      }
    }
  }
}

const updateList = <T>(list: unknown[], changes: ListChange<T>[]): void => {
  const removalsAndModifications = changes.filter(hasBeforeIndex)
  removalsAndModifications.forEach(({ beforeIndex }) => {
    list[beforeIndex] = undefined
  })

  const sortedAdditionsAndModifications = _.sortBy(changes.filter(hasAfterIndex), change => change.afterIndex)
  sortedAdditionsAndModifications.forEach(({ afterIndex, afterValue }) => {
    if (list[afterIndex] === undefined) {
      list[afterIndex] = afterValue
    } else {
      list.splice(afterIndex, 0, afterValue)
    }
  })
}

const updateListWithFilteredChanges = (
  list: unknown[],
  changes: DetailedChange[],
  filterFunc: (change: DetailedChange) => boolean,
): void => {
  // cannot apply order changes selectively because it creates an unexpected result
  const relevantChanges = changes.filter(change => !isOrderChange(change))
  const [modifications, additionsAndRemovals] = _.partition(relevantChanges, isModificationChange)

  updateList(list, modifications.filter(filterFunc).map(toListChange))

  const [changesToApply, changesToIgnore] = _.partition(additionsAndRemovals, filterFunc)

  const listChangesToApply = changesToApply.map(toListChange)
  const listChangesToIgnore = changesToIgnore.map(toListChange)

  const [additionsToApply, removalsToApply] = _.partition(listChangesToApply, hasAfterIndex)

  const additionsToApplyWithFixedIndex = additionsToApply.map(change => ({
    ...change,
    fixedIndex: change.afterIndex,
  }))

  listChangesToIgnore.forEach(changeToIgnore => {
    const indexShiftValue = hasAfterIndex(changeToIgnore) ? -1 : 1
    const changeToIgnoreIndex = hasAfterIndex(changeToIgnore) ? changeToIgnore.afterIndex : changeToIgnore.beforeIndex

    additionsToApplyWithFixedIndex.forEach(additionToApply => {
      if (changeToIgnoreIndex < additionToApply.afterIndex) {
        additionToApply.fixedIndex += indexShiftValue
      }
    })
  })

  additionsToApplyWithFixedIndex.forEach(change => {
    change.afterIndex = change.fixedIndex
  })

  updateList(list, [...removalsToApply, ...additionsToApplyWithFixedIndex])
}

/**
 * This method is for applying list item changes on the element
 * (e.g, removal, addition or reorder of items inside lists).
 *
 * How it works:
 * - Get the before list values.
 * - Set to undefined every index that is changed in the before list.
 * - Sort the changes by the after index.
 * - Go over the changes
 *   - If the after index is available (undefined) then use it
 *   - Otherwise, use splice and add it between the item in the after index to the one before
 * - Omit the undefined values that were left in the list
 *
 * Notes:
 * - If all the detailed changes from the detailedCompare will be applied,
 *   every change should be applied to the index in its after element id (and not after that)
 *
 * - If not all the detailed changes are applied, the results are ambiguous.
 *   E.g., if we have ['a', 'b'] that was turned into ['b'], but we omit the removal change of 'b',
 *   then we are left only with a reorder change for 'b' between index 1 to index 0.
 *   In such scenario it is not clear whether the results should be ['b', 'a'] or ['a', 'b'].
 *   Here we chose the results for such case to be ['a', 'b'].
 */
export const applyListChanges = (
  element: Element,
  changes: DetailedChange[],
  filterFunc: (change: DetailedChange) => boolean = () => true,
): void => {
  const ids = changes.map(change => change.id)
  if (ids.some(id => !isIndexPathPart(id.name)) || new Set(ids.map(id => id.createParentID().getFullName())).size > 1) {
    throw new Error('Changes that are passed to applyListChanges must be only list item changes of the same list')
  }

  const matchingChanges = changes.filter(filterFunc)
  if (matchingChanges.length === 0) {
    return
  }

  const parentId = getChangeRealId(changes[0]).createParentID().replaceParentId(element.elemID)
  const list = resolvePath(element, parentId)

  if (matchingChanges.length === changes.length) {
    updateList(list, changes.map(toListChange))
  } else {
    updateListWithFilteredChanges(list, changes, filterFunc)
  }

  setPath(element, parentId, list.filter(values.isDefined))
}
