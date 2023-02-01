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
import { Change, ElemID, Field, getChangeData, isAdditionOrModificationChange, isField, isModificationChange,
  isObjectType, isObjectTypeChange, ObjectType, toChange } from '@salto-io/adapter-api'
import { LocalFilterCreator } from '../filter'
import { isCustomObject, isFieldOfCustomObject } from '../transformers/transformer'
import { FIELD_HISTORY_TRACKING_ENABLED, HISTORY_TRACKED_FIELDS, OBJECT_HISTORY_TRACKING_ENABLED,
  SALESFORCE } from '../constants'

const trackedFields = (type: ObjectType): string[] => type.annotations[HISTORY_TRACKED_FIELDS] ?? []

const centralizeHistoryTrackingAnnotations = (customObject: ObjectType): void => {
  if (!customObject.annotations[OBJECT_HISTORY_TRACKING_ENABLED]) {
    return
  }

  customObject.annotations[HISTORY_TRACKED_FIELDS] = Object.values(customObject.fields)
    .filter(field => !!field.annotations.trackHistory)
    .map(field => field.name)
    .sort()

  Object.values(customObject.fields).forEach(field => delete field.annotations.trackHistory)
}

const distributeHistoryTrackingAnnotations = (field: Field): void => {
  if (!field.parent.annotations[OBJECT_HISTORY_TRACKING_ENABLED]) {
    return
  }

  field.annotations[FIELD_HISTORY_TRACKING_ENABLED] = trackedFields(field.parent).includes(field.name)
}

const createFieldChanges = (objType: ObjectType,
  addedTrackedFields: string[],
  removedTrackedFields: string[],
  fieldsToIgnore: ElemID[]): Change<Field>[] => {
  const shouldProcessField = (fieldName: string): boolean => (
    fieldsToIgnore.includes(new ElemID(SALESFORCE, objType.elemID.typeName, 'field', fieldName))
  )
  const historyTrackingAddedChange = (fieldName: string): Change<Field> => {
    const before = objType.fields[fieldName].clone()
    before.annotations[FIELD_HISTORY_TRACKING_ENABLED] = false
    const after = objType.fields[fieldName].clone()
    after.annotations[FIELD_HISTORY_TRACKING_ENABLED] = true
    return toChange({ before, after })
  }

  const historyTrackingRemovedChange = (fieldName: string): Change<Field> => {
    const before = objType.fields[fieldName].clone()
    before.annotations[FIELD_HISTORY_TRACKING_ENABLED] = true
    const after = objType.fields[fieldName].clone()
    after.annotations[FIELD_HISTORY_TRACKING_ENABLED] = false
    return toChange({ before, after })
  }

  return [
    ...addedTrackedFields.filter(shouldProcessField).map(fieldName => historyTrackingAddedChange(fieldName)),
    ...removedTrackedFields.filter(shouldProcessField).map(fieldName => historyTrackingRemovedChange(fieldName)),
  ]
}

/**
 * Note: we assume this filter runs *after* custom objects are turned into types (custom_object_to_object_type) but
 * *before* these types are split up into different elements (custom_type_split)
 * */
const filter: LocalFilterCreator = () => ({
  onFetch: async elements => {
    elements
      .filter(isObjectType)
      .filter(isCustomObject)
      .forEach(centralizeHistoryTrackingAnnotations)
  },
  preDeploy: async changes => {
    const changedCustomObjectFields = changes
      .filter(isAdditionOrModificationChange)
      .map(getChangeData)
      .filter(isField)
      .filter(isFieldOfCustomObject)

    // 1. If a field was changed, make sure it has the expected 'trackHistory' value
    changedCustomObjectFields
      .forEach(distributeHistoryTrackingAnnotations)
    // 2. If an object's historyTrackedFields changed:
    //  2.1 for every field that was added/removed in historyTrackedFields:
    //    2.1.1 If there already is a change to the field, it was handled by (1)
    //    2.1.2 Else if the field was added:
    //      2.1.2.1 create a new change where the 'before' part is the field from the object and the 'after' part is
    //              the same field with trackHistory=true
    //    2.1.3 Else if the field was removed:
    //    2.1.3.1 create a new change where the 'before' part is the field from the object with trackHistory=true and
    //            the 'after' part is the field from the object
    // Note: if an object was added we assume we'll get an AdditionChange for every one of its fields, so that case will
    //       be handled in (1)
    // Note: For now we don't handle the case where an object's enableHistory value changed but the appropriate change
    //       was not made to its historyTrackedFields annotations. This will be handled in a change validator
    const changedFieldNames = changedCustomObjectFields.map(field => field.elemID)
    const additionalChanges = changes
      .filter(isModificationChange)
      .filter(isObjectTypeChange)
      .map((change):{type: ObjectType; added: string[]; removed: string[]} => (
        {
          type: getChangeData(change),
          added: _.difference(trackedFields(change.data.after), trackedFields(change.data.before)),
          removed: _.difference(trackedFields(change.data.before), trackedFields(change.data.after)),
        }
      ))
      .filter(({ added, removed }) => (added.length > 0 || removed.length > 0))
      .flatMap(({ type, added, removed }) => createFieldChanges(type, added, removed, changedFieldNames))

    changes.push(...additionalChanges)
  },
})

export default filter
