import { MetadataInfo, SaveResult } from 'jsforce'
import _ from 'lodash'
import { FIELD_TYPE_NAMES } from '../constants'

export type JSONBool = boolean | 'true' | 'false'

export type ObjectPermissionsOptionsFields = 'allowCreate' | 'allowDelete' | 'allowEdit'
 | 'allowRead' | 'modifyAllRecords' | 'viewAllRecords'
export const OBJECT_PERMISSIONS_OPTIONS:
 ReadonlyArray<ObjectPermissionsOptionsFields> = Object.freeze([
   'allowCreate', 'allowDelete', 'allowEdit', 'allowRead',
   'modifyAllRecords', 'viewAllRecords',
 ])
export type ObjectPermissionsOptions = {[option in ObjectPermissionsOptionsFields]: JSONBool}

export type FieldPermissionsOptionsFields = 'editable' | 'readable'
export const FIELD_PERMISSIONS_OPTIONS:
 ReadonlyArray<FieldPermissionsOptionsFields> = Object.freeze([
   'readable', 'editable',
 ])
export type FieldPermissionsOptions = {[option in FieldPermissionsOptionsFields]: JSONBool}

export type FieldPermissions = { field: string } & FieldPermissionsOptions
export type ObjectPermissions = { object: string } & ObjectPermissionsOptions

export type PermissionsTypes = FieldPermissions | ObjectPermissions
export type PermissionsOptionsTypes = FieldPermissionsOptions | ObjectPermissionsOptions
export type PermissionsOptionsFieldsTypes = ObjectPermissionsOptionsFields |
 FieldPermissionsOptionsFields

export class ProfileInfo implements MetadataInfo {
  constructor(
    public readonly fullName: string,
    public fieldPermissions: FieldPermissions[] = [],
    public objectPermissions: ObjectPermissions[] = [],
  ) {}
}

// https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_metadatawithcontent.htm
export interface MetadataWithContent extends MetadataInfo {
  fullName: string
  content: string
}

export class TopicsForObjectsInfo implements MetadataInfo {
  constructor(
    public readonly fullName: string,
    public entityApiName: string,
    public enableTopics: JSONBool
  ) {}
}

class CustomPicklistValue implements MetadataInfo {
  readonly default: boolean
  constructor(public readonly fullName: string, isDefault: boolean, readonly label?: string) {
    if (!this.label) {
      this.label = fullName
    }
    this.default = isDefault
  }
}

export interface ValueSettings {
  controllingFieldValue: string[]
  valueName: string
}

export interface PicklistValue {
  fullName: string
  label: string
  default: boolean
}

export interface ValueSet {
  restricted: boolean
  valueSetDefinition: { value: PicklistValue[] }
}

export interface FilterItem {
  field: string
  operation: string
  value: string
  valueField: string
}

export interface LookupFilter {
  active: boolean
  booleanFilter: string
  errorMessage: string
  filterItems: FilterItem[]
  infoMessage: string
  isOptional: boolean
}

export class CustomField implements MetadataInfo {
  // Common field annotations
  readonly type: string
  readonly required?: boolean
  readonly defaultValue?: string
  // For formula fields
  readonly formula?: string
  // To be used for picklist and combobox types
  valueSet?: {
    restricted?: boolean
    controllingField?: string
    valueSetDefinition?: { value: CustomPicklistValue[] }
    valueSettings?: ValueSettings[]
    valueSetName?: string
  }

  // To be used for lookup and masterdetail types
  readonly referenceTo?: string[]
  readonly relationshipName?: string
  readonly deleteConstraint?: string
  readonly reparentableMasterDetail?: boolean
  readonly writeRequiresMasterRead?: boolean
  readonly lookupFilter?: LookupFilter

  // To be used for rollupSummary type
  readonly summaryFilterItems?: FilterItem | FilterItem[]

  // To be used for Text types fields
  readonly length?: number

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

  constructor(
    public fullName: string,
    type: string,
    readonly label?: string,
    required = false,
    defaultVal?: string,
    defaultValFormula?: string,
    values?: PicklistValue[],
    controllingField?: string,
    valueSettings?: ValueSettings[],
    picklistRestricted?: boolean,
    valueSetName?: string,
    formula?: string,
    summaryFilterItems?: FilterItem[],
    relatedTo?: string[],
    relationshipName?: string,
    allowLookupRecordDeletion?: boolean,
  ) {
    this.type = type
    if (formula) {
      this.formula = formula
    } else {
      switch (this.type) {
        case 'Text':
          this.length = 80
          break
        case 'LongTextArea':
        case 'Html':
          this.length = 32768
          break
        case 'EncryptedText':
          this.length = 32
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
      if ((values && !_.isEmpty(values)) || (valueSetName)) {
        if (values && !_.isEmpty(values)) {
          this.valueSet = {
            restricted: picklistRestricted || false,
            valueSetDefinition: {
              value: values.map(val =>
                new CustomPicklistValue(val.fullName, val.default, val.label)),
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
    } else if (type === FIELD_TYPE_NAMES.LOOKUP) {
      this.relationshipName = relationshipName
      this.deleteConstraint = allowLookupRecordDeletion ? 'SetNull' : 'Restrict'
      this.referenceTo = relatedTo
    } else if (type === FIELD_TYPE_NAMES.MASTER_DETAIL) {
      this.relationshipName = relationshipName
      this.referenceTo = relatedTo
    } else if (type === FIELD_TYPE_NAMES.ROLLUP_SUMMARY && summaryFilterItems) {
      this.summaryFilterItems = summaryFilterItems
    }

    // Checkbox, Formula, AutoNumber, LongTextArea and RichTextArea
    //  fields should not have required field
    if (!([FIELD_TYPE_NAMES.CHECKBOX,
      FIELD_TYPE_NAMES.AUTONUMBER,
      FIELD_TYPE_NAMES.LONGTEXTAREA,
      FIELD_TYPE_NAMES.RICHTEXTAREA] as string[]).includes(this.type)
      && !formula) {
      this.required = required
    }
  }
}

export class CustomObject implements MetadataInfo {
  readonly pluralLabel: string
  readonly fields?: CustomField[] | CustomField

  readonly deploymentStatus = 'Deployed'
  readonly sharingModel: string
  readonly nameField = {
    type: 'Text',
    label: 'Name',
  }

  constructor(
    readonly fullName: string,
    readonly label: string,
    fields?: CustomField[]
  ) {
    this.pluralLabel = `${this.label}s`
    if (fields) {
      this.fields = fields
    }

    const hasMasterDetailField = (): boolean|undefined => fields
      && fields.some(field => field.type === FIELD_TYPE_NAMES.MASTER_DETAIL)

    if (hasMasterDetailField()) {
      this.sharingModel = 'ControlledByParent'
    } else {
      this.sharingModel = 'ReadWrite'
    }
  }
}

export interface SfError {
  extendedErrorDetails: string[]
  extendedErrorCode: number[]
  fields: string[]
  message: string
  statusCode: number
}

export interface CompleteSaveResult extends SaveResult {
  success: boolean
  fullName: string
  errors: SfError | SfError[]
}
