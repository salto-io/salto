/*
*                      Copyright 2022 Salto Labs Ltd.
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
import {
  ChangeDataType, DetailedChange, Value, isReferenceExpression,
  isRemovalOrModificationChange,
  isAdditionOrModificationChange,
  isPrimitiveValue,
  isStaticFile,
  isIndexPathPart,
} from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'
import wu from 'wu'
import { getElementChangeId, resolvePath, setPath } from './utils'

const getSingleValueKey = (value: Value): string => {
  if (isReferenceExpression(value)) {
    return value.elemID.getFullName()
  }
  if (isStaticFile(value)) {
    return value.filepath
  }
  return value.toString()
}

/**
 * Function that calculate a string to represent an item in the list
 *
 * Based on experiments, we found looking only on the top level values
 * to be a good heuristic for representing an item in a list
 */
const getListItemKey = (value: Value): string => {
  if (_.isPlainObject(value) || Array.isArray(value)) {
    return Object.keys(value)
      .filter(key => isPrimitiveValue(value[key]) || isReferenceExpression(value[key]) || isStaticFile(value[key]))
      .sort()
      .flatMap(key => [key, ':', getSingleValueKey(value[key])])
      .join('')
  }

  if (!_.isObject(value) || isReferenceExpression(value) || isStaticFile(value)) {
    return getSingleValueKey(value)
  }
  return ''
}

const buildKeyToIndicesMap = (list: Value[]): Record<string, number[]> => {
  const keyToIndex = list.map((value, index) => ({ key: getListItemKey(value), index }))
  return _.mapValues(
    _.groupBy(
      keyToIndex,
      ({ key }) => key,
    ),
    indices => indices.map(({ index }) => index)
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
 * How to works:
 * 1. Assume the items with the same key have and different indexes were moved
 * 2. Assume the items with different key and the same indexes were modified
 * 3. Match the rest of items with the following heuristic
 *   - For an item I1 in the before list, match it to an item I2 in the after list such that
 *     for each item J, if beforeIndex(J) < beforeIndex(I1) then afterIndex(J) < afterIndex(I2)
 * 4. The unmatched items in the before list are assumed to be items that were removed from the list
 * 5. The unmatched items in the after list are assumed to be items that were added to the list
 */
export const getArrayIndexMapping = (before: Value[], after: Value[]): IndexMappingItem[] => {
  const afterIndexMap = buildKeyToIndicesMap(after)
  const matchedAfterIndexes = new Set<number>()

  // We want to maintain the following invariant in our mapping:
  // - let A and B be indices in the before array that do not have an exact match
  //   then A<B implies afterIndex(A)<afterIndex(B)
  //
  // In order the maintain this, we need to keep track of the possible indices for comparison.
  // so for each before index, we maintain the highest after index that was seen before it, meaning
  // that before index cannot be matched with an after index lower than that value
  let maxAfterIndexMatched = -1
  const matchesAfterKeyMatch = before.map((value, beforeIndex) => {
    const key = getListItemKey(value)
    const matchedAfterIndex = (afterIndexMap[key] ?? []).shift()

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
    }
  })

  maxAfterIndexMatched = -1
  // After finding matches by key, we prefer matching equal indices because they provide
  // the clearest difference (only value difference with no index difference)
  const matchesAfterIndexMatch = matchesAfterKeyMatch
    .map(({ beforeIndex, afterIndex, minAfterIndex }) => {
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

      const selectedAfterIndex = reversedMinAfterIndex - reversedMaxPossibleAfterIndex > 0
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
    .filter((item): item is { beforeIndex: number } => item.beforeIndex !== undefined
      && item.afterIndex === undefined)
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
 *   E.g., if we have ['a', 'b'] that was turn into ['b'], but we omit the removal change of 'b',
 *   then we are left only with a reorder change for 'b' between index 1 to index 0.
 *   In such scenario it is not clear whether the results should be ['b', 'a'] or ['a', 'b'].
 *   Here we chose the results for such case to be ['a', 'b'].
 */
export const applyListChanges = (element: ChangeDataType, changes: DetailedChange[]): void => {
  const ids = changes.map(change => change.id)
  if (ids.some(id => !isIndexPathPart(id.name)) || new Set(ids.map(id => id.createParentID().getFullName())).size > 1) {
    throw new Error('Changes that are passed to applyListChanges must be only list item changes of the same list')
  }

  const parentId = getElementChangeId(element, changes[0].id.createParentID())
  const list = resolvePath(element, parentId)
  changes.filter(isRemovalOrModificationChange)
    .forEach(change => { list[Number(change.elemIDs?.before?.name)] = undefined })

  _(changes)
    .filter(isAdditionOrModificationChange)
    .sortBy(change => change.elemIDs?.after?.getFullName())
    .forEach(change => {
      const index = Number(change.elemIDs?.after?.name)
      if (list[index] === undefined) {
        list[index] = change.data.after
      } else {
        list.splice(index, 0, change.data.after)
      }
    })

  setPath(element, parentId, list.filter(values.isDefined))
}
