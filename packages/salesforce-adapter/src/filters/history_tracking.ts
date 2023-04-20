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
  Change, Element,
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
import { safeApiName } from './utils'

const { awu } = collections.asynciterable

const apiName = async (element: Element): Promise<string> => ((await safeApiName(element)) ?? '')

const isHistoryTrackingEnabled = (type: ObjectType): boolean => (
  (type.annotations[OBJECT_HISTORY_TRACKING_ENABLED] === true)
  || (type.annotations[HISTORY_TRACKED_FIELDS] !== undefined)
)

const centralizeHistoryTrackingAnnotations = (customObject: ObjectType): void => {
  if (!isHistoryTrackingEnabled(customObject)) {
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
  const trackedBefore = Object.keys(typeBefore.annotations[HISTORY_TRACKED_FIELDS] ?? {}).includes(field.name)
  const trackedAfter = Object.keys(typeAfter.annotations[HISTORY_TRACKED_FIELDS] ?? {}).includes(field.name)
  const existedBefore = field.name in typeBefore.fields
  const existedAfter = field.name in typeAfter.fields
  return existedBefore && existedAfter && (trackedBefore !== trackedAfter)
}

const createHistoryTrackingFieldChange = async (
  field: Field,
  objectTypeChange: ModificationChange<ObjectType>
): Promise<Change<Field>> => {
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
  let objectTypesChangedInPreDeploy: Record<string, ObjectType> = {}
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
        Object.keys(type.annotations[HISTORY_TRACKED_FIELDS] ?? {})
      )

      const isHistoryTrackedField = (field: Field): boolean => (
        (field.annotations[FIELD_ANNOTATIONS.TRACK_HISTORY] === true)
        || trackedFields(field.parent).includes(field.name)
      )

      const distributeTrackingInfo = async (objType: ObjectType): Promise<void> => {
        const typeSupportsHistoryTracking = (type: ObjectType): boolean => (
          type.annotations[OBJECT_HISTORY_TRACKING_ENABLED] !== undefined
        )

        if (!typeSupportsHistoryTracking(objType)) {
          return
        }

        Object.values(objType.fields)
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
        .forEach(field => {
          field.annotations[FIELD_ANNOTATIONS.TRACK_HISTORY] = isHistoryTrackedField(field)
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
      objectTypesChangedInPreDeploy = await awu(actuallyChangedObjectTypes)
        .map(change => change.data.before)
        .keyBy(objectType => apiName(objectType))

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
      const isRedundantFieldChange = (change: Change) : change is ModificationChange<Field> => (
        isModificationChange(change)
        && isFieldChange(change)
        && isFieldOfCustomObject(getChangeData(change))
        && change.data.before.isEqual(change.data.after)
      )

      /**
       * Re-create ObjectType changes that may have been discarded between preDeploy and onDeploy.
       *
       * If the only change in an object is a change in the list of tracked fields, then after preDeploy that change
       * becomes redundant (because we delete the historyTrackedFields annotation, and the enableHistory annotation
       * remains the same).
       * We can't assume that such changes where before === after will remain intact between preDeploy and onDeploy, so
       * we have to recreate them in onDeploy.
       * Luckily, we can identify these "tracked fields only" changes, because in preDeploy we generate a
       * ModificationChange<Field> for every field that changed. And we can identify these field changes here by them
       * having *only* a change in the trackHistory annotation.
       * So we use the state we saved in preDeploy as the basis for creating these ObjectType changes, and modify the
       * 'after' part of these changes based on the field changes we receive here.
       *
       * Note that we can't just use the changes from preDeploy as-is because some of them could be missing from the
       * onDeploy changes because they failed to deploy, and we shouldn't re-add them to the list of changes.
       * */
      const createAdditionalObjectTypeChanges = async (
        fieldChanges: ModificationChange<Field>[],
        typesToIgnore: Set<string>
      ): Promise<Change<ObjectType>[]> => {
        const additionalChanges: Record<string, Change<ObjectType>> = {}

        const addTrackedFieldChangeToObjectTypeChange = async (change: ModificationChange<Field>): Promise<void> => {
          const [before, after] = getAllChangeData(change)
          const parentTypeName = await apiName(after.parent)

          const trackedBefore = before.annotations[FIELD_ANNOTATIONS.TRACK_HISTORY]
          const trackedAfter = after.annotations[FIELD_ANNOTATIONS.TRACK_HISTORY]

          if (!!trackedBefore === !!trackedAfter) {
            // converting to bool because some types don't have the annotation at all, but for now we still add a false
            // annotation in preDeploy
            return
          }

          if (!(parentTypeName in additionalChanges)) {
            const originalObjectType = objectTypesChangedInPreDeploy[parentTypeName]
            additionalChanges[parentTypeName] = toChange(
              { before: originalObjectType, after: originalObjectType.clone() }
            )
          }

          const changedObjectType = getChangeData(additionalChanges[parentTypeName])
          if (trackedAfter) {
            // field is added to tracked fields
            changedObjectType.annotations[HISTORY_TRACKED_FIELDS][after.name] = new ReferenceExpression(after.elemID)
          } else {
            // field is removed from tracked fields
            _.omit(changedObjectType.annotations[HISTORY_TRACKED_FIELDS], [after.name])
          }
        }

        await awu(fieldChanges)
          .filter(isModificationChange)
          .filter(change => _.isEqual(_.omit(change.data.before.annotations[HISTORY_TRACKED_FIELDS]),
            _.omit(change.data.after.annotations[HISTORY_TRACKED_FIELDS])))
          .filter(async change => !typesToIgnore.has(await apiName(getChangeData(change).parent)))
          .forEach(change => addTrackedFieldChangeToObjectTypeChange(change))

        return Object.values(additionalChanges)
      }

      const changedCustomObjects = await awu(changes)
        .filter(isAdditionOrModificationChange)
        .filter(isObjectTypeChange)
        .map(getChangeData)
        .filter(isCustomObject)
        .toArray()

      changedCustomObjects
        .forEach(centralizeHistoryTrackingAnnotations)

      const changedCustomObjectNames = new Set(await awu(changedCustomObjects)
        .map(objType => apiName(objType))
        .toArray())

      const fieldChanges = await awu(changes)
        .filter(isFieldChange)
        .filter(change => isFieldOfCustomObject(getChangeData(change)))
        .toArray()

      const additionalChanges = await createAdditionalObjectTypeChanges(
        fieldChanges.filter(isModificationChange),
        changedCustomObjectNames,
      )

      additionalChanges.forEach(change => changes.push(change))

      fieldChanges
        .forEach(change => {
          const [before, after] = getAllChangeData(change)
          if (before !== undefined) {
            delete before.annotations[FIELD_ANNOTATIONS.TRACK_HISTORY]
          }
          if (after !== undefined) {
            delete after.annotations[FIELD_ANNOTATIONS.TRACK_HISTORY]
          }
        })

      _.remove(changes, isRedundantFieldChange)
    },
  }
}

export default filter
