/*
*                      Copyright 2020 Salto Labs Ltd.
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
import wu from 'wu'

import { NodeId, Group } from '@salto-io/dag'
import {
  ChangeDataType, Value, ElemID, Change, isEqualElements, isEqualValues, getChangeElement,
  Element, isField, isInstanceElement, isObjectType, isPrimitiveType, ObjectType, PrimitiveType,
  isListType, DetailedChange,
} from '@salto-io/adapter-api'
import { getOrCreateGroupLevelChange } from './group'

export type PlanItemId = NodeId
export type PlanItem = Group<Change> & {
  parent: () => Change
  changes: () => Iterable<Change>
  detailedChanges: () => Iterable<DetailedChange>
  getElementName: () => string
}

/**
 * Create detailed changes from change data (before and after values)
 */
const getValuesChanges = (id: ElemID, before: Value, after: Value): DetailedChange[] => {
  if (isEqualElements(before, after) || isEqualValues(before, after)) {
    return []
  }
  if (before === undefined) {
    return [{ id, action: 'add', data: { after } }]
  }
  if (after === undefined) {
    return [{ id, action: 'remove', data: { before } }]
  }
  if (_.isPlainObject(before) && _.isPlainObject(after)) {
    return _(before).keys()
      .union(_.keys(after))
      .map(key => getValuesChanges(id.createNestedID(key), before[key], after[key]))
      .flatten()
      .value()
  }
  if (_.isArray(before) && _.isArray(after)) {
    // If there is an addition or deletion in the list we treat the whole list as changed
    // This is because we cannot serialize addition / deletion from a list properly
    if (before.length === after.length) {
      return _.flatten(
        _.times(before.length).map(
          i => getValuesChanges(id.createNestedID(i.toString()), before[i], after[i])
        )
      )
    }
  }
  return [{ id, action: 'modify', data: { before, after } }]
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
const getAnnotationTypeChanges = (id: ElemID, before: Value, after: Value): DetailedChange[] => {
  const hasAnnotationTypes = (elem: ChangeDataType): elem is ObjectType | PrimitiveType =>
    isObjectType(elem) || isPrimitiveType(elem)

  // Return only annotationTypes that exists in val and not exists in otherVal.
  const returnOnlyAnnotationTypesDiff = (
    val: Value,
    otherVal: Value
  ): Value => _.pickBy(val.annotationTypes,
    (annotationType, annotationName) =>
      !(otherVal.annotationTypes[annotationName]?.elemID.isEqual(annotationType.elemID)))

  if (hasAnnotationTypes(before) && hasAnnotationTypes(after)) {
    const beforeUniqueAnnotationsTypes = returnOnlyAnnotationTypesDiff(before, after)
    const afterUniqueAnnotationsTypes = returnOnlyAnnotationTypesDiff(after, before)

    // Calling getValuesChanges with unique annotationTypes
    return getValuesChanges(
      id.createNestedID('annotation'),
      beforeUniqueAnnotationsTypes,
      afterUniqueAnnotationsTypes
    )
  }
  return []
}

export const addPlanItemAccessors = (
  group: Group<Change>,
  beforeElementsMap: Record<NodeId, Element>,
  afterElementsMap: Record<NodeId, Element>,
): PlanItem => Object.assign(group, {
  parent() {
    return getOrCreateGroupLevelChange(group, beforeElementsMap, afterElementsMap)
  },
  changes() {
    return group.items.values()
  },
  detailedChanges() {
    return wu(group.items.values())
      .map(change => {
        const elem = getChangeElement(change)
        if (change.action !== 'modify') {
          return { ...change, id: elem.elemID }
        }

        // A special case to handle isList changes in fields.
        // should only happen if we misidentified the type
        // in fetch. See SALTO-322
        if (isField(change.data.before)
          && isField(change.data.after)
          && isListType(change.data.after.type) !== isListType(change.data.before.type)) {
          return { ...change, id: elem.elemID }
        }

        if (isInstanceElement(change.data.before) && isInstanceElement(change.data.after)) {
          return getValuesChanges(elem.elemID, change.data.before.value, change.data.after.value)
        }

        // A special case to handle changes in annotationType.
        const annotationTypeChanges = getAnnotationTypeChanges(
          elem.elemID,
          change.data.before,
          change.data.after
        )

        const annotationChanges = getValuesChanges(
          elem.elemID.isTopLevel() ? elem.elemID.createNestedID('attr') : elem.elemID,
          change.data.before.annotations, change.data.after.annotations
        )
        return [...annotationTypeChanges, ...annotationChanges]
      })
      .flatten()
  },
  getElementName() {
    return getChangeElement(this.parent()).elemID.getFullName()
  },
})
