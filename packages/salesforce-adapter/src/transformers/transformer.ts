import _ from 'lodash'
import {
  ValueTypeField, Field, MetadataInfo, DefaultValueWithType, QueryResult, Record as SfRecord,
} from 'jsforce'
import {
  Type, ObjectType, ElemID, PrimitiveTypes, PrimitiveType, Values, Value, Field as TypeField,
  BuiltinTypes, Element, isInstanceElement, InstanceElement, isPrimitiveType, ElemIdGetter,
  ServiceIds, toServiceIdsString, OBJECT_SERVICE_ID, ADAPTER, isObjectType, CORE_ANNOTATIONS,
} from 'adapter-api'
import { collections } from '@salto/lowerdash'
import { CustomObject, CustomField, ValueSettings, FilterItem } from '../client/types'
import {
  API_NAME, CUSTOM_OBJECT, LABEL, SALESFORCE, FORMULA,
  FORMULA_TYPE_PREFIX, FIELD_TYPE_NAMES, FIELD_TYPE_API_NAMES, METADATA_OBJECT_NAME_FIELD,
  METADATA_TYPE, FIELD_ANNOTATIONS, SALESFORCE_CUSTOM_SUFFIX, DEFAULT_VALUE_FORMULA,
  MAX_METADATA_RESTRICTION_VALUES, LOOKUP_FILTER_FIELDS,
  ADDRESS_FIELDS, NAME_FIELDS, GEOLOCATION_FIELDS, INSTANCE_FULL_NAME_FIELD,
  FIELD_LEVEL_SECURITY_ANNOTATION, FIELD_LEVEL_SECURITY_FIELDS, FIELD_DEPENDENCY_FIELDS,
  VALUE_SETTINGS_FIELDS, FILTER_ITEM_FIELDS, OBJECT_LEVEL_SECURITY_ANNOTATION,
  OBJECT_LEVEL_SECURITY_FIELDS, NAMESPACE_SEPARATOR, DESCRIPTION, HELP_TEXT,
} from '../constants'
import SalesforceClient from '../client/client'

const { makeArray } = collections.array

const capitalize = (s: string): string => {
  if (typeof s !== 'string') return ''
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export const sfCase = (name: string, custom = false, capital = true): string => {
  const toSfCamelCase = (word: string): string =>
    word.split(NAMESPACE_SEPARATOR)
      .map(_.camelCase)
      .map((v, idx) => (idx === 0 ? v : capitalize(v)))
      .join('_')
  const sf = name.endsWith(SALESFORCE_CUSTOM_SUFFIX)
    ? toSfCamelCase(name.slice(0, -3)) + name.slice(-3)
    : toSfCamelCase(name) + (custom ? SALESFORCE_CUSTOM_SUFFIX : '')
  return capital ? capitalize(sf) : sf
}

export const bpCase = (name: string): string => {
  const upperCase = /[A-Z]/
  const isUpperCase = (c: string): boolean => (c.match(upperCase) !== null)
  const toBpSnakeCase = (word: string): string => word.split('_')
    .reduce((prevRes, w, idx) => {
      if (idx > 0 && isUpperCase(w.charAt(0))) {
        prevRes.push('_')
      }
      prevRes.push(w)
      return prevRes
    }, [] as string[])
    .map(_.snakeCase).join('_')

  // Using specific replace for chars then _.unescape is not replacing well
  // and we see in our responses for sfdc
  const unescaped = _.unescape(name).replace(/%26|%28|%29/g, '_')
  return unescaped.toLocaleLowerCase().endsWith(SALESFORCE_CUSTOM_SUFFIX)
    ? toBpSnakeCase(unescaped.slice(0, -3)) + SALESFORCE_CUSTOM_SUFFIX
    : toBpSnakeCase(unescaped)
}

export const metadataType = (element: Element): string => (
  element.annotations[METADATA_TYPE] || CUSTOM_OBJECT
)

export const isCustomObject = (element: Element): boolean =>
  (metadataType(element) === CUSTOM_OBJECT)

export const apiName = (elem: Element): string => {
  if (isInstanceElement(elem)) {
    return elem.value[INSTANCE_FULL_NAME_FIELD]
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

const addressElemID = new ElemID(SALESFORCE, FIELD_TYPE_NAMES.ADDRESS)
const nameElemID = new ElemID(SALESFORCE, FIELD_TYPE_NAMES.FIELD_NAME)
const geoLocationElemID = new ElemID(SALESFORCE, FIELD_TYPE_NAMES.LOCATION)

export class Types {
  private static getElemIdFunc: ElemIdGetter

  private static fieldLevelSecurityElemID = new ElemID(SALESFORCE, FIELD_LEVEL_SECURITY_ANNOTATION)
  private static fieldLevelSecurityType = new ObjectType({
    elemID: Types.fieldLevelSecurityElemID,
    fields: {
      [FIELD_LEVEL_SECURITY_FIELDS.EDITABLE]: new TypeField(
        Types.fieldLevelSecurityElemID, FIELD_LEVEL_SECURITY_FIELDS.EDITABLE,
        BuiltinTypes.STRING, {}, true
      ),
      [FIELD_LEVEL_SECURITY_FIELDS.READABLE]: new TypeField(
        Types.fieldLevelSecurityElemID, FIELD_LEVEL_SECURITY_FIELDS.READABLE,
        BuiltinTypes.STRING, {}, true
      ),
    },
  })

  private static objectLevelSecurityElemID = new ElemID(SALESFORCE,
    OBJECT_LEVEL_SECURITY_ANNOTATION)

  private static objectLevelSecurityType = new ObjectType({
    elemID: Types.objectLevelSecurityElemID,
    fields: {
      [OBJECT_LEVEL_SECURITY_FIELDS.ALLOW_CREATE]: new TypeField(
        Types.objectLevelSecurityElemID, OBJECT_LEVEL_SECURITY_FIELDS.ALLOW_CREATE,
        BuiltinTypes.STRING, {}, true
      ),
      [OBJECT_LEVEL_SECURITY_FIELDS.ALLOW_DELETE]: new TypeField(
        Types.objectLevelSecurityElemID, OBJECT_LEVEL_SECURITY_FIELDS.ALLOW_DELETE,
        BuiltinTypes.STRING, {}, true
      ),
      [OBJECT_LEVEL_SECURITY_FIELDS.ALLOW_EDIT]: new TypeField(
        Types.objectLevelSecurityElemID, OBJECT_LEVEL_SECURITY_FIELDS.ALLOW_EDIT,
        BuiltinTypes.STRING, {}, true
      ),
      [OBJECT_LEVEL_SECURITY_FIELDS.ALLOW_READ]: new TypeField(
        Types.objectLevelSecurityElemID, OBJECT_LEVEL_SECURITY_FIELDS.ALLOW_READ,
        BuiltinTypes.STRING, {}, true
      ),
      [OBJECT_LEVEL_SECURITY_FIELDS.MODIFY_ALL_RECORDS]: new TypeField(
        Types.objectLevelSecurityElemID, OBJECT_LEVEL_SECURITY_FIELDS.MODIFY_ALL_RECORDS,
        BuiltinTypes.STRING, {}, true
      ),
      [OBJECT_LEVEL_SECURITY_FIELDS.VIEW_ALL_RECORDS]: new TypeField(
        Types.objectLevelSecurityElemID, OBJECT_LEVEL_SECURITY_FIELDS.VIEW_ALL_RECORDS,
        BuiltinTypes.STRING, {}, true
      ),
    },
  })

  private static filterItemElemID = new ElemID(SALESFORCE, FIELD_TYPE_NAMES.FILTER_ITEM)
  private static filterItemType = new ObjectType({
    elemID: Types.filterItemElemID,
    fields: {
      [FILTER_ITEM_FIELDS.FIELD]: new TypeField(
        Types.filterItemElemID, FILTER_ITEM_FIELDS.FIELD, BuiltinTypes.STRING
      ),
      [FILTER_ITEM_FIELDS.OPERATION]: new TypeField(
        Types.filterItemElemID, FILTER_ITEM_FIELDS.OPERATION, BuiltinTypes.STRING
      ),
      [FILTER_ITEM_FIELDS.VALUE_FIELD]: new TypeField(
        Types.filterItemElemID, FILTER_ITEM_FIELDS.VALUE_FIELD, BuiltinTypes.STRING
      ),
      [FILTER_ITEM_FIELDS.VALUE]: new TypeField(
        Types.filterItemElemID, FILTER_ITEM_FIELDS.VALUE, BuiltinTypes.STRING
      ),
    },
  })

  private static lookupFilterElemID = new ElemID(SALESFORCE, FIELD_TYPE_NAMES.LOOKUP_FILTER)
  private static lookupFilterType = new ObjectType({
    elemID: Types.lookupFilterElemID,
    fields: {
      [LOOKUP_FILTER_FIELDS.ACTIVE]: new TypeField(
        Types.lookupFilterElemID, LOOKUP_FILTER_FIELDS.ACTIVE, BuiltinTypes.BOOLEAN
      ),
      [LOOKUP_FILTER_FIELDS.BOOLEAN_FILTER]: new TypeField(
        Types.lookupFilterElemID, LOOKUP_FILTER_FIELDS.BOOLEAN_FILTER, BuiltinTypes.STRING
      ),
      [LOOKUP_FILTER_FIELDS.ERROR_MESSAGE]: new TypeField(
        Types.lookupFilterElemID, LOOKUP_FILTER_FIELDS.ERROR_MESSAGE, BuiltinTypes.STRING
      ),
      [LOOKUP_FILTER_FIELDS.INFO_MESSAGE]: new TypeField(
        Types.lookupFilterElemID, LOOKUP_FILTER_FIELDS.INFO_MESSAGE, BuiltinTypes.STRING
      ),
      [LOOKUP_FILTER_FIELDS.IS_OPTIONAL]: new TypeField(
        Types.lookupFilterElemID, LOOKUP_FILTER_FIELDS.IS_OPTIONAL, BuiltinTypes.BOOLEAN
      ),
      [LOOKUP_FILTER_FIELDS.FILTER_ITEMS]: new TypeField(
        Types.lookupFilterElemID, LOOKUP_FILTER_FIELDS.FILTER_ITEMS,
        Types.filterItemType, {}, true
      ),
    },
  })

  private static valueSettingsElemID = new ElemID(SALESFORCE, FIELD_TYPE_NAMES.VALUE_SETTINGS)
  private static valueSettingsType = new ObjectType({
    elemID: Types.valueSettingsElemID,
    fields: {
      // todo: currently this field is populated with the referenced field's API name,
      //  should be modified to elemID reference once we'll use HIL
      [VALUE_SETTINGS_FIELDS.VALUE_NAME]: new TypeField(
        Types.valueSettingsElemID, VALUE_SETTINGS_FIELDS.VALUE_NAME, BuiltinTypes.STRING
      ),
      [VALUE_SETTINGS_FIELDS.CONTROLLING_FIELD_VALUE]: new TypeField(
        Types.valueSettingsElemID, VALUE_SETTINGS_FIELDS.CONTROLLING_FIELD_VALUE,
        BuiltinTypes.STRING, {}, true
      ),
    },
  })

  private static fieldDependencyElemID = new ElemID(SALESFORCE, FIELD_TYPE_NAMES.FIELD_DEPENDENCY)
  private static fieldDependencyType = new ObjectType({
    elemID: Types.fieldDependencyElemID,
    fields: {
      [FIELD_DEPENDENCY_FIELDS.CONTROLLING_FIELD]: new TypeField(
        Types.fieldDependencyElemID, FIELD_DEPENDENCY_FIELDS.CONTROLLING_FIELD, BuiltinTypes.STRING
      ),
      [FIELD_DEPENDENCY_FIELDS.VALUE_SETTINGS]: new TypeField(
        Types.fieldDependencyElemID, FIELD_DEPENDENCY_FIELDS.VALUE_SETTINGS,
        Types.valueSettingsType, {}, true
      ),
    },
  })

  private static rollupSummaryOperationTypeElemID = new ElemID(SALESFORCE,
    FIELD_ANNOTATIONS.SUMMARY_OPERATION)

  private static rollupSummaryOperationType = new PrimitiveType({
    elemID: Types.rollupSummaryOperationTypeElemID,
    primitive: PrimitiveTypes.STRING,
    annotations: {
      [CORE_ANNOTATIONS.RESTRICTION]: { [CORE_ANNOTATIONS.ENFORCE_VALUE]: true },
      [CORE_ANNOTATIONS.VALUES]: ['count', 'min', 'max', 'sum'],
    },
  })

  private static rollupSummaryFilterOperationTypeElemID = new ElemID(SALESFORCE,
    FIELD_ANNOTATIONS.SUMMARY_FILTER_ITEMS, 'type', FILTER_ITEM_FIELDS.OPERATION)

  private static rollupSummaryFilterOperationTypeType = new PrimitiveType({
    elemID: Types.rollupSummaryFilterOperationTypeElemID,
    primitive: PrimitiveTypes.STRING,
    annotations: {
      [CORE_ANNOTATIONS.RESTRICTION]: { [CORE_ANNOTATIONS.ENFORCE_VALUE]: true },
      [CORE_ANNOTATIONS.VALUES]: [
        'equals', 'notEqual', 'lessThan', 'greaterThan', 'lessOrEqual',
        'greaterOrEqual', 'contains', 'notContain', 'startsWith',
        'includes', 'excludes', 'within',
      ],
    },
  })

  private static rollupSummaryFilterItemsElemID = new ElemID(SALESFORCE,
    FIELD_ANNOTATIONS.SUMMARY_FILTER_ITEMS)

  private static rollupSummaryFilterItemsType = new ObjectType({
    elemID: Types.rollupSummaryFilterItemsElemID,
    fields: {
      [FILTER_ITEM_FIELDS.FIELD]: new TypeField(
        Types.rollupSummaryFilterItemsElemID, FILTER_ITEM_FIELDS.FIELD, BuiltinTypes.STRING
      ),
      [FILTER_ITEM_FIELDS.OPERATION]: new TypeField(
        Types.rollupSummaryFilterItemsElemID, FILTER_ITEM_FIELDS.OPERATION,
        Types.rollupSummaryFilterOperationTypeType
      ),
      [FILTER_ITEM_FIELDS.VALUE]: new TypeField(
        Types.rollupSummaryFilterItemsElemID, FILTER_ITEM_FIELDS.VALUE, BuiltinTypes.STRING
      ),
      [FILTER_ITEM_FIELDS.VALUE_FIELD]: new TypeField(
        Types.rollupSummaryFilterItemsElemID, FILTER_ITEM_FIELDS.VALUE_FIELD, BuiltinTypes.STRING
      ),
    },
  })

  private static commonAnnotationTypes = {
    [API_NAME]: BuiltinTypes.SERVICE_ID,
    [DESCRIPTION]: BuiltinTypes.STRING,
    [HELP_TEXT]: BuiltinTypes.STRING,
    [LABEL]: BuiltinTypes.STRING,
    [FIELD_LEVEL_SECURITY_ANNOTATION]: Types.fieldLevelSecurityType,
  }

  // Type mapping for custom objects
  public static primitiveDataTypes: Record<string, Type> = {
    text: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.TEXT),
      primitive: PrimitiveTypes.STRING,
      annotationTypes: {
        ...Types.commonAnnotationTypes,
        [FIELD_ANNOTATIONS.UNIQUE]: BuiltinTypes.BOOLEAN,
        [FIELD_ANNOTATIONS.EXTERNAL_ID]: BuiltinTypes.BOOLEAN,
        [FIELD_ANNOTATIONS.CASE_SENSITIVE]: BuiltinTypes.BOOLEAN,
        [FIELD_ANNOTATIONS.LENGTH]: BuiltinTypes.NUMBER,
      },
    }),
    number: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.NUMBER),
      primitive: PrimitiveTypes.NUMBER,
      annotationTypes: {
        ...Types.commonAnnotationTypes,
        [FIELD_ANNOTATIONS.SCALE]: BuiltinTypes.NUMBER,
        [FIELD_ANNOTATIONS.PRECISION]: BuiltinTypes.NUMBER,
        [FIELD_ANNOTATIONS.UNIQUE]: BuiltinTypes.BOOLEAN,
        [FIELD_ANNOTATIONS.EXTERNAL_ID]: BuiltinTypes.BOOLEAN,
      },
    }),
    autonumber: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.AUTONUMBER),
      primitive: PrimitiveTypes.STRING,
      annotationTypes: {
        ...Types.commonAnnotationTypes,
        [FIELD_ANNOTATIONS.EXTERNAL_ID]: BuiltinTypes.BOOLEAN,
        [FIELD_ANNOTATIONS.DISPLAY_FORMAT]: BuiltinTypes.STRING,
      },
    }),
    boolean: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.CHECKBOX),
      primitive: PrimitiveTypes.BOOLEAN,
      annotationTypes: {
        ...Types.commonAnnotationTypes,
      },
    }),
    date: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.DATE),
      primitive: PrimitiveTypes.STRING,
      annotationTypes: {
        ...Types.commonAnnotationTypes,
      },
    }),
    time: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.TIME),
      primitive: PrimitiveTypes.STRING,
      annotationTypes: {
        ...Types.commonAnnotationTypes,
      },
    }),
    datetime: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.DATETIME),
      primitive: PrimitiveTypes.STRING,
      annotationTypes: {
        ...Types.commonAnnotationTypes,
      },
    }),
    currency: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.CURRENCY),
      primitive: PrimitiveTypes.NUMBER,
      annotationTypes: {
        ...Types.commonAnnotationTypes,
        [FIELD_ANNOTATIONS.SCALE]: BuiltinTypes.NUMBER,
        [FIELD_ANNOTATIONS.PRECISION]: BuiltinTypes.NUMBER,
      },
    }),
    picklist: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.PICKLIST),
      primitive: PrimitiveTypes.STRING,
      annotationTypes: {
        ...Types.commonAnnotationTypes,
        [FIELD_ANNOTATIONS.FIELD_DEPENDENCY]: Types.fieldDependencyType,
      },
    }),
    multipicklist: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.MULTIPICKLIST),
      primitive: PrimitiveTypes.STRING,
      annotationTypes: {
        ...Types.commonAnnotationTypes,
        [FIELD_ANNOTATIONS.VISIBLE_LINES]: BuiltinTypes.NUMBER,
        [FIELD_ANNOTATIONS.FIELD_DEPENDENCY]: Types.fieldDependencyType,
      },
    }),
    email: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.EMAIL),
      primitive: PrimitiveTypes.STRING,
      annotationTypes: {
        ...Types.commonAnnotationTypes,
        [FIELD_ANNOTATIONS.UNIQUE]: BuiltinTypes.BOOLEAN,
        [FIELD_ANNOTATIONS.EXTERNAL_ID]: BuiltinTypes.BOOLEAN,
        [FIELD_ANNOTATIONS.CASE_SENSITIVE]: BuiltinTypes.BOOLEAN,
      },
    }),
    percent: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.PERCENT),
      primitive: PrimitiveTypes.NUMBER,
      annotationTypes: {
        ...Types.commonAnnotationTypes,
        [FIELD_ANNOTATIONS.SCALE]: BuiltinTypes.NUMBER,
        [FIELD_ANNOTATIONS.PRECISION]: BuiltinTypes.NUMBER,
      },
    }),
    phone: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.PHONE),
      primitive: PrimitiveTypes.STRING,
      annotationTypes: {
        ...Types.commonAnnotationTypes,
      },
    }),
    longtextarea: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.LONGTEXTAREA),
      primitive: PrimitiveTypes.STRING,
      annotationTypes: {
        ...Types.commonAnnotationTypes,
        [FIELD_ANNOTATIONS.VISIBLE_LINES]: BuiltinTypes.NUMBER,
        [FIELD_ANNOTATIONS.LENGTH]: BuiltinTypes.NUMBER,
      },
    }),
    richtextarea: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.RICHTEXTAREA),
      primitive: PrimitiveTypes.STRING,
      annotationTypes: {
        ...Types.commonAnnotationTypes,
        [FIELD_ANNOTATIONS.VISIBLE_LINES]: BuiltinTypes.NUMBER,
        [FIELD_ANNOTATIONS.LENGTH]: BuiltinTypes.NUMBER,
      },
    }),
    textarea: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.TEXTAREA),
      primitive: PrimitiveTypes.STRING,
      annotationTypes: {
        ...Types.commonAnnotationTypes,
      },
    }),
    encryptedtext: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.ENCRYPTEDTEXT),
      primitive: PrimitiveTypes.STRING,
      annotationTypes: {
        ...Types.commonAnnotationTypes,
        [FIELD_ANNOTATIONS.MASK_CHAR]: BuiltinTypes.STRING,
        [FIELD_ANNOTATIONS.MASK_TYPE]: BuiltinTypes.STRING,
        [FIELD_ANNOTATIONS.LENGTH]: BuiltinTypes.NUMBER,
      },
    }),
    url: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.URL),
      primitive: PrimitiveTypes.STRING,
      annotationTypes: {
        ...Types.commonAnnotationTypes,
      },
    }),
    lookup: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.LOOKUP),
      primitive: PrimitiveTypes.STRING,
      annotationTypes: {
        ...Types.commonAnnotationTypes,
        [FIELD_ANNOTATIONS.ALLOW_LOOKUP_RECORD_DELETION]: BuiltinTypes.BOOLEAN,
        [FIELD_ANNOTATIONS.REFERENCE_TO]: BuiltinTypes.STRING,
        [FIELD_ANNOTATIONS.LOOKUP_FILTER]: Types.lookupFilterType,
      },
    }),
    masterdetail: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.MASTER_DETAIL),
      primitive: PrimitiveTypes.STRING,
      annotationTypes: {
        ...Types.commonAnnotationTypes,
        [FIELD_ANNOTATIONS.REPARENTABLE_MASTER_DETAIL]: BuiltinTypes.BOOLEAN,
        [FIELD_ANNOTATIONS.WRITE_REQUIRES_MASTER_READ]: BuiltinTypes.BOOLEAN,
        [FIELD_ANNOTATIONS.LOOKUP_FILTER]: Types.lookupFilterType,
        [FIELD_ANNOTATIONS.REFERENCE_TO]: BuiltinTypes.STRING,
      },
    }),
    rollupsummary: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.ROLLUP_SUMMARY),
      primitive: PrimitiveTypes.STRING,
      annotationTypes: {
        ...Types.commonAnnotationTypes,
        // todo: currently SUMMARIZED_FIELD && SUMMARY_FOREIGN_KEY are populated with the referenced
        //  field's API name should be modified to elemID reference once we'll use HIL
        [FIELD_ANNOTATIONS.SUMMARIZED_FIELD]: BuiltinTypes.STRING,
        [FIELD_ANNOTATIONS.SUMMARY_FILTER_ITEMS]: Types.rollupSummaryFilterItemsType,
        [FIELD_ANNOTATIONS.SUMMARY_FOREIGN_KEY]: BuiltinTypes.STRING,
        [FIELD_ANNOTATIONS.SUMMARY_OPERATION]: Types.rollupSummaryOperationType,
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
        ...Types.commonAnnotationTypes,
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
        ...Types.commonAnnotationTypes,
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
        ...Types.commonAnnotationTypes,
      },
    }),
  }

  // Type mapping for metadata types
  private static metadataPrimitiveTypes: Record<string, Type> = {
    string: BuiltinTypes.STRING,
    double: BuiltinTypes.NUMBER,
    int: BuiltinTypes.NUMBER,
    integer: BuiltinTypes.NUMBER,
    boolean: BuiltinTypes.BOOLEAN,
  }

  static setElemIdGetter(getElemIdFunc: ElemIdGetter): void {
    this.getElemIdFunc = getElemIdFunc
  }

  static getKnownType(name: string, customObject = true): Type {
    return customObject
      ? this.primitiveDataTypes[name.toLowerCase()]
      : this.metadataPrimitiveTypes[name.toLowerCase()]
  }

  static get(name: string, customObject = true, isSettings = false, serviceIds?: ServiceIds): Type {
    const type = Types.getKnownType(name, customObject)
    if (type === undefined) {
      return this.createObjectType(name, customObject, isSettings, serviceIds)
    }
    return type
  }

  private static createObjectType(name: string, customObject = true, isSettings = false,
    serviceIds?: ServiceIds): ObjectType {
    const elemId = this.getElemId(name, customObject, serviceIds)
    return new ObjectType({
      elemID: elemId,
      isSettings,
    })
  }

  public static getElemId(name: string, customObject: boolean, serviceIds?: ServiceIds): ElemID {
    return (customObject && this.getElemIdFunc && serviceIds)
      ? (this.getElemIdFunc as ElemIdGetter)(SALESFORCE, serviceIds as ServiceIds, bpCase(name))
      : new ElemID(SALESFORCE, bpCase(name))
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

  static getAnnotationTypes(): Type[] {
    return [Types.fieldLevelSecurityType, Types.fieldDependencyType,
      Types.rollupSummaryOperationType, Types.objectLevelSecurityType,
      Types.valueSettingsType, Types.lookupFilterType, Types.filterItemType]
      .map(type => {
        const fieldType = type.clone()
        fieldType.path = ['types', 'annotation_types']
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

export const toCustomField = (
  object: ObjectType, field: TypeField, fullname = false
): CustomField => {
  const fieldDependency = field.annotations[FIELD_ANNOTATIONS.FIELD_DEPENDENCY]
  const valueSettings = mapKeysRecursive(fieldDependency?.[FIELD_DEPENDENCY_FIELDS.VALUE_SETTINGS],
    key => sfCase(key, false, false)) as ValueSettings[]
  const summaryFilterItems = mapKeysRecursive(
    field.annotations[FIELD_ANNOTATIONS.SUMMARY_FILTER_ITEMS], key => sfCase(key, false, false)
  ) as FilterItem[]
  const newField = new CustomField(
    fullname ? fieldFullName(object, field) : apiName(field),
    FIELD_TYPE_API_NAMES[fieldTypeName(field.type.elemID.name)],
    field.annotations[LABEL],
    field.annotations[CORE_ANNOTATIONS.REQUIRED],
    field.annotations[CORE_ANNOTATIONS.DEFAULT],
    field.annotations[DEFAULT_VALUE_FORMULA],
    field.annotations[CORE_ANNOTATIONS.VALUES],
    fieldDependency?.[FIELD_DEPENDENCY_FIELDS.CONTROLLING_FIELD],
    valueSettings,
    field.annotations[FORMULA],
    summaryFilterItems,
    field.annotations[FIELD_ANNOTATIONS.REFERENCE_TO],
    sfCase(field.name),
    field.annotations[FIELD_ANNOTATIONS.ALLOW_LOOKUP_RECORD_DELETION]
  )

  // Skip the assignment of the following annotations that are defined as annotationType
  const blacklistedAnnotations: string[] = [
    API_NAME, // used to mark the SERVICE_ID but does not exist in the CustomObject
    FIELD_ANNOTATIONS.ALLOW_LOOKUP_RECORD_DELETION, // handled in the CustomField constructor
    FIELD_ANNOTATIONS.FIELD_DEPENDENCY, // handled in field_dependencies filter
    FIELD_ANNOTATIONS.LOOKUP_FILTER, // handled in lookup_filters filter
    FIELD_LEVEL_SECURITY_ANNOTATION,
  ]
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

export const toCustomObject = (
  element: ObjectType, includeFields: boolean, skipFields: string[] = [],
): CustomObject =>
  new CustomObject(
    apiName(element),
    element.annotations[LABEL],
    includeFields
      ? Object.values(element.fields)
        .map(field => toCustomField(element, field))
        .filter(field => !skipFields.includes(field.fullName))
      : undefined
  )

export const getValueTypeFieldElement = (parentID: ElemID, field: ValueTypeField,
  knownTypes: Map<string, Type>): TypeField => {
  const bpFieldName = bpCase(field.name)
  const bpFieldType = (field.name === METADATA_OBJECT_NAME_FIELD) ? BuiltinTypes.SERVICE_ID
    : knownTypes.get(field.soapType) || Types.get(field.soapType, false)
  // mark required as false until SALTO-45 will be resolved
  const annotations: Values = { [CORE_ANNOTATIONS.REQUIRED]: false }

  if (field.picklistValues && field.picklistValues.length > 0) {
    // picklist values in metadata types are used to restrict a field to a list of allowed values
    // because some fields can allow all fields names / all object names this restriction list
    // might be very large and cause memory problems on parsing, so we choose to omit the
    // restriction where there are too many possible values
    if (field.picklistValues.length < MAX_METADATA_RESTRICTION_VALUES) {
      annotations[CORE_ANNOTATIONS.VALUES] = _.sortedUniq(field
        .picklistValues.map(val => val.value).sort())
      annotations[CORE_ANNOTATIONS.RESTRICTION] = { [CORE_ANNOTATIONS.ENFORCE_VALUE]: false }
    }
    const defaults = field.picklistValues
      .filter(val => val.defaultValue)
      .map(val => val.value)
    if (defaults.length === 1) {
      annotations[CORE_ANNOTATIONS.DEFAULT] = defaults.pop()
    }
  }
  return new TypeField(parentID, bpFieldName, bpFieldType, annotations)
}

export type PrimitiveValue = string | boolean | number
type ConvertXsdTypeFunc = (v: string) => PrimitiveValue
export const convertXsdTypeFuncMap: Record<string, ConvertXsdTypeFunc> = {
  'xsd:string': String,
  'xsd:boolean': v => v === 'true',
  'xsd:double': Number,
  'xsd:int': Number,
  'xsd:long': Number,
}

const isDefaultWithType = (val: PrimitiveValue | DefaultValueWithType):
  val is DefaultValueWithType => new Set(_.keys(val)).has('_')

const valueFromXsdType = (val: DefaultValueWithType): PrimitiveValue => {
  const convertFunc = convertXsdTypeFuncMap[val.$['xsi:type']] || (v => v)
  return convertFunc(val._)
}

const getDefaultValue = (field: Field): PrimitiveValue | undefined => {
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
  }
  if (field.type !== 'boolean') {
    // nillable is the closest thing we could find to infer if a field is required, it might not
    // be perfect
    // boolean (i.e. Checkbox) must not have required field
    annotations[CORE_ANNOTATIONS.REQUIRED] = !field.nillable
  }
  const defaultValue = getDefaultValue(field)
  if (defaultValue !== undefined) {
    annotations[CORE_ANNOTATIONS.DEFAULT] = defaultValue
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
    annotations[CORE_ANNOTATIONS.VALUES] = field.picklistValues.map(val => val.value)
    annotations[CORE_ANNOTATIONS.RESTRICTION] = { [CORE_ANNOTATIONS.ENFORCE_VALUE]:
       Boolean(field.restrictedPicklist) }

    const defaults = field.picklistValues
      .filter(val => val.defaultValue)
      .map(val => val.value)
    if (defaults.length > 0) {
      if (field.type.endsWith('picklist')) {
        annotations[CORE_ANNOTATIONS.DEFAULT] = defaults.pop()
      } else {
        annotations[CORE_ANNOTATIONS.DEFAULT] = defaults
      }
    }
    if (field.dependentPicklist) {
      // will be populated in the field_dependencies filter
      annotations[FIELD_ANNOTATIONS.FIELD_DEPENDENCY] = {}
    }
    if (field.type === 'multipicklist') {
      // Precision is the field for multi-picklist in SFDC API that defines how many objects will
      // be visible in the picklist in the UI. Why? Because.
      annotations[FIELD_ANNOTATIONS.VISIBLE_LINES] = field.precision
    }
  } else if (field.calculated) {
    if (!_.isEmpty(field.calculatedFormula)) {
      // Formulas
      bpFieldType = getFieldType(formulaTypeName(bpFieldType.elemID.name))
      annotations[FORMULA] = field.calculatedFormula
    } else {
      // Rollup Summary
      bpFieldType = getFieldType(FIELD_TYPE_NAMES.ROLLUP_SUMMARY)
    }
    // Lookup & MasterDetail
  } else if (field.type === 'reference') {
    if (field.cascadeDelete) {
      bpFieldType = getFieldType(FIELD_TYPE_NAMES.MASTER_DETAIL)
      // master detail fields are always not required in SF although returned as nillable=false
      annotations[CORE_ANNOTATIONS.REQUIRED] = false
      annotations[FIELD_ANNOTATIONS.WRITE_REQUIRES_MASTER_READ] = Boolean(
        field.writeRequiresMasterRead
      )
      annotations[FIELD_ANNOTATIONS.REPARENTABLE_MASTER_DETAIL] = Boolean(field.updateable)
    } else {
      bpFieldType = getFieldType(FIELD_TYPE_NAMES.LOOKUP)
      annotations[FIELD_ANNOTATIONS.ALLOW_LOOKUP_RECORD_DELETION] = !(_.get(field, 'restrictedDelete'))
    }
    if (!_.isEmpty(field.referenceTo)) {
      // todo: currently this field is populated with the referenced object's API name,
      //  should be modified to elemID reference once we'll use HIL
      // there are some SF reference fields without related fields
      // e.g. salesforce_user_app_menu_item.ApplicationId, salesforce_login_event.LoginHistoryId
      annotations[FIELD_ANNOTATIONS.REFERENCE_TO] = field.referenceTo
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

  const fieldName = Types.getElemId(field.name, true, serviceIds).name
  return new TypeField(parentID, fieldName, bpFieldType, annotations)
}

export const fromMetadataInfo = (info: MetadataInfo):
  Values => mapKeysRecursive(info, bpCase)

export const toMetadataInfo = (fullName: string, values: Values):
  MetadataInfo =>
  ({
    fullName,
    ...mapKeysRecursive(values, name => sfCase(name, false, false)),
  })

export const toInstanceElements = (type: ObjectType, queryResult: QueryResult<Value>):
  InstanceElement[] => {
  // Omit the "attributes" field from the objects
  const results = queryResult.records.map(obj => _.pickBy(obj, (_value, key) =>
    key !== 'attributes'))

  // Convert the result to Instance Elements
  return results.map(res => new InstanceElement(res.Id, type, res))
}

export const createInstanceElement = (mdInfo: MetadataInfo, type: ObjectType,
  namespacePrefix?: string): InstanceElement => {
  const getPackagePath = (): string[] => {
    if (namespacePrefix) {
      if (namespacePrefix === 'standard' || mdInfo.fullName === namespacePrefix) {
        // InstalledPackage records should be under records and not within their package
        // Some CustomApplications have 'standard' namespace although they are not part of a package
        return []
      }
      return ['installed_packages', namespacePrefix]
    }
    return []
  }

  const instanceServiceIds = (): ServiceIds => {
    const typeServiceIds = (): ServiceIds => {
      const serviceIds: ServiceIds = {
        [ADAPTER]: SALESFORCE,
        [METADATA_TYPE]: type.annotations[METADATA_TYPE],
      }
      if (type.annotations[API_NAME]) {
        serviceIds[API_NAME] = type.annotations[API_NAME]
      }
      return serviceIds
    }

    return {
      [INSTANCE_FULL_NAME_FIELD]: mdInfo.fullName,
      [ADAPTER]: SALESFORCE,
      [OBJECT_SERVICE_ID]: toServiceIdsString(typeServiceIds()),
    }
  }

  const typeName = type.elemID.name
  const name = (): string => Types.getElemId(mdInfo.fullName, true, instanceServiceIds()).name
  return new InstanceElement(
    type.isSettings ? ElemID.CONFIG_NAME : name(),
    type,
    fromMetadataInfo(mdInfo),
    [...getPackagePath(), 'records',
      type.isSettings ? 'settings' : typeName, bpCase(mdInfo.fullName)],
  )
}


export const createMetadataTypeElements = async (
  objectName: string,
  fields: ValueTypeField[],
  knownTypes: Map<string, Type>,
  baseTypeNames: Set<string>,
  client: SalesforceClient,
  isSettings = false,
): Promise<ObjectType[]> => {
  if (knownTypes.has(objectName)) {
    // Already created this type, no new types to return here
    return []
  }
  const element = Types.get(objectName, false, isSettings) as ObjectType
  knownTypes.set(objectName, element)
  element.annotationTypes[METADATA_TYPE] = BuiltinTypes.SERVICE_ID
  element.annotate({ [METADATA_TYPE]: objectName })
  element.path = [
    'types',
    ...(baseTypeNames.has(objectName) ? [] : ['subtypes']),
    element.elemID.name,
  ]
  if (!fields || _.isEmpty(fields)) {
    return [element]
  }

  /* Due to a SF API bug, there are field types that returned with no nested fields why they should.
   * Only a specific call to describeMetadataType with the nested type returns the inner fields.
   * e.g. the nested fields of Report fields are not returned from describeMetadataType('Report')
   */
  const shouldEnrichFieldValue = (field: ValueTypeField): boolean => {
    const isKnownType = (): boolean =>
      knownTypes.has(field.soapType) || baseTypeNames.has(field.soapType)
        || isPrimitiveType(Types.get(field.soapType, false))

    const startsWithUppercase = (): boolean =>
      // covers types like base64Binary, anyType etc.
      field.soapType[0] === field.soapType[0].toUpperCase()

    return _.isEmpty(field.fields) && _.isEmpty(field.picklistValues)
      && !isKnownType() && startsWithUppercase()
  }

  // We need to create embedded types BEFORE creating this element's fields
  // in order to make sure all internal types we may need are updated in the
  // knownTypes map
  const enrichedFields = await Promise.all(fields.map(async field => {
    if (shouldEnrichFieldValue(field)) {
      const innerFields = await client.describeMetadataType(field.soapType)
      return { ...field,
        fields: innerFields }
    }
    return field
  }))

  const embeddedTypes = await Promise.all(_.flatten(enrichedFields
    .filter(field => !_.isEmpty(field.fields))
    .map(field => createMetadataTypeElements(
      field.soapType,
      makeArray(field.fields),
      knownTypes,
      baseTypeNames,
      client,
      false,
    ))))

  // Enum fields sometimes show up with a type name that is not primitive but also does not
  // have fields (so we won't create an embedded type for it). it seems like these "empty" types
  // are always supposed to be a string with some restriction so we map all non primitive "empty"
  // types to string
  enrichedFields
    .filter(field => _.isEmpty(field.fields))
    .filter(field => !isPrimitiveType(Types.get(field.soapType, false)))
    .forEach(field => knownTypes.set(field.soapType, BuiltinTypes.STRING))

  const fieldElements = enrichedFields.map(field =>
    getValueTypeFieldElement(element.elemID, field, knownTypes))

  // Set fields on elements
  fieldElements.forEach(field => {
    element.fields[field.name] = field
  })

  return _.flatten([element, ...embeddedTypes])
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
    field.type.elemID.isEqual(fieldType.elemID)
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
          [API_NAME]: `${key.slice(0, -SALESFORCE_CUSTOM_SUFFIX.length)}${NAMESPACE_SEPARATOR}${capitalize(childField.name)}${isCustomField ? '__s' : ''}`,
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
