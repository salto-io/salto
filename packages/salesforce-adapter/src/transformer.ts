import _ from 'lodash'
import {
  ValueTypeField, Field, MetadataInfo, DefaultValueWithType,
} from 'jsforce'

import {
  Type, ObjectType, ElemID, PrimitiveTypes, PrimitiveType, Values,
  Field as TypeField, BuiltinTypes, Element, isObjectType, isPrimitiveType, isInstanceElement,
} from 'adapter-api'
import {
  CustomObject, CustomField,
} from './client/types'
import {
  API_NAME, LABEL, PICKLIST_VALUES, SALESFORCE, RESTRICTED_PICKLIST, FORMULA,
  FORMULA_TYPE_PREFIX, METADATA_TYPES_SUFFIX,
  PRECISION, FIELD_TYPE_NAMES, FIELD_TYPE_API_NAMES, METADATA_TYPE,
} from './constants'

const capitalize = (s: string): string => {
  if (typeof s !== 'string') return ''
  return s.charAt(0).toUpperCase() + s.slice(1)
}
export const sfCase = (name: string, custom: boolean = false, capital: boolean = true): string => {
  const sf = _.camelCase(name) + (custom ? '__c' : '')
  return capital ? capitalize(sf) : sf
}

export const bpCase = (name: string): string => {
  const bpName = (name.endsWith('__c') ? name.slice(0, -2) : name)
  // Using specific replace for chars then _.unescape is not replacing well
  // and we see in our responses for sfdc
  return _.snakeCase(_.unescape(bpName.replace(/%26|%28|%29/g, ' ')))
}
export const sfTypeName = (type: Type, customObject: boolean = false): string =>
  (customObject
    ? sfCase(type.elemID.name, customObject)
    : type.elemID.nameParts.slice(0, -1).map(p => sfCase(p, customObject)).join(''))
export const sfInstnaceName = (instance: Element): string =>
  instance.elemID.nameParts.slice(1).map(p => sfCase(p, false)).join('')
export const bpNameParts = (name: string, customObject: boolean): string[] =>
  (customObject
    ? [bpCase(name)]
    : [bpCase(name), METADATA_TYPES_SUFFIX])
export const apiName = (elem: Element): string => (
  (isInstanceElement(elem)) ? sfCase(elem.elemID.name) : elem.getAnnotationsValues()[API_NAME]
)

export const metadataType = (element: Element): string => (
  element.getAnnotationsValues()[METADATA_TYPE]
)

const formulaTypeName = (baseTypeName: string): string =>
  `${FORMULA_TYPE_PREFIX}${baseTypeName}`
const fieldTypeName = (typeName: string): string => (
  typeName.startsWith(FORMULA_TYPE_PREFIX) ? typeName.slice(FORMULA_TYPE_PREFIX.length) : typeName
)

// Defines SFDC built-in field types & built-in primitive data types
// Ref: https://developer.salesforce.com/docs/atlas.en-us.api.meta/api/field_types.htm
// Ref: https://developer.salesforce.com/docs/atlas.en-us.api.meta/api/primitive_data_types.htm
export class Types {
  // Type mapping for custom objects
  public static salesforceDataTypes: Record<string, Type> = {
    // Adding string on top of a text is a temp solution as we are not supporting computed fields.
    // As far as we know string appears only in compound fields (at least in Name).
    string: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.STRING),
      primitive: PrimitiveTypes.STRING,
    }),
    text: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.TEXT),
      primitive: PrimitiveTypes.STRING,
    }),
    number: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.NUMBER),
      primitive: PrimitiveTypes.NUMBER,
      annotations: {
        scale: BuiltinTypes.NUMBER,
        precision: BuiltinTypes.NUMBER,
      },
    }),
    autonumber: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.AUTONUMBER),
      primitive: PrimitiveTypes.STRING,
      annotations: {
        displayFormat: BuiltinTypes.STRING,
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
    int: BuiltinTypes.NUMBER,
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
    field.getAnnotationsValues()[LABEL],
    field.getAnnotationsValues()[Type.REQUIRED],
    field.getAnnotationsValues()[PICKLIST_VALUES],
    field.getAnnotationsValues()[FORMULA],
  )

  _.assign(newField,
    _.pickBy(
      field.getAnnotationsValues(),
      (_val, annotationValue) => allowedAnnotations(
        field.type.elemID.name
      ).includes(annotationValue)
    ))

  return newField
}

export const toCustomObject = (element: ObjectType): CustomObject =>
  new CustomObject(
    apiName(element),
    element.getAnnotationsValues()[LABEL],
    Object.values(element.fields).map(field => toCustomField(element, field))
  )

export const getValueTypeFieldElement = (parentID: ElemID, field: ValueTypeField,
  knonwTypes: Map<string, Type>): TypeField => {
  const bpFieldName = bpCase(field.name)
  let bpFieldType = knonwTypes.has(field.soapType)
    ? knonwTypes.get(field.soapType) as Type
    // If type is not known type it have to be primitive,
    // we create sub types before calling this function.
    : Types.get(field.soapType, false)
  const annotations: Values = { [Type.REQUIRED]: field.valueRequired }

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

// The following method is used during the discovery process and is used in building the objects
// described in the blue print
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
  // Picklists
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
  // Formulas
  } else if (field.calculated && !_.isEmpty(field.calculatedFormula)) {
    bpFieldType = Types.get(formulaTypeName(bpFieldType.elemID.name))
    annotations[FORMULA] = field.calculatedFormula
  }
  if (!_.isEmpty(bpFieldType.annotations)) {
    // For most of the field types (except for picklist & formula)
    _.assign(annotations,
      _.pickBy(
        field,
        (_val, key) => allowedAnnotations(
          _.toLower(bpFieldType.elemID.name)
        ).includes(key)
      ))
  }

  return new TypeField(parentID, bpFieldName, bpFieldType, annotations)
}

const transformPrimitive = (val: string, primitive: PrimitiveTypes):
  string | boolean | number => {
  switch (primitive) {
    case PrimitiveTypes.NUMBER:
      return Number(val)
    case PrimitiveTypes.BOOLEAN:
      return (val.toLowerCase() === 'true')
    case PrimitiveTypes.STRING:
      return val
    default:
      return val
  }
}

const transform = (obj: Values, type: ObjectType, convert: (name: string) => string,
  strict: boolean = true): Values =>
  _(obj).mapKeys((_value, key) => convert(key)).mapValues((value, key) => {
    // we get lists of empty strings that we would like to filter out
    if (_.isArray(value) && _.isEmpty(value.filter(v => !_.isEmpty(v)))) {
      return undefined
    }
    // we get empty strings that we would like to filter out, will filter non string cases too.
    if (_.isEmpty(value)) {
      return undefined
    }

    const field = type.fields[key]
    if (field !== undefined) {
      const fieldType = field.type
      if (isObjectType(fieldType)) {
        return _.isArray(value)
          ? value.map(v => transform(v, fieldType, convert, strict))
            .filter(v => !_.isEmpty(v))
          : transform(value, fieldType, convert, strict)
      }
      if (isPrimitiveType(fieldType)) {
        return _.isArray(value)
          ? value.map(v => transformPrimitive(v, fieldType.primitive)).filter(v => !_.isEmpty(v))
          : transformPrimitive(value, fieldType.primitive)
      }
    }
    // We are not returning the value if it's not fit the type definition.
    // We saw cases where we got for jsforce values empty values in unexpected
    // format for example:
    // "layoutColumns":["","",""] where layoutColumns suppose to be list of object
    // with LayoutItem and reserve fields.
    // return undefined
    // We are not strict for salesforce Settings type as type definition is empty
    // and each Setting looks different
    if (strict) {
      return undefined
    }
    return value
  }).omitBy(_.isUndefined)
    .value()

export const fromMetadataInfo = (info: MetadataInfo, infoType: ObjectType, strict: boolean = true):
  Values =>
  transform(info as Values, infoType, bpCase, strict)


export const toMetadataInfo = (fullName: string, values: Values, infoType: ObjectType):
  MetadataInfo =>
  ({ fullName, ...transform(values, infoType, (name: string) => sfCase(name, false, false)) })
