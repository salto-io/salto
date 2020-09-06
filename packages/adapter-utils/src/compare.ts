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
import {
  ChangeDataType, DetailedChange, isField, isListType, isInstanceElement,
  ElemID, Value, ObjectType, PrimitiveType, isObjectType, isPrimitiveType,
  isEqualElements, isEqualValues, isRemovalChange,
} from '@salto-io/adapter-api'
import { setPath } from './utils'

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

export const detailedCompare = (
  before: ChangeDataType,
  after: ChangeDataType,
  createFieldChanges = false
): DetailedChange[] => {
  const getFieldsChanges = (beforeObj: ObjectType, afterObj: ObjectType): DetailedChange[] => {
    const removeChanges = Object.keys(beforeObj.fields)
      .filter(fieldName => afterObj.fields[fieldName] === undefined)
      .map(fieldName => ({
        action: 'remove',
        data: { before: beforeObj.fields[fieldName] },
        id: beforeObj.fields[fieldName].elemID,
      })) as DetailedChange[]

    const addChanges = Object.keys(afterObj.fields)
      .filter(fieldName => beforeObj.fields[fieldName] === undefined)
      .map(fieldName => ({
        action: 'add',
        data: { after: afterObj.fields[fieldName] },
        id: afterObj.fields[fieldName].elemID,
      })) as DetailedChange[]

    const modifyChanges = Object.keys(afterObj.fields)
      .filter(fieldName => beforeObj.fields[fieldName] !== undefined)
      .map(fieldName => detailedCompare(beforeObj.fields[fieldName], afterObj.fields[fieldName]))

    return [
      ...removeChanges,
      ...addChanges,
      ..._.flatten(modifyChanges) as DetailedChange[],
    ]
  }

  // A special case to handle isList changes in fields.
  // should only happen if we misidentified the type
  // in fetch. See SALTO-322
  if (isField(before)
      && isField(after)
      && isListType(after.type) !== isListType(before.type)) {
    return [{ action: 'modify', data: { before, after }, id: after.elemID }]
  }

  if (isInstanceElement(before) && isInstanceElement(after)) {
    return getValuesChanges(after.elemID, before.value, after.value)
  }

  // A special case to handle changes in annotationType.
  const annotationTypeChanges = getAnnotationTypeChanges(
    after.elemID,
    before,
    after
  )

  const annotationChanges = getValuesChanges(
    after.elemID.isTopLevel() ? after.elemID.createNestedID('attr') : after.elemID,
    before.annotations, after.annotations
  )

  const fieldChanges = createFieldChanges && isObjectType(before) && isObjectType(after)
    ? getFieldsChanges(before, after)
    : []
  return [...annotationTypeChanges, ...annotationChanges, ...fieldChanges]
}

export const applyDetailedChanges = (
  planElement: ChangeDataType,
  detailedChanges: DetailedChange[],
): void => {
  detailedChanges.forEach(detailedChange => {
    const data = isRemovalChange(detailedChange) ? undefined : detailedChange.data.after
    setPath(planElement, detailedChange.id, data)
  })
}
