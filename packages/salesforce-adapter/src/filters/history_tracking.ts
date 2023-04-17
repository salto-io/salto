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
import { apiName, isCustomObject, isFieldOfCustomObject } from '../transformers/transformer'
import { FIELD_ANNOTATIONS, HISTORY_TRACKED_FIELDS, OBJECT_HISTORY_TRACKING_ENABLED } from '../constants'

const { awu, groupByAsync } = collections.asynciterable


const isHistoryTrackingEnabled = (type: ObjectType): boolean => (
  (type.annotations[OBJECT_HISTORY_TRACKING_ENABLED] === true)
  || (type.annotations[HISTORY_TRACKED_FIELDS] !== undefined)
)

const centralizeHistoryTrackingAnnotations = (customObject: ObjectType): void => {
  const trackingEnabled = isHistoryTrackingEnabled(customObject)
  delete customObject.annotations[OBJECT_HISTORY_TRACKING_ENABLED]

  if (!trackingEnabled) {
    return
  }

  customObject.annotations[HISTORY_TRACKED_FIELDS] = _(customObject.fields)
    .pickBy(field => (field.annotations[FIELD_ANNOTATIONS.TRACK_HISTORY] === true))
    .mapValues(field => (field !== undefined ? new ReferenceExpression(field.elemID) : undefined))
    .value()

  Object.values(customObject.fields).forEach(field => delete field.annotations[FIELD_ANNOTATIONS.TRACK_HISTORY])
}

const fieldHistoryTrackingChanged = async (
  field: Field,
  objectTypeChange: ModificationChange<ObjectType>
): Promise<boolean> => {
  const [typeBefore, typeAfter] = getAllChangeData(objectTypeChange)
  const fieldApiName = await apiName(field)
  const trackedBefore = Object.values(typeBefore.annotations[HISTORY_TRACKED_FIELDS] ?? {}).includes(fieldApiName)
  const trackedAfter = Object.values(typeAfter.annotations[HISTORY_TRACKED_FIELDS] ?? {}).includes(fieldApiName)
  const existedBefore = field.name in typeBefore.fields
  const existedAfter = field.name in typeAfter.fields
  return existedBefore && existedAfter && (trackedBefore !== trackedAfter)
}

const createHistoryTrackingFieldChange = async (
  field: Field,
  objectTypeChange: ModificationChange<ObjectType>
): Promise<Change<Field>> => {
  const [typeBefore, typeAfter] = getAllChangeData(objectTypeChange)
  const fieldApiName = await apiName(field)
  const trackedBefore = Object.values(typeBefore.annotations[HISTORY_TRACKED_FIELDS] ?? {}).includes(fieldApiName)
  const trackedAfter = Object.values(typeAfter.annotations[HISTORY_TRACKED_FIELDS] ?? {}).includes(fieldApiName)

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
  let objectTypesChangedInPreDeploy: Record<string, Change<ObjectType>[]> = {}
  return {
    name: 'history_tracking',
    onFetch: async elements => {
      await awu(elements)
        .filter(isObjectType)
        .filter(isCustomObject)
        .forEach(centralizeHistoryTrackingAnnotations)
    },
    preDeploy: async changes => {
      const trackedFields = (type: ObjectType): string[] => (
        // At this point the type will be resolved through getLookUpName so the annotation will have the apiName of the
        // field instead of the reference
        Object.values(type.annotations[HISTORY_TRACKED_FIELDS] ?? {})
      )

      const isHistoryTrackedField = async (field: Field): Promise<boolean> => (
        (field.annotations[FIELD_ANNOTATIONS.TRACK_HISTORY] === true)
        || trackedFields(field.parent).includes(await apiName(field))
      )

      const distributeTrackingInfo = async (objType: ObjectType): Promise<void> => {
        objType.annotations[OBJECT_HISTORY_TRACKING_ENABLED] = isHistoryTrackingEnabled(objType)
        await awu(Object.values(objType.fields))
          .filter(isHistoryTrackedField)
          .forEach(field => {
            field.annotations[FIELD_ANNOTATIONS.TRACK_HISTORY] = true
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
      await awu(changes)
        .filter(isAdditionOrModificationChange)
        .map(getChangeData)
        .filter(isField)
        .filter(isFieldOfCustomObject)
        .forEach(async field => {
          field.annotations[FIELD_ANNOTATIONS.TRACK_HISTORY] = await isHistoryTrackedField(field)
        })

      // Existing object types that changed
      const changedObjectTypes = await awu(changes)
        .filter(isObjectTypeChange)
        .filter(isModificationChange)
        .filter(change => isCustomObject(getChangeData(change)))
        .toArray()

      //  - if the list of tracked fields changed, create field changes that represent the changes to the trackHistory
      //    annotations
      const additionalChanges = await awu(changedObjectTypes)
        .flatMap(change => awu(Object.values(getChangeData(change).fields))
          .filter(field => fieldHistoryTrackingChanged(field, change))
          .map(field => createHistoryTrackingFieldChange(field, change)))
        .toArray()

      additionalChanges.forEach(change => changes.push(change))

      //  - now set the annotations on the type and its fields
      changedObjectTypes
        .map(getChangeData)
        .forEach(distributeTrackingInfo)

      // - and save the objects where the list of tracked fields changed, because if it's the *only* thing that changed
      //   we may not receive these changes in onDeploy (since we removed the HISTORY_TRACKED_FIELDS annotation).
      const actuallyChangedObjectTypes = changedObjectTypes
        .filter(change => {
          const [before, after] = getAllChangeData(change)
          return !_.isEqual(before?.annotations[HISTORY_TRACKED_FIELDS], after.annotations[HISTORY_TRACKED_FIELDS])
        })
      objectTypesChangedInPreDeploy = await groupByAsync(actuallyChangedObjectTypes,
        change => apiName(getChangeData(change)))

      // Finally, remove the 'historyTrackedFields' annotation from all object types (either added or changed)
      changes
        .filter(isAdditionOrModificationChange)
        .filter(isObjectTypeChange)
        .map(getChangeData)
        .forEach(objType => {
          delete objType.annotations[HISTORY_TRACKED_FIELDS]
        })
    },
    onDeploy: async changes => {
      const changedCustomObjects = changes
        .filter(isAdditionOrModificationChange)
        .filter(isObjectTypeChange)
        .map(getChangeData)
        .filter(isCustomObject)

      const onDeployObjectTypes = await awu(changedCustomObjects)
        .map(objType => apiName(objType))
        .toArray()
      const preDeployObjectTypes = Object.keys(objectTypesChangedInPreDeploy)

      _.difference(preDeployObjectTypes, onDeployObjectTypes)
        .forEach(objTypeApiName => {
          changes.push(...objectTypesChangedInPreDeploy[objTypeApiName])
          changedCustomObjects.push(...objectTypesChangedInPreDeploy[objTypeApiName].map(getChangeData))
        })

      changedCustomObjects
        .forEach(centralizeHistoryTrackingAnnotations)

      changes
        .filter(isFieldChange)
        .filter(change => isFieldOfCustomObject(getChangeData(change)))
        .forEach(change => {
          const [before, after] = getAllChangeData(change)
          if (before !== undefined) {
            delete before.annotations[FIELD_ANNOTATIONS.TRACK_HISTORY]
          }
          if (after !== undefined) {
            delete after.annotations[FIELD_ANNOTATIONS.TRACK_HISTORY]
          }
        })

      _.remove(changes, change => (
        isModificationChange(change)
        && isFieldChange(change)
        && isFieldOfCustomObject(getChangeData(change))
        && change.data.before.isEqual(change.data.after)
      ))
    },
  }
}

export default filter
