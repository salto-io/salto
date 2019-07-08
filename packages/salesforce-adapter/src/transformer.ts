import { snakeCase, camelCase } from 'lodash'
import { ValueTypeField, Field } from 'jsforce'
import {
  Type, ObjectType, ElemID, PrimitiveTypes, PrimitiveType, Values,
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

export const apiName = (element: Type, fieldName?: string): string => {
  if (fieldName === undefined) {
    return element.annotationsValues[API_NAME]
  }
  return element.getAnnotationValue(fieldName, API_NAME)
}

export class Types {
  static get(name: string): Type {
    const typeName = bpCase(name)
    switch (typeName) {
      case 'string': {
        return new PrimitiveType({
          elemID: new ElemID({ adapter: '', name }),
          primitive: PrimitiveTypes.STRING,
        })
      }
      case 'double': {
        return new PrimitiveType({
          elemID: new ElemID({ adapter: '', name: 'number' }),
          primitive: PrimitiveTypes.NUMBER,
        })
      }
      case 'boolean': {
        return new PrimitiveType({
          elemID: new ElemID({ adapter: '', name: 'checkbox' }),
          primitive: PrimitiveTypes.BOOLEAN,
        })
      }
      default: {
        return new ObjectType({
          elemID: new ElemID({ adapter: SALESFORCE, name }),
        })
      }
    }
  }
}

export const fieldFullName = (object: ObjectType, fieldName: string): string =>
  `${apiName(object)}.${apiName(object, fieldName)}`

export const toCustomField = (
  object: ObjectType, name: string, fullname: boolean = false
): CustomField =>
  new CustomField(
    fullname ? fieldFullName(object, name) : apiName(object, name),
    object.fields[name].elemID.name,
    object.getAnnotationValue(name, LABEL),
    object.getAnnotationValue(name, Type.REQUIRED),
    object.getAnnotationValue(name, PICKLIST_VALUES),
  )

export const toCustomObject = (element: ObjectType): CustomObject =>
  new CustomObject(
    apiName(element),
    element.annotationsValues[LABEL],
    Object.keys(element.fields).map(name => toCustomField(element, name))
  )

export const toProfiles = (object: ObjectType, fields: string[]): ProfileInfo[] => {
  const profiles = new Map<string, ProfileInfo>()
  fields.forEach(field => {
    const fieldPermissions = object.getAnnotationValue(field, FIELD_LEVEL_SECURITY)
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

export const getValueTypeFieldAnnotations = (field: ValueTypeField): Values => {
  const annotations: Values = {}
  annotations.required = field.valueRequired

  if (field.picklistValues && field.picklistValues.length > 0) {
    annotations.values = field.picklistValues.map(
      val => val.value
    )
    const defaults = field.picklistValues
      .filter(val => val.defaultValue === true)
      .map(val => val.value)
    if (defaults.length === 1) {
      annotations[Type.DEFAULT] = defaults.pop()
    } else {
      annotations[Type.DEFAULT] = defaults
    }
  }
  return annotations
}

export const getFieldAnnotations = (field: Field): Values => {
  const annotations: Values = {}
  annotations[LABEL] = field.label
  annotations[Type.REQUIRED] = field.nillable
  if (field.defaultValue !== null) {
    annotations[Type.DEFAULT] = field.defaultValue
  }

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

  return annotations
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
