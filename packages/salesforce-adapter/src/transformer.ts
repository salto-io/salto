import _ from 'lodash'
import {
  ValueTypeField, Field, MetadataInfo, DefaultValueWithType,
} from 'jsforce'

import {
  Type, ObjectType, ElemID, PrimitiveTypes, PrimitiveType, Values,
  Field as TypeField, BuiltinTypes,
} from 'adapter-api'
import {
  CustomObject, CustomField,
} from './client/types'
import {
  API_NAME, LABEL, PICKLIST_VALUES, SALESFORCE, RESTRICTED_PICKLIST, FORMULA,
  FORMULA_TYPE_PREFIX, METADATA_OBJECT_NAME_FIELD, METADATA_TYPES_SUFFIX,
  PRECISION, FIELD_TYPE_NAMES, FIELD_TYPE_API_NAMES,
} from './constants'

const capitalize = (s: string): string => {
  if (typeof s !== 'string') return ''
  return s.charAt(0).toUpperCase() + s.slice(1)
}
export const sfCase = (name: string, custom: boolean = false): string =>
  capitalize(_.camelCase(name)) + (custom === true ? '__c' : '')
export const bpCase = (name: string): string =>
  (name.endsWith('__c') ? _.snakeCase(name).slice(0, -2) : _.snakeCase(name))
export const sfTypeName = (type: Type, customObject: boolean = false): string =>
  (customObject
    ? sfCase(type.elemID.name, customObject)
    : type.elemID.nameParts.slice(0, -1).map(p => sfCase(p, customObject)).join())
export const bpNameParts = (name: string, customObject: boolean): string[] =>
  (customObject
    ? [bpCase(name)]
    : [bpCase(name), METADATA_TYPES_SUFFIX])

export const apiName = (element: Type | TypeField): string => (
  element.annotationsValues[API_NAME]
)

const formulaTypeName = (baseTypeName: string): string =>
  `${FORMULA_TYPE_PREFIX}${baseTypeName}`
const fieldTypeName = (typeName: string): string => (
  typeName.startsWith(FORMULA_TYPE_PREFIX) ? typeName.slice(FORMULA_TYPE_PREFIX.length) : typeName
)

const textType = new PrimitiveType({
  elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.TEXT),
  primitive: PrimitiveTypes.STRING,
})
// Defines SFDC built-in field types & built-in primitive data types
// Ref: https://developer.salesforce.com/docs/atlas.en-us.api.meta/api/field_types.htm
// Ref: https://developer.salesforce.com/docs/atlas.en-us.api.meta/api/primitive_data_types.htm
export class Types {
  // Type mapping for custom objects
  public static salesforceDataTypes: Record<string, Type> = {
    string: textType,
    text: textType,
    number: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.NUMBER),
      primitive: PrimitiveTypes.NUMBER,
      annotations: {
        scale: BuiltinTypes.NUMBER,
        precision: BuiltinTypes.NUMBER,
      },
    }),
    boolean: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.CHECKBOX),
      primitive: PrimitiveTypes.BOOLEAN,
    }),
    date: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.DATE),
      primitive: PrimitiveTypes.STRING,
    }),
    time: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.TIME),
      primitive: PrimitiveTypes.STRING,
    }),
    datetime: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.DATETIME),
      primitive: PrimitiveTypes.STRING,
    }),
    currency: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.CURRENCY),
      primitive: PrimitiveTypes.NUMBER,
      annotations: {
        scale: BuiltinTypes.NUMBER,
        precision: BuiltinTypes.NUMBER,
      },
    }),
    picklist: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.PICKLIST),
      primitive: PrimitiveTypes.STRING,
    }),
  }

  // Type mapping for metadata types
  private static metadataPrimitiveTypes: Record<string, Type> = {
    string: BuiltinTypes.STRING,
    double: BuiltinTypes.NUMBER,
    boolean: BuiltinTypes.BOOLEAN,
  }

  static get(name: string, customObject: boolean = true): Type {
    const type = customObject
      ? this.salesforceDataTypes[name]
      : this.metadataPrimitiveTypes[name]

    if (type === undefined) {
      return new ObjectType({
        elemID: new ElemID(SALESFORCE, ...bpNameParts(name, customObject)),
      })
    }
    return type
  }

  static getAllFieldTypes(): Type[] {
    return Object.values(Types.salesforceDataTypes)
  }
}

export const fieldFullName = (object: ObjectType, field: TypeField): string =>
  `${apiName(object)}.${apiName(field)}`

const allowedAnnotations = (key: string): string[] => (
  Types.salesforceDataTypes[key] ? Object.keys(Types.salesforceDataTypes[key].annotations) : []
)

export const toCustomField = (
  object: ObjectType, field: TypeField, fullname: boolean = false
): CustomField => {
  const newField = new CustomField(
    fullname ? fieldFullName(object, field) : apiName(field),
    FIELD_TYPE_API_NAMES[fieldTypeName(field.type.elemID.name)],
    field.annotationsValues[LABEL],
    field.annotationsValues[Type.REQUIRED],
    field.annotationsValues[PICKLIST_VALUES],
    field.annotationsValues[FORMULA],
  )

  _.assign(newField,
    _.pickBy(
      field.annotationsValues,
      (_val, annotationValue) => allowedAnnotations(
        field.type.elemID.name
      ).includes(annotationValue)
    ))

  return newField
}

export const toCustomObject = (element: ObjectType): CustomObject =>
  new CustomObject(
    apiName(element),
    element.annotationsValues[LABEL],
    Object.values(element.fields).map(field => toCustomField(element, field))
  )

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

type DefaultValueType = string | boolean | number

const isDefaultWithType = (val: DefaultValueType | DefaultValueWithType):
  val is DefaultValueWithType => new Set(_.keys(val)).has('_')

const valueFromXsdType = (val: DefaultValueWithType): DefaultValueType => {
  type ConvertFuncT = (v: string) => DefaultValueType
  const convertFuncMap: Record<string, ConvertFuncT> = {
    'xsd:string': String,
    'xsd:boolean': v => v === 'true',
    'xsd:double': Number,
    'xsd:int': Number,
    'xsd:long': Number,
  }
  const convertFunc = convertFuncMap[val.$['xsi:type']] || (v => v)
  return convertFunc(val._)
}

const getDefaultValue = (field: Field): DefaultValueType | undefined => {
  if (field.defaultValue === null || field.defaultValue === undefined) {
    return undefined
  }

  return isDefaultWithType(field.defaultValue)
    ? valueFromXsdType(field.defaultValue) : field.defaultValue
}

export const getSObjectFieldElement = (parentID: ElemID, field: Field): TypeField => {
  const bpFieldName = bpCase(field.name)
  let bpFieldType = Types.get(field.type)
  const annotations: Values = {
    [API_NAME]: field.name,
    [LABEL]: field.label,
    [Type.REQUIRED]: !field.nillable,
  }
  const defaultValue = getDefaultValue(field)
  if (defaultValue !== undefined) {
    annotations[Type.DEFAULT] = defaultValue
  }

  if (field.picklistValues && field.picklistValues.length > 0) {
    annotations[PICKLIST_VALUES] = field.picklistValues.map(val => val.value)
    annotations[RESTRICTED_PICKLIST] = Boolean(field.restrictedPicklist)

    const defaults = field.picklistValues
      .filter(val => val.defaultValue === true)
      .map(val => val.value)
    if (defaults.length > 0) {
      if (field.type.endsWith('picklist')) {
        annotations[Type.DEFAULT] = defaults.pop()
      } else {
        annotations[Type.DEFAULT] = defaults
      }
    }
    if (field.type === 'multipicklist') {
      // Precision is the field for multi-picklist in SFDC API that defines how many objects will
      // be visible in the picklist in the UI. Why? Because.
      annotations[PRECISION] = field.precision
    }
  } else if (field.calculated && !_.isEmpty(field.calculatedFormula)) {
    bpFieldType = Types.get(formulaTypeName(bpFieldType.elemID.name))
    annotations[FORMULA] = field.calculatedFormula
  } else if (!_.isEmpty(bpFieldType.annotations)) {
    // For most of the field types (except for picklist & formula)
    _.assign(annotations,
      _.pickBy(
        field,
        (_val, key) => allowedAnnotations(
          _.toLower(bpFieldType.elemID.name)
        ).includes(key)
      ))
  }
  // Set all type names to appear as lower case,
  // differently than the Camel Casing when passing them to the API

  return new TypeField(parentID, bpFieldName, bpFieldType, annotations)
}

export const fromMetadataInfo = (info: MetadataInfo): Values => {
  const transform = (obj: Values): Values => {
    const returnVal: Values = {}
    Object.keys(obj).filter(key => key !== METADATA_OBJECT_NAME_FIELD)
      .forEach(key => {
        if (_.isObject(obj[key])) {
          returnVal[bpCase(key)] = transform(obj[key])
        } else {
          returnVal[bpCase(key)] = obj[key]
        }
      })
    return returnVal
  }
  return transform(info as Values)
}
