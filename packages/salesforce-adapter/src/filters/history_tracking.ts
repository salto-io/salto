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
import {
  Change,
  Field,
  getChangeData,
  isAdditionOrModificationChange,
  isField,
  isFieldChange,
  isModificationChange,
  isObjectType,
  isObjectTypeChange,
  isRemovalOrModificationChange,
  ModificationChange,
  ObjectType,
  ReferenceExpression,
  toChange,
} from '@salto-io/adapter-api'
import { LocalFilterCreator } from '../filter'
import { apiName, isCustomObject, isFieldOfCustomObject } from '../transformers/transformer'
import { FIELD_ANNOTATIONS, HISTORY_TRACKED_FIELDS, OBJECT_HISTORY_TRACKING_ENABLED } from '../constants'

const log = logger(module)
const { awu } = collections.asynciterable


const isHistoryTrackingEnabled = (type: ObjectType): boolean => (
  (type.annotations[OBJECT_HISTORY_TRACKING_ENABLED] === true)
  || (type.annotations[HISTORY_TRACKED_FIELDS] !== undefined)
)

const centralizeHistoryTrackingAnnotations = (customObject: ObjectType): void => {
  if (!isHistoryTrackingEnabled(customObject)) {
    delete customObject.annotations[OBJECT_HISTORY_TRACKING_ENABLED]
    return
  }

  customObject.annotations[HISTORY_TRACKED_FIELDS] = Object.values(customObject.fields)
    .filter(field => (field.annotations[FIELD_ANNOTATIONS.TRACK_HISTORY] === true))
    .map(field => new ReferenceExpression(field.elemID))
    .sort()

  Object.values(customObject.fields).forEach(field => delete field.annotations[FIELD_ANNOTATIONS.TRACK_HISTORY])
  delete customObject.annotations[OBJECT_HISTORY_TRACKING_ENABLED]
}

const createFieldChanges = async (typeBefore: ObjectType,
  typeAfter: ObjectType,
  addedTrackedFields: string[],
  removedTrackedFields: string[],
  fieldsToIgnore: string[]): Promise<Change<Field>[]> => {
  const shouldProcessField = (fieldName: string): boolean => (
    !fieldsToIgnore.includes(fieldName)
  )
  const fieldByName = async (type: ObjectType, fieldName: string): Promise<Field | undefined> => (
    Object.values(type.fields).find(async fieldDef => (await apiName(fieldDef) === fieldName))
  )
  const historyTrackingAddedChange = async (fieldName: string): Promise<Change<Field> | undefined> => {
    const before = (await fieldByName(typeBefore, fieldName))?.clone()
    const after = (await fieldByName(typeAfter, fieldName))?.clone()
    if (after === undefined) {
      log.error('The field %o was added to %o\'s history tracking, but does not exist', fieldName, typeAfter.elemID.getFullName())
      return undefined
    }
    if (before === undefined) {
      // The field was added, so it will be handled in the field's AdditionChange
      return undefined
    }

    before.annotations[FIELD_ANNOTATIONS.TRACK_HISTORY] = false
    after.annotations[FIELD_ANNOTATIONS.TRACK_HISTORY] = true
    return toChange({ before, after })
  }

  const historyTrackingRemovedChange = async (fieldName: string): Promise<Change<Field> | undefined> => {
    const before = (await fieldByName(typeBefore, fieldName))?.clone()
    const after = (await fieldByName(typeAfter, fieldName))?.clone()
    if (before !== undefined) {
      before.annotations[FIELD_ANNOTATIONS.TRACK_HISTORY] = true
    } else {
      log.warn('The field %o was removed from %o\'s history tracking, but did not exist', fieldName, typeAfter.elemID.getFullName())
    }
    if (after === undefined) {
      // the field was removed from the object, no need to add a change beyond the RemovalChange that already exists
      return undefined
    }
    after.annotations[FIELD_ANNOTATIONS.TRACK_HISTORY] = false
    return toChange({ before, after })
  }

  return [
    ...await awu(addedTrackedFields)
      .filter(shouldProcessField)
      .map(fieldName => historyTrackingAddedChange(fieldName))
      .filter(valueUtils.isDefined)
      .toArray(),
    ...await awu(removedTrackedFields)
      .filter(shouldProcessField)
      .map(fieldName => historyTrackingRemovedChange(fieldName))
      .filter(valueUtils.isDefined)
      .toArray(),
  ]
}

/**
 * Note: we assume this filter runs *after* custom objects are turned into types (custom_object_to_object_type) but
 * *before* these types are split up into different elements (custom_type_split)
 * */
const filter: LocalFilterCreator = () => ({
  name: 'history_tracking',
  onFetch: async elements => {
    elements
      .filter(isObjectType)
      .filter(isCustomObject)
      .forEach(centralizeHistoryTrackingAnnotations)
  },
  preDeploy: async changes => {
    const trackedFields = (type: ObjectType): string[] => (
      // by the time preDeploy is called references are already resolved, so they won't be ref expressions anymore.
      type.annotations[HISTORY_TRACKED_FIELDS] ?? []
    )

    const isHistoryTrackedField = async (field: Field): Promise<boolean> => (
      (field.annotations[FIELD_ANNOTATIONS.TRACK_HISTORY] === true)
      || trackedFields(field.parent).includes(await apiName(field))
    )
    const changedTrackedFields = (change: ModificationChange<ObjectType>):
      {
        typeBefore: ObjectType
        typeAfter: ObjectType
        added: string[]
        removed: string[]
      } => (
      {
        typeBefore: change.data.before,
        typeAfter: getChangeData(change),
        added: _.difference(trackedFields(change.data.after), trackedFields(change.data.before)),
        removed: _.difference(trackedFields(change.data.before), trackedFields(change.data.after)),
      }
    )

    const changedCustomObjectFields = changes
      .filter(isAdditionOrModificationChange)
      .map(getChangeData)
      .filter(isField)
      .filter(isFieldOfCustomObject)

    const objectTypeChanges = changes
      .filter(isAdditionOrModificationChange)
      .filter(isObjectTypeChange)

    // 1. For all CustomObjects, set the correct 'enableHistory' value
    await awu(objectTypeChanges)
      .map(getChangeData)
      .forEach(objType => {
        objType.annotations[OBJECT_HISTORY_TRACKING_ENABLED] = isHistoryTrackingEnabled(objType)
        _.forOwn(objType.fields, async field => {
          if (await isHistoryTrackedField(field)) {
            field.annotations[FIELD_ANNOTATIONS.TRACK_HISTORY] = true
          }
        })
      })

    // 2. For all changed fields, make sure they have the expected 'trackHistory' value
    await awu(changedCustomObjectFields)
      .forEach(async field => {
        field.annotations[FIELD_ANNOTATIONS.TRACK_HISTORY] = await isHistoryTrackedField(field)
      })

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

    const changedFieldNames = changedCustomObjectFields.map(field => field.elemID.getFullName())
    const additionalChanges = await awu(objectTypeChanges)
      .filter(isModificationChange)
      .map(changedTrackedFields)
      .filter(({ added, removed }) => (added.length > 0 || removed.length > 0))
      .flatMap(({ typeBefore, typeAfter, added, removed }) => (
        createFieldChanges(typeBefore, typeAfter, added, removed, changedFieldNames)
      ))
      .toArray()

    // 4. Remove the 'historyTrackedFields' annotation from all objects
    objectTypeChanges
      .map(getChangeData)
      .forEach(objType => {
        delete objType.annotations[HISTORY_TRACKED_FIELDS]
      })
    changes.push(...additionalChanges)
  },
  onDeploy: async changes => {
    changes
      .filter(isAdditionOrModificationChange)
      .filter(isObjectTypeChange)
      .filter(change => isCustomObject(getChangeData(change)))
      .forEach(change => {
        centralizeHistoryTrackingAnnotations(getChangeData(change))
      })

    changes
      .filter(isAdditionOrModificationChange)
      .filter(isFieldChange)
      .filter(change => isFieldOfCustomObject(getChangeData(change)))
      .forEach(change => {
        delete getChangeData(change).annotations[FIELD_ANNOTATIONS.TRACK_HISTORY]
      })

    changes
      .filter(isRemovalOrModificationChange)
      .filter(isFieldChange)
      .filter(change => isFieldOfCustomObject(getChangeData(change)))
      .forEach(change => {
        delete change.data.before.annotations[FIELD_ANNOTATIONS.TRACK_HISTORY]
      })

    _.remove(changes, change => (
      isModificationChange(change)
      && isObjectTypeChange(change)
      && isCustomObject(getChangeData(change))
      && change.data.before.isEqual(change.data.after)
    ))

    _.remove(changes, change => (
      isModificationChange(change)
      && isFieldChange(change)
      && isFieldOfCustomObject(getChangeData(change))
      && change.data.before.isEqual(change.data.after)
    ))
  },
})

export default filter
