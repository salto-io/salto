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
import _ from 'lodash'
import {
  ChangeDataType, DetailedChange, isField, isInstanceElement, ElemID, Value, ObjectType, isType,
  PrimitiveType, isObjectType, isPrimitiveType, isEqualElements, isEqualValues, isRemovalChange,
  isElement,
  CompareOptions,
  isIndexPathPart, Change, getChangeData, Element,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { hash as hashUtils } from '@salto-io/lowerdash'
import { resolvePath, safeJsonStringify, setPath } from './utils'
import { applyListChanges, getArrayIndexMapping } from './list_comparison'

const log = logger(module)

export type DetailedCompareOptions = CompareOptions & {
  createFieldChanges?: boolean
  compareListItems?: boolean
}

const compareListWithOrderMatching = ({
  id, before, after, beforeId, afterId, options,
}: {
  id: ElemID
  before: Value
  after: Value
  beforeId: ElemID | undefined
  afterId: ElemID | undefined
  options: DetailedCompareOptions | undefined
}): DetailedChange[] => log.time(() => {
  const indexMapping = getArrayIndexMapping(before, after)

  const itemsChanges = _.flatten(
    indexMapping.map((item, changeIndex) => {
      const itemChangeId = id.createNestedID(changeIndex.toString())
      const itemBeforeId = item.beforeIndex !== undefined
        ? beforeId?.createNestedID(item.beforeIndex.toString())
        : undefined
      const itemAfterId = item.afterIndex !== undefined
        ? afterId?.createNestedID(item.afterIndex.toString())
        : undefined

      const itemBeforeValue = item.beforeIndex !== undefined ? before[item.beforeIndex] : undefined
      const itemAfterValue = item.afterIndex !== undefined ? after[item.afterIndex] : undefined
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
      if (item.beforeIndex !== item.afterIndex && !hasChangeDirectlyOnItem) {
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
}, `compareListWithOrderMatching - ${id.getFullName()}`)

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
  options?: DetailedCompareOptions
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
    // If compareListItems is false and there is an addition or deletion in the list we treat the whole list as changed
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

/**
 * This function returns if a change contains a moving of a item in a list for one index to another
*/
const isOrderChange = (change: DetailedChange): boolean => (
  isIndexPathPart(change.id.name)
  && isIndexPathPart(change.elemIDs?.before?.name ?? '')
  && isIndexPathPart(change.elemIDs?.after?.name ?? '')
    && Number(change.elemIDs?.before?.name) !== Number(change.elemIDs?.after?.name)
)

/**
 * When comparing lists with compareListItem, we might get a change about an item
 * in a list that moved from one index to another, and a change about an inner value
 * in that item that was changed. In that case we would want to ignore the inner change
 * since the item change already contains it.
 */
const filterChangesForApply = (changes: DetailedChange[]): DetailedChange[] => {
  // For performance, avoiding the sort if no need to filter
  if (changes.every(change => !isOrderChange(change))) {
    return changes
  }
  // The sort here is to make sure a change of inner values in list items
  // will appear after the change of the item itself.
  const sortedChanges = _.sortBy(changes, change => change.id.getFullNameParts())
  let lastId = sortedChanges[0].id
  return sortedChanges.filter(change => {
    const skip = lastId.isParentOf(change.id)
    if (!skip) {
      lastId = change.id
    }
    return !skip
  })
}


/**
 * Note: When working with list item changes, separating the changes between
 * multiple applyDetailedChanges calls might create different results.
 * E.g., if we have ['a', 'b', 'c'] with a removal change on the index 0 and index 1.
 * if we apply the together we will get ['c'], but if we apply them separately we will get ['b'].
 * So in order to get the expected results, all the detailed changes should be passed to this
 * function in a single call
 */
export const applyDetailedChanges = (
  element: ChangeDataType,
  detailedChanges: DetailedChange[],
): void => {
  const changesToApply = filterChangesForApply(detailedChanges)
  const [potentialListItemChanges, otherChanges] = _.partition(changesToApply, change =>
    isIndexPathPart(change.id.name))

  const potentialListItemGroups = _.groupBy(
    potentialListItemChanges,
    change => change.id.createParentID().getFullName()
  )

  const [realListItemGroup, otherGroups] = _.partition(
    Object.values(potentialListItemGroups),
    group => Array.isArray(resolvePath(element, group[0].id.createParentID()))
  )

  _(otherChanges).concat(otherGroups.flat()).forEach(detailedChange => {
    const id = isRemovalChange(detailedChange)
      ? detailedChange.elemIDs?.before ?? detailedChange.id
      : detailedChange.elemIDs?.after ?? detailedChange.id
    const data = isRemovalChange(detailedChange) ? undefined : detailedChange.data.after
    setPath(element, id.replaceParentId(element.elemID), data)
  })

  realListItemGroup.forEach(changes => {
    applyListChanges(element, changes)
  })
}
const sortChanges = (a: Change, b: Change): number =>
  getChangeData(a).elemID.getFullName().localeCompare(getChangeData(b).elemID.getFullName())

export const calculateChangesHash = (changes: ReadonlyArray<Change>): string =>
  hashUtils.toMD5(safeJsonStringify(Array.from(changes).sort(sortChanges)))

export const getRelevantNamesFromChange = (change: Change<Element>): string[] => {
  const element = getChangeData(change)
  const fieldsNames = isObjectType(element)
    ? element.getFieldsElemIDsFullName()
    : []
  return [element.elemID.getFullName(), ...fieldsNames]
}
