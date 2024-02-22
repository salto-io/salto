/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import _ from 'lodash'
import objectHash from 'object-hash'
import {
  ChangeDataType,
  DetailedChange,
  Value,
  isReferenceExpression,
  isRemovalOrModificationChange,
  isAdditionOrModificationChange,
  isPrimitiveValue,
  isStaticFile,
  isIndexPathPart,
  ReferenceExpression,
  isTemplateExpression,
  PrimitiveValue,
  TemplateExpression,
  StaticFile,
} from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'
import wu from 'wu'
import { logger } from '@salto-io/logging'
import { resolvePath, setPath } from './utils'

const log = logger(module)

type KeyFunction = (value: Value) => string

/**
 * Calculate a string to represent an item in a list based on all of its values
 *
 * Note: this function ignores the value of compareReferencesByValue and always looks at the reference id
 */
const getListItemExactKey: KeyFunction = value =>
  objectHash(value, {
    replacer: val => {
      if (isReferenceExpression(val)) {
        // Returning without the reference value
        return new ReferenceExpression(val.elemID)
      }
      return val
    },
  })

type TopLevelType = PrimitiveValue | ReferenceExpression | TemplateExpression | StaticFile

const isValidTopLevelType = (value: unknown): value is TopLevelType =>
  isPrimitiveValue(value) || isReferenceExpression(value) || isTemplateExpression(value) || isStaticFile(value)

/**
 * Note: this function ignores the value of compareReferencesByValue and always looks at the reference id
 */
const getSingleValueKey = (value: TopLevelType): string => {
  if (isReferenceExpression(value)) {
    return value.elemID.getFullName()
  }
  if (isStaticFile(value)) {
    return value.filepath
  }
  if (isTemplateExpression(value)) {
    return value.parts.map(getSingleValueKey).join('')
  }
  return value.toString()
}

/**
 * Calculate a string to represent an item in the list
 * based only on its top level values
 *
 * Based on experiments, we found looking only on the top level values
 * to be a good heuristic for representing an item in a list
 */
const getListItemTopLevelKey: KeyFunction = value => {
  if (_.isPlainObject(value) || Array.isArray(value)) {
    return Object.keys(value)
      .filter(key => isValidTopLevelType(value[key]))
      .sort()
      .flatMap(key => [key, ':', getSingleValueKey(value[key])])
      .join('')
  }

  if (isValidTopLevelType(value)) {
    return getSingleValueKey(value)
  }

  // When there aren't any top level keys
  return ''
}

const buildKeyToIndicesMap = (list: Value[], keyFunc: KeyFunction): Record<string, number[]> => {
  const keyToIndex = list.map((value, index) => ({ key: keyFunc(value), index }))
  return _.mapValues(
    _.groupBy(keyToIndex, ({ key }) => key),
    indices => indices.map(({ index }) => index),
  )
}

type IndexMappingItem = {
  beforeIndex?: number
  afterIndex?: number
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
export const applyListChanges = (element: ChangeDataType, changes: DetailedChange[]): void =>
  log.time(() => {
    const ids = changes.map(change => change.id)
    if (
      ids.some(id => !isIndexPathPart(id.name)) ||
      new Set(ids.map(id => id.createParentID().getFullName())).size > 1
    ) {
      throw new Error('Changes that are passed to applyListChanges must be only list item changes of the same list')
    }

    const parentId = changes[0].id.createParentID().replaceParentId(element.elemID)
    const list = resolvePath(element, parentId)
    changes.filter(isRemovalOrModificationChange).forEach(change => {
      list[Number(change.elemIDs?.before?.name)] = undefined
    })

    _(changes)
      .filter(isAdditionOrModificationChange)
      .sortBy(change => Number(change.elemIDs?.after?.name))
      .forEach(change => {
        const index = Number(change.elemIDs?.after?.name)
        if (list[index] === undefined) {
          list[index] = change.data.after
        } else {
          list.splice(index, 0, change.data.after)
        }
      })

    setPath(element, parentId, list.filter(values.isDefined))
  }, `applyListChanges - ${element.elemID.getFullName()}`)
