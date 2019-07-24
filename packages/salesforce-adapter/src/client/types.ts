import { MetadataInfo, SaveResult } from 'jsforce'
import _ from 'lodash'

export interface FieldPermissions {
  field: string
  editable: boolean
  readable: boolean
}

export class ProfileInfo implements MetadataInfo {
  constructor(
    public readonly fullName: string,
    public fieldPermissions: FieldPermissions[] = []
  ) {}
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
    combobox: 'Combobox',
  }

  readonly type: string
  readonly required?: boolean
  readonly formula?: string
  // To be used for picklist and combobox types
  readonly valueSet?: { valueSetDefinition: { value: CustomPicklistValue[] } }

  // To be used for Text types fields
  readonly length: number = 0

  constructor(
    public fullName: string,
    type: string,
    readonly label?: string,
    required: boolean = false,
    values?: string[],
    formula?: string,
  ) {
    const typeName = formula ? type.replace('formula_', '') : type
    this.type = CustomField.fieldTypeMapping[typeName]
    if (formula) {
      this.formula = formula
    } else {
      if (this.type === 'Text') {
        this.length = 80
      }
      this.required = !!required
    }

    if (values && !_.isEmpty(values)) {
      this.valueSet = {
        valueSetDefinition: {
          value: values.map(val => new CustomPicklistValue(val)),
        },
      }
    }
  }
}

export class CustomObject implements MetadataInfo {
  readonly pluralLabel: string
  readonly fields: CustomField[] | CustomField = []

  readonly deploymentStatus = 'Deployed'
  readonly sharingModel = 'ReadWrite'
  readonly nameField = {
    type: 'Text',
    label: 'Test Object Name',
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
