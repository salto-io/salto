import { snakeCase, camelCase } from 'lodash'
import { ValueTypeField, Field } from 'jsforce'
import {
  Type, ObjectType, ElemID, PrimitiveTypes, PrimitiveType, Values,
  Field as TypeField, BuiltinTypes,
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
  (name.endsWith('__c') ? snakeCase(name).slice(0, -2) : snakeCase(name))

export const apiName = (element: Type | TypeField): string => (
  element.annotationsValues[API_NAME]
)


export class Types {
  // Type mapping for custom objects
  private static customObjectTypes: Record<string, Type> = {
    string: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, 'string'),
      primitive: PrimitiveTypes.STRING,
    }),
    double: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, 'number'),
      primitive: PrimitiveTypes.NUMBER,
    }),
    boolean: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, 'checkbox'),
      primitive: PrimitiveTypes.BOOLEAN,
    }),
  }

  // Type mapping for metadata types
  private static metadataTypes: Record<string, Type> = {
    string: BuiltinTypes.STRING,
    double: BuiltinTypes.NUMBER,
    boolean: BuiltinTypes.BOOLEAN,
  }

  static get(name: string, customObject: boolean = true): Type {
    const typeMapping = customObject ? this.customObjectTypes : this.metadataTypes
    const typeName = bpCase(name)
    const type = typeMapping[typeName]
    if (type === undefined) {
      return new ObjectType({
        elemID: new ElemID(SALESFORCE, typeName),
      })
    }
    return type
  }
}

export const fieldFullName = (object: ObjectType, field: TypeField): string =>
  `${apiName(object)}.${apiName(field)}`

export const toCustomField = (
  object: ObjectType, field: TypeField, fullname: boolean = false
): CustomField =>
  new CustomField(
    fullname ? fieldFullName(object, field) : apiName(field),
    field.type.elemID.name,
    field.annotationsValues[LABEL],
    field.annotationsValues[Type.REQUIRED],
    field.annotationsValues[PICKLIST_VALUES],
  )

export const toCustomObject = (element: ObjectType): CustomObject =>
  new CustomObject(
    apiName(element),
    element.annotationsValues[LABEL],
    Object.values(element.fields).map(field => toCustomField(element, field))
  )

export const toProfiles = (object: ObjectType, fields: TypeField[]): ProfileInfo[] => {
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
      (profiles.get(profile) as ProfileInfo).fieldPermissions.push({
        field: fieldFullName(object, field),
        editable: permissions.editable,
        readable: permissions.readable,
      })
    })
  })
  return Array.from(profiles.values())
}

export const getValueTypeFieldElement = (parentID: ElemID, field: ValueTypeField): TypeField => {
  const bpFieldName = bpCase(field.name)
  let bpFieldType = Types.get(field.soapType, false)
  const annotations: Values = {
    [Type.REQUIRED]: field.valueRequired,
  }

  if (field.picklistValues && field.picklistValues.length > 0) {
    // In metadata types picklist values means this is actually an enum
    // Currently it seems that we can assume all enums are string enums
    bpFieldType = BuiltinTypes.STRING

    annotations[Type.RESTRICTION] = {
      values: field.picklistValues.map(val => val.value),
    }
    const defaults = field.picklistValues
      .filter(val => val.defaultValue === true)
      .map(val => val.value)
    if (defaults.length === 1) {
      annotations[Type.DEFAULT] = defaults.pop()
    } else {
      annotations[Type.DEFAULT] = defaults
    }
  }
  return new TypeField(parentID, bpFieldName, bpFieldType, annotations)
}

export const getFieldAnnotations = (field: Field): Values => {
  const annotations: Values = {}
  annotations[LABEL] = field.label
  annotations[Type.REQUIRED] = !field.nillable
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
      (permissions.get(name) as Map<string, FieldPermission>).set(info.fullName, {
        editable: fieldPermission.editable,
        readable: fieldPermission.readable,
      })
    })
  })

  return permissions
}
