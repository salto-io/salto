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
  readonly type: string
  constructor(
    public fullName: string,
    type: string,
    readonly label?: string,
  ) {
    this.type = type
  }
}

export class TextField extends CustomField {
  readonly length: number = 0
  readonly formula?: string
  readonly required?: boolean
  constructor(
    public fullName: string,
    type: string,
    readonly label?: string,
    required: boolean = false,
    formula?: string,
  ) {
    super(fullName, type, label)
    if (formula) {
      this.formula = formula
    } else {
      this.length = 80
      this.required = required
    }
  }
}

export class CurrencyField extends CustomField {
  scale: number = 0
  precision: number = 0
  readonly required?: boolean
  constructor(
    public fullName: string,
    type: string,
    scale: number,
    precision: number,
    readonly label?: string,
    required: boolean = false,
  ) {
    super(fullName, type, label)
    this.scale = scale
    this.precision = precision
    this.required = required
  }
}

export class PicklistField extends CustomField {
  readonly valueSet?: { valueSetDefinition: { value: CustomPicklistValue[] } }
  readonly required?: boolean
  constructor(
    public fullName: string,
    type: string,
    readonly label?: string,
    required: boolean = false,
    values?: string[],
  ) {
    super(fullName, type, label)
    if (values && !_.isEmpty(values)) {
      this.valueSet = {
        valueSetDefinition: {
          value: values.map(val => new CustomPicklistValue(val)),
        },
      }
    }
    this.required = required
  }
}

export class NumberField extends CustomField {
  readonly formula?: string
  readonly required?: boolean
  constructor(
    public fullName: string,
    type: string,
    readonly label?: string,
    required: boolean = false,
    formula?: string,
  ) {
    super(fullName, type, label)
    if (formula) {
      this.formula = formula
    } else {
      this.required = required
    }
  }
}

export class CheckboxField extends CustomField {
  readonly required?: boolean
  constructor(
    public fullName: string,
    type: string,
    readonly label?: string,
    required: boolean = false,
  ) {
    super(fullName, type, label)
    this.required = required
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
