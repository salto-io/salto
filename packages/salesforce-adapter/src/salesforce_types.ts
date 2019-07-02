import { MetadataInfo } from 'jsforce'
import { ObjectType } from 'adapter-api'
import { LABEL, REQUIRED, PICKLIST_VALUES } from './constants'

export interface FieldPermissions {
  field: string
  editable: boolean
  readable: boolean
}

export class ProfileInfo implements MetadataInfo {
  fieldPermissions: FieldPermissions[]
  constructor(public readonly fullName: string) {
    this.fieldPermissions = []
  }
}

class CustomPicklistValue implements MetadataInfo {
  constructor(public readonly fullName: string, readonly label?: string) {
    if (!this.label) {
      this.label = fullName
    }
  }
}

export class CustomField implements MetadataInfo {
  private static readonly fieldTypeMapping: Record<string, string> = {
    string: 'Text',
    int: 'Number',
    boolean: 'Checkbox',
    picklist: 'Picklist',
    combobox: 'Combobox'
  }

  readonly fullName: string
  readonly type: string
  // To be used for picklist and combobox types
  readonly valueSet: { valueSetDefinition: { value: CustomPicklistValue[] } }
  // To be used for Text types fields
  readonly length: number

  constructor(
    fullName: string,
    type: string,
    public label?: string,
    public required: boolean = false,
    values?: string[]
  ) {
    this.fullName = `${fullName}__c`
    this.type = CustomField.fieldTypeMapping[type]
    if (this.type === 'Text') {
      this.length = 80
    }

    if (values) {
      this.valueSet = {
        valueSetDefinition: { value: [] as CustomPicklistValue[] }
      }
      values.forEach(val => {
        this.valueSet.valueSetDefinition.value.push(
          new CustomPicklistValue(val)
        )
      })
    }
  }
}

export class CustomObject implements MetadataInfo {
  readonly fullName: string
  readonly label: string
  readonly pluralLabel: string
  readonly fields: CustomField[] = []

  readonly deploymentStatus = 'Deployed'
  readonly sharingModel = 'ReadWrite'
  readonly nameField = {
    type: 'Text',
    label: 'Test Object Name'
  }

  constructor(element: ObjectType) {
    this.fullName = `${element.typeID.name}__c`
    this.label = element.typeID.name
    this.pluralLabel = `${this.label}s`

    Object.entries(element.fields).forEach(([fieldName, field]) => {
      // TODO: handle default values
      const annotations = field.annotationsValues
      this.fields.push(
        new CustomField(
          fieldName,
          field.typeID.name,
          annotations[LABEL],
          annotations[REQUIRED],
          annotations[PICKLIST_VALUES]
          // TODO: use restricted picklist
          // annotations[RESTRICTED_PICKLIST]
        )
      )
    })
  }
}
