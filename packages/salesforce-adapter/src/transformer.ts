import { snakeCase, camelCase } from 'lodash'
import { ValueTypeField, Field } from 'jsforce'
import {
  Type, ObjectType, ElementsRegistry, ElemID, PrimitiveTypes,
} from 'adapter-api'
import { CustomObject, CustomField, ProfileInfo } from './client/types'
import {
  API_NAME, LABEL, PICKLIST_VALUES, SALESFORCE, RESTRICTED_PICKLIST, FIELD_LEVEL_SECURITY,
} from './constants'

const capitalize = (s: string): string => {
  if (typeof s !== 'string') return ''
  return s.charAt(0).toUpperCase() + s.slice(1)
}
export const sfCase = (name: string, custom: boolean = false): string =>
  capitalize(camelCase(name)) + (custom === true ? '__c' : '')
export const bpCase = (name: string): string =>
  (name.endsWith('__c') ? snakeCase(name).slice(0, -3) : snakeCase(name))

export const apiName = (element: Type): string => element.annotationsValues[API_NAME]

export class Types {
  // type registery used in discover
  static readonly types = new ElementsRegistry()

  static get(name: string): Type {
    const typeName = bpCase(name)
    switch (typeName) {
      case 'string': {
        return this.types
          .getElement(new ElemID({ adapter: '', name }), PrimitiveTypes.STRING)
          .clone()
      }
      case 'double': {
        return this.types
          .getElement(
            new ElemID({ adapter: '', name: 'number' }),
            PrimitiveTypes.NUMBER
          )
          .clone()
      }
      case 'boolean': {
        return this.types
          .getElement(
            // TODO: take checkbox from constans
            new ElemID({ adapter: SALESFORCE, name: 'checkbox' })
          )
          .clone()
      }
      default: {
        return this.types
          .getElement(new ElemID({ adapter: SALESFORCE, name }))
          .clone()
      }
    }
  }
}

export const fieldFullName = (object: ObjectType, field: Type): string =>
  `${apiName(object)}.${apiName(field)}`

export const toCustomField = (field: Type, fullname: boolean = false, object?: ObjectType):
 CustomField =>
  new CustomField(
    fullname ? fieldFullName(object, field) : apiName(field),
    field.elemID.name,
    field.annotationsValues[LABEL],
    field.annotationsValues[Type.REQUIRED],
    field.annotationsValues[PICKLIST_VALUES]
  )

export const toCustomObject = (element: ObjectType): CustomObject =>
  new CustomObject(
    apiName(element),
    element.annotationsValues[LABEL],
    Object.values(element.fields).map(f => toCustomField(f))
  )

export const toProfiles = (object: ObjectType, fields: Type[]): ProfileInfo[] => {
  const profiles = new Map<string, ProfileInfo>()
  fields.forEach(field => {
    const fieldPermissions = field.annotationsValues[FIELD_LEVEL_SECURITY]
    if (!fieldPermissions) {
      return
    }
    Object.entries(fieldPermissions).forEach(fieldLevelSecurity => {
      const profile = sfCase(fieldLevelSecurity[0])
      const permissions = fieldLevelSecurity[1] as {editable: boolean; readable: boolean}
      if (!profiles.has(profile)) {
        profiles.set(profile, new ProfileInfo(sfCase(profile)))
      }
      profiles.get(profile).fieldPermissions.push({
        field: fieldFullName(object, field),
        editable: permissions.editable,
        readable: permissions.readable,
      })
    })
  })
  return Array.from(profiles.values())
}

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

export interface FieldPermission {editable: boolean; readable: boolean}
/**
 * Transform list of ProfileInfo to map fieldFullName -> profileName -> FieldPermission
 */
export const fromProfiles = (profiles: ProfileInfo[]):
Map<string, Map<string, FieldPermission>> => {
  const permissions = new Map<string, Map<string, FieldPermission>>()
  profiles.forEach(info => {
    info.fieldPermissions.forEach(fieldPermission => {
      const name = fieldPermission.field
      if (!permissions.has(name)) {
        permissions.set(name, new Map<string, FieldPermission>())
      }
      permissions.get(name).set(info.fullName, {
        editable: fieldPermission.editable,
        readable: fieldPermission.readable,
      })
    })
  })

  return permissions
}
