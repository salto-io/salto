import _ from 'lodash'
import {
  ValueTypeField, Field, MetadataInfo, DefaultValueWithType, QueryResult, Record as SfRecord,
} from 'jsforce'
import JSZip from 'jszip'

import {
  Type, ObjectType, ElemID, PrimitiveTypes, PrimitiveType, Values, Value, Field as TypeField,
  BuiltinTypes, Element, isInstanceElement, InstanceElement, isPrimitiveType, ElemIdGetter,
  ServiceIds, toServiceIdsString, OBJECT_SERVICE_ID, ADAPTER, isObjectType,
} from 'adapter-api'
import { collections } from '@salto/lowerdash'
import { CustomObject, CustomField } from './client/types'
import { API_VERSION, METADATA_NAMESPACE } from './client/client'
import {
  API_NAME, CUSTOM_OBJECT, LABEL, SALESFORCE, FORMULA,
  FORMULA_TYPE_PREFIX, FIELD_TYPE_NAMES, FIELD_TYPE_API_NAMES, METADATA_OBJECT_NAME_FIELD,
  METADATA_TYPE, FIELD_ANNOTATIONS, SALESFORCE_CUSTOM_SUFFIX, DEFAULT_VALUE_FORMULA,
  MAX_METADATA_RESTRICTION_VALUES, LOOKUP_FILTER_FIELDS,
  ADDRESS_FIELDS, NAME_FIELDS, GEOLOCATION_FIELDS,
} from './constants'

const { makeArray } = collections.array

const capitalize = (s: string): string => {
  if (typeof s !== 'string') return ''
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const toSfCamelCase = (name: string): string => _.replace(name, /_[a-z]|_[0-9]/g,
  (match: string) => match.charAt(1).toUpperCase())

export const sfCase = (name: string, custom = false, capital = true): string => {
  const sf = name.endsWith(SALESFORCE_CUSTOM_SUFFIX)
    ? toSfCamelCase(name.slice(0, -3)) + name.slice(-3)
    : toSfCamelCase(name) + (custom ? SALESFORCE_CUSTOM_SUFFIX : '')
  return capital ? capitalize(sf) : sf
}

export const bpCase = (name: string): string => {
  // Using specific replace for chars then _.unescape is not replacing well
  // and we see in our responses for sfdc
  const unescaped = _.unescape(name).replace(/%26|%28|%29|[^A-Za-z0-9_]/g, '_')
  return unescaped.charAt(0).toLowerCase()
    + _.replace(unescaped.slice(1), /[A-Z]|[0-9]/g, (char: string) => `_${char.toLowerCase()}`)
}

export const metadataType = (element: Element): string => (
  element.annotations[METADATA_TYPE] || CUSTOM_OBJECT
)

export const isCustomObject = (element: ObjectType): boolean =>
  (metadataType(element) === CUSTOM_OBJECT)

export const apiName = (elem: Element): string => {
  if (isInstanceElement(elem)) {
    // Instance API name comes from the full name value, fallback to the elem ID
    return elem.value[bpCase(METADATA_OBJECT_NAME_FIELD)] || sfCase(elem.elemID.name)
  }
  const elemMetadataType = metadataType(elem)
  return elemMetadataType === CUSTOM_OBJECT ? elem.annotations[API_NAME] : elemMetadataType
}

const formulaTypeName = (baseTypeName: string): string =>
  `${FORMULA_TYPE_PREFIX}${baseTypeName}`
const fieldTypeName = (typeName: string): string => (
  typeName.startsWith(FORMULA_TYPE_PREFIX) ? typeName.slice(FORMULA_TYPE_PREFIX.length) : typeName
)

// Defines SFDC built-in field types & built-in primitive data types
// Ref: https://developer.salesforce.com/docs/atlas.en-us.api.meta/api/field_types.htm
// Ref: https://developer.salesforce.com/docs/atlas.en-us.api.meta/api/primitive_data_types.htm
// Ref: https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_field_types.htm#meta_type_fieldtype

const lookupFilterElemID = new ElemID(SALESFORCE, FIELD_TYPE_NAMES.LOOKUP_FILTER)
const filterItemElemID = new ElemID(SALESFORCE, FIELD_TYPE_NAMES.FILTER_ITEM)
const lookupFilterObjectType = new ObjectType({
  elemID: lookupFilterElemID,
  fields: {
    [LOOKUP_FILTER_FIELDS.ACTIVE]: new TypeField(
      lookupFilterElemID, LOOKUP_FILTER_FIELDS.ACTIVE, BuiltinTypes.BOOLEAN
    ),
    [LOOKUP_FILTER_FIELDS.BOOLEAN_FILTER]: new TypeField(
      lookupFilterElemID, LOOKUP_FILTER_FIELDS.BOOLEAN_FILTER, BuiltinTypes.STRING
    ),
    [LOOKUP_FILTER_FIELDS.ERROR_MESSAGE]: new TypeField(
      lookupFilterElemID, LOOKUP_FILTER_FIELDS.ERROR_MESSAGE, BuiltinTypes.STRING
    ),
    [LOOKUP_FILTER_FIELDS.INFO_MESSAGE]: new TypeField(
      lookupFilterElemID, LOOKUP_FILTER_FIELDS.INFO_MESSAGE, BuiltinTypes.STRING
    ),
    [LOOKUP_FILTER_FIELDS.IS_OPTIONAL]: new TypeField(
      lookupFilterElemID, LOOKUP_FILTER_FIELDS.IS_OPTIONAL, BuiltinTypes.BOOLEAN
    ),
    [LOOKUP_FILTER_FIELDS.FILTER_ITEMS]: new TypeField(
      lookupFilterElemID, LOOKUP_FILTER_FIELDS.FILTER_ITEMS,
      new ObjectType({
        elemID: filterItemElemID,
        fields: {
          [LOOKUP_FILTER_FIELDS.FIELD]: new TypeField(
            filterItemElemID, LOOKUP_FILTER_FIELDS.FIELD, BuiltinTypes.STRING
          ),
          [LOOKUP_FILTER_FIELDS.OPERATION]: new TypeField(
            filterItemElemID, LOOKUP_FILTER_FIELDS.OPERATION, BuiltinTypes.STRING
          ),
          [LOOKUP_FILTER_FIELDS.VALUE_FIELD]: new TypeField(
            filterItemElemID, LOOKUP_FILTER_FIELDS.VALUE_FIELD, BuiltinTypes.STRING
          ),
        },
      }), {}, true
    ),
  },
})

const addressElemID = new ElemID(SALESFORCE, FIELD_TYPE_NAMES.ADDRESS)
const nameElemID = new ElemID(SALESFORCE, FIELD_TYPE_NAMES.FIELD_NAME)
const geoLocationElemID = new ElemID(SALESFORCE, FIELD_TYPE_NAMES.LOCATION)

export class Types {
  private static getElemIdFunc: ElemIdGetter

  // Type mapping for custom objects
  public static primitiveDataTypes: Record<string, Type> = {
    text: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.TEXT),
      primitive: PrimitiveTypes.STRING,
      annotationTypes: {
        [FIELD_ANNOTATIONS.UNIQUE]: BuiltinTypes.BOOLEAN,
        [FIELD_ANNOTATIONS.CASE_SENSITIVE]: BuiltinTypes.BOOLEAN,
        [FIELD_ANNOTATIONS.LENGTH]: BuiltinTypes.NUMBER,
        [API_NAME]: BuiltinTypes.SERVICE_ID,
      },
    }),
    number: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.NUMBER),
      primitive: PrimitiveTypes.NUMBER,
      annotationTypes: {
        [FIELD_ANNOTATIONS.SCALE]: BuiltinTypes.NUMBER,
        [FIELD_ANNOTATIONS.PRECISION]: BuiltinTypes.NUMBER,
        [FIELD_ANNOTATIONS.UNIQUE]: BuiltinTypes.BOOLEAN,
        [API_NAME]: BuiltinTypes.SERVICE_ID,
      },
    }),
    autonumber: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.AUTONUMBER),
      primitive: PrimitiveTypes.STRING,
      annotationTypes: {
        [FIELD_ANNOTATIONS.DISPLAY_FORMAT]: BuiltinTypes.STRING,
        [API_NAME]: BuiltinTypes.SERVICE_ID,
      },
    }),
    boolean: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.CHECKBOX),
      primitive: PrimitiveTypes.BOOLEAN,
      annotationTypes: {
        [API_NAME]: BuiltinTypes.SERVICE_ID,
      },
    }),
    date: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.DATE),
      primitive: PrimitiveTypes.STRING,
      annotationTypes: {
        [API_NAME]: BuiltinTypes.SERVICE_ID,
      },
    }),
    time: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.TIME),
      primitive: PrimitiveTypes.STRING,
      annotationTypes: {
        [API_NAME]: BuiltinTypes.SERVICE_ID,
      },
    }),
    datetime: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.DATETIME),
      primitive: PrimitiveTypes.STRING,
      annotationTypes: {
        [API_NAME]: BuiltinTypes.SERVICE_ID,
      },
    }),
    currency: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.CURRENCY),
      primitive: PrimitiveTypes.NUMBER,
      annotationTypes: {
        [FIELD_ANNOTATIONS.SCALE]: BuiltinTypes.NUMBER,
        [FIELD_ANNOTATIONS.PRECISION]: BuiltinTypes.NUMBER,
        [API_NAME]: BuiltinTypes.SERVICE_ID,
      },
    }),
    picklist: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.PICKLIST),
      primitive: PrimitiveTypes.STRING,
      annotationTypes: {
        [API_NAME]: BuiltinTypes.SERVICE_ID,
      },
    }),
    multipicklist: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.MULTIPICKLIST),
      primitive: PrimitiveTypes.STRING,
      annotationTypes: {
        [FIELD_ANNOTATIONS.VISIBLE_LINES]: BuiltinTypes.NUMBER,
        [API_NAME]: BuiltinTypes.SERVICE_ID,
      },
    }),
    email: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.EMAIL),
      primitive: PrimitiveTypes.STRING,
      annotationTypes: {
        [FIELD_ANNOTATIONS.UNIQUE]: BuiltinTypes.BOOLEAN,
        [FIELD_ANNOTATIONS.CASE_SENSITIVE]: BuiltinTypes.BOOLEAN,
        [API_NAME]: BuiltinTypes.SERVICE_ID,
      },
    }),
    percent: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.PERCENT),
      primitive: PrimitiveTypes.NUMBER,
      annotationTypes: {
        [FIELD_ANNOTATIONS.SCALE]: BuiltinTypes.NUMBER,
        [FIELD_ANNOTATIONS.PRECISION]: BuiltinTypes.NUMBER,
        [API_NAME]: BuiltinTypes.SERVICE_ID,
      },
    }),
    phone: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.PHONE),
      primitive: PrimitiveTypes.STRING,
      annotationTypes: {
        [API_NAME]: BuiltinTypes.SERVICE_ID,
      },
    }),
    longtextarea: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.LONGTEXTAREA),
      primitive: PrimitiveTypes.STRING,
      annotationTypes: {
        [FIELD_ANNOTATIONS.VISIBLE_LINES]: BuiltinTypes.NUMBER,
        [FIELD_ANNOTATIONS.LENGTH]: BuiltinTypes.NUMBER,
        [API_NAME]: BuiltinTypes.SERVICE_ID,
      },
    }),
    richtextarea: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.RICHTEXTAREA),
      primitive: PrimitiveTypes.STRING,
      annotationTypes: {
        [FIELD_ANNOTATIONS.VISIBLE_LINES]: BuiltinTypes.NUMBER,
        [FIELD_ANNOTATIONS.LENGTH]: BuiltinTypes.NUMBER,
        [API_NAME]: BuiltinTypes.SERVICE_ID,
      },
    }),
    textarea: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.TEXTAREA),
      primitive: PrimitiveTypes.STRING,
      annotationTypes: {
        [API_NAME]: BuiltinTypes.SERVICE_ID,
      },
    }),
    encryptedtext: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.ENCRYPTEDTEXT),
      primitive: PrimitiveTypes.STRING,
      annotationTypes: {
        [FIELD_ANNOTATIONS.MASK_CHAR]: BuiltinTypes.STRING,
        [FIELD_ANNOTATIONS.MASK_TYPE]: BuiltinTypes.STRING,
        [FIELD_ANNOTATIONS.MASK]: BuiltinTypes.STRING,
        [FIELD_ANNOTATIONS.LENGTH]: BuiltinTypes.NUMBER,
        [API_NAME]: BuiltinTypes.SERVICE_ID,
      },
    }),
    url: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.URL),
      primitive: PrimitiveTypes.STRING,
      annotationTypes: {
        [API_NAME]: BuiltinTypes.SERVICE_ID,
      },
    }),
    lookup: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.LOOKUP),
      primitive: PrimitiveTypes.STRING,
      annotationTypes: {
        [FIELD_ANNOTATIONS.ALLOW_LOOKUP_RECORD_DELETION]: BuiltinTypes.BOOLEAN,
        // Todo SALTO-228 The FIELD_ANNOTATIONS.RELATED_TO annotation is missing since
        // currently there is no way to declare on a list annotation
        [FIELD_ANNOTATIONS.LOOKUP_FILTER]: lookupFilterObjectType,
        [API_NAME]: BuiltinTypes.SERVICE_ID,
      },
    }),
    masterdetail: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.MASTER_DETAIL),
      primitive: PrimitiveTypes.STRING,
      annotationTypes: {
        [FIELD_ANNOTATIONS.REPARENTABLE_MASTER_DETAIL]: BuiltinTypes.BOOLEAN,
        [FIELD_ANNOTATIONS.WRITE_REQUIRES_MASTER_READ]: BuiltinTypes.BOOLEAN,
        [FIELD_ANNOTATIONS.LOOKUP_FILTER]: lookupFilterObjectType,
        // Todo SALTO-228 The FIELD_ANNOTATIONS.RELATED_TO annotation is missing since
        // currently there is no way to declare on a list annotation
        [API_NAME]: BuiltinTypes.SERVICE_ID,
      },
    }),
  }

  // Type mapping for compound fields
  public static compoundDataTypes: Record<string, ObjectType> = {
    address: new ObjectType({
      elemID: addressElemID,
      fields: {
        [ADDRESS_FIELDS.CITY]: new TypeField(
          addressElemID, ADDRESS_FIELDS.CITY, BuiltinTypes.STRING
        ),
        [ADDRESS_FIELDS.COUNTRY]: new TypeField(
          addressElemID, ADDRESS_FIELDS.COUNTRY, BuiltinTypes.STRING
        ),
        [ADDRESS_FIELDS.GEOCODE_ACCURACY]: new TypeField(
          addressElemID, ADDRESS_FIELDS.GEOCODE_ACCURACY, Types.primitiveDataTypes.picklist
        ),
        [ADDRESS_FIELDS.LATITUDE]: new TypeField(
          addressElemID, ADDRESS_FIELDS.LATITUDE, BuiltinTypes.NUMBER
        ),
        [ADDRESS_FIELDS.LONGITUDE]: new TypeField(
          addressElemID, ADDRESS_FIELDS.LONGITUDE, BuiltinTypes.NUMBER
        ),
        [ADDRESS_FIELDS.POSTAL_CODE]: new TypeField(
          addressElemID, ADDRESS_FIELDS.POSTAL_CODE, BuiltinTypes.STRING
        ),
        [ADDRESS_FIELDS.STATE]: new TypeField(
          addressElemID, ADDRESS_FIELDS.STATE, BuiltinTypes.STRING
        ),
        [ADDRESS_FIELDS.STREET]: new TypeField(
          addressElemID, ADDRESS_FIELDS.STREET, Types.primitiveDataTypes.textarea
        ),
      },
      annotationTypes: {
        [API_NAME]: BuiltinTypes.SERVICE_ID,
      },
    }),
    name: new ObjectType({
      elemID: nameElemID,
      fields: {
        [NAME_FIELDS.FIRST_NAME]: new TypeField(
          nameElemID, NAME_FIELDS.FIRST_NAME, BuiltinTypes.STRING
        ),
        [NAME_FIELDS.LAST_NAME]: new TypeField(
          nameElemID, NAME_FIELDS.LAST_NAME, BuiltinTypes.STRING
        ),
        [NAME_FIELDS.SALUTATION]: new TypeField(
          nameElemID, NAME_FIELDS.SALUTATION, Types.primitiveDataTypes.picklist
        ),
      },
      annotationTypes: {
        [API_NAME]: BuiltinTypes.SERVICE_ID,
      },
    }),
    location: new ObjectType({
      elemID: geoLocationElemID,
      fields: {
        [GEOLOCATION_FIELDS.LATITUDE]: new TypeField(
          geoLocationElemID, GEOLOCATION_FIELDS.LATITUDE, BuiltinTypes.NUMBER
        ),
        [GEOLOCATION_FIELDS.LONGITUDE]: new TypeField(
          geoLocationElemID, GEOLOCATION_FIELDS.LONGITUDE, BuiltinTypes.NUMBER
        ),
      },
      annotationTypes: {
        [FIELD_ANNOTATIONS.DISPLAY_LOCATION_IN_DECIMAL]: BuiltinTypes.BOOLEAN,
        [FIELD_ANNOTATIONS.SCALE]: BuiltinTypes.NUMBER,
        [API_NAME]: BuiltinTypes.SERVICE_ID,
      },
    }),
  }

  // Type mapping for metadata types
  private static metadataPrimitiveTypes: Record<string, Type> = {
    string: BuiltinTypes.STRING,
    double: BuiltinTypes.NUMBER,
    int: BuiltinTypes.NUMBER,
    boolean: BuiltinTypes.BOOLEAN,
  }

  static setElemIdGetter(getElemIdFunc: ElemIdGetter): void {
    this.getElemIdFunc = getElemIdFunc
  }

  static get(name: string, customObject = true, isSettings = false, serviceIds?: ServiceIds): Type {
    const type = customObject
      ? this.primitiveDataTypes[name.toLowerCase()]
      : this.metadataPrimitiveTypes[name.toLowerCase()]

    if (type === undefined) {
      return this.createObjectType(name, customObject, isSettings, serviceIds)
    }
    return type
  }

  private static createObjectType(name: string, customObject = true, isSettings = false,
    serviceIds?: ServiceIds): ObjectType {
    const elemId = (customObject && this.getElemIdFunc && serviceIds)
      ? (this.getElemIdFunc as ElemIdGetter)(SALESFORCE,
        serviceIds as ServiceIds, bpCase(name))
      : new ElemID(SALESFORCE, bpCase(name))
    return new ObjectType({
      elemID: elemId,
      isSettings,
    })
  }

  static getCompound(name: string): Type {
    return this.compoundDataTypes[name.toLowerCase()]
  }

  static getAllFieldTypes(): Type[] {
    return _.concat(
      Object.values(Types.primitiveDataTypes),
      Object.values(Types.compoundDataTypes),
    ).map(type => {
      const fieldType = type.clone()
      fieldType.path = ['types', 'field_types']
      return fieldType
    })
  }
}

export const fieldFullName = (object: ObjectType | string, field: TypeField): string =>
  `${isObjectType(object) ? apiName(object) : object}.${apiName(field)}`

const allowedAnnotations = (key: string): string[] => {
  const returnedType = Types.primitiveDataTypes[key] ?? Types.compoundDataTypes[key]
  return returnedType ? Object.keys(returnedType.annotationTypes) : []
}

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
    field.annotations[Type.VALUES],
    field.annotations[FORMULA],
    field.annotations[FIELD_ANNOTATIONS.RELATED_TO],
    sfCase(field.name),
    field.annotations[FIELD_ANNOTATIONS.ALLOW_LOOKUP_RECORD_DELETION]
  )

  // Skip the assignment of the following annotations that are defined as annotationType
  const blacklistedAnnotations: string[] = [
    API_NAME, // used to mark the SERVICE_ID but does not exist in the CustomObject
    FIELD_ANNOTATIONS.ALLOW_LOOKUP_RECORD_DELETION, // handled in the CustomField constructor
    FIELD_ANNOTATIONS.LOOKUP_FILTER] // handled in lookup_filters filter
  const isBlacklisted = (annotationValue: string): boolean =>
    blacklistedAnnotations.includes(annotationValue)

  // Convert the annotations' names to the required API name
  _.assign(newField,
    _.mapKeys(
      _.pickBy(field.annotations,
        (_val, annotationValue) =>
          allowedAnnotations(field.type.elemID.name).includes(annotationValue)
          && !isBlacklisted(annotationValue)),
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
  const bpFieldType = (field.name === METADATA_OBJECT_NAME_FIELD) ? BuiltinTypes.SERVICE_ID
    : knownTypes.get(field.soapType) || Types.get(field.soapType, false)
  // mark required as false until SALTO-45 will be resolved
  const annotations: Values = { [Type.REQUIRED]: false }

  if (field.picklistValues && field.picklistValues.length > 0) {
    // picklist values in metadata types are used to restrict a field to a list of allowed values
    // because some fields can allow all fields names / all object names this restriction list
    // might be very large and cause memory problems on parsing, so we choose to omit the
    // restriction where there are too many possible values
    if (field.picklistValues.length < MAX_METADATA_RESTRICTION_VALUES) {
      annotations[Type.VALUES] = _.sortedUniq(field.picklistValues.map(val => val.value).sort())
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

// The following method is used during the fetchy process and is used in building the objects
// and their fields described in the blueprint
export const getSObjectFieldElement = (parentID: ElemID, field: Field,
  parentServiceIds: ServiceIds): TypeField => {
  const serviceIds = {
    [ADAPTER]: SALESFORCE,
    [API_NAME]: field.name,
    [OBJECT_SERVICE_ID]: toServiceIdsString(parentServiceIds),
  }

  const getFieldType = (typeName: string): Type => Types.get(typeName, true, false, serviceIds)

  let bpFieldType = getFieldType(field.type)
  const annotations: Values = {
    [API_NAME]: field.name,
    [LABEL]: field.label,
    [Type.REQUIRED]: false,
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
    bpFieldType = getFieldType(FIELD_TYPE_NAMES.AUTONUMBER)
  } else if (field.type === 'string' && !field.compoundFieldName) { // string
    bpFieldType = getFieldType(FIELD_TYPE_NAMES.TEXT)
  } else if ((field.type === 'double' && !field.compoundFieldName) || field.type === 'int') { // number
    bpFieldType = getFieldType(FIELD_TYPE_NAMES.NUMBER)
  } else if (field.type === 'textarea' && field.length > 255) { // long text area & rich text area
    if (field.extraTypeInfo === 'plaintextarea') {
      bpFieldType = getFieldType(FIELD_TYPE_NAMES.LONGTEXTAREA)
    } else if (field.extraTypeInfo === 'richtextarea') {
      bpFieldType = getFieldType(FIELD_TYPE_NAMES.RICHTEXTAREA)
    }
  } else if (field.type === 'encryptedstring') { // encrypted string
    bpFieldType = getFieldType(FIELD_TYPE_NAMES.ENCRYPTEDTEXT)
  }
  // Picklists
  if (field.picklistValues && field.picklistValues.length > 0) {
    annotations[Type.VALUES] = field.picklistValues.map(val => val.value)
    annotations[Type.RESTRICTION] = { [Type.ENFORCE_VALUE]: Boolean(field.restrictedPicklist) }

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
    bpFieldType = getFieldType(formulaTypeName(bpFieldType.elemID.name))
    annotations[FORMULA] = field.calculatedFormula

    // Lookup & MasterDetail
  } else if (field.type === 'reference') {
    if (field.cascadeDelete) {
      bpFieldType = getFieldType(FIELD_TYPE_NAMES.MASTER_DETAIL)
      // master detail fields are always not required in SF although returned as nillable=false
      annotations[Type.REQUIRED] = false
      annotations[FIELD_ANNOTATIONS.WRITE_REQUIRES_MASTER_READ] = Boolean(
        field.writeRequiresMasterRead
      )
      annotations[FIELD_ANNOTATIONS.REPARENTABLE_MASTER_DETAIL] = Boolean(field.updateable)
    } else {
      bpFieldType = getFieldType(FIELD_TYPE_NAMES.LOOKUP)
      annotations[FIELD_ANNOTATIONS.ALLOW_LOOKUP_RECORD_DELETION] = !(_.get(field, 'restrictedDelete'))
    }
    if (!_.isEmpty(field.referenceTo)) {
      // there are some SF reference fields without related fields
      // e.g. salesforce_user_app_menu_item.ApplicationId, salesforce_login_event.LoginHistoryId
      annotations[FIELD_ANNOTATIONS.RELATED_TO] = field.referenceTo
    }
    if (field.filteredLookupInfo) {
      // will be populated in the lookup_filter filter
      annotations[FIELD_ANNOTATIONS.LOOKUP_FILTER] = {}
    }
    // Compound fields
  } else if (['address', 'location'].includes(field.type)) {
    bpFieldType = Types.getCompound(field.type)
  } else if (field.name === 'Name' && field.label === 'Full Name') {
    bpFieldType = Types.getCompound(field.name)
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

  const fieldName = getFieldType(field.name).elemID.name
  return new TypeField(parentID, fieldName, bpFieldType, annotations)
}

/**
 * Deploy transform function on all keys in a values map recursively
 *
 * @param obj Input object to transform
 * @param func Transform function to deploy to all keys
 */
export const mapKeysRecursive = (obj: Values, func: (key: string) => string): Values => {
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
  return results.map(res => new InstanceElement(res.Id, type, res))
}

export const createInstanceElement = (
  mdInfo: MetadataInfo,
  type: ObjectType
): InstanceElement => {
  const typeName = type.elemID.name
  return new InstanceElement(
    type.isSettings ? ElemID.CONFIG_NAME : bpCase(mdInfo.fullName),
    type,
    fromMetadataInfo(mdInfo),
    ['records', type.isSettings ? 'settings'
      : typeName, bpCase(mdInfo.fullName)],
  )
}

export const createMetadataTypeElements = (
  objectName: string,
  fields: ValueTypeField[],
  knownTypes: Map<string, Type>,
  isSubtype = false,
  isSettings = false,
): ObjectType[] => {
  if (knownTypes.has(objectName)) {
    // Already created this type, no new types to return here
    return []
  }
  const element = Types.get(objectName, false, isSettings) as ObjectType
  knownTypes.set(objectName, element)
  element.annotationTypes[METADATA_TYPE] = BuiltinTypes.SERVICE_ID
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
      false,
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
SfRecord[] => ElemIDs.map(elem => ({ Id: elem.name }))

// The purpose of the following method is to modify the list of field names, so that compound
// fields names do not appear, and only their nested fields appear in the list of fields.
// The reason for this is to later show during export, fields that can be sent back to SFDC
// during import
export const getCompoundChildFields = (objectType: ObjectType): TypeField[] => {
  // Internal functions
  const isFieldType = (fieldType: Type) => (field: TypeField): boolean => (
    field.type.elemID.getFullName() === fieldType.elemID.getFullName()
  )
  const handleAddressFields = (object: ObjectType): void => {
    // Find the address fields
    const addressFields = _.pickBy(object.fields, isFieldType(Types.compoundDataTypes.address))

    // For each address field, get its prefix, then find its corresponding child fields by
    // this prefix.
    Object.keys(addressFields).forEach(key => {
      const addressPrefix = key.replace(/address/, '')
      Object.values(Types.compoundDataTypes.address.fields).forEach(childField => {
        const clonedField = childField.clone()
        // Add the child fields to the object type
        const childFieldName = addressPrefix + clonedField.name
        clonedField.name = childFieldName
        clonedField.annotations = { [API_NAME]: sfCase(childFieldName) }
        object.fields[childFieldName] = clonedField
      })
      // Remove the compound field from the element
      object.fields = _.omit(object.fields, key)
    })
  }

  const handleNameField = (object: ObjectType): void => {
    const compoundNameFieldName = 'name'
    const compoundNameFieldFullName = 'Full Name'
    // Find the name field
    const nameFields = _.pickBy(object.fields,
      (value, key) => key === compoundNameFieldName
        && value.annotations.label === compoundNameFieldFullName)

    if (_.size(nameFields) === 0) {
      return
    }
    // Add the child fields to the object type
    Object.values(Types.compoundDataTypes.name.fields).forEach(childField => {
      const clonedField = childField.clone()
      clonedField.annotations = { [API_NAME]: sfCase(childField.name) }
      object.fields[childField.name] = clonedField
    })
    // Remove the compound field from the element
    object.fields = _.omit(object.fields, compoundNameFieldName)
  }

  const handleGeolocationFields = (object: ObjectType): void => {
    // Find the  geolocation fields
    const locationFields = _.pickBy(object.fields, isFieldType(Types.compoundDataTypes.location))

    // For each geolocation field, get its name, then find its corresponding child fields by
    // this name.
    Object.keys(locationFields).forEach(key => {
      const isCustomField = key.endsWith(SALESFORCE_CUSTOM_SUFFIX)
      Object.values(Types.compoundDataTypes.location.fields).forEach(childField => {
        const clonedField = childField.clone()
        // Add the child fields to the object type
        const childFieldName = `${isCustomField ? key.slice(0, -SALESFORCE_CUSTOM_SUFFIX.length) : key}_${clonedField.name}`
        clonedField.name = childFieldName
        clonedField.annotations = {
          [API_NAME]: `${key.slice(0, -SALESFORCE_CUSTOM_SUFFIX.length)}__${capitalize(childField.name)}${isCustomField ? '__s' : ''}`,
        }
        object.fields[childFieldName] = clonedField
      })
      // Remove the compound field from the element
      object.fields = _.omit(object.fields, key)
    })
  }
  const clonedObject = objectType.clone()
  // 1) Handle the address fields
  handleAddressFields(clonedObject)
  // 2) Handle the name field
  handleNameField(clonedObject)
  // 3) Handle geolocation fields
  handleGeolocationFields(clonedObject)
  return Object.values(clonedObject.fields)
}
