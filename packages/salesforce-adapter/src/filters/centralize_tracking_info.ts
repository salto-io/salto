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
  FEED_HISTORY_TRACKED_FIELDS,
  OBJECT_HISTORY_TRACKING_ENABLED,
  OBJECT_FEED_HISTORY_TRACKING_ENABLED,
} from '../constants'

const { awu } = collections.asynciterable


type TrackedFieldsDefinition = {
  objectLevelEnable: string
  fieldLevelEnable: string
  aggregate: string
}

const trackedFieldsDefinitions: TrackedFieldsDefinition[] = [
  {
    objectLevelEnable: OBJECT_HISTORY_TRACKING_ENABLED,
    fieldLevelEnable: FIELD_ANNOTATIONS.TRACK_HISTORY,
    aggregate: HISTORY_TRACKED_FIELDS,
  },
  {
    objectLevelEnable: OBJECT_FEED_HISTORY_TRACKING_ENABLED,
    fieldLevelEnable: FIELD_ANNOTATIONS.TRACK_FEED_HISTORY,
    aggregate: FEED_HISTORY_TRACKED_FIELDS,
  },
]

const isHistoryTrackingEnabled = (type: ObjectType, trackingDef: TrackedFieldsDefinition): boolean => (
  type.annotations[trackingDef.objectLevelEnable] === true
)

const trackedFields = (type: ObjectType | undefined, trackingDef: TrackedFieldsDefinition): string[] => (
  Object.keys(type?.annotations[trackingDef.aggregate] ?? {})
)

const isHistoryTrackedField = (field: Field, trackingDef: TrackedFieldsDefinition): boolean => (
  (field.annotations[trackingDef.fieldLevelEnable] === true)
  || trackedFields(field.parent, trackingDef).includes(field.name)
)

const deleteFieldHistoryTrackingAnnotation = (field: Field, trackingDef: TrackedFieldsDefinition): void => {
  if (field !== undefined) {
    delete field.annotations[trackingDef.fieldLevelEnable]
  }
}

const centralizeHistoryTrackingAnnotations = (customObject: ObjectType, trackingDef: TrackedFieldsDefinition): void => {
  if (isHistoryTrackingEnabled(customObject, trackingDef)) {
    customObject.annotations[trackingDef.aggregate] = _.mapValues(
      _.pickBy(customObject.fields, field => isHistoryTrackedField(field, trackingDef)),
      field => new ReferenceExpression(field.elemID),
    )
  }

  Object.values(customObject.fields).forEach(field => deleteFieldHistoryTrackingAnnotation(field, trackingDef))
}

const fieldHistoryTrackingChanged = (
  field: Field,
  objectTypeChange: ModificationChange<ObjectType>,
  trackingDef: TrackedFieldsDefinition,
): boolean => {
  const [typeBefore, typeAfter] = getAllChangeData(objectTypeChange)
  const trackedBefore = Object.keys(typeBefore.annotations[trackingDef.aggregate] ?? {}).includes(field.name)
  const trackedAfter = Object.keys(typeAfter.annotations[trackingDef.aggregate] ?? {}).includes(field.name)
  const existsAfter = field.name in typeAfter.fields
  return existsAfter && (trackedBefore !== trackedAfter)
}

const createHistoryTrackingFieldChange = (
  field: Field,
  objectTypeChange: ModificationChange<ObjectType>,
  trackingDef: TrackedFieldsDefinition,
): Change<Field> => {
  const [typeBefore, typeAfter] = getAllChangeData(objectTypeChange)
  const trackedBefore = Object.keys(typeBefore.annotations[trackingDef.aggregate] ?? {}).includes(field.name)
  const trackedAfter = Object.keys(typeAfter.annotations[trackingDef.aggregate] ?? {}).includes(field.name)

  const fieldBefore = field.clone()
  const fieldAfter = field.clone()
  if (!trackedBefore && trackedAfter) {
    // field was added to the annotations
    fieldBefore.annotations[trackingDef.fieldLevelEnable] = false
    fieldAfter.annotations[trackingDef.fieldLevelEnable] = true
  } else {
    // field was removed from the annotations
    fieldBefore.annotations[trackingDef.fieldLevelEnable] = true
    fieldAfter.annotations[trackingDef.fieldLevelEnable] = false
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
      trackedFieldsDefinitions.forEach(
        trackingDef => elements
          .filter(isObjectType)
          .filter(isCustomObject)
          .forEach(objType => centralizeHistoryTrackingAnnotations(objType, trackingDef))
      )
    },
    preDeploy: async changes => {
      const distributeTrackingInfo = (
        objType: ObjectType,
        trackingDef: TrackedFieldsDefinition
      ): void => {
        if (!isHistoryTrackingEnabled(objType, trackingDef)) {
          return
        }

        Object.values(objType.fields)
          .forEach(field => {
            field.annotations[trackingDef.fieldLevelEnable] = isHistoryTrackedField(field, trackingDef)
          })
      }

      const distributeTrackingInfoInAddedObjectTypes = async (trackingDef: TrackedFieldsDefinition): Promise<void> => {
        await awu(changes)
          .filter(isAdditionChange)
          .filter(isObjectTypeChange)
          .filter(change => isCustomObject(getChangeData(change)))
          .map(getChangeData)
          .forEach(objType => distributeTrackingInfo(objType, trackingDef))
      }

      const updateAnnotationsOnChangedFields = async (trackingDef: TrackedFieldsDefinition): Promise<string[]> => {
        const fieldsThatChanged = await awu(changes)
          .filter(isAdditionOrModificationChange)
          .map(getChangeData)
          .filter(isField)
          .filter(isFieldOfCustomObject)
          .toArray()

        fieldsThatChanged.forEach(field => {
          field.annotations[trackingDef.fieldLevelEnable] = isHistoryTrackedField(field, trackingDef)
        })

        return fieldsThatChanged.map(field => field.elemID.getFullName())
      }

      const distributeTrackingInfoInModifiedObjectTypes = async (
        trackingDef: TrackedFieldsDefinition,
        namesOfFieldsThatChanged: Set<string>,
      ): Promise<Change[]> => {
        const modifiedObjectTypes = await awu(changes)
          .filter(isObjectTypeChange)
          .filter(isModificationChange)
          .filter(change => isCustomObject(getChangeData(change)))
          .toArray()

        //  - set the annotations on the type and its fields
        modifiedObjectTypes
          .map(getChangeData)
          .forEach(objType => distributeTrackingInfo(objType, trackingDef))

        //  - if the list of tracked fields changed, create field changes that represent the changes to the trackHistory
        //    annotations. We only create such changes if we don't already have an unrelated change for this field (in
        //    which case we handled it above)
        const additionalChanges = modifiedObjectTypes.flatMap(change => (
          Object.values(getChangeData(change).fields)
            .filter(field => !namesOfFieldsThatChanged.has(field.elemID.getFullName()))
            .filter(field => fieldHistoryTrackingChanged(field, change, trackingDef))
            .map(field => createHistoryTrackingFieldChange(field, change, trackingDef))
        ))

        additionalChanges
          .map(getChangeData)
          .map(field => field.elemID.getFullName())
          .forEach(name => fieldsWithSyntheticChanges.add(name))

        return additionalChanges
      }

      fieldsWithSyntheticChanges = new Set()
      const additionalChanges: Change[] = []
      await awu(trackedFieldsDefinitions)
        .forEach(async trackingDef => {
          // Added object types - set the annotations on the type and its fields
          await distributeTrackingInfoInAddedObjectTypes(trackingDef)

          // Added or modified fields - set the annotations on the fields
          const namesOfFieldsThatChanged = new Set(await updateAnnotationsOnChangedFields(trackingDef))

          // Existing object types that changed
          const fieldChanges = await distributeTrackingInfoInModifiedObjectTypes(trackingDef, namesOfFieldsThatChanged)
          fieldChanges.forEach(change => additionalChanges.push(change))

          // Finally, remove the aggregate annotation from all object types (either added or changed)
          changes
            .filter(isAdditionOrModificationChange)
            .filter(isObjectTypeChange)
            .map(getChangeData)
            .filter(isCustomObject)
            .forEach(objType => {
              delete objType.annotations[trackingDef.aggregate]
            })
        })

      additionalChanges.forEach(change => changes.push(change))
    },
    onDeploy: async changes => {
      const isSyntheticChangeFromPreDeploy = (change: Change): boolean => (
        isFieldChange(change)
        && isModificationChange(change)
        && fieldsWithSyntheticChanges.has(getChangeData(change).elemID.getFullName())
      )

      // We want to make sure we remove the changes we created in preDeploy
      _.remove(changes, change => isSyntheticChangeFromPreDeploy(change))

      await awu(trackedFieldsDefinitions).forEach(async trackingDef => {
        await awu(changes)
          .filter(isAdditionOrModificationChange)
          .filter(isObjectTypeChange)
          .map(getChangeData)
          .filter(isCustomObject)
          .forEach(objType => centralizeHistoryTrackingAnnotations(objType, trackingDef))

        await awu(changes)
          .filter(isFieldChange)
          .filter(change => isFieldOfCustomObject(getChangeData(change)))
          .forEach(change => {
            const [before, after] = getAllChangeData(change)
            deleteFieldHistoryTrackingAnnotation(before, trackingDef)
            deleteFieldHistoryTrackingAnnotation(after, trackingDef)
          })
      })
    },
  }
}

export default filter
