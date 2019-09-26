import _ from 'lodash'
import {
  ValueTypeField, Field, MetadataInfo, DefaultValueWithType, QueryResult, Record as SfRecord,
} from 'jsforce'
import JSZip from 'jszip'

import {
  Type, ObjectType, ElemID, PrimitiveTypes, PrimitiveType, Values, Value,
  Field as TypeField, BuiltinTypes, Element, isInstanceElement, InstanceElement, isPrimitiveType,
} from 'adapter-api'
import { collections } from '@salto/lowerdash'
import { CustomObject, CustomField } from './client/types'
import { API_VERSION, METADATA_NAMESPACE } from './client/client'
import {
  API_NAME, LABEL, PICKLIST_VALUES, SALESFORCE, RESTRICTED_PICKLIST, FORMULA,
  FORMULA_TYPE_PREFIX, FIELD_TYPE_NAMES, FIELD_TYPE_API_NAMES, METADATA_OBJECT_NAME_FIELD,
  METADATA_TYPE, FIELD_ANNOTATIONS, SALESFORCE_CUSTOM_SUFFIX, DEFAULT_VALUE_FORMULA,
  MAX_METADATA_RESTRICTION_VALUES, SETTINGS_METADATA_TYPE,
} from './constants'

const { makeArray } = collections.array

const capitalize = (s: string): string => {
  if (typeof s !== 'string') return ''
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export const sfCase = (name: string, custom = false, capital = true): string => {
  const sf = _.camelCase(name) + (custom ? SALESFORCE_CUSTOM_SUFFIX : '')
  return capital ? capitalize(sf) : sf
}

export const bpCase = (name: string): string => {
  const bpName = (name.endsWith(SALESFORCE_CUSTOM_SUFFIX) ? name.slice(0, -2) : name)
  // Using specific replace for chars then _.unescape is not replacing well
  // and we see in our responses for sfdc
  return _.snakeCase(_.unescape(bpName.replace(/%26|%28|%29/g, ' ')))
}
export const sfInstnaceName = (instance: Element): string =>
  instance.elemID.nameParts.slice(1).map(p => sfCase(p, false)).join('')

export const apiName = (elem: Element): string => (
  isInstanceElement(elem)
    // Instance API name comes from the full name value, fallback to the elem ID
    ? elem.value[bpCase(METADATA_OBJECT_NAME_FIELD)] || sfCase(elem.elemID.name)
    // Object/Field name comes from the annotation, Fallback to the element ID. we assume
    // it is custom because all standard objects and fields get the annotation in discover
    : elem.annotations[API_NAME] || sfCase(elem.elemID.nameParts.slice(-1)[0], true)
)

export const metadataType = (element: Element): string => (
  element.annotations[METADATA_TYPE]
)

const formulaTypeName = (baseTypeName: string): string =>
  `${FORMULA_TYPE_PREFIX}${baseTypeName}`
const fieldTypeName = (typeName: string): string => (
  typeName.startsWith(FORMULA_TYPE_PREFIX) ? typeName.slice(FORMULA_TYPE_PREFIX.length) : typeName
)

// Defines SFDC built-in field types & built-in primitive data types
// Ref: https://developer.salesforce.com/docs/atlas.en-us.api.meta/api/field_types.htm
// Ref: https://developer.salesforce.com/docs/atlas.en-us.api.meta/api/primitive_data_types.htm
// Ref: https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_field_types.htm#meta_type_fieldtype
export class Types {
  // Type mapping for custom objects
  public static salesforceDataTypes: Record<string, Type> = {
    text: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.TEXT),
      primitive: PrimitiveTypes.STRING,
      annotationTypes: {
        [FIELD_ANNOTATIONS.UNIQUE]: BuiltinTypes.BOOLEAN,
        [FIELD_ANNOTATIONS.CASE_SENSITIVE]: BuiltinTypes.BOOLEAN,
        [FIELD_ANNOTATIONS.LENGTH]: BuiltinTypes.NUMBER,
      },
    }),
    number: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.NUMBER),
      primitive: PrimitiveTypes.NUMBER,
      annotationTypes: {
        [FIELD_ANNOTATIONS.SCALE]: BuiltinTypes.NUMBER,
        [FIELD_ANNOTATIONS.PRECISION]: BuiltinTypes.NUMBER,
        [FIELD_ANNOTATIONS.UNIQUE]: BuiltinTypes.BOOLEAN,
      },
    }),
    autonumber: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.AUTONUMBER),
      primitive: PrimitiveTypes.STRING,
      annotationTypes: {
        [FIELD_ANNOTATIONS.DISPLAY_FORMAT]: BuiltinTypes.STRING,
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
      annotationTypes: {
        [FIELD_ANNOTATIONS.SCALE]: BuiltinTypes.NUMBER,
        [FIELD_ANNOTATIONS.PRECISION]: BuiltinTypes.NUMBER,
      },
    }),
    picklist: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.PICKLIST),
      primitive: PrimitiveTypes.STRING,
    }),
    multipicklist: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.MULTIPICKLIST),
      primitive: PrimitiveTypes.STRING,
      annotationTypes: {
        [FIELD_ANNOTATIONS.VISIBLE_LINES]: BuiltinTypes.NUMBER,
      },
    }),
    email: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.EMAIL),
      primitive: PrimitiveTypes.STRING,
      annotationTypes: {
        [FIELD_ANNOTATIONS.UNIQUE]: BuiltinTypes.BOOLEAN,
        [FIELD_ANNOTATIONS.CASE_SENSITIVE]: BuiltinTypes.BOOLEAN,
      },
    }),
    location: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.LOCATION),
      primitive: PrimitiveTypes.NUMBER,
      annotationTypes: {
        [FIELD_ANNOTATIONS.DISPLAY_LOCATION_IN_DECIMAL]: BuiltinTypes.BOOLEAN,
        [FIELD_ANNOTATIONS.SCALE]: BuiltinTypes.NUMBER,
      },
    }),
    percent: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.PERCENT),
      primitive: PrimitiveTypes.NUMBER,
      annotationTypes: {
        [FIELD_ANNOTATIONS.SCALE]: BuiltinTypes.NUMBER,
        [FIELD_ANNOTATIONS.PRECISION]: BuiltinTypes.NUMBER,
      },
    }),
    phone: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.PHONE),
      primitive: PrimitiveTypes.STRING,
    }),
    longtextarea: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.LONGTEXTAREA),
      primitive: PrimitiveTypes.STRING,
      annotationTypes: {
        [FIELD_ANNOTATIONS.VISIBLE_LINES]: BuiltinTypes.NUMBER,
        [FIELD_ANNOTATIONS.LENGTH]: BuiltinTypes.NUMBER,
      },
    }),
    richtextarea: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.RICHTEXTAREA),
      primitive: PrimitiveTypes.STRING,
      annotationTypes: {
        [FIELD_ANNOTATIONS.VISIBLE_LINES]: BuiltinTypes.NUMBER,
        [FIELD_ANNOTATIONS.LENGTH]: BuiltinTypes.NUMBER,
      },
    }),
    textarea: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.TEXTAREA),
      primitive: PrimitiveTypes.STRING,
    }),
    encryptedtext: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.ENCRYPTEDTEXT),
      primitive: PrimitiveTypes.STRING,
      annotationTypes: {
        [FIELD_ANNOTATIONS.MASK_CHAR]: BuiltinTypes.STRING,
        [FIELD_ANNOTATIONS.MASK_TYPE]: BuiltinTypes.STRING,
        [FIELD_ANNOTATIONS.MASK]: BuiltinTypes.STRING,
        [FIELD_ANNOTATIONS.LENGTH]: BuiltinTypes.NUMBER,
      },
    }),
    url: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.URL),
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

  static get(name: string, customObject = true): Type {
    const type = customObject
      ? this.salesforceDataTypes[name.toLowerCase()]
      : this.metadataPrimitiveTypes[name.toLowerCase()]

    if (type === undefined) {
      return new ObjectType({
        elemID: new ElemID(SALESFORCE, bpCase(name)),
        isSettings: name === SETTINGS_METADATA_TYPE,
      })
    }
    return type
  }

  static getAllFieldTypes(): Type[] {
    return Object.values(Types.salesforceDataTypes).map(type => {
      const fieldType = type.clone()
      fieldType.path = ['types', 'field_types']
      return fieldType
    })
  }
}

export const fieldFullName = (object: ObjectType, field: TypeField): string =>
  `${apiName(object)}.${apiName(field)}`

const allowedAnnotations = (key: string): string[] => (
  Types.salesforceDataTypes[key]
    ? Object.keys(Types.salesforceDataTypes[key].annotationTypes)
    : []
)

export const toCustomField = (
  object: ObjectType, field: TypeField, fullname = false
): CustomField => {
  const newField = new CustomField(
    fullname ? fieldFullName(object, field) : apiName(field),
    FIELD_TYPE_API_NAMES[fieldTypeName(field.type.elemID.name)],
    field.annotations[LABEL],
    field.annotations[Type.REQUIRED],
    field.annotations[Type.DEFAULT],
    field.annotations[DEFAULT_VALUE_FORMULA],
    field.annotations[PICKLIST_VALUES],
    field.annotations[FORMULA],
  )

  // Convert the annotations' names to the required API name
  _.assign(newField,
    _.mapKeys(
      _.pickBy(field.annotations,
        (_val, annotationValue) => allowedAnnotations(
          field.type.elemID.name
        ).includes(annotationValue)),
      (_val, key) => sfCase(key, false, false)
    ))
  return newField
}

export const toCustomObject = (element: ObjectType, includeFields = true): CustomObject =>
  new CustomObject(
    apiName(element),
    element.annotations[LABEL],
    includeFields ? Object.values(element.fields).map(field => toCustomField(element, field))
      : undefined
  )

export const getValueTypeFieldElement = (parentID: ElemID, field: ValueTypeField,
  knownTypes: Map<string, Type>): TypeField => {
  const bpFieldName = bpCase(field.name)
  const bpFieldType = knownTypes.get(field.soapType) || Types.get(field.soapType, false)
  // mark required as false until SALTO-45 will be resolved
  const annotations: Values = { [Type.REQUIRED]: false }

  if (field.picklistValues && field.picklistValues.length > 0) {
    // picklist values in metadata types are used to restrict a field to a list of allowed values
    // because some fields can allow all fields names / all object names this restriction list
    // might be very large and cause memory problems on parsing, so we choose to omit the
    // restriction where there are too many possible values
    if (field.picklistValues.length < MAX_METADATA_RESTRICTION_VALUES) {
      annotations[Type.RESTRICTION] = {
        values: field.picklistValues.map(val => val.value),
      }
    }
    const defaults = field.picklistValues
      .filter(val => val.defaultValue)
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
// and their fields described in the blueprint
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

  if (field.defaultValueFormula) {
    annotations[DEFAULT_VALUE_FORMULA] = field.defaultValueFormula
  }

  // Handle specific field types that need to be converted from their primitive type to their
  // Salesforce field type
  if (field.autoNumber) { // autonumber (needs to be first because its type in the field
    // returned from the API is string)
    bpFieldType = Types.get(FIELD_TYPE_NAMES.AUTONUMBER)
  } else if (field.type === 'string' && !field.compoundFieldName) { // string
    bpFieldType = Types.get(FIELD_TYPE_NAMES.TEXT)
  } else if ((field.type === 'double' && !field.compoundFieldName) || field.type === 'int') { // number
    bpFieldType = Types.get(FIELD_TYPE_NAMES.NUMBER)
  } else if (field.type === 'textarea' && field.length > 255) { // long text area & rich text area
    if (field.extraTypeInfo === 'plaintextarea') {
      bpFieldType = Types.get(FIELD_TYPE_NAMES.LONGTEXTAREA)
    } else if (field.extraTypeInfo === 'richtextarea') {
      bpFieldType = Types.get(FIELD_TYPE_NAMES.RICHTEXTAREA)
    }
  } else if (field.type === 'encryptedstring') { // encrypted string
    bpFieldType = Types.get(FIELD_TYPE_NAMES.ENCRYPTEDTEXT)
  }
  // Picklists
  if (field.picklistValues && field.picklistValues.length > 0) {
    annotations[PICKLIST_VALUES] = field.picklistValues.map(val => val.value)
    annotations[RESTRICTED_PICKLIST] = Boolean(field.restrictedPicklist)

    const defaults = field.picklistValues
      .filter(val => val.defaultValue)
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
      annotations[FIELD_ANNOTATIONS.VISIBLE_LINES] = field.precision
    }
    // Formulas
  } else if (field.calculated && !_.isEmpty(field.calculatedFormula)) {
    bpFieldType = Types.get(formulaTypeName(bpFieldType.elemID.name))
    annotations[FORMULA] = field.calculatedFormula
  }
  if (!_.isEmpty(bpFieldType.annotationTypes)) {
    // Convert the annotations' names to bp case for those that are not already in that format
    // (annotations that consist of at least 2 words) and assign the additional annotations
    // (ones that were received from the api)
    _.assign(annotations,
      _.pickBy(
        _.mapKeys(field,
          (_val, key) => bpCase(key)),
        (_val, key) => allowedAnnotations(
          _.toLower(bpFieldType.elemID.name)
        ).includes(key)
      ))
  }

  return new TypeField(parentID, bpFieldName, bpFieldType, annotations)
}

/**
 * Apply transform function on all keys in a values map recursively
 *
 * @param obj Input object to transform
 * @param func Transform function to apply to all keys
 */
const mapKeysRecursive = (obj: Values, func: (key: string) => string): Values => {
  if (_.isArray(obj)) {
    return obj.map(val => mapKeysRecursive(val, func))
  }
  if (_.isObject(obj)) {
    return _(obj)
      .mapKeys((_val, key) => func(key))
      .mapValues(val => mapKeysRecursive(val, func))
      .value()
  }
  return obj
}

export const fromMetadataInfo = (info: MetadataInfo):
  Values => mapKeysRecursive(info, bpCase)

export const toMetadataInfo = (fullName: string, values: Values):
  MetadataInfo =>
  ({
    fullName,
    ...mapKeysRecursive(values, name => sfCase(name, false, false)),
  })

const toMetadataXml = (name: string, val: Value, inner = false): string => {
  if (_.isArray(val)) {
    return val.map(v => toMetadataXml(name, v, true)).join('')
  }
  const innerXml = _.isObject(val)
    ? _(val)
      .entries()
      .filter(([k]) => inner || k !== 'fullName')
      .map(([k, v]) => toMetadataXml(k, v, true))
      .value()
      .join('')
    : val
  const openName = inner ? name : `${name} xmlns="${METADATA_NAMESPACE}"`
  return `<${openName}>${innerXml}</${name}>`
}

export const toMetadataPackageZip = (instance: InstanceElement): Promise<Buffer> => {
  const instanceName = apiName(instance)
  const typeName = metadataType(instance)

  const zip = new JSZip()
  // Add package "manifest" that specifies what is contained in the rest of the zip
  zip.file(
    'default/package.xml',
    toMetadataXml('Package', {
      types: { members: instanceName, name: typeName },
      version: API_VERSION,
    }),
  )
  // Add the instance
  zip.file(
    `default/${_.camelCase(typeName)}/${instanceName}.${_.camelCase(typeName)}`,
    toMetadataXml(typeName, toMetadataInfo(instanceName, instance.value)),
  )
  return zip.generateAsync({ type: 'nodebuffer' })
}

export const toInstanceElements = (type: ObjectType, queryResult: QueryResult<Value>):
  InstanceElement[] => {
  // Omit the "attributes" field from the objects
  const results = queryResult.records.map(obj => _.pickBy(obj, (_value, key) =>
    key !== 'attributes'))

  // Convert the result to Instance Elements
  return results.map(res => new InstanceElement(
    new ElemID(SALESFORCE, type.elemID.name, res.Id),
    type,
    res
  ))
}

export const createInstanceElement = (mdInfo: MetadataInfo, type: ObjectType): InstanceElement => {
  const typeName = type.elemID.name
  const isSettings = sfCase(typeName) === SETTINGS_METADATA_TYPE
  return new InstanceElement(
    new ElemID(SALESFORCE, typeName, bpCase(mdInfo.fullName)),
    type,
    fromMetadataInfo(mdInfo),
    isSettings ? ['settings'] : ['records', typeName, bpCase(mdInfo.fullName)],
  )
}

export const createMetadataTypeElements = (
  objectName: string,
  fields: ValueTypeField[],
  knownTypes: Map<string, Type>,
  isSubtype = false,
): Type[] => {
  if (knownTypes.has(objectName)) {
    // Already created this type, no new types to return here
    return []
  }
  const element = Types.get(objectName, false) as ObjectType
  knownTypes.set(objectName, element)
  element.annotate({ [METADATA_TYPE]: objectName })
  element.path = ['types', ...(isSubtype ? ['subtypes'] : []), element.elemID.name]
  if (!fields) {
    return [element]
  }

  // We need to create embedded types BEFORE creating this element's fields
  // in order to make sure all internal types we may need are updated in the
  // knownTypes map
  const embeddedTypes = _.flatten(fields.filter(field => !_.isEmpty(field.fields)).map(
    field => createMetadataTypeElements(
      field.soapType,
      makeArray(field.fields),
      knownTypes,
      true,
    )
  ))

  // Enum fields sometimes show up with a type name that is not primitive but also does not
  // have fields (so we won't create an embedded type for it). it seems like these "empty" types
  // are always supposed to be a string with some restriction so we map all non primitive "empty"
  // types to string
  fields
    .filter(field => _.isEmpty(field.fields))
    .filter(field => !isPrimitiveType(Types.get(field.soapType, false)))
    .forEach(field => knownTypes.set(field.soapType, BuiltinTypes.STRING))

  const fieldElements = fields.map(field =>
    getValueTypeFieldElement(element.elemID, field, knownTypes))

  // Set fields on elements
  fieldElements.forEach(field => {
    element.fields[field.name] = field
  })

  return _.flatten([element, embeddedTypes])
}

// Convert the InstanceElements to records
export const instanceElementstoRecords = (instances: InstanceElement[]):
SfRecord[] => instances.map(res => res.value)

// Convert the ElemIDs to records
export const elemIDstoRecords = (ElemIDs: ElemID[]):
SfRecord[] => ElemIDs.map(elem => ({ Id: elem.nameParts[1] }))
