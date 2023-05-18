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
import { collections } from '@salto-io/lowerdash'
import {
  Change,
  Field, getAllChangeData,
  getChangeData, isAdditionChange,
  isAdditionOrModificationChange,
  isField,
  isFieldChange,
  isModificationChange,
  isObjectType,
  isObjectTypeChange,
  ModificationChange,
  ObjectType,
  ReferenceExpression,
  toChange,
} from '@salto-io/adapter-api'
import { LocalFilterCreator } from '../filter'
import { isCustomObject, isFieldOfCustomObject } from '../transformers/transformer'
import {
  FIELD_ANNOTATIONS,
  HISTORY_TRACKED_FIELDS,
  OBJECT_HISTORY_TRACKING_ENABLED,
} from '../constants'

const { awu } = collections.asynciterable

const isHistoryTrackingEnabled = (type: ObjectType): boolean => (
  type.annotations[OBJECT_HISTORY_TRACKING_ENABLED] === true
)

const trackedFields = (type: ObjectType | undefined): string[] => (
  Object.keys(type?.annotations[HISTORY_TRACKED_FIELDS] ?? {})
)

const isHistoryTrackedField = (field: Field): boolean => (
  (field.annotations[FIELD_ANNOTATIONS.TRACK_HISTORY] === true)
  || trackedFields(field.parent).includes(field.name)
)
const deleteFieldHistoryTrackingAnnotation = (field: Field): void => {
  if (field !== undefined) {
    delete field.annotations[FIELD_ANNOTATIONS.TRACK_HISTORY]
  }
}

const centralizeHistoryTrackingAnnotations = (customObject: ObjectType): void => {
  if (isHistoryTrackingEnabled(customObject)) {
    customObject.annotations[HISTORY_TRACKED_FIELDS] = _.mapValues(
      _.pickBy(customObject.fields, isHistoryTrackedField),
      field => new ReferenceExpression(field.elemID),
    )
  }

  Object.values(customObject.fields).forEach(deleteFieldHistoryTrackingAnnotation)
}

const fieldHistoryTrackingChanged = (
  field: Field,
  objectTypeChange: ModificationChange<ObjectType>
): boolean => {
  const [typeBefore, typeAfter] = getAllChangeData(objectTypeChange)
  const trackedBefore = Object.keys(typeBefore.annotations[HISTORY_TRACKED_FIELDS] ?? {}).includes(field.name)
  const trackedAfter = Object.keys(typeAfter.annotations[HISTORY_TRACKED_FIELDS] ?? {}).includes(field.name)
  const existsAfter = field.name in typeAfter.fields
  return existsAfter && (trackedBefore !== trackedAfter)
}

const createHistoryTrackingFieldChange = (
  field: Field,
  objectTypeChange: ModificationChange<ObjectType>
): Change<Field> => {
  const [typeBefore, typeAfter] = getAllChangeData(objectTypeChange)
  const trackedBefore = Object.keys(typeBefore.annotations[HISTORY_TRACKED_FIELDS] ?? {}).includes(field.name)
  const trackedAfter = Object.keys(typeAfter.annotations[HISTORY_TRACKED_FIELDS] ?? {}).includes(field.name)

  const fieldBefore = field.clone()
  const fieldAfter = field.clone()
  if (!trackedBefore && trackedAfter) {
    // field was added to the annotations
    fieldBefore.annotations[FIELD_ANNOTATIONS.TRACK_HISTORY] = false
    fieldAfter.annotations[FIELD_ANNOTATIONS.TRACK_HISTORY] = true
  } else {
    // field was removed from the annotations
    fieldBefore.annotations[FIELD_ANNOTATIONS.TRACK_HISTORY] = true
    fieldAfter.annotations[FIELD_ANNOTATIONS.TRACK_HISTORY] = false
  }

  return toChange({ before: fieldBefore, after: fieldAfter })
}

/**
 * Note: we assume this filter runs *after* custom objects are turned into types (custom_object_to_object_type) but
 * *before* these types are split up into different elements (custom_type_split)
 * */
const filter: LocalFilterCreator = () => {
  let fieldsWithSyntheticChanges: Set<string> = new Set()
  return {
    name: 'centralizeTrackingInfo',
    onFetch: async elements => {
      await awu(elements)
        .filter(isObjectType)
        .filter(isCustomObject)
        .forEach(centralizeHistoryTrackingAnnotations)
    },
    preDeploy: async changes => {
      const distributeTrackingInfo = async (objType: ObjectType): Promise<void> => {
        if (!isHistoryTrackingEnabled(objType)) {
          return
        }

        Object.values(objType.fields)
          .forEach(field => {
            field.annotations[FIELD_ANNOTATIONS.TRACK_HISTORY] = isHistoryTrackedField(field)
          })
      }

      // Added object types - set the annotations on the type and its fields
      await awu(changes)
        .filter(isAdditionChange)
        .filter(isObjectTypeChange)
        .filter(change => isCustomObject(getChangeData(change)))
        .map(getChangeData)
        .forEach(distributeTrackingInfo)

      // Added or modified fields - set the annotations on the fields
      const fieldsThatChanged = await awu(changes)
        .filter(isAdditionOrModificationChange)
        .map(getChangeData)
        .filter(isField)
        .filter(isFieldOfCustomObject)
        .toArray()

      fieldsThatChanged.forEach(field => {
        field.annotations[FIELD_ANNOTATIONS.TRACK_HISTORY] = isHistoryTrackedField(field)
      })
      const namesOfFieldsThatChanged = new Set(fieldsThatChanged.map(field => field.elemID.getFullName()))

      // Existing object types that changed
      const modifiedObjectTypes = await awu(changes)
        .filter(isObjectTypeChange)
        .filter(isModificationChange)
        .filter(change => isCustomObject(getChangeData(change)))
        .toArray()

      //  - set the annotations on the type and its fields
      modifiedObjectTypes
        .map(getChangeData)
        .forEach(distributeTrackingInfo)

      //  - if the list of tracked fields changed, create field changes that represent the changes to the trackHistory
      //    annotations. We only create such changes if we don't already have an unrelated change for this field (in
      //    which case we handled it above)
      const additionalChanges = modifiedObjectTypes.flatMap(change => (
        Object.values(getChangeData(change).fields)
          .filter(field => !namesOfFieldsThatChanged.has(field.elemID.getFullName()))
          .filter(field => fieldHistoryTrackingChanged(field, change))
          .map(field => createHistoryTrackingFieldChange(field, change))
      ))

      fieldsWithSyntheticChanges = new Set(
        additionalChanges
          .map(getChangeData)
          .map(field => field.elemID.getFullName())
      )

      additionalChanges.forEach(change => changes.push(change))

      // Finally, remove the 'historyTrackedFields' annotation from all object types (either added or changed)
      changes
        .filter(isAdditionOrModificationChange)
        .filter(isObjectTypeChange)
        .map(getChangeData)
        .filter(isCustomObject)
        .forEach(objType => {
          delete objType.annotations[HISTORY_TRACKED_FIELDS]
        })
    },
    onDeploy: async changes => {
      const isSyntheticChangeFromPreDeploy = (change: Change): boolean => (
        isFieldChange(change)
        && isModificationChange(change)
        && fieldsWithSyntheticChanges.has(getChangeData(change).elemID.getFullName())
      )

      // We want to make sure we remove the changes we created in preDeploy
      _.remove(changes, change => isSyntheticChangeFromPreDeploy(change))

      await awu(changes)
        .filter(isAdditionOrModificationChange)
        .filter(isObjectTypeChange)
        .map(getChangeData)
        .filter(isCustomObject)
        .forEach(centralizeHistoryTrackingAnnotations)

      await awu(changes)
        .filter(isFieldChange)
        .filter(change => isFieldOfCustomObject(getChangeData(change)))
        .forEach(change => {
          const [before, after] = getAllChangeData(change)
          deleteFieldHistoryTrackingAnnotation(before)
          deleteFieldHistoryTrackingAnnotation(after)
        })
    },
  }
}

export default filter
