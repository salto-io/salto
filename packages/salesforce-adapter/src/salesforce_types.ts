import { MetadataInfo } from 'jsforce'

// TODO: this should be replaced with Elements from core once ready
export type TypeElement = Record<string, any>

export interface FieldPermissions {
  field: string
  editable: boolean
  readable: boolean
}

export interface ProfileInfo extends MetadataInfo {
  fieldPermissions: FieldPermissions[]
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
    if (this.type === 'Picklist' || this.type === 'Combobox') {
      this.valueSet = {
        valueSetDefinition: { value: [] as CustomPicklistValue[] }
      }
      if (values) {
        values.forEach(val => {
          this.valueSet.valueSetDefinition.value.push(
            new CustomPicklistValue(val)
          )
        })
      }
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

  constructor(element: TypeElement) {
    this.fullName = `${element.object}__c`
    this.label = element.object
    this.pluralLabel = `${this.label}s`

    Object.keys(element)
      // skip object - not field name - this will be changed once we move to real TypeElement
      .filter(name => {
        return name !== 'object'
      })
      .forEach(fieldName => {
        const field = new CustomField(
          fieldName,
          element[fieldName].type,
          element[fieldName].label,
          element[fieldName].required,
          element[fieldName].values
          // TODO: handle default values
          // element[fieldName]._default
        )
        this.fields.push(field)
      })
  }
}
