/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { MetadataInfo, SaveResult } from '@salto-io/jsforce'
import _ from 'lodash'
import { ReferenceExpression, Value } from '@salto-io/adapter-api'
import { FIELD_TYPE_NAMES, CUSTOM_OBJECT_ID_FIELD } from '../constants'

const RELATIONSHIP_FIELD_NAMES: string[] = [
  FIELD_TYPE_NAMES.METADATA_RELATIONSHIP,
  FIELD_TYPE_NAMES.LOOKUP,
  FIELD_TYPE_NAMES.MASTER_DETAIL,
  FIELD_TYPE_NAMES.HIERARCHY,
]

const isRelationshipFieldName = (fieldName: string): boolean => RELATIONSHIP_FIELD_NAMES.includes(fieldName)

export type JSONBool = boolean | 'true' | 'false'

type ObjectPermissionsOptionsFields =
  | 'allowCreate'
  | 'allowDelete'
  | 'allowEdit'
  | 'allowRead'
  | 'modifyAllRecords'
  | 'viewAllRecords'
type ObjectPermissionsOptions = {
  [option in ObjectPermissionsOptionsFields]: JSONBool
}

type FieldPermissionsOptionsFields = 'editable' | 'readable'
type FieldPermissionsOptions = {
  [option in FieldPermissionsOptionsFields]: JSONBool
}

export type FieldPermissions = { field: string } & FieldPermissionsOptions
export type ObjectPermissions = { object: string } & ObjectPermissionsOptions

export interface ProfileInfo extends MetadataInfo {
  fullName: string
  fieldPermissions: FieldPermissions[]
  objectPermissions: ObjectPermissions[]
}

export class TopicsForObjectsInfo implements MetadataInfo {
  constructor(
    public readonly fullName: string,
    public entityApiName: string,
    public enableTopics: JSONBool,
  ) {}
}

export class CustomPicklistValue implements MetadataInfo {
  readonly default: boolean
  color?: string
  constructor(
    public readonly fullName: string,
    isDefault: boolean,
    readonly isActive: boolean,
    readonly label?: string,
    color?: string,
  ) {
    if (!this.label) {
      this.label = fullName
    }
    this.default = isDefault
    if (color) {
      this.color = color
    }
  }
}

export interface ValueSettings {
  controllingFieldValue: (string | ReferenceExpression)[]
  valueName: string | ReferenceExpression
}

interface PicklistValue {
  fullName: string
  label: string
  default: boolean
  color: string
  isActive: boolean
}

export interface FilterItem {
  field: string
  operation: string
  value: string
  valueField: string
}

interface LookupFilter {
  active: boolean
  booleanFilter: string
  errorMessage: string
  filterItems: FilterItem[]
  infoMessage: string
  isOptional: boolean
}

export class CustomField implements MetadataInfo {
  // Common field annotations
  readonly label?: string
  readonly type?: string
  readonly required?: boolean
  readonly defaultValue?: string
  // For formula fields
  readonly formula?: string
  // To be used for picklist and combobox types
  valueSet?: {
    restricted?: boolean
    controllingField?: string
    valueSetDefinition?: {
      sorted?: boolean
      value: CustomPicklistValue[]
    }
    valueSettings?: ValueSettings[]
    valueSetName?: string
  }

  // To be used for lookup and master-detail types
  readonly referenceTo?: string[]
  readonly relationshipName?: string
  readonly deleteConstraint?: string
  readonly reparentableMasterDetail?: boolean
  readonly writeRequiresMasterRead?: boolean
  readonly relationshipOrder?: number
  readonly lookupFilter?: LookupFilter

  // To be used for rollupSummary type
  readonly summaryFilterItems?: FilterItem | FilterItem[]

  // To be used for Text types fields
  readonly length?: number

  // To be used for Formula types fields
  readonly formulaTreatBlanksAs?: string

  // For the rest of the annotation values required by the rest of the field types:
  scale?: number
  precision?: number
  displayFormat?: string
  unique?: boolean
  caseSensitive?: boolean
  displayLocationInDecimal?: boolean
  visibleLines?: number
  maskType?: string
  maskChar?: string
  businessOwnerGroup?: string
  businessOwnerUser?: string
  businessStatus?: string
  securityClassification?: string
  complianceGroup?: string

  // CustomMetadata types
  metadataRelationshipControllingField?: string

  constructor(
    public fullName: string,
    type: string | undefined,
    required = false,
    defaultVal?: string,
    defaultValFormula?: string,
    values?: PicklistValue[],
    controllingField?: string,
    valueSettings?: ValueSettings[],
    picklistRestricted?: boolean,
    picklistSorted?: boolean,
    valueSetName?: string,
    formula?: string,
    summaryFilterItems?: FilterItem[],
    relatedTo?: string[],
    relationshipName?: string,
    length?: number,
    metadataRelationshipControllingField?: string,
  ) {
    this.type = type
    if (metadataRelationshipControllingField !== undefined) {
      this.metadataRelationshipControllingField = metadataRelationshipControllingField
    }
    if (formula) {
      this.formula = formula
    } else {
      switch (this.type) {
        case 'Text':
          this.length = length ?? 80
          break
        case 'LongTextArea':
        case 'Html':
          this.length = length ?? 32768
          break
        case 'EncryptedText':
          this.length = length ?? 32
          break
        default:
          break
      }
    }

    if (defaultValFormula) {
      this.defaultValue = defaultValFormula
    }

    // For Picklist we save the default value in defaultVal but Metadata requires it at Value level
    if (type === FIELD_TYPE_NAMES.PICKLIST || type === FIELD_TYPE_NAMES.MULTIPICKLIST) {
      if ((values && !_.isEmpty(values)) || valueSetName) {
        if (values && !_.isEmpty(values)) {
          this.valueSet = {
            ...(picklistRestricted ? { restricted: true } : {}),
            valueSetDefinition: {
              ...(picklistSorted ? { sorted: true } : {}),
              value: values.map(
                val => new CustomPicklistValue(val.fullName, val.default, val.isActive ?? true, val.label, val.color),
              ),
            },
          }
        } else {
          this.valueSet = {
            restricted: true,
            valueSetName,
          }
        }
        if (controllingField && valueSettings) {
          this.valueSet.controllingField = controllingField
          this.valueSet.valueSettings = valueSettings
        }
      }
    } else if (type === FIELD_TYPE_NAMES.CHECKBOX && !formula) {
      // For Checkbox the default value comes from defaultVal and not defaultValFormula
      this.defaultValue = defaultVal
    } else if (type !== undefined && isRelationshipFieldName(type)) {
      this.relationshipName = relationshipName
      // "Can not specify 'referenceTo' for a CustomField of type Hierarchy" Error will be thrown
      // if we try sending the `referenceTo` value to Salesforce.
      // Hierarchy fields always reference the current CustomObject type,
      // and are not modifiable, that's probably why Salesforce forbid us
      // from sending the `referenceTo` value upon deploy.
      if (type !== FIELD_TYPE_NAMES.HIERARCHY) {
        this.referenceTo = relatedTo
      }
    } else if (type === FIELD_TYPE_NAMES.ROLLUP_SUMMARY && summaryFilterItems) {
      this.summaryFilterItems = summaryFilterItems
    }

    // Checkbox, Formula, AutoNumber, LongTextArea and RichTextArea
    //  fields should not have required field
    if (
      !(
        [
          FIELD_TYPE_NAMES.CHECKBOX,
          FIELD_TYPE_NAMES.AUTONUMBER,
          FIELD_TYPE_NAMES.LONGTEXTAREA,
          FIELD_TYPE_NAMES.RICHTEXTAREA,
        ] as (string | undefined)[]
      ).includes(this.type) &&
      !formula
    ) {
      this.required = required
    }
  }
}

type SharingModelEnum =
  | 'Private'
  | 'Read'
  | 'ReadSelect'
  | 'ReadWrite'
  | 'ReadWriteTransfer'
  | 'FullAccess'
  | 'ControlledByParent'
  | 'ControlledByLeadOrContact'
  | 'ControlledByCampaign'

export type CustomObject = MetadataInfo & {
  label: string
  fields?: CustomField | CustomField[]
  pluralLabel?: string
  deploymentStatus?: string
  sharingModel?: SharingModelEnum
  nameField?: Partial<CustomField>
}

export interface SfError {
  extendedErrorDetails: string[]
  extendedErrorCode: string
  fields: string[]
  message: string
  statusCode: string
}

export interface CompleteSaveResult extends SaveResult {
  success: boolean
  fullName: string
  errors: SfError | SfError[]
}

export type SalesforceRecord = {
  [CUSTOM_OBJECT_ID_FIELD]: string
  [attr: string]: Value
}
