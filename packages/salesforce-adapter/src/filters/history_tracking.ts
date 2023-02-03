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
import { collections, values as valueUtils } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { Change, Field, getChangeData, isAdditionOrModificationChange, isField, isModificationChange,
  isObjectType, isObjectTypeChange, ObjectType, toChange } from '@salto-io/adapter-api'
import { LocalFilterCreator } from '../filter'
import { apiName, isCustomObject, isFieldOfCustomObject } from '../transformers/transformer'
import { FIELD_HISTORY_TRACKING_ENABLED, HISTORY_TRACKED_FIELDS, OBJECT_HISTORY_TRACKING_ENABLED } from '../constants'

const { awu } = collections.asynciterable
const log = logger(module)

const trackedFields = (type: ObjectType): string[] => type.annotations[HISTORY_TRACKED_FIELDS] ?? []

const isHistoryTrackingEnabled = (type: ObjectType): boolean => (
  !!type.annotations[OBJECT_HISTORY_TRACKING_ENABLED]
  || type.annotations[HISTORY_TRACKED_FIELDS] !== undefined
)

const centralizeHistoryTrackingAnnotations = async (customObject: ObjectType): Promise<void> => {
  if (!isHistoryTrackingEnabled(customObject)) {
    delete customObject.annotations[OBJECT_HISTORY_TRACKING_ENABLED]
    return
  }

  customObject.annotations[HISTORY_TRACKED_FIELDS] = (await awu(Object.values(customObject.fields))
    .filter(field => !!field.annotations.trackHistory)
    .map(field => apiName(field))
    .toArray())
    .sort()

  Object.values(customObject.fields).forEach(field => delete field.annotations.trackHistory)
  delete customObject.annotations[OBJECT_HISTORY_TRACKING_ENABLED]
}

const distributeHistoryTrackingAnnotations = async (field: Field): Promise<void> => {
  if (!isHistoryTrackingEnabled(field.parent)) {
    return
  }

  field.annotations[FIELD_HISTORY_TRACKING_ENABLED] = trackedFields(field.parent).includes(await apiName(field))
}

const createFieldChanges = (typeBefore: ObjectType,
  typeAfter: ObjectType,
  addedTrackedFields: string[],
  removedTrackedFields: string[],
  fieldsToIgnore: string[]): Change<Field>[] => {
  const shouldProcessField = (fieldName: string): boolean => (
    !fieldsToIgnore.includes(fieldName)
  )
  const fieldByApiName = (type: ObjectType, name: string): Field | undefined => (
    Object.values(type.fields).find(async fieldDef => (await apiName(fieldDef)) === name)
  )
  const historyTrackingAddedChange = (fieldName: string): Change<Field> | undefined => {
    const before = fieldByApiName(typeBefore, fieldName)?.clone()
    const after = fieldByApiName(typeAfter, fieldName)?.clone()
    if (after === undefined) {
      log.error('The field %o was added to %o\'s history tracking, but does not exist', fieldName, typeAfter.elemID.getFullName())
      return undefined
    }
    if (before === undefined) {
      // The field was added, so it will be handled in the field's AdditionChange
      return undefined
    }

    before.annotations[FIELD_HISTORY_TRACKING_ENABLED] = false
    after.annotations[FIELD_HISTORY_TRACKING_ENABLED] = true
    return toChange({ before, after })
  }

  const historyTrackingRemovedChange = (fieldName: string): Change<Field> | undefined => {
    const before = fieldByApiName(typeBefore, fieldName)?.clone()
    const after = fieldByApiName(typeAfter, fieldName)?.clone()
    if (before !== undefined) {
      log.warn('The field %o was removed from %o\'s history tracking, but did not exist', fieldName, typeAfter.elemID.getFullName())
      before.annotations[FIELD_HISTORY_TRACKING_ENABLED] = true
    }
    if (after === undefined) {
      // the field was removed from the object, no need to add a change beyond the RemovalChange that already exists
      return undefined
    }
    after.annotations[FIELD_HISTORY_TRACKING_ENABLED] = false
    return toChange({ before, after })
  }

  return [
    ...addedTrackedFields
      .filter(shouldProcessField)
      .map(fieldName => historyTrackingAddedChange(fieldName))
      .filter(valueUtils.isDefined),
    ...removedTrackedFields
      .filter(shouldProcessField)
      .map(fieldName => historyTrackingRemovedChange(fieldName))
      .filter(valueUtils.isDefined),
  ]
}

/**
 * Note: we assume this filter runs *after* custom objects are turned into types (custom_object_to_object_type) but
 * *before* these types are split up into different elements (custom_type_split)
 * */
const filter: LocalFilterCreator = () => ({
  onFetch: async elements => {
    await awu(elements)
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

    const objectTypeChanges = changes
      .filter(isAdditionOrModificationChange)
      .filter(isObjectTypeChange)

    // 1. For all CustomObjects, set the correct 'enableHistory' value
    objectTypeChanges
      .map(getChangeData)
      .forEach(objType => {
        objType.annotations[OBJECT_HISTORY_TRACKING_ENABLED] = isHistoryTrackingEnabled(objType)
      })

    // 2. For all changed fields, make sure they have the expected 'trackHistory' value
    await awu(changedCustomObjectFields)
      .forEach(distributeHistoryTrackingAnnotations)

    // 3. If an object's historyTrackedFields changed:
    //  3.1 for every field that was added/removed in historyTrackedFields:
    //    3.1.1 If there already is a change to the field, it was handled by (1)
    //    3.1.2 Else if the field was added:
    //      3.1.2.1 create a new change where the 'before' part is the field from the object and the 'after' part is
    //              the same field with trackHistory=true
    //    3.1.3 Else if the field was removed:
    //    3.1.3.1 create a new change where the 'before' part is the field from the object with trackHistory=true and
    //            the 'after' part is the field from the object
    // Note: if an object was added we assume we'll get an AdditionChange for every one of its fields, so that case will
    //       be handled in (1)

    const changedFieldNames = await awu(changedCustomObjectFields).map(field => apiName(field)).toArray()
    const additionalChanges = objectTypeChanges
      .filter(isModificationChange)
      .map((change):{typeBefore: ObjectType; typeAfter: ObjectType; added: string[]; removed: string[]} => (
        {
          typeBefore: change.data.before,
          typeAfter: getChangeData(change),
          added: _.difference(trackedFields(change.data.after), trackedFields(change.data.before)),
          removed: _.difference(trackedFields(change.data.before), trackedFields(change.data.after)),
        }
      ))
      .filter(({ added, removed }) => (added.length > 0 || removed.length > 0))
      .flatMap(({ typeBefore, typeAfter, added, removed }) => (
        createFieldChanges(typeBefore, typeAfter, added, removed, changedFieldNames)
      ))

    // 4. Remove the 'historyTrackedFields' annotation from all objects
    objectTypeChanges
      .map(getChangeData)
      .forEach(objType => {
        delete objType.annotations[HISTORY_TRACKED_FIELDS]
      })
    changes.push(...additionalChanges)
  },
})

export default filter
