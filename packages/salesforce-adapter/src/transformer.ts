import { snakeCase, startCase, camelCase } from 'lodash'
import { ValueTypeField, Field } from 'jsforce'
import {
  Type,
  ObjectType,
  TypesRegistry,
  TypeID,
  PrimitiveTypes,
} from 'adapter-api'
import { CustomObject, CustomField, ProfileInfo } from './client/types'
import {
  API_NAME,
  LABEL,
  PICKLIST_VALUES,
  SALESFORCE,
  RESTRICTED_PICKLIST,
} from './constants'

export const sfCase = (name: string, custom: boolean = false): string =>
  startCase(camelCase(name)) + (custom === true ? '__c' : '')
export const bpCase = (name: string): string =>
  (name.endsWith('__c') ? snakeCase(name).slice(0, -3) : snakeCase(name))

export class Types {
  // type registery used in discover
  static readonly types = new TypesRegistry()

  static get(name: string): Type {
    const typeName = bpCase(name)
    switch (typeName) {
      case 'string': {
        return this.types
          .getType(new TypeID({ adapter: '', name }), PrimitiveTypes.STRING)
          .clone()
      }
      case 'double': {
        return this.types
          .getType(
            new TypeID({ adapter: '', name: 'number' }),
            PrimitiveTypes.NUMBER
          )
          .clone()
      }
      case 'boolean': {
        return this.types
          .getType(
            // TODO: take checkbox from constans
            new TypeID({ adapter: SALESFORCE, name: 'checkbox' })
          )
          .clone()
      }
      default: {
        return this.types
          .getType(new TypeID({ adapter: SALESFORCE, name }))
          .clone()
      }
    }
  }
}

export const fieldFullName = (
  typeApiName: string,
  fieldApiName: string
): string => `${typeApiName}.${fieldApiName}`

export const toCustomField = (
  field: Type,
  fullname: boolean = false,
  objectName: string = ''
): CustomField =>
  new CustomField(
    fullname
      ? fieldFullName(objectName, field.annotationsValues[API_NAME])
      : field.annotationsValues[API_NAME],
    field.typeID.name,
    field.annotationsValues[LABEL],
    field.annotationsValues[Type.REQUIRED],
    field.annotationsValues[PICKLIST_VALUES]
  )

export const toCustomObject = (element: ObjectType): CustomObject =>
  new CustomObject(
    element.annotationsValues[API_NAME],
    element.annotationsValues[LABEL],
    Object.values(element.fields).map(f => toCustomField(f))
  )

export const toProfileInfo = (
  profile: string,
  objectApiName: string,
  fieldsApiName: string[]
): ProfileInfo => new ProfileInfo(
  profile,
  fieldsApiName.map(f => ({
    field: `${objectApiName}.${f}`,
    editable: true,
    readable: true,
  }))
)

export const fromValueTypeField = (field: ValueTypeField): Type => {
  const element = Types.get(field.soapType) as ObjectType
  element.annotationsValues.required = field.valueRequired

  if (field.picklistValues && field.picklistValues.length > 0) {
    element.annotationsValues.values = field.picklistValues.map(
      val => val.value
    )
    const defaults = field.picklistValues
      .filter(val => val.defaultValue === true)
      .map(val => val.value)
    if (defaults.length === 1) {
      element.annotationsValues[Type.DEFAULT] = defaults.pop()
    } else {
      element.annotationsValues[Type.DEFAULT] = defaults
    }
  }

  return element
}

export const fromField = (field: Field): Type => {
  const element: Type = Types.get(field.type)
  const annotations = element.annotationsValues
  annotations[LABEL] = field.label
  annotations[Type.REQUIRED] = field.nillable
  annotations[Type.DEFAULT] = field.defaultValue

  if (field.picklistValues && field.picklistValues.length > 0) {
    annotations[PICKLIST_VALUES] = field.picklistValues.map(val => val.value)
    annotations[RESTRICTED_PICKLIST] = false
    if (field.restrictedPicklist) {
      annotations[RESTRICTED_PICKLIST] = field.restrictedPicklist
    }

    const defaults = field.picklistValues
      .filter(val => val.defaultValue === true)
      .map(val => val.value)
    if (defaults.length > 0) {
      if (field.type === 'picklist') {
        annotations[Type.DEFAULT] = defaults.pop()
      } else {
        annotations[Type.DEFAULT] = defaults
      }
    }
  }

  return element
}
