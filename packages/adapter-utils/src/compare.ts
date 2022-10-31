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
import wu from 'wu'
import _ from 'lodash'
import objectHash from 'object-hash'
import {
  ChangeDataType, DetailedChange, isField, isInstanceElement, ElemID, Value, ObjectType, isType,
  PrimitiveType, isObjectType, isPrimitiveType, isEqualElements, isEqualValues, isRemovalChange,
  isElement,
  Element,
  CompareOptions,
  isIndexPathPart,
  isReferenceExpression,
  ReferenceExpression,
  isRemovalOrModificationChange,
  isAdditionOrModificationChange,
} from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'
import { resolvePath, setPath } from './utils'

const hashValue = (value: Value): string =>
  objectHash(value, {
    replacer: val => {
      if (isReferenceExpression(val)) {
        // Returning without the reference value
        return new ReferenceExpression(val.elemID)
      }
      return val
    },
  })

// This returns a map of hash to list of indices where this hash appears in ascending order
const buildKeyToIndexMap = (list: Value[]): Record<string, number[]> => {
  const hashToIndex = list.map((value, index) => ({ hash: hashValue(value), index }))
  return _.mapValues(
    _.groupBy(
      hashToIndex,
      ({ hash }) => hash,
    ),
    indices => indices.map(({ index }) => index)
  )
}

type IndexMappingItem = {
  beforeIdx?: number
  afterIdx?: number
}

/**
 * For comparing lists, this function creates the mapping between the indexes
 * of the items in the old list to the indexes of the mapping in the after
 * list based on a heuristic we created.
 *
 * How to works:
 * 1. Assume the items with the same have and different indexes were moved
 * 2. Assume the items with different hash and the same indexes were modified
 * 3. Match the rest of items with the following heuristic
 *   - For an item I1 in the before list, match it to an item I2 in the after list such that
 *     for each item J, if beforeIndex(J) < beforeIndex(I1) then afterIndex(J) < afterIndex(I2)
 * 4. The unmatched items in the before list are assumed to be removals
 * 5. The unmatched items in the after list are assumed to be additions
 */
const getArrayIndexMapping = (before: Value[], after: Value[]): IndexMappingItem[] => {
  const afterIndexMap = buildKeyToIndexMap(after)
  const beforeIdxToAfterIdx: Record<number, number> = {}
  const mappingItems: IndexMappingItem[] = []

  const unmappedAfterIndices = new Set(_.times(after.length))
  const unmappedBeforeIndices: number[] = []

  // We want to maintain the following invariant in our mapping:
  //  let A and B be indices in the before array that do not have an exact match
  //  then A<B implies afterIdx(A)<afterIdx(B)
  // In order the maintain this, we need to keep track of the possible indices for comparison.
  // so for each before index, we maintain the highest after index that was seen before it, meaning
  // that before index cannot be matched with an after index lower than that value
  const minPossibleAfterIdx = new Map<number, number>()

  let maxAfterIndexMatched = -1
  before.forEach((value, beforeIdx) => {
    const key = hashValue(value)
    const matchingAfterIdx = (afterIndexMap[key] ?? []).shift()
    if (matchingAfterIdx !== undefined) {
      // this is a re-order
      unmappedAfterIndices.delete(matchingAfterIdx)

      beforeIdxToAfterIdx[beforeIdx] = matchingAfterIdx
      mappingItems.push({ beforeIdx, afterIdx: matchingAfterIdx })

      maxAfterIndexMatched = Math.max(maxAfterIndexMatched, matchingAfterIdx)
    } else {
      // no exact match, remember this index as one that needs to be mapped later
      // we do not try to match it now because we don't know which before indices
      // are going to be matched by later items in the after array, so we don't want
      // to "take" any items from the before array until this loop is done, so we do nothing
      unmappedBeforeIndices.push(beforeIdx)
      // This afterIdx must be matched with a beforeIDx that is larger than any beforeIdx
      // matched so far. so we set this maxBeforeIndexMatched as the minimal beforeIdx
      // possible for this afterIdx
      minPossibleAfterIdx.set(beforeIdx, maxAfterIndexMatched)
    }
  })

  // After finding matches by key, we prefer matching equal indices because they provide
  // the clearest difference (only value difference with no index difference)
  const exactIdxMatches = unmappedBeforeIndices.filter(
    beforeIdx => unmappedAfterIndices.has(beforeIdx)
  )
  exactIdxMatches.forEach(beforeIdx => {
    mappingItems.push({ beforeIdx, afterIdx: beforeIdx })
    beforeIdxToAfterIdx[beforeIdx] = beforeIdx
    unmappedAfterIndices.delete(beforeIdx)
  })

  // Make sure all before indices are mapped to something
  let maxPossibleAfterIdx = after.length
  _.times(before.length).reverse().forEach(beforeIdx => {
    if (beforeIdxToAfterIdx[beforeIdx] !== undefined) {
      // Any afterIdx smaller than this afterIdx must not be matched with a beforeIdx
      // larger than the match we have here, so we update the maxPossibleBeforeIdx here
      maxPossibleAfterIdx = Math.min(maxPossibleAfterIdx, beforeIdxToAfterIdx[beforeIdx])
    } else {
      const afterIdx = wu(unmappedAfterIndices).find(
        idx =>
          idx < maxPossibleAfterIdx
          && idx > (minPossibleAfterIdx.get(beforeIdx) ?? -1)
      )
      if (afterIdx === undefined) {
        // No available after index - we will mark this before index as a removal
        mappingItems.push({ beforeIdx })
      } else {
        mappingItems.push({ beforeIdx, afterIdx })
        unmappedAfterIndices.delete(afterIdx)
        maxPossibleAfterIdx = Math.min(maxPossibleAfterIdx, afterIdx)
      }
    }
  })

  // Make sure all after indices are mapped to something - all the remaining indices
  // at this point will be marked as additions
  unmappedAfterIndices.forEach(afterIdx => {
    mappingItems.push({ afterIdx })
  })

  // Sort mapping to maintain that items appear in a consistent order according to their
  // location in the after array.
  const orderedItems = _(mappingItems)
    .filter(item => item.afterIdx !== undefined)
    .sortBy(item => item.afterIdx)
    .value()

  // Insert remove changes in their original location in the array, this seems to give
  // to most intuitive result
  _(mappingItems)
    .filter((item): item is { beforeIdx: number } => item.beforeIdx !== undefined
      && item.afterIdx === undefined)
    .sortBy(item => item.beforeIdx)
    .forEach(removal => {
      orderedItems.splice(removal.beforeIdx, 0, removal)
    })

  return orderedItems
}

const compareListWithOrderMatching = ({
  id, before, after, beforeId, afterId, options,
}: {
  id: ElemID
  before: Value
  after: Value
  beforeId: ElemID | undefined
  afterId: ElemID | undefined
  options: CompareOptions | undefined
}): DetailedChange[] => {
  const indexMapping = getArrayIndexMapping(before, after)

  const itemsChanges = _.flatten(
    indexMapping.map((item, changeIdx) => {
      const itemChangeId = id.createNestedID(changeIdx.toString())
      const itemBeforeId = item.beforeIdx !== undefined
        ? beforeId?.createNestedID(item.beforeIdx.toString())
        : undefined
      const itemAfterId = item.afterIdx !== undefined
        ? afterId?.createNestedID(item.afterIdx.toString())
        : undefined

      const itemBeforeValue = item.beforeIdx !== undefined ? before[item.beforeIdx] : undefined
      const itemAfterValue = item.afterIdx !== undefined ? after[item.afterIdx] : undefined
      // eslint-disable-next-line no-use-before-define
      const innerChanges = getValuesChanges({
        id: itemChangeId,
        beforeId: itemBeforeId,
        afterId: itemAfterId,
        before: itemBeforeValue,
        after: itemAfterValue,
        options,
      })
      const hasChangeDirectlyOnItem = (
        innerChanges.length === 1
        && innerChanges.some(change => change.id.isEqual(itemChangeId))
      )
      if (item.beforeIdx !== item.afterIdx && !hasChangeDirectlyOnItem) {
        // This item changed its index, so if we don't already have a change
        // on this item, we need to add one
        innerChanges.push({
          action: 'modify',
          data: {
            before: itemBeforeValue,
            after: itemAfterValue,
          },
          id: itemChangeId,
          elemIDs: { before: itemBeforeId, after: itemAfterId },
        })
      }
      return innerChanges
    }),
  )

  return itemsChanges
}

/**
 * Create detailed changes from change data (before and after values)
 */
const getValuesChanges = ({
  id, before, after, options, beforeId, afterId,
}: {
  id: ElemID
  before: Value
  after: Value
  beforeId: ElemID | undefined
  afterId: ElemID | undefined
  options?: CompareOptions
}): DetailedChange[] => {
  if (isElement(before) && isElement(after)
    && isEqualElements(before, after, options)) {
    return []
  }

  if (!isElement(before) && !isElement(after)
    && isEqualValues(before, after, options)) {
    return []
  }

  if (before === undefined) {
    return [{ id, action: 'add', data: { after }, elemIDs: { before: beforeId, after: afterId } }]
  }
  if (after === undefined) {
    return [{ id, action: 'remove', data: { before }, elemIDs: { before: beforeId, after: afterId } }]
  }
  if (_.isPlainObject(before) && _.isPlainObject(after)) {
    return _(before).keys()
      .union(_.keys(after))
      .map(key => getValuesChanges({
        id: id.createNestedID(key),
        beforeId: beforeId?.createNestedID(key),
        afterId: afterId?.createNestedID(key),
        before: before[key],
        after: after[key],
        options,
      }))
      .flatten()
      .value()
  }

  if (_.isArray(before) && _.isArray(after)) {
    if (options?.compareListItems) {
      return compareListWithOrderMatching({ id, before, after, beforeId, afterId, options })
    }
    // If there is an addition or deletion in the list we treat the whole list as changed
    // This is because we cannot serialize addition / deletion from a list properly
    if (before.length === after.length) {
      return _.flatten(
        _.times(before.length).map(
          i => getValuesChanges({
            id: id.createNestedID(i.toString()),
            before: before[i],
            after: after[i],
            beforeId: beforeId?.createNestedID(i.toString()),
            afterId: afterId?.createNestedID(i.toString()),
            options,
          })
        )
      )
    }
  }
  return [{
    id,
    action: 'modify',
    data: { before, after },
    elemIDs: { before: beforeId, after: afterId },
  }]
}

/**
 * Create detailed changes for annotationType, by using elemID.isEqual.
 *
 * We treat change only for annotationType that exist only in one value:
 *   - If the annotation Type exist in before the action will be remove.
 *   - If the annotation Type exist in after the action will be add.
 *
 * Change in the the annotationType value (in the inner annotations or fields) when the
 * annotationType exists in both (before & after) will not consider as change.
 *
 */
const getAnnotationTypeChanges = ({
  id, before, after, beforeId, afterId,
}: {
  id: ElemID
  before: Value
  after: Value
  beforeId: ElemID
  afterId: ElemID
}): DetailedChange[] => {
  const hasAnnotationTypes = (elem: ChangeDataType): elem is ObjectType | PrimitiveType =>
    isObjectType(elem) || isPrimitiveType(elem)

  // Return only annotationTypes that exists in val and not exists in otherVal.
  const returnOnlyAnnotationTypesDiff = (
    val: Value,
    otherVal: Value
  ): Value => _.pickBy(val.annotationRefTypes,
    (annotationRefType, annotationName) =>
      !(otherVal.annotationRefTypes[annotationName]?.elemID.isEqual(annotationRefType.elemID)))

  if (hasAnnotationTypes(before) && hasAnnotationTypes(after)) {
    const beforeUniqueAnnotationsTypes = returnOnlyAnnotationTypesDiff(before, after)
    const afterUniqueAnnotationsTypes = returnOnlyAnnotationTypesDiff(after, before)

    // Calling getValuesChanges with unique annotationTypes
    return getValuesChanges({
      id: id.createNestedID('annotation'),
      beforeId: beforeId.createNestedID('annotation'),
      afterId: afterId.createNestedID('annotation'),
      before: beforeUniqueAnnotationsTypes,
      after: afterUniqueAnnotationsTypes,
    })
  }
  return []
}

export type DetailedCompareOptions = CompareOptions & {
  createFieldChanges?: boolean
}

export const detailedCompare = (
  before: ChangeDataType,
  after: ChangeDataType,
  compareOptions?: DetailedCompareOptions
): DetailedChange[] => {
  const createFieldChanges = compareOptions?.createFieldChanges ?? false

  const getFieldsChanges = (beforeObj: ObjectType, afterObj: ObjectType): DetailedChange[] => {
    const removeChanges = Object.keys(beforeObj.fields)
      .filter(fieldName => afterObj.fields[fieldName] === undefined)
      .map(fieldName => ({
        action: 'remove' as const,
        id: beforeObj.fields[fieldName].elemID,
        data: { before: beforeObj.fields[fieldName] },
        elemIDs: { before: beforeObj.fields[fieldName].elemID },
      }))

    const addChanges = Object.keys(afterObj.fields)
      .filter(fieldName => beforeObj.fields[fieldName] === undefined)
      .map(fieldName => ({
        action: 'add' as const,
        id: afterObj.fields[fieldName].elemID,
        data: { after: afterObj.fields[fieldName] },
        elemIDs: { after: afterObj.fields[fieldName].elemID },
      }))

    const modifyChanges = Object.keys(afterObj.fields)
      .filter(fieldName => beforeObj.fields[fieldName] !== undefined)
      .map(fieldName => detailedCompare(
        beforeObj.fields[fieldName],
        afterObj.fields[fieldName],
        compareOptions,
      ))

    return [
      ...removeChanges,
      ...addChanges,
      ..._.flatten(modifyChanges) as DetailedChange[],
    ]
  }

  // A special case to handle type changes in fields, we have to modify the whole field
  if (isField(before) && isField(after) && !before.refType.elemID.isEqual(after.refType.elemID)) {
    return [{
      action: 'modify',
      id: after.elemID,
      data: { before, after },
      elemIDs: { before: before.elemID, after: after.elemID },
    }]
  }

  const valueChanges = isInstanceElement(before) && isInstanceElement(after)
    ? getValuesChanges({
      id: after.elemID,
      beforeId: before.elemID,
      afterId: after.elemID,
      before: before.value,
      after: after.value,
      options: compareOptions,
    })
    : []

  // A special case to handle changes in annotationType.
  const annotationTypeChanges = getAnnotationTypeChanges({
    id: after.elemID,
    beforeId: before.elemID,
    afterId: after.elemID,
    before,
    after,
  })

  const afterAttrId = isType(after) ? after.elemID.createNestedID('attr') : after.elemID
  const beforeAttrId = isType(before) ? before.elemID.createNestedID('attr') : before.elemID
  const annotationChanges = getValuesChanges({
    id: afterAttrId,
    beforeId: beforeAttrId,
    afterId: afterAttrId,
    before: before.annotations,
    after: after.annotations,
    options: compareOptions,
  })

  const fieldChanges = createFieldChanges && isObjectType(before) && isObjectType(after)
    ? getFieldsChanges(before, after)
    : []
  return [...annotationTypeChanges, ...annotationChanges, ...fieldChanges, ...valueChanges]
}

const getElementChangeId = (
  element: Element,
  id: ElemID
): ElemID => {
  // When the name is CONFIG_NAME it is omitted from getFullNameParts
  const elementIdSize = element.elemID.name === ElemID.CONFIG_NAME
    ? element.elemID.getFullNameParts().length + 1
    : element.elemID.getFullNameParts().length
  // Account for the possibility that the comparison was between two different elements
  // in that case we cannot simply use the after ID, we have to use the relative path
  const relativeId = id.getFullNameParts().splice(elementIdSize)
  return relativeId.length !== 0
    ? element.elemID.createNestedID(...relativeId)
    : element.elemID
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
const applyListChanges = (element: ChangeDataType, changes: DetailedChange[]): void => {
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

const isOrderChange = (change: DetailedChange): boolean => (
  isIndexPathPart(change.id.name)
  && isIndexPathPart(change.elemIDs?.before?.name ?? '')
  && isIndexPathPart(change.elemIDs?.after?.name ?? '')
    && Number(change.elemIDs?.before?.name) !== Number(change.elemIDs?.after?.name)
)

const filterChangesForApply = (changes: DetailedChange[]): DetailedChange[] => {
  // For performance, avoiding the sort of no need to filter
  if (changes.every(change => !isOrderChange(change))) {
    return changes
  }
  const sortedChanges = _.sortBy(changes, change => change.id.getFullName())
  let lastId = sortedChanges[0].id
  return sortedChanges.filter(change => {
    const skip = lastId.isParentOf(change.id)
    if (!skip) {
      lastId = change.id
    }
    return !skip
  })
}

export const applyDetailedChanges = (
  element: ChangeDataType,
  detailedChanges: DetailedChange[],
): void => {
  const changesToApply = filterChangesForApply(detailedChanges)
  const [listItemChanges, otherChanges] = _.partition(changesToApply, change =>
    isIndexPathPart(change.id.name))

  otherChanges.forEach(detailedChange => {
    const id = isRemovalChange(detailedChange)
      ? detailedChange.elemIDs?.before ?? detailedChange.id
      : detailedChange.elemIDs?.after ?? detailedChange.id
    const data = isRemovalChange(detailedChange) ? undefined : detailedChange.data.after
    setPath(element, getElementChangeId(element, id), data)
  })

  _(listItemChanges)
    .groupBy(change => change.id.createParentID().getFullName())
    .forEach(changes => {
      applyListChanges(element, changes)
    })
}
