/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import {
  Change,
  Field,
  getAllChangeData,
  getChangeData,
  isAdditionChange,
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
import {
  isCustomObject,
  isFieldOfCustomObject,
} from '../transformers/transformer'
import {
  FIELD_ANNOTATIONS,
  HISTORY_TRACKED_FIELDS,
  FEED_HISTORY_TRACKED_FIELDS,
  OBJECT_HISTORY_TRACKING_ENABLED,
  OBJECT_FEED_HISTORY_TRACKING_ENABLED,
  RECORD_TYPE_HISTORY_TRACKING_ENABLED,
  RECORD_TYPE_FEED_HISTORY_TRACKING_ENABLED,
} from '../constants'

const { awu } = collections.asynciterable
const log = logger(module)

// Of the types enumerated in https://help.salesforce.com/s/articleView?id=sf.tracking_field_history.htm&type=5, only
// the types mentioned as having an object-level checkbox in
// https://help.salesforce.com/s/articleView?id=sf.tracking_field_history_for_standard_objects.htm&type=5 have an
// object-level enable. For other types, we should assume tracking is supported and enabled.
const TYPES_WITH_NO_OBJECT_LEVEL_ENABLE_HISTORY = [
  'ActiveScratchOrg', // This type does not appear in the SF docs, but we saw it with fields where trackHistory=true
  'Article',
  'Asset',
  'Campaign',
  'Case',
  'ContentVersion', // This type does not appear in the SF docs, but it supports history tracking in the UI and API.
  'Contract',
  'ContractLineItem',
  'Crisis',
  'Employee',
  'EmployeeCrisisAssessment',
  'Entitlement',
  'Event',
  'Individual',
  'InternalOrganizationUnit',
  'Knowledge',
  'LiveChatTranscript', // This type does not appear in the SF docs, but we saw it with fields where trackHistory=true
  'NamespaceRegistry', // This type does not appear in the SF docs, but we saw it with fields where trackHistory=true
  'Order',
  'OrderItem', // API name of 'Order Product'
  'PartnerMarketingBudget', // This type does not appear in the SF docs, but we saw it with fields where trackHistory=true
  'PartnerFundAllocation', // This type does not appear in the SF docs, but we saw it with fields where trackHistory=true
  'Pricebook2', // This type does not appear in the SF docs, but we saw it with fields where trackHistory=true
  'PricebookEntry',
  'Product',
  'Product2', // This type does not appear in the SF docs, but we saw it with fields where trackHistory=true
  'Quote',
  'QuoteLineItem',
  'ScratchOrgInfo', // This type does not appear in the SF docs, but we saw it with fields where trackHistory=true
  'ServiceAppointment',
  'ServiceContract',
  'ServiceResource', // This type does not appear in the SF docs, but we saw it with fields where trackHistory=true
  'SignupRequest', // This type does not appear in the SF docs, but we saw it with fields where trackHistory=true
  'Solution',
  'Task',
  'WorkOrder',
  'WorkOrderLineItem',
]

type TrackedFieldsDefinition = {
  objectLevelEnable: string
  recordTypeEnable: string
  fieldLevelEnable: string
  aggregate: string
  alwaysEnabledObjectTypes: Set<string>
}

const trackedFieldsDefinitions: TrackedFieldsDefinition[] = [
  {
    objectLevelEnable: OBJECT_HISTORY_TRACKING_ENABLED,
    recordTypeEnable: RECORD_TYPE_HISTORY_TRACKING_ENABLED,
    fieldLevelEnable: FIELD_ANNOTATIONS.TRACK_HISTORY,
    aggregate: HISTORY_TRACKED_FIELDS,
    alwaysEnabledObjectTypes: new Set(
      TYPES_WITH_NO_OBJECT_LEVEL_ENABLE_HISTORY,
    ),
  },
  {
    objectLevelEnable: OBJECT_FEED_HISTORY_TRACKING_ENABLED,
    recordTypeEnable: RECORD_TYPE_FEED_HISTORY_TRACKING_ENABLED,
    fieldLevelEnable: FIELD_ANNOTATIONS.TRACK_FEED_HISTORY,
    aggregate: FEED_HISTORY_TRACKED_FIELDS,
    alwaysEnabledObjectTypes: new Set(),
  },
]

const isHistoryTrackingEnabled = (
  type: ObjectType,
  trackingDef: TrackedFieldsDefinition,
): boolean =>
  type.annotations[trackingDef.objectLevelEnable] === true ||
  trackingDef.alwaysEnabledObjectTypes.has(type.elemID.typeName)

const trackedFields = (
  type: ObjectType | undefined,
  trackingDef: TrackedFieldsDefinition,
): string[] => Object.keys(type?.annotations[trackingDef.aggregate] ?? {})

const isHistoryTrackedField = (
  field: Field,
  trackingDef: TrackedFieldsDefinition,
): boolean =>
  field.annotations[trackingDef.fieldLevelEnable] === true ||
  trackedFields(field.parent, trackingDef).includes(field.name)

const deleteFieldHistoryTrackingAnnotation = (
  field: Field,
  trackingDef: TrackedFieldsDefinition,
): void => {
  if (field !== undefined) {
    delete field.annotations[trackingDef.fieldLevelEnable]
  }
}

const centralizeHistoryTrackingAnnotations = (
  customObject: ObjectType,
  trackingDef: TrackedFieldsDefinition,
): void => {
  const areAnyFieldsTracked = (obj: ObjectType): boolean =>
    Object.values(obj.fields).some(
      (field) => field.annotations[trackingDef.fieldLevelEnable] === true,
    )
  const isTrackingSupported = (obj: ObjectType): boolean =>
    obj.annotations[trackingDef.objectLevelEnable] !== undefined &&
    !trackingDef.alwaysEnabledObjectTypes.has(obj.elemID.typeName)

  if (isHistoryTrackingEnabled(customObject, trackingDef)) {
    customObject.annotations[trackingDef.aggregate] = _.mapValues(
      _.pickBy(customObject.fields, (field) =>
        isHistoryTrackedField(field, trackingDef),
      ),
      (field) => new ReferenceExpression(field.elemID),
    )
  } else {
    // After the resolution of SALTO-4309, the following should not happen. Let's make sure, though...
    if (customObject.annotations[trackingDef.recordTypeEnable] === true) {
      log.debug(
        'In object type %s, %s is %s but %s is true. Treating as tracking disabled.',
        customObject.elemID.getFullName(),
        trackingDef.objectLevelEnable,
        customObject.annotations[trackingDef.objectLevelEnable],
        trackingDef.recordTypeEnable,
      )
    }
    if (
      !isTrackingSupported(customObject) &&
      areAnyFieldsTracked(customObject)
    ) {
      log.debug(
        'In object type %s, %s is %s but some fields have tracking enabled',
        customObject.elemID.getFullName(),
        trackingDef.objectLevelEnable,
        customObject.annotations[trackingDef.objectLevelEnable],
      )
    }
  }

  Object.values(customObject.fields).forEach((field) =>
    deleteFieldHistoryTrackingAnnotation(field, trackingDef),
  )
}

const fieldHistoryTrackingChanged = (
  field: Field,
  objectTypeChange: ModificationChange<ObjectType>,
  trackingDef: TrackedFieldsDefinition,
): boolean => {
  const [typeBefore, typeAfter] = getAllChangeData(objectTypeChange)
  const trackedBefore = Object.keys(
    typeBefore.annotations[trackingDef.aggregate] ?? {},
  ).includes(field.name)
  const trackedAfter = Object.keys(
    typeAfter.annotations[trackingDef.aggregate] ?? {},
  ).includes(field.name)
  const existsAfter = field.name in typeAfter.fields
  return existsAfter && trackedBefore !== trackedAfter
}

const createHistoryTrackingFieldChange = (
  field: Field,
  objectTypeChange: ModificationChange<ObjectType>,
  trackingDef: TrackedFieldsDefinition,
): Change<Field> => {
  const [typeBefore, typeAfter] = getAllChangeData(objectTypeChange)
  const trackedBefore = Object.keys(
    typeBefore.annotations[trackingDef.aggregate] ?? {},
  ).includes(field.name)
  const trackedAfter = Object.keys(
    typeAfter.annotations[trackingDef.aggregate] ?? {},
  ).includes(field.name)

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
    onFetch: async (elements) => {
      trackedFieldsDefinitions.forEach((trackingDef) =>
        elements
          .filter(isObjectType)
          .filter(isCustomObject)
          .forEach((objType) =>
            centralizeHistoryTrackingAnnotations(objType, trackingDef),
          ),
      )
    },
    preDeploy: async (changes) => {
      const distributeTrackingInfo = (
        objType: ObjectType,
        trackingDef: TrackedFieldsDefinition,
      ): void => {
        if (!isHistoryTrackingEnabled(objType, trackingDef)) {
          return
        }

        Object.values(objType.fields).forEach((field) => {
          field.annotations[trackingDef.fieldLevelEnable] =
            isHistoryTrackedField(field, trackingDef)
        })
      }

      const distributeTrackingInfoInAddedObjectTypes = async (
        trackingDef: TrackedFieldsDefinition,
      ): Promise<void> => {
        await awu(changes)
          .filter(isAdditionChange)
          .filter(isObjectTypeChange)
          .filter((change) => isCustomObject(getChangeData(change)))
          .map(getChangeData)
          .forEach((objType) => distributeTrackingInfo(objType, trackingDef))
      }

      const updateAnnotationsOnChangedFields = async (
        trackingDef: TrackedFieldsDefinition,
      ): Promise<string[]> => {
        const fieldsThatChanged = await awu(changes)
          .filter(isAdditionOrModificationChange)
          .map(getChangeData)
          .filter(isField)
          .filter(isFieldOfCustomObject)
          .toArray()

        fieldsThatChanged.forEach((field) => {
          field.annotations[trackingDef.fieldLevelEnable] =
            isHistoryTrackedField(field, trackingDef)
        })

        return fieldsThatChanged.map((field) => field.elemID.getFullName())
      }

      const distributeTrackingInfoInModifiedObjectTypes = async (
        trackingDef: TrackedFieldsDefinition,
        namesOfFieldsThatChanged: Set<string>,
      ): Promise<Change[]> => {
        const modifiedObjectTypes = await awu(changes)
          .filter(isObjectTypeChange)
          .filter(isModificationChange)
          .filter((change) => isCustomObject(getChangeData(change)))
          .toArray()

        //  - set the annotations on the type and its fields
        modifiedObjectTypes
          .map(getChangeData)
          .forEach((objType) => distributeTrackingInfo(objType, trackingDef))

        //  - if the list of tracked fields changed, create field changes that represent the changes to the trackHistory
        //    annotations. We only create such changes if we don't already have an unrelated change for this field (in
        //    which case we handled it above)
        const additionalChanges = modifiedObjectTypes.flatMap((change) =>
          Object.values(getChangeData(change).fields)
            .filter(
              (field) =>
                !namesOfFieldsThatChanged.has(field.elemID.getFullName()),
            )
            .filter((field) =>
              fieldHistoryTrackingChanged(field, change, trackingDef),
            )
            .map((field) =>
              createHistoryTrackingFieldChange(field, change, trackingDef),
            ),
        )

        additionalChanges
          .map(getChangeData)
          .map((field) => field.elemID.getFullName())
          .forEach((name) => fieldsWithSyntheticChanges.add(name))

        return additionalChanges
      }

      fieldsWithSyntheticChanges = new Set()
      const additionalChanges: Change[] = []
      await awu(trackedFieldsDefinitions).forEach(async (trackingDef) => {
        // Added object types - set the annotations on the type and its fields
        await distributeTrackingInfoInAddedObjectTypes(trackingDef)

        // Added or modified fields - set the annotations on the fields
        const namesOfFieldsThatChanged = new Set(
          await updateAnnotationsOnChangedFields(trackingDef),
        )

        // Existing object types that changed
        const fieldChanges = await distributeTrackingInfoInModifiedObjectTypes(
          trackingDef,
          namesOfFieldsThatChanged,
        )
        fieldChanges.forEach((change) => additionalChanges.push(change))

        // Finally, remove the aggregate annotation from all object types (either added or changed)
        changes
          .filter(isAdditionOrModificationChange)
          .filter(isObjectTypeChange)
          .map(getChangeData)
          .filter(isCustomObject)
          .forEach((objType) => {
            delete objType.annotations[trackingDef.aggregate]
          })
      })

      additionalChanges.forEach((change) => changes.push(change))
    },
    onDeploy: async (changes) => {
      const isSyntheticChangeFromPreDeploy = (change: Change): boolean =>
        isFieldChange(change) &&
        isModificationChange(change) &&
        fieldsWithSyntheticChanges.has(
          getChangeData(change).elemID.getFullName(),
        )

      // We want to make sure we remove the changes we created in preDeploy
      _.remove(changes, (change) => isSyntheticChangeFromPreDeploy(change))

      await awu(trackedFieldsDefinitions).forEach(async (trackingDef) => {
        await awu(changes)
          .filter(isAdditionOrModificationChange)
          .filter(isObjectTypeChange)
          .map(getChangeData)
          .filter(isCustomObject)
          .forEach((objType) =>
            centralizeHistoryTrackingAnnotations(objType, trackingDef),
          )

        await awu(changes)
          .filter(isFieldChange)
          .filter((change) => isFieldOfCustomObject(getChangeData(change)))
          .forEach((change) => {
            const [before, after] = getAllChangeData(change)
            deleteFieldHistoryTrackingAnnotation(before, trackingDef)
            deleteFieldHistoryTrackingAnnotation(after, trackingDef)
          })
      })
    },
  }
}

export default filter
