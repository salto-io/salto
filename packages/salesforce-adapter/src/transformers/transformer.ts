/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import {
  DefaultValueWithType,
  Field as SalesforceField,
  FileProperties,
  MetadataInfo,
  PicklistEntry,
  ValueTypeField,
} from '@salto-io/jsforce'
import {
  BuiltinTypes,
  CORE_ANNOTATIONS,
  createRefToElmWithValue,
  createRestriction,
  Element,
  ElemID,
  ElemIdGetter,
  Field,
  InstanceElement,
  isContainerType,
  isElement,
  isField,
  isInstanceElement,
  isObjectType,
  isPrimitiveType,
  isPrimitiveValue,
  ListType,
  OBJECT_SERVICE_ID,
  ObjectType,
  PrimitiveType,
  PrimitiveTypes,
  PrimitiveValue,
  ServiceIds,
  toServiceIdsString,
  TypeElement,
  TypeMap,
  TypeReference,
  Value,
  Values,
} from '@salto-io/adapter-api'
import { collections, promises, values as lowerDashValues } from '@salto-io/lowerdash'
import { naclCase, pathNaclCase, TransformFunc, TransformFuncSync, transformValues } from '@salto-io/adapter-utils'

import { logger } from '@salto-io/logging'
import { SalesforceRecord } from '../client/types'
import {
  ADDRESS_FIELDS,
  ALL_FIELD_TYPE_NAMES,
  ANNOTATION_TYPE_NAMES,
  API_NAME,
  API_NAME_SEPARATOR,
  BUSINESS_OWNER_GROUP,
  BUSINESS_OWNER_USER,
  BUSINESS_STATUS,
  COMPLIANCE_GROUP,
  COMPOUND_FIELD_TYPE_NAMES,
  COMPOUND_FIELDS_SOAP_TYPE_NAMES,
  CUSTOM_FIELD,
  CUSTOM_METADATA,
  CUSTOM_METADATA_TYPE_NAME,
  CUSTOM_OBJECT,
  CUSTOM_OBJECT_ID_FIELD,
  CUSTOM_OBJECT_TYPE_NAME,
  CUSTOM_SETTINGS_TYPE,
  CUSTOM_VALUE,
  DEFAULT_VALUE_FORMULA,
  DESCRIPTION,
  FIELD_ANNOTATIONS,
  FIELD_DEPENDENCY_FIELDS,
  FIELD_SOAP_TYPE_NAMES,
  FIELD_TYPE_NAMES,
  FILTER_ITEM_FIELDS,
  FOREIGN_KEY_DOMAIN,
  FORMULA,
  FORMULA_TYPE_NAME,
  GEOLOCATION_FIELDS,
  getTypePath,
  HELP_TEXT,
  INSTALLED_PACKAGES_PATH,
  INSTANCE_FULL_NAME_FIELD,
  INTERNAL_FIELD_TYPE_NAMES,
  INTERNAL_ID_ANNOTATION,
  INTERNAL_ID_FIELD,
  LABEL,
  LOCATION_INTERNAL_COMPOUND_FIELD_TYPE_NAME,
  LOOKUP_FILTER_FIELDS,
  MAX_METADATA_RESTRICTION_VALUES,
  META_TYPES_PATH,
  METADATA_META_TYPE,
  METADATA_TYPE,
  NAME_FIELDS,
  RECORDS_PATH,
  SALESFORCE,
  SALESFORCE_CUSTOM_SUFFIX,
  SALESFORCE_DATE_PLACEHOLDER,
  SECURITY_CLASSIFICATION,
  SETTINGS_PATH,
  STANDARD_SETTINGS_META_TYPE,
  TYPES_PATH,
  VALUE_SET_DEFINITION_FIELDS,
  VALUE_SET_FIELDS,
  VALUE_SETTINGS_FIELDS,
  XML_ATTRIBUTE_PREFIX,
} from '../constants'
import SalesforceClient from '../client/client'
import { allMissingSubTypes } from './salesforce_types'
import { defaultMissingFields } from './missing_fields'
import { FetchProfile } from '../types'

const log = logger(module)
const { mapValuesAsync } = promises.object
const { makeArray } = collections.array
const { isDefined } = lowerDashValues

const xsdTypes = [
  'xsd:boolean',
  'xsd:date',
  'xsd:dateTime',
  'xsd:picklist',
  'xsd:string',
  'xsd:int',
  'xsd:double',
  'xsd:long',
] as const

export type XsdType = (typeof xsdTypes)[number]
type ConvertXsdTypeFunc = (v: string) => PrimitiveValue

export const metadataType = async (element: Readonly<Element>): Promise<string> => {
  if (isInstanceElement(element)) {
    return metadataType(await element.getType())
  }
  if (isField(element)) {
    // We expect to reach to this place only with field of CustomObject
    return CUSTOM_FIELD
  }
  return element.annotations[METADATA_TYPE] || 'unknown'
}

export const isCustomObject = async (element: Readonly<Element>): Promise<boolean> => {
  const res =
    isObjectType(element) &&
    (await metadataType(element)) === CUSTOM_OBJECT &&
    // The last part is so we can tell the difference between a custom object
    // and the original "CustomObject" type from salesforce (the latter will not have an API_NAME)
    element.annotations[API_NAME] !== undefined
  return res
}

export const isFieldOfCustomObject = async (field: Field): Promise<boolean> => isCustomObject(field.parent)

// This function checks whether an element is an instance of any custom object type.
// Note that this does not apply to custom object definitions themselves, e.g, this will be true
// for instances of Lead, but it will not be true for Lead itself when it is still an instance
// (before the custom objects filter turns it into a type).
// To filter for instances like the Lead definition, use isInstanceOfType(CUSTOM_OBJECT) instead
/**
 * @deprecated use {@link isInstanceOfCustomObjectSync}
 */
export const isInstanceOfCustomObject = async (element: Readonly<Element>): Promise<boolean> =>
  isInstanceElement(element) && isCustomObject(await element.getType())

export const isCustom = (fullName: string | undefined): boolean => fullName?.endsWith(SALESFORCE_CUSTOM_SUFFIX) ?? false

export const isCustomSettings = (instance: Readonly<InstanceElement>): boolean => instance.value[CUSTOM_SETTINGS_TYPE]

export const isCustomSettingsObject = (obj: Readonly<Element>): boolean => obj.annotations[CUSTOM_SETTINGS_TYPE]

export const defaultApiName = (element: Readonly<Element>): string => {
  const { name } = element.elemID
  return isCustom(name) || isInstanceElement(element) ? name : `${name}${SALESFORCE_CUSTOM_SUFFIX}`
}

const fullApiName = async (elem: Readonly<Element>): Promise<string> => {
  if (isInstanceElement(elem)) {
    return (await isCustomObject(await elem.getType()))
      ? elem.value[CUSTOM_OBJECT_ID_FIELD]
      : elem.value[INSTANCE_FULL_NAME_FIELD]
  }
  return elem.annotations[API_NAME] ?? elem.annotations[METADATA_TYPE]
}

export const relativeApiName = (name: string): string => _.last(name.split(API_NAME_SEPARATOR)) as string

/**
 * @deprecated use {@link safeApiName} instead.
 */
export const apiName = async (elem: Readonly<Element>, relative = false): Promise<string> => {
  const name = await fullApiName(elem)
  return name && relative ? relativeApiName(name) : name
}

export const formulaTypeName = (baseTypeName: FIELD_TYPE_NAMES): string => `${FORMULA_TYPE_NAME}${baseTypeName}`

export const fieldTypeName = (typeName: string): string | undefined => {
  if (typeName.startsWith(FORMULA_TYPE_NAME)) {
    return typeName.slice(FORMULA_TYPE_NAME.length)
  }
  if (typeName === LOCATION_INTERNAL_COMPOUND_FIELD_TYPE_NAME) {
    return COMPOUND_FIELD_TYPE_NAMES.LOCATION
  }
  if (typeName === INTERNAL_FIELD_TYPE_NAMES.UNKNOWN) {
    return undefined
  }
  return typeName
}

const createPicklistValuesAnnotations = (picklistValues: PicklistEntry[]): Values =>
  picklistValues.map(val => ({
    [CUSTOM_VALUE.FULL_NAME]: val.value,
    [CUSTOM_VALUE.DEFAULT]: val.defaultValue,
    [CUSTOM_VALUE.LABEL]: val.label || val.value,
    [CUSTOM_VALUE.IS_ACTIVE]: val.active,
  }))

const addPicklistAnnotations = (picklistValues: PicklistEntry[], restricted: boolean, annotations: Values): void => {
  if (picklistValues && picklistValues.length > 0) {
    annotations[FIELD_ANNOTATIONS.VALUE_SET] = createPicklistValuesAnnotations(picklistValues)
    annotations[FIELD_ANNOTATIONS.RESTRICTED] = restricted
  }
}

// Defines SFDC built-in field types & built-in primitive data types
// Ref: https://developer.salesforce.com/docs/atlas.en-us.api.meta/api/field_types.htm
// Ref: https://developer.salesforce.com/docs/atlas.en-us.api.meta/api/primitive_data_types.htm
// Ref: https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_field_types.htm#meta_type_fieldtype

const addressElemID = new ElemID(SALESFORCE, COMPOUND_FIELD_TYPE_NAMES.ADDRESS)
const nameElemID = new ElemID(SALESFORCE, COMPOUND_FIELD_TYPE_NAMES.FIELD_NAME)
const nameNoSalutationElemID = new ElemID(SALESFORCE, COMPOUND_FIELD_TYPE_NAMES.FIELD_NAME_NO_SALUTATION)
// We cannot use "Location" as the Salto ID here because there is a standard object called Location
const geoLocationElemID = new ElemID(SALESFORCE, LOCATION_INTERNAL_COMPOUND_FIELD_TYPE_NAME)

const restrictedNumberTypeDefinitions = {
  TextLength: createRestriction({ min: 1, max: 255, enforce_value: false }),
  TextAreaLength: createRestriction({
    min: 1,
    max: 131072,
    enforce_value: false,
  }),
  EncryptedTextLength: createRestriction({
    min: 1,
    max: 175,
    enforce_value: false,
  }),
  LongTextAreaVisibleLines: createRestriction({
    min: 2,
    max: 50,
    enforce_value: false,
  }),
  MultiPicklistVisibleLines: createRestriction({
    min: 3,
    max: 10,
    enforce_value: false,
  }),
  RichTextAreaVisibleLines: createRestriction({
    min: 10,
    max: 50,
    enforce_value: false,
  }),
  RelationshipOrder: createRestriction({
    min: 0,
    max: 1,
    enforce_value: false,
  }),
}

const restrictedNumberTypes = _.mapValues(
  restrictedNumberTypeDefinitions,
  (restriction, name) =>
    new PrimitiveType({
      elemID: new ElemID(SALESFORCE, name),
      primitive: PrimitiveTypes.NUMBER,
      annotations: { [CORE_ANNOTATIONS.RESTRICTION]: restriction },
    }),
)

export const METADATA_TYPES_TO_RENAME: Map<string, string> = new Map([
  [CUSTOM_OBJECT, CUSTOM_OBJECT_TYPE_NAME],
  // TODO (SALTO-6264): Uncomment this once hide types is enabled.
  // [CUSTOM_METADATA, CUSTOM_METADATA_TYPE_NAME],
  ['FlexiPage', 'LightningPage'],
  ['FlexiPageRegion', 'LightningPageRegion'],
  ['FlexiPageTemplateInstance', 'LightningPageTemplateInstance'],
  ['Territory2', 'Territory2Metadata'],
  ['Territory2Model', 'Territory2ModelMetadata'],
])

export class Types {
  private static getElemIdFunc?: ElemIdGetter

  private static filterItemElemID = new ElemID(SALESFORCE, ANNOTATION_TYPE_NAMES.FILTER_ITEM)

  private static filterItemType = new ObjectType({
    elemID: Types.filterItemElemID,
    fields: {
      [FILTER_ITEM_FIELDS.FIELD]: { refType: BuiltinTypes.STRING },
      [FILTER_ITEM_FIELDS.OPERATION]: {
        refType: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
            values: [
              'contains',
              'equals',
              'excludes',
              'greaterOrEqual',
              'greaterThan',
              'includes',
              'lessOrEqual',
              'lessThan',
              'notContain',
              'notEqual',
              'startsWith',
              'within',
            ],
          }),
        },
      },
      [FILTER_ITEM_FIELDS.VALUE_FIELD]: { refType: BuiltinTypes.STRING },
      [FILTER_ITEM_FIELDS.VALUE]: { refType: BuiltinTypes.STRING },
    },
    annotations: {
      [API_NAME]: 'FilterItem',
    },
  })

  private static lookupFilterElemID = new ElemID(SALESFORCE, ANNOTATION_TYPE_NAMES.LOOKUP_FILTER)

  private static lookupFilterType = new ObjectType({
    elemID: Types.lookupFilterElemID,
    fields: {
      [LOOKUP_FILTER_FIELDS.ACTIVE]: { refType: BuiltinTypes.BOOLEAN },
      [LOOKUP_FILTER_FIELDS.BOOLEAN_FILTER]: {
        refType: BuiltinTypes.STRING,
      },
      [LOOKUP_FILTER_FIELDS.ERROR_MESSAGE]: {
        refType: BuiltinTypes.STRING,
      },
      [LOOKUP_FILTER_FIELDS.INFO_MESSAGE]: {
        refType: BuiltinTypes.STRING,
      },
      [LOOKUP_FILTER_FIELDS.IS_OPTIONAL]: {
        refType: BuiltinTypes.BOOLEAN,
      },
      [LOOKUP_FILTER_FIELDS.FILTER_ITEMS]: {
        refType: new ListType(Types.filterItemType),
      },
    },
    annotations: {
      [API_NAME]: 'LookupFilter',
    },
  })

  private static valueSettingsElemID = new ElemID(SALESFORCE, ANNOTATION_TYPE_NAMES.VALUE_SETTINGS)

  private static valueSettingsType = new ObjectType({
    elemID: Types.valueSettingsElemID,
    fields: {
      // todo: currently this field is populated with the referenced field's API name,
      //  should be modified to elemID reference once we'll use HIL
      [VALUE_SETTINGS_FIELDS.VALUE_NAME]: { refType: BuiltinTypes.STRING },
      [VALUE_SETTINGS_FIELDS.CONTROLLING_FIELD_VALUE]: {
        refType: new ListType(BuiltinTypes.STRING),
      },
    },
    annotations: {
      [API_NAME]: 'ValueSettings',
    },
  })

  private static valueSetElemID = new ElemID(SALESFORCE, FIELD_ANNOTATIONS.VALUE_SET)

  public static valueSetType = new ObjectType({
    elemID: Types.valueSetElemID,
    fields: {
      [CUSTOM_VALUE.FULL_NAME]: { refType: BuiltinTypes.STRING },
      [CUSTOM_VALUE.LABEL]: { refType: BuiltinTypes.STRING },
      [CUSTOM_VALUE.DEFAULT]: { refType: BuiltinTypes.BOOLEAN },
      [CUSTOM_VALUE.IS_ACTIVE]: { refType: BuiltinTypes.BOOLEAN },
      [CUSTOM_VALUE.COLOR]: { refType: BuiltinTypes.STRING },
    },
  })

  private static fieldDependencyElemID = new ElemID(SALESFORCE, ANNOTATION_TYPE_NAMES.FIELD_DEPENDENCY)

  private static fieldDependencyType = new ObjectType({
    elemID: Types.fieldDependencyElemID,
    fields: {
      [FIELD_DEPENDENCY_FIELDS.CONTROLLING_FIELD]: {
        refType: BuiltinTypes.STRING,
      },
      [FIELD_DEPENDENCY_FIELDS.VALUE_SETTINGS]: {
        refType: new ListType(Types.valueSettingsType),
      },
    },
  })

  private static rollupSummaryOperationTypeElemID = new ElemID(SALESFORCE, FIELD_ANNOTATIONS.SUMMARY_OPERATION)

  private static rollupSummaryOperationType = new PrimitiveType({
    elemID: Types.rollupSummaryOperationTypeElemID,
    primitive: PrimitiveTypes.STRING,
    annotations: {
      [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
        values: ['count', 'min', 'max', 'sum'],
      }),
    },
  })

  private static rollupSummaryFilterItemOperationType = new PrimitiveType({
    elemID: new ElemID(SALESFORCE, FIELD_ANNOTATIONS.ROLLUP_SUMMARY_FILTER_OPERATION),
    primitive: PrimitiveTypes.STRING,
    annotations: {
      [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
        values: [
          'equals',
          'notEqual',
          'lessThan',
          'greaterThan',
          'lessOrEqual',
          'greaterOrEqual',
          'contains',
          'notContain',
          'startsWith',
          'includes',
          'excludes',
          'within',
        ],
      }),
    },
  })

  private static rollupSummaryFilterItemsElemID = new ElemID(SALESFORCE, FIELD_ANNOTATIONS.SUMMARY_FILTER_ITEMS)

  private static rollupSummaryFilterItemsType = new ObjectType({
    elemID: Types.rollupSummaryFilterItemsElemID,
    fields: {
      [FILTER_ITEM_FIELDS.FIELD]: {
        refType: BuiltinTypes.STRING,
      },
      [FILTER_ITEM_FIELDS.OPERATION]: {
        refType: Types.rollupSummaryFilterItemOperationType,
      },
      [FILTER_ITEM_FIELDS.VALUE]: {
        refType: BuiltinTypes.STRING,
      },
      [FILTER_ITEM_FIELDS.VALUE_FIELD]: {
        refType: BuiltinTypes.STRING,
      },
    },
  })

  private static encryptedTextMaskTypeTypeElemID = new ElemID(SALESFORCE, FIELD_ANNOTATIONS.MASK_TYPE, 'type')

  private static encryptedTextMaskTypeType = new PrimitiveType({
    elemID: Types.encryptedTextMaskTypeTypeElemID,
    primitive: PrimitiveTypes.STRING,
    annotations: {
      [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
        values: ['all', 'creditCard', 'ssn', 'lastFour', 'sin', 'nino'],
      }),
    },
  })

  private static encryptedTextMaskCharTypeElemID = new ElemID(SALESFORCE, FIELD_ANNOTATIONS.MASK_CHAR, 'type')

  private static encryptedTextMaskCharType = new PrimitiveType({
    elemID: Types.encryptedTextMaskCharTypeElemID,
    primitive: PrimitiveTypes.STRING,
    annotations: {
      [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
        values: ['X', 'asterisk'],
      }),
    },
  })

  private static BusinessStatusTypeElemID = new ElemID(SALESFORCE, BUSINESS_STATUS)

  private static BusinessStatusType = new PrimitiveType({
    elemID: Types.BusinessStatusTypeElemID,
    primitive: PrimitiveTypes.STRING,
    annotations: {
      [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
        values: ['Active', 'DeprecateCandidate', 'Hidden'],
      }),
    },
  })

  private static SecurityClassificationTypeElemID = new ElemID(SALESFORCE, SECURITY_CLASSIFICATION)

  private static SecurityClassificationType = new PrimitiveType({
    elemID: Types.SecurityClassificationTypeElemID,
    primitive: PrimitiveTypes.STRING,
    annotations: {
      [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
        values: ['Public', 'Internal', 'Confidential', 'Restricted', 'MissionCritical'],
      }),
    },
  })

  private static TreatBlankAsTypeElemID = new ElemID(SALESFORCE, FIELD_ANNOTATIONS.FORMULA_TREAT_BLANKS_AS)

  private static TreatBlankAsType = new PrimitiveType({
    elemID: Types.TreatBlankAsTypeElemID,
    primitive: PrimitiveTypes.STRING,
    annotations: {
      [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
        values: ['BlankAsBlank', 'BlankAsZero'],
      }),
    },
  })

  private static commonAnnotationTypes = {
    [API_NAME]: BuiltinTypes.SERVICE_ID,
    [DESCRIPTION]: BuiltinTypes.STRING,
    [HELP_TEXT]: BuiltinTypes.STRING,
    [LABEL]: BuiltinTypes.STRING,
    [BUSINESS_OWNER_USER]: BuiltinTypes.STRING,
    [BUSINESS_OWNER_GROUP]: BuiltinTypes.STRING,
    [BUSINESS_STATUS]: Types.BusinessStatusType,
    [SECURITY_CLASSIFICATION]: Types.SecurityClassificationType,
    [COMPLIANCE_GROUP]: BuiltinTypes.STRING,
    [FIELD_ANNOTATIONS.CREATABLE]: BuiltinTypes.BOOLEAN,
    [FIELD_ANNOTATIONS.UPDATEABLE]: BuiltinTypes.BOOLEAN,
    [FIELD_ANNOTATIONS.QUERYABLE]: BuiltinTypes.BOOLEAN,
    [INTERNAL_ID_ANNOTATION]: BuiltinTypes.HIDDEN_STRING,
    [FIELD_ANNOTATIONS.EXTERNAL_ID]: BuiltinTypes.BOOLEAN,
    [FIELD_ANNOTATIONS.TRACK_TRENDING]: BuiltinTypes.BOOLEAN,
    [FIELD_ANNOTATIONS.TRACK_FEED_HISTORY]: BuiltinTypes.BOOLEAN,
    [FIELD_ANNOTATIONS.DEPRECATED]: BuiltinTypes.BOOLEAN,
    [FIELD_ANNOTATIONS.TRACK_HISTORY]: BuiltinTypes.BOOLEAN,
  }

  private static lookupAnnotationTypes = {
    [FIELD_ANNOTATIONS.REFERENCE_TO]: new ListType(BuiltinTypes.STRING),
    [FIELD_ANNOTATIONS.LOOKUP_FILTER]: Types.lookupFilterType,
    [FIELD_ANNOTATIONS.RELATIONSHIP_NAME]: BuiltinTypes.STRING,
    [FIELD_ANNOTATIONS.RELATIONSHIP_LABEL]: BuiltinTypes.STRING,
    [FIELD_ANNOTATIONS.DELETE_CONSTRAINT]: BuiltinTypes.STRING,
  }

  // Type mapping for custom objects
  public static primitiveDataTypes: Record<ALL_FIELD_TYPE_NAMES, PrimitiveType> = {
    [INTERNAL_FIELD_TYPE_NAMES.SERVICE_ID]: BuiltinTypes.SERVICE_ID,
    Text: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.TEXT),
      primitive: PrimitiveTypes.STRING,
      annotationRefsOrTypes: {
        ...Types.commonAnnotationTypes,
        [FIELD_ANNOTATIONS.UNIQUE]: BuiltinTypes.BOOLEAN,
        [FIELD_ANNOTATIONS.CASE_SENSITIVE]: BuiltinTypes.BOOLEAN,
        [FIELD_ANNOTATIONS.LENGTH]: restrictedNumberTypes.TextLength,
        [DEFAULT_VALUE_FORMULA]: BuiltinTypes.STRING,
      },
    }),
    Number: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.NUMBER),
      primitive: PrimitiveTypes.NUMBER,
      annotationRefsOrTypes: {
        ...Types.commonAnnotationTypes,
        [FIELD_ANNOTATIONS.SCALE]: BuiltinTypes.NUMBER,
        [FIELD_ANNOTATIONS.PRECISION]: BuiltinTypes.NUMBER,
        [FIELD_ANNOTATIONS.UNIQUE]: BuiltinTypes.BOOLEAN,
        [DEFAULT_VALUE_FORMULA]: BuiltinTypes.STRING,
      },
    }),
    AutoNumber: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.AUTONUMBER),
      primitive: PrimitiveTypes.STRING,
      annotationRefsOrTypes: {
        ...Types.commonAnnotationTypes,
        [FIELD_ANNOTATIONS.DISPLAY_FORMAT]: BuiltinTypes.STRING,
      },
    }),
    Checkbox: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.CHECKBOX),
      primitive: PrimitiveTypes.BOOLEAN,
      annotationRefsOrTypes: {
        ...Types.commonAnnotationTypes,
        [FIELD_ANNOTATIONS.DEFAULT_VALUE]: BuiltinTypes.BOOLEAN,
      },
    }),
    Date: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.DATE),
      primitive: PrimitiveTypes.STRING,
      annotationRefsOrTypes: {
        ...Types.commonAnnotationTypes,
        [DEFAULT_VALUE_FORMULA]: BuiltinTypes.STRING,
      },
    }),
    Time: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.TIME),
      primitive: PrimitiveTypes.STRING,
      annotationRefsOrTypes: {
        ...Types.commonAnnotationTypes,
        [DEFAULT_VALUE_FORMULA]: BuiltinTypes.STRING,
      },
    }),
    DateTime: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.DATETIME),
      primitive: PrimitiveTypes.STRING,
      annotationRefsOrTypes: {
        ...Types.commonAnnotationTypes,
        [DEFAULT_VALUE_FORMULA]: BuiltinTypes.STRING,
      },
    }),
    Currency: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.CURRENCY),
      primitive: PrimitiveTypes.NUMBER,
      annotationRefsOrTypes: {
        ...Types.commonAnnotationTypes,
        [FIELD_ANNOTATIONS.SCALE]: BuiltinTypes.NUMBER,
        [FIELD_ANNOTATIONS.PRECISION]: BuiltinTypes.NUMBER,
        [DEFAULT_VALUE_FORMULA]: BuiltinTypes.STRING,
      },
    }),
    Picklist: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.PICKLIST),
      primitive: PrimitiveTypes.STRING,
      annotationRefsOrTypes: {
        ...Types.commonAnnotationTypes,
        [FIELD_ANNOTATIONS.FIELD_DEPENDENCY]: Types.fieldDependencyType,
        [FIELD_ANNOTATIONS.VALUE_SET]: new ListType(Types.valueSetType),
        [FIELD_ANNOTATIONS.RESTRICTED]: BuiltinTypes.BOOLEAN,
        [VALUE_SET_FIELDS.VALUE_SET_NAME]: BuiltinTypes.STRING,
        [VALUE_SET_DEFINITION_FIELDS.SORTED]: BuiltinTypes.BOOLEAN,
        [DEFAULT_VALUE_FORMULA]: BuiltinTypes.STRING,
      },
    }),
    MultiselectPicklist: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.MULTIPICKLIST),
      primitive: PrimitiveTypes.STRING,
      annotationRefsOrTypes: {
        ...Types.commonAnnotationTypes,
        [FIELD_ANNOTATIONS.VISIBLE_LINES]: restrictedNumberTypes.MultiPicklistVisibleLines,
        [FIELD_ANNOTATIONS.FIELD_DEPENDENCY]: Types.fieldDependencyType,
        [FIELD_ANNOTATIONS.VALUE_SET]: new ListType(Types.valueSetType),
        [FIELD_ANNOTATIONS.RESTRICTED]: BuiltinTypes.BOOLEAN,
        [VALUE_SET_FIELDS.VALUE_SET_NAME]: BuiltinTypes.STRING,
        [VALUE_SET_DEFINITION_FIELDS.SORTED]: BuiltinTypes.BOOLEAN,
        [DEFAULT_VALUE_FORMULA]: BuiltinTypes.STRING,
      },
    }),
    Email: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.EMAIL),
      primitive: PrimitiveTypes.STRING,
      annotationRefsOrTypes: {
        ...Types.commonAnnotationTypes,
        [FIELD_ANNOTATIONS.UNIQUE]: BuiltinTypes.BOOLEAN,
        [DEFAULT_VALUE_FORMULA]: BuiltinTypes.STRING,
      },
    }),
    Percent: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.PERCENT),
      primitive: PrimitiveTypes.NUMBER,
      annotationRefsOrTypes: {
        ...Types.commonAnnotationTypes,
        [FIELD_ANNOTATIONS.SCALE]: BuiltinTypes.NUMBER,
        [FIELD_ANNOTATIONS.PRECISION]: BuiltinTypes.NUMBER,
        [DEFAULT_VALUE_FORMULA]: BuiltinTypes.STRING,
      },
    }),
    Phone: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.PHONE),
      primitive: PrimitiveTypes.STRING,
      annotationRefsOrTypes: {
        ...Types.commonAnnotationTypes,
        [DEFAULT_VALUE_FORMULA]: BuiltinTypes.STRING,
      },
    }),
    LongTextArea: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.LONGTEXTAREA),
      primitive: PrimitiveTypes.STRING,
      annotationRefsOrTypes: {
        ...Types.commonAnnotationTypes,
        [FIELD_ANNOTATIONS.VISIBLE_LINES]: restrictedNumberTypes.LongTextAreaVisibleLines,
        [FIELD_ANNOTATIONS.LENGTH]: restrictedNumberTypes.TextAreaLength,
        [DEFAULT_VALUE_FORMULA]: BuiltinTypes.STRING,
      },
    }),
    Html: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.RICHTEXTAREA),
      primitive: PrimitiveTypes.STRING,
      annotationRefsOrTypes: {
        ...Types.commonAnnotationTypes,
        [FIELD_ANNOTATIONS.VISIBLE_LINES]: restrictedNumberTypes.RichTextAreaVisibleLines,
        [FIELD_ANNOTATIONS.LENGTH]: restrictedNumberTypes.TextAreaLength,
      },
    }),
    TextArea: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.TEXTAREA),
      primitive: PrimitiveTypes.STRING,
      annotationRefsOrTypes: {
        ...Types.commonAnnotationTypes,
        [DEFAULT_VALUE_FORMULA]: BuiltinTypes.STRING,
      },
    }),
    EncryptedText: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.ENCRYPTEDTEXT),
      primitive: PrimitiveTypes.STRING,
      annotationRefsOrTypes: {
        ...Types.commonAnnotationTypes,
        [FIELD_ANNOTATIONS.MASK_CHAR]: Types.encryptedTextMaskCharType,
        [FIELD_ANNOTATIONS.MASK_TYPE]: Types.encryptedTextMaskTypeType,
        [FIELD_ANNOTATIONS.LENGTH]: restrictedNumberTypes.EncryptedTextLength,
      },
    }),
    Url: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.URL),
      primitive: PrimitiveTypes.STRING,
      annotationRefsOrTypes: {
        ...Types.commonAnnotationTypes,
        [DEFAULT_VALUE_FORMULA]: BuiltinTypes.STRING,
      },
    }),
    Lookup: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.LOOKUP),
      primitive: PrimitiveTypes.STRING,
      annotationRefsOrTypes: {
        ...Types.commonAnnotationTypes,
        ...Types.lookupAnnotationTypes,
      },
    }),
    MasterDetail: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.MASTER_DETAIL),
      primitive: PrimitiveTypes.STRING,
      annotationRefsOrTypes: {
        ...Types.commonAnnotationTypes,
        [FIELD_ANNOTATIONS.REPARENTABLE_MASTER_DETAIL]: BuiltinTypes.BOOLEAN,
        [FIELD_ANNOTATIONS.WRITE_REQUIRES_MASTER_READ]: BuiltinTypes.BOOLEAN,
        [FIELD_ANNOTATIONS.LOOKUP_FILTER]: Types.lookupFilterType,
        [FIELD_ANNOTATIONS.REFERENCE_TO]: new ListType(BuiltinTypes.STRING),
        [FIELD_ANNOTATIONS.RELATIONSHIP_ORDER]: restrictedNumberTypes.RelationshipOrder,
        [FIELD_ANNOTATIONS.RELATIONSHIP_NAME]: BuiltinTypes.STRING,
        [FIELD_ANNOTATIONS.RELATIONSHIP_LABEL]: BuiltinTypes.STRING,
      },
    }),
    Summary: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.ROLLUP_SUMMARY),
      primitive: PrimitiveTypes.STRING,
      annotationRefsOrTypes: {
        ...Types.commonAnnotationTypes,
        // todo: currently SUMMARIZED_FIELD && SUMMARY_FOREIGN_KEY are populated with the referenced
        //  field's API name should be modified to elemID reference once we'll use HIL
        [FIELD_ANNOTATIONS.SUMMARIZED_FIELD]: BuiltinTypes.STRING,
        [FIELD_ANNOTATIONS.SUMMARY_FILTER_ITEMS]: new ListType(Types.rollupSummaryFilterItemsType),
        [FIELD_ANNOTATIONS.SUMMARY_FOREIGN_KEY]: BuiltinTypes.STRING,
        [FIELD_ANNOTATIONS.SUMMARY_OPERATION]: Types.rollupSummaryOperationType,
      },
    }),
    Hierarchy: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.HIERARCHY),
      primitive: PrimitiveTypes.STRING,
      annotationRefsOrTypes: {
        ...Types.commonAnnotationTypes,
        ...Types.lookupAnnotationTypes,
      },
    }),
    MetadataRelationship: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.METADATA_RELATIONSHIP),
      primitive: PrimitiveTypes.STRING,
      annotationRefsOrTypes: {
        ...Types.commonAnnotationTypes,
        ...Types.lookupAnnotationTypes,
      },
    }),
    ExternalLookup: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.EXTERNAL_LOOKUP),
      primitive: PrimitiveTypes.STRING,
      annotationRefsOrTypes: {
        ...Types.commonAnnotationTypes,
        ...Types.lookupAnnotationTypes,
      },
    }),
    IndirectLookup: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.INDIRECT_LOOKUP),
      primitive: PrimitiveTypes.STRING,
      annotationRefsOrTypes: {
        ...Types.commonAnnotationTypes,
        ...Types.lookupAnnotationTypes,
      },
    }),
    File: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.FILE),
      primitive: PrimitiveTypes.STRING,
      annotationRefsOrTypes: {
        ...Types.commonAnnotationTypes,
      },
    }),
    Unknown: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, INTERNAL_FIELD_TYPE_NAMES.UNKNOWN),
      primitive: PrimitiveTypes.STRING,
      annotationRefsOrTypes: {
        ...Types.commonAnnotationTypes,
      },
    }),
    AnyType: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, INTERNAL_FIELD_TYPE_NAMES.ANY),
      primitive: PrimitiveTypes.UNKNOWN,
      annotationRefsOrTypes: {
        ...Types.commonAnnotationTypes,
      },
    }),
  }

  private static getFormulaDataType = (baseTypeName: FIELD_TYPE_NAMES): Record<string, PrimitiveType> => {
    const baseType = Types.primitiveDataTypes[baseTypeName]
    const typeName = formulaTypeName(baseTypeName)
    return {
      [typeName]: new PrimitiveType({
        elemID: new ElemID(SALESFORCE, typeName),
        primitive: baseType.primitive,
        annotationRefsOrTypes: {
          ...baseType.annotationRefTypes,
          [FORMULA]: BuiltinTypes.STRING,
          [FIELD_ANNOTATIONS.FORMULA_TREAT_BLANKS_AS]: Types.TreatBlankAsType,
        },
      }),
    }
  }

  public static formulaDataTypes: Record<string, PrimitiveType> = _.merge(
    Types.getFormulaDataType(FIELD_TYPE_NAMES.CHECKBOX),
    Types.getFormulaDataType(FIELD_TYPE_NAMES.CURRENCY),
    Types.getFormulaDataType(FIELD_TYPE_NAMES.DATE),
    Types.getFormulaDataType(FIELD_TYPE_NAMES.DATETIME),
    Types.getFormulaDataType(FIELD_TYPE_NAMES.NUMBER),
    Types.getFormulaDataType(FIELD_TYPE_NAMES.PERCENT),
    Types.getFormulaDataType(FIELD_TYPE_NAMES.TEXT),
    Types.getFormulaDataType(FIELD_TYPE_NAMES.TIME),
  )

  private static nameInnerFields = {
    [NAME_FIELDS.FIRST_NAME]: {
      refType: BuiltinTypes.STRING,
    },
    [NAME_FIELDS.LAST_NAME]: {
      refType: BuiltinTypes.STRING,
    },
    [NAME_FIELDS.SALUTATION]: {
      refType: Types.primitiveDataTypes.Picklist,
    },
    [NAME_FIELDS.MIDDLE_NAME]: {
      refType: BuiltinTypes.STRING,
    },
    [NAME_FIELDS.SUFFIX]: {
      refType: BuiltinTypes.STRING,
    },
  }

  // Type mapping for compound fields
  public static compoundDataTypes: Record<COMPOUND_FIELD_TYPE_NAMES, ObjectType> = {
    Address: new ObjectType({
      elemID: addressElemID,
      fields: {
        [ADDRESS_FIELDS.CITY]: {
          refType: BuiltinTypes.STRING,
        },
        [ADDRESS_FIELDS.COUNTRY]: {
          refType: BuiltinTypes.STRING,
        },
        [ADDRESS_FIELDS.GEOCODE_ACCURACY]: {
          refType: Types.primitiveDataTypes.Picklist,
        },
        [ADDRESS_FIELDS.LATITUDE]: {
          refType: BuiltinTypes.NUMBER,
        },
        [ADDRESS_FIELDS.LONGITUDE]: {
          refType: BuiltinTypes.NUMBER,
        },
        [ADDRESS_FIELDS.POSTAL_CODE]: {
          refType: BuiltinTypes.STRING,
        },
        [ADDRESS_FIELDS.STATE]: {
          refType: BuiltinTypes.STRING,
        },
        [ADDRESS_FIELDS.STREET]: {
          refType: Types.primitiveDataTypes.TextArea,
        },
      },
      annotationRefsOrTypes: {
        ...Types.commonAnnotationTypes,
      },
    }),
    Name: new ObjectType({
      elemID: nameElemID,
      fields: Types.nameInnerFields,
      annotationRefsOrTypes: {
        ...Types.commonAnnotationTypes,
      },
    }),
    Name2: new ObjectType({
      // replaces the regular Name for types that don't have Salutation attribute (e.g User)
      elemID: nameNoSalutationElemID,
      fields: _.omit(Types.nameInnerFields, [NAME_FIELDS.SALUTATION]),
      annotationRefsOrTypes: {
        ...Types.commonAnnotationTypes,
      },
    }),
    Location: new ObjectType({
      elemID: geoLocationElemID,
      fields: {
        [GEOLOCATION_FIELDS.LATITUDE]: {
          refType: BuiltinTypes.NUMBER,
        },
        [GEOLOCATION_FIELDS.LONGITUDE]: {
          refType: BuiltinTypes.NUMBER,
        },
      },
      annotationRefsOrTypes: {
        [FIELD_ANNOTATIONS.DISPLAY_LOCATION_IN_DECIMAL]: BuiltinTypes.BOOLEAN,
        [FIELD_ANNOTATIONS.SCALE]: BuiltinTypes.NUMBER,
        ...Types.commonAnnotationTypes,
      },
    }),
  }

  // Type mapping for metadata types
  private static metadataPrimitiveTypes: TypeMap = {
    string: BuiltinTypes.STRING,
    double: BuiltinTypes.NUMBER,
    int: BuiltinTypes.NUMBER,
    integer: BuiltinTypes.NUMBER,
    boolean: BuiltinTypes.BOOLEAN,
    unknown: BuiltinTypes.UNKNOWN, // only relevant for missing fields
  }

  static setElemIdGetter(getElemIdFunc: ElemIdGetter): void {
    this.getElemIdFunc = getElemIdFunc
  }

  static getKnownType(name: string, customObject = true): TypeElement {
    return customObject
      ? this.primitiveDataTypes[name as FIELD_TYPE_NAMES] ||
          this.compoundDataTypes[name as COMPOUND_FIELD_TYPE_NAMES] ||
          this.formulaDataTypes[name as FIELD_TYPE_NAMES]
      : this.metadataPrimitiveTypes[name.toLowerCase()]
  }

  static get({
    name,
    customObject = true,
    isSettings = false,
    serviceIds,
    metaType,
  }: {
    name: string
    customObject?: boolean
    isSettings?: boolean
    serviceIds?: ServiceIds
    metaType?: ObjectType
  }): TypeElement {
    const type = Types.getKnownType(name, customObject)
    if (type === undefined) {
      return this.createObjectType(name, customObject, isSettings, serviceIds, metaType)
    }
    return type
  }

  static createObjectType(
    name: string,
    customObject = true,
    isSettings = false,
    serviceIds?: ServiceIds,
    metaType?: ObjectType,
  ): ObjectType {
    // TODO (SALTO-6264): Revert this once hide types is enabled.
    // THe meta type not being undefined means that the meta types feature is enabled
    // and this is not the meta type definition.
    const elemID =
      name === CUSTOM_METADATA && metaType !== undefined
        ? new ElemID(SALESFORCE, CUSTOM_METADATA_TYPE_NAME)
        : this.getElemId(name, customObject, serviceIds)
    return new ObjectType({
      elemID,
      isSettings,
      metaType,
    })
  }

  public static getElemId(name: string, customObject: boolean, serviceIds?: ServiceIds): ElemID {
    const updatedName = customObject ? name : METADATA_TYPES_TO_RENAME.get(name) ?? name
    return customObject && this.getElemIdFunc && serviceIds
      ? this.getElemIdFunc(SALESFORCE, serviceIds, naclCase(updatedName))
      : new ElemID(SALESFORCE, naclCase(updatedName))
  }

  static getAllFieldTypes(): TypeElement[] {
    return Object.values<TypeElement>(Types.primitiveDataTypes)
      .concat(Object.values(Types.compoundDataTypes))
      .concat(Object.values(Types.formulaDataTypes))
      .filter(type => type.elemID.adapter === SALESFORCE)
      .map(type => {
        const fieldType = type.clone()
        fieldType.path = [SALESFORCE, TYPES_PATH, 'fieldTypes']
        return fieldType
      })
  }

  static getAllMissingTypes(): ObjectType[] {
    return allMissingSubTypes
  }

  static getAnnotationTypes(): TypeElement[] {
    return [
      Types.fieldDependencyType,
      Types.rollupSummaryOperationType,
      Types.rollupSummaryFilterItemsType,
      Types.rollupSummaryFilterItemOperationType,
      Types.valueSettingsType,
      Types.lookupFilterType,
      Types.filterItemType,
      Types.encryptedTextMaskCharType,
      Types.encryptedTextMaskTypeType,
      Types.BusinessStatusType,
      Types.SecurityClassificationType,
      Types.valueSetType,
      Types.TreatBlankAsType,
      ...Object.values(restrictedNumberTypes),
    ].map(type => {
      const fieldType = type.clone()
      fieldType.path = fieldType.elemID.isEqual(Types.filterItemElemID)
        ? [SALESFORCE, TYPES_PATH, Types.filterItemElemID.name]
        : [SALESFORCE, TYPES_PATH, 'annotationTypes']
      return fieldType
    })
  }
}

export const isFormulaField = (element: Element): element is Field => {
  if (!isField(element)) {
    return false
  }
  const formulaTypes = Object.values(Types.formulaDataTypes)
  return formulaTypes.some(type => element.refType.elemID.isEqual(type.elemID))
}

export const isNameField = async (field: Field): Promise<boolean> =>
  isObjectType(await field.getType()) &&
  (field.refType.elemID.isEqual(Types.compoundDataTypes.Name.elemID) ||
    field.refType.elemID.isEqual(Types.compoundDataTypes.Name2.elemID))

const transformCompoundValues = async (
  record: SalesforceRecord,
  instance: InstanceElement,
): Promise<SalesforceRecord> => {
  const compoundFieldsElemIDs = Object.values(Types.compoundDataTypes).map(o => o.elemID)
  const relevantCompoundFields = _.pickBy(
    (await instance.getType()).fields,
    (field, fieldKey) =>
      Object.keys(record).includes(fieldKey) &&
      !_.isUndefined(_.find(compoundFieldsElemIDs, e => field.refType.elemID.isEqual(e))),
  )
  if (_.isEmpty(relevantCompoundFields)) {
    return record
  }
  const transformedCompoundValues = await mapValuesAsync(
    relevantCompoundFields,
    async (compoundField, compoundFieldKey) => {
      // Name fields are without a prefix
      if (await isNameField(compoundField)) {
        return record[compoundFieldKey]
      }
      // Other compound fields are added a prefix according to the field name
      // ie. LocalAddress -> LocalCity, LocalState etc.
      const typeName = compoundField.refType.elemID.isEqual(Types.compoundDataTypes.Address.elemID)
        ? COMPOUND_FIELD_TYPE_NAMES.ADDRESS
        : COMPOUND_FIELD_TYPE_NAMES.LOCATION
      const fieldPrefix = compoundFieldKey.slice(0, -typeName.length)
      return _.mapKeys(record[compoundFieldKey], (_vv, key) => fieldPrefix.concat(key))
    },
  )
  return Object.assign(_.omit(record, Object.keys(relevantCompoundFields)), ...Object.values(transformedCompoundValues))
}

export const toRecord = async (
  instance: InstanceElement,
  fieldAnnotationToFilterBy: string,
  withNulls: boolean,
): Promise<SalesforceRecord> => {
  const instanceType = await instance.getType()
  const values = {
    ...(withNulls ? _.mapValues(instanceType.fields, () => null) : {}),
    ..._.mapValues(instance.value, val => {
      // Lookups to the same types will have an Id value only after the referenced Record was deployed
      if (isInstanceElement(val)) {
        const referencedRecordId = val.value[CUSTOM_OBJECT_ID_FIELD]
        if (referencedRecordId === undefined) {
          return null
        }
        return referencedRecordId
      }
      // Can happen when we failed to resolve a reference to Metadata Element.
      if (isElement(val)) {
        log.warn(
          'Unexpected non deployable value of Element with elemID %s in toRecord on Instance with elemID %s. Omitting value',
          val.elemID.getFullName(),
          instance.elemID.getFullName(),
        )
        return undefined
      }
      return val
    }),
  }
  const filteredRecordValues = {
    [CUSTOM_OBJECT_ID_FIELD]: instance.value[CUSTOM_OBJECT_ID_FIELD],
    ..._.pickBy(values, (v, k) => v !== undefined && instanceType.fields[k]?.annotations[fieldAnnotationToFilterBy]),
  }
  return transformCompoundValues(filteredRecordValues, instance)
}

export const instancesToUpdateRecords = async (
  instances: InstanceElement[],
  withNulls: boolean,
): Promise<SalesforceRecord[]> =>
  Promise.all(instances.map(instance => toRecord(instance, FIELD_ANNOTATIONS.UPDATEABLE, withNulls)))

export const instancesToCreateRecords = (instances: InstanceElement[]): Promise<SalesforceRecord[]> =>
  Promise.all(instances.map(instance => toRecord(instance, FIELD_ANNOTATIONS.CREATABLE, false)))

export const instancesToDeleteRecords = (instances: InstanceElement[]): SalesforceRecord[] =>
  instances.map(instance => ({ Id: instance.value[CUSTOM_OBJECT_ID_FIELD] }))

export const isLocalOnly = (field?: Field): boolean =>
  field !== undefined && field.annotations[FIELD_ANNOTATIONS.LOCAL_ONLY] === true

export const getValueTypeFieldElement = (
  parent: ObjectType,
  field: ValueTypeField,
  knownTypes: Map<string, TypeElement>,
  additionalAnnotations?: Values,
): Field => {
  const naclFieldType =
    field.name === INSTANCE_FULL_NAME_FIELD
      ? BuiltinTypes.SERVICE_ID
      : knownTypes.get(field.soapType) || Types.get({ name: field.soapType, customObject: false })
  const annotations: Values = {
    ...(additionalAnnotations || {}),
  }

  if (field.picklistValues && field.picklistValues.length > 0) {
    // picklist values in metadata types are used to restrict a field to a list of allowed values
    // because some fields can allow all fields names / all object names this restriction list
    // might be very large and cause memory problems on parsing, so we choose to omit the
    // restriction where there are too many possible values
    if (field.picklistValues.length < MAX_METADATA_RESTRICTION_VALUES) {
      annotations[CORE_ANNOTATIONS.RESTRICTION] = createRestriction({
        enforce_value: false,
        values: _.sortedUniq(field.picklistValues.map(val => val.value).sort()),
      })
    }
    const defaults = field.picklistValues.filter(val => val.defaultValue).map(val => val.value)
    if (defaults.length === 1) {
      annotations[CORE_ANNOTATIONS.DEFAULT] = defaults.pop()
    }
  }

  if (field.isForeignKey) {
    annotations[FOREIGN_KEY_DOMAIN] = makeArray(field.foreignKeyDomain)
  }

  return new Field(parent, field.name, naclFieldType, annotations)
}

const convertXsdTypeFuncMap: Record<XsdType, ConvertXsdTypeFunc> = {
  'xsd:string': String,
  'xsd:boolean': v => v === 'true',
  'xsd:double': Number,
  'xsd:int': Number,
  'xsd:long': Number,
  'xsd:date': String,
  'xsd:dateTime': String,
  'xsd:picklist': String,
}

const isXsdType = (xsdType: string): xsdType is XsdType => (xsdTypes as ReadonlyArray<string>).includes(xsdType)

const getXsdConvertFunc = (xsdType: string): ConvertXsdTypeFunc =>
  isXsdType(xsdType) ? convertXsdTypeFuncMap[xsdType] : v => v

// Salesforce returns nulls in metadata API as objects like { $: { 'xsi:nil': 'true' } }
// and in retrieve API like <activateRSS xsi:nil="true"/>
// which is transformed to { `${XML_ATTRIBUTE_PREFIX}xsi:nil`): 'true' }
export const isNull = (value: Value): boolean =>
  _.isNull(value) ||
  (_.isObject(value) &&
    (_.get(value, ['$', 'xsi:nil']) === 'true' || _.get(value, `${XML_ATTRIBUTE_PREFIX}xsi:nil`) === 'true'))

export const transformPrimitive: TransformFuncSync = ({ value, path, field }) => {
  if (isNull(value)) {
    // We transform null to undefined as currently we don't support null in Salto language
    // and the undefined values are omitted later in the code
    return undefined
  }

  // (Salto-394) Salesforce returns objects like:
  // { "_": "fieldValue", "$": { "xsi:type": "xsd:string" } }
  if (_.isObject(value) && Object.keys(value).includes('_')) {
    const convertFunc = getXsdConvertFunc(_.get(value, ['$', 'xsi:type']))
    return transformPrimitive({
      value: convertFunc(_.get(value, '_')),
      path,
      field,
    })
  }
  const fieldType = field?.getTypeSync()

  if (isContainerType(fieldType) && _.isEmpty(value)) {
    return undefined
  }
  if (isObjectType(fieldType) && value === '') {
    // Salesforce returns empty objects in XML as <quickAction></quickAction> for example
    // We treat them as "" (empty string), and we don't want to delete them
    // We should replace them with {} (empty object)
    return {}
  }
  if (!isPrimitiveType(fieldType) || !isPrimitiveValue(value)) {
    return value
  }
  if (value === null || value === undefined) {
    return undefined
  }
  switch (fieldType.primitive) {
    case PrimitiveTypes.NUMBER:
      return Number(value)
    case PrimitiveTypes.BOOLEAN:
      return value.toString().toLowerCase() === 'true'
    case PrimitiveTypes.STRING:
      return value.toString()
    default:
      return value
  }
}

const isDefaultWithType = (val: PrimitiveValue | DefaultValueWithType): val is DefaultValueWithType =>
  new Set(_.keys(val)).has('_')

const valueFromXsdType = (val: DefaultValueWithType): PrimitiveValue => {
  const convertFunc = getXsdConvertFunc(val.$['xsi:type'])
  return convertFunc(val._)
}

const getDefaultValue = (field: SalesforceField): PrimitiveValue | undefined => {
  if (field.defaultValue === null || field.defaultValue === undefined) {
    return undefined
  }

  return isDefaultWithType(field.defaultValue) ? valueFromXsdType(field.defaultValue) : field.defaultValue
}

export const isSubfieldOfCompound = (field: SalesforceField): boolean =>
  field.compoundFieldName !== undefined && field.compoundFieldName !== field.name

const EXTRA_INFORMATION_FIELD_ANNOTATIONS = [FIELD_ANNOTATIONS.DEFAULTED_ON_CREATE]

// The following method is used during the fetch process and is used in building the objects
// and their fields described in the Nacl file
export const getSObjectFieldElement = (
  parent: ObjectType,
  field: SalesforceField,
  parentServiceIds: ServiceIds,
  objCompoundFieldNames: Record<string, string> = {},
  fetchProfile: FetchProfile,
  systemFields: string[] = [],
): Field => {
  const fieldApiName = [parentServiceIds[API_NAME], field.name].join(API_NAME_SEPARATOR)
  const serviceIds = {
    [API_NAME]: fieldApiName,
    [OBJECT_SERVICE_ID]: toServiceIdsString(parentServiceIds),
  }

  const getFieldType = (typeName: string): TypeElement => Types.get({ name: typeName, serviceIds })
  let naclFieldType = getFieldType(FIELD_SOAP_TYPE_NAMES[field.type])
  const annotations: Values = {
    [API_NAME]: fieldApiName,
    [LABEL]: field.label,
  }
  if (fetchProfile.isFeatureEnabled('extendedCustomFieldInformation')) {
    EXTRA_INFORMATION_FIELD_ANNOTATIONS.forEach(annotation => {
      annotations[annotation] = field[annotation]
    })
  }

  if (field.type !== 'boolean' && field.nillable === false) {
    // nillable is the closest thing we could find to infer if a field is required,
    // it might not be perfect
    // boolean (i.e. Checkbox) must not have required field
    annotations[CORE_ANNOTATIONS.REQUIRED] = true
  }

  if (field.defaultValueFormula) {
    annotations[DEFAULT_VALUE_FORMULA] = field.defaultValueFormula
  }

  const defaultValue = getDefaultValue(field)
  if (defaultValue !== undefined && _.isEmpty(field.picklistValues)) {
    annotations[FIELD_ANNOTATIONS.DEFAULT_VALUE] = defaultValue
  }

  // Handle specific field types that need to be converted from their primitive type to their
  // Salesforce field type
  if (field.autoNumber) {
    // autonumber (needs to be first because its type in the field
    // returned from the API is string)
    naclFieldType = getFieldType(FIELD_TYPE_NAMES.AUTONUMBER)
  } else if (field.idLookup && field.type === 'id') {
    naclFieldType = BuiltinTypes.SERVICE_ID
  } else if (field.type === 'string' && !isSubfieldOfCompound(field)) {
    // string
    naclFieldType = getFieldType(FIELD_TYPE_NAMES.TEXT)
  } else if (field.type === 'double' && !isSubfieldOfCompound(field)) {
    naclFieldType = getFieldType(FIELD_TYPE_NAMES.NUMBER)
    annotations[FIELD_ANNOTATIONS.PRECISION] = field.precision
    annotations[FIELD_ANNOTATIONS.SCALE] = field.scale
  } else if (field.type === 'int') {
    naclFieldType = getFieldType(FIELD_TYPE_NAMES.NUMBER)
    annotations[FIELD_ANNOTATIONS.PRECISION] = field.digits
  } else if (field.type === 'textarea' && field.length > 255) {
    // long text area & rich text area
    if (field.extraTypeInfo === 'plaintextarea') {
      naclFieldType = getFieldType(FIELD_TYPE_NAMES.LONGTEXTAREA)
    } else if (field.extraTypeInfo === 'richtextarea') {
      naclFieldType = getFieldType(FIELD_TYPE_NAMES.RICHTEXTAREA)
    }
  } else if (field.type === 'encryptedstring') {
    // encrypted string
    naclFieldType = getFieldType(FIELD_TYPE_NAMES.ENCRYPTEDTEXT)
  }
  // Picklists
  if (field.picklistValues && field.picklistValues.length > 0) {
    addPicklistAnnotations(field.picklistValues, Boolean(field.restrictedPicklist), annotations)
    if (field.type === 'multipicklist') {
      // Precision is the field for multi-picklist in SFDC API that defines how many objects will
      // be visible in the picklist in the UI. Why? Because.
      annotations[FIELD_ANNOTATIONS.VISIBLE_LINES] = field.precision
    }
  } else if (field.calculated) {
    if (!_.isEmpty(field.calculatedFormula)) {
      // Formulas
      naclFieldType = getFieldType(formulaTypeName(naclFieldType.elemID.name as FIELD_TYPE_NAMES))
      annotations[FORMULA] = field.calculatedFormula
    } else {
      // Rollup Summary
      naclFieldType = getFieldType(FIELD_TYPE_NAMES.ROLLUP_SUMMARY)
    }
    // Lookup & MasterDetail
  } else if (field.type === 'reference') {
    if (field.cascadeDelete) {
      naclFieldType = getFieldType(FIELD_TYPE_NAMES.MASTER_DETAIL)
      // master detail fields are always not required in SF although returned as nillable=false
      delete annotations[CORE_ANNOTATIONS.REQUIRED]
      annotations[FIELD_ANNOTATIONS.WRITE_REQUIRES_MASTER_READ] = Boolean(field.writeRequiresMasterRead)
      annotations[FIELD_ANNOTATIONS.REPARENTABLE_MASTER_DETAIL] = Boolean(field.updateable)
    } else {
      naclFieldType = getFieldType(FIELD_TYPE_NAMES.LOOKUP)
    }
    if (!_.isEmpty(field.referenceTo)) {
      // todo: currently this field is populated with the referenced object's API name,
      //  should be modified to elemID reference once we'll use HIL
      // there are some SF reference fields without related fields
      // e.g. salesforce.user_app_menu_item.ApplicationId, salesforce.login_event.LoginHistoryId
      annotations[FIELD_ANNOTATIONS.REFERENCE_TO] = field.referenceTo
    }
    // Compound Fields
  } else if (!_.isUndefined(COMPOUND_FIELDS_SOAP_TYPE_NAMES[field.type]) || field.nameField) {
    // Only fields that are compound in this object get compound type
    if (objCompoundFieldNames[field.name] !== undefined) {
      naclFieldType = field.nameField
        ? // objCompoundFieldNames[field.name] is either 'Name' or 'Name2'
          Types.compoundDataTypes[objCompoundFieldNames[field.name] as COMPOUND_FIELD_TYPE_NAMES]
        : Types.compoundDataTypes[COMPOUND_FIELDS_SOAP_TYPE_NAMES[field.type]]
    }
  }

  if (!_.isEmpty(naclFieldType.annotationRefTypes)) {
    // Get the rest of the annotations if their name matches exactly the API response
    // and they are not already assigned
    _.assign(
      annotations,
      _.pick(_.omit(field, Object.keys(annotations)), Object.keys(naclFieldType.annotationRefTypes)),
    )
  }
  // mark all fields from the SOAP API as queryable (internal annotation)
  annotations[FIELD_ANNOTATIONS.QUERYABLE] = true

  // System fields besides name should be hidden and not be creatable, updateable nor required
  // Because they differ between envs and should not be edited through salto
  // Name is an exception because it can be editable and visible to the user
  if (!field.nameField && systemFields.includes(field.name)) {
    annotations[CORE_ANNOTATIONS.HIDDEN_VALUE] = true
    delete annotations[CORE_ANNOTATIONS.REQUIRED]
  }

  // An autoNumber field should be hidden because it will differ between environments
  // and not required to be able to add without it (ie. when moving envs)
  if (field.autoNumber) {
    annotations[CORE_ANNOTATIONS.HIDDEN_VALUE] = true
    delete annotations[CORE_ANNOTATIONS.REQUIRED]
  }

  const fieldName = Types.getElemId(naclCase(field.name), true, serviceIds).name
  return new Field(parent, fieldName, naclFieldType, annotations)
}

export const toDeployableInstance = async (element: InstanceElement): Promise<InstanceElement> => {
  const removeNonDeployableValues: TransformFunc = ({ value, field }) => {
    if (isLocalOnly(field)) {
      return undefined
    }
    // When we have a reference that resolves to undefined, we return the Element as a PlaceHolder.
    // This value is not deployable and should not be parsed to XML.
    if (isElement(value)) {
      log.warn(
        'The value of the field %s is Element with Id %s in toDeployableInstance',
        field?.elemID.getFullName(),
        value.elemID.getFullName(),
      )
      return undefined
    }
    return value
  }
  // Annotations are not deployed.
  return new InstanceElement(
    element.elemID.name,
    element.refType,
    await transformValues({
      values: element.value,
      type: await element.getType(),
      transformFunc: removeNonDeployableValues,
      strict: false,
      pathID: element.elemID,
      allowEmptyArrays: true,
      allowExistingEmptyObjects: true,
    }),
  )
}

export const toMetadataInfo = async (instance: InstanceElement): Promise<MetadataInfo> => ({
  fullName: await apiName(instance),
  ...(await toDeployableInstance(instance)).value,
})

export const createInstanceServiceIds = (serviceIdsValues: Values, type: ObjectType): ServiceIds => {
  const typeServiceIds = (): ServiceIds => {
    const serviceIds: ServiceIds = {
      [METADATA_TYPE]: type.annotations[METADATA_TYPE],
    }
    if (type.annotations[API_NAME]) {
      serviceIds[API_NAME] = type.annotations[API_NAME]
    }
    return serviceIds
  }

  return {
    ...serviceIdsValues,
    [OBJECT_SERVICE_ID]: toServiceIdsString(typeServiceIds()),
  }
}

export type MetadataTypeAnnotations = {
  [METADATA_TYPE]: string
  hasMetaFile?: boolean
  folderType?: string
  folderContentType?: string
  suffix?: string
  dirName?: string
}

export const metadataAnnotationTypes: Record<keyof MetadataTypeAnnotations, TypeReference> = {
  [METADATA_TYPE]: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
  hasMetaFile: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
  folderType: createRefToElmWithValue(BuiltinTypes.STRING),
  folderContentType: createRefToElmWithValue(BuiltinTypes.STRING),
  suffix: createRefToElmWithValue(BuiltinTypes.STRING),
  dirName: createRefToElmWithValue(BuiltinTypes.STRING),
}

export const createMetaType = (
  name: string,
  annotationTypes: ConstructorParameters<typeof ObjectType>[0]['annotationRefsOrTypes'],
  alias: string,
): ObjectType =>
  new ObjectType({
    elemID: new ElemID(SALESFORCE, name),
    annotationRefsOrTypes: annotationTypes,
    annotations: {
      [CORE_ANNOTATIONS.HIDDEN]: true,
      [CORE_ANNOTATIONS.ALIAS]: alias,
    },
    path: [SALESFORCE, META_TYPES_PATH, name],
  })

export const MetadataMetaType = createMetaType(METADATA_META_TYPE, metadataAnnotationTypes, 'Metadata type')
export const StandardSettingsMetaType = createMetaType(
  STANDARD_SETTINGS_META_TYPE,
  metadataAnnotationTypes,
  'Standard Settings',
)

export type MetadataObjectType = ObjectType & {
  annotations: ObjectType['annotations'] & MetadataTypeAnnotations
}

export const isMetadataObjectType = (elem?: Element): elem is MetadataObjectType =>
  isObjectType(elem) && elem.annotations[METADATA_TYPE] !== undefined

type ObjectTypeCtorParam = ConstructorParameters<typeof ObjectType>[0]
type CreateMetadataObjectTypeParams = Omit<ObjectTypeCtorParam, 'elemID'> & {
  annotations: MetadataTypeAnnotations
}
export const createMetadataObjectType = (params: CreateMetadataObjectTypeParams): MetadataObjectType =>
  new ObjectType({
    elemID: Types.getElemId(params.annotations.metadataType, false),
    ...params,
    fields: {
      [INSTANCE_FULL_NAME_FIELD]: {
        refType: BuiltinTypes.SERVICE_ID,
      },
      ...params.fields,
    },
  }) as MetadataObjectType

export type MetadataValues = MetadataInfo & Values

export type MetadataInstanceElement = InstanceElement & {
  getType: () => MetadataObjectType
  // type: MetadataObjectType
  value: InstanceElement['value'] & MetadataValues
}

export const assertMetadataObjectType = (type: ObjectType): MetadataObjectType => {
  if (!isMetadataObjectType(type)) {
    throw new Error(`This type (${type.elemID.getFullName()}) must be MetadataObjectType`)
  }
  return type
}

export const isMetadataInstanceElement = async (elem?: Element): Promise<boolean> =>
  isInstanceElement(elem) &&
  isMetadataObjectType(await elem.getType()) &&
  elem.value[INSTANCE_FULL_NAME_FIELD] !== undefined

export const createInstanceElement = (
  values: MetadataValues,
  type: ObjectType,
  namespacePrefix?: string,
  annotations?: Values,
): MetadataInstanceElement => {
  const fullName = values[INSTANCE_FULL_NAME_FIELD]
  const getPackagePath = (): string[] => {
    if (namespacePrefix) {
      if (namespacePrefix === 'standard' || fullName === namespacePrefix) {
        // InstalledPackage records should be under records and not within their package
        // Some CustomApplications have 'standard' namespace although they are not part of a package
        return [SALESFORCE]
      }
      return [SALESFORCE, INSTALLED_PACKAGES_PATH, namespacePrefix]
    }
    return [SALESFORCE]
  }

  const typeName = pathNaclCase(type.elemID.name)
  const { name } = Types.getElemId(
    fullName,
    true,
    createInstanceServiceIds(_.pick(values, INSTANCE_FULL_NAME_FIELD), type),
  )
  return new InstanceElement(
    type.isSettings ? ElemID.CONFIG_NAME : name,
    type,
    values,
    [...getPackagePath(), RECORDS_PATH, type.isSettings ? SETTINGS_PATH : typeName, pathNaclCase(name)],
    annotations,
  ) as MetadataInstanceElement
}

export const getAuthorAnnotations = (fileProperties: FileProperties): Record<string, string> => {
  const annotations = {
    [CORE_ANNOTATIONS.CREATED_BY]: fileProperties?.createdByName,
    [CORE_ANNOTATIONS.CREATED_AT]: fileProperties?.createdDate,
    [CORE_ANNOTATIONS.CHANGED_AT]: fileProperties?.lastModifiedDate,
  }
  if (fileProperties?.lastModifiedDate !== SALESFORCE_DATE_PLACEHOLDER) {
    Object.assign(annotations, {
      [CORE_ANNOTATIONS.CHANGED_BY]: fileProperties?.lastModifiedByName,
    })
  }
  return annotations
}

const createIdField = (parent: ObjectType): void => {
  parent.fields[INTERNAL_ID_FIELD] = new Field(parent, INTERNAL_ID_FIELD, BuiltinTypes.STRING, {
    [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
    [FIELD_ANNOTATIONS.LOCAL_ONLY]: true,
  })
}

type CreateMetadataTypeParams = {
  name: string
  fields: ValueTypeField[]
  knownTypes?: Map<string, TypeElement>
  baseTypeNames: Set<string>
  childTypeNames: Set<string>
  client: SalesforceClient
  isSettings?: boolean
  annotations?: Partial<MetadataTypeAnnotations>
  missingFields?: Record<string, ValueTypeField[]>
  metaType?: ObjectType
}
export const createMetadataTypeElements = async ({
  name,
  fields,
  knownTypes = new Map(),
  baseTypeNames,
  childTypeNames,
  client,
  isSettings = false,
  annotations = {},
  missingFields = defaultMissingFields(),
  metaType,
}: CreateMetadataTypeParams): Promise<MetadataObjectType[]> => {
  if (knownTypes.has(name)) {
    // Already created this type, no new types to return here
    return []
  }

  const element = Types.get({
    name,
    customObject: false,
    isSettings,
    metaType,
  }) as MetadataObjectType
  knownTypes.set(name, element)
  const isTopLevelType = baseTypeNames.has(name) || annotations.folderContentType !== undefined
  if (metaType === undefined) {
    element.annotationRefTypes = _.clone(metadataAnnotationTypes)
  }
  element.annotate({
    ..._.pickBy(annotations, isDefined),
    [METADATA_TYPE]: name,
  })
  element.path = getTypePath(element.elemID.name, isTopLevelType)

  const shouldCreateIdField = (): boolean =>
    (isTopLevelType || childTypeNames.has(name)) && element.fields[INTERNAL_ID_FIELD] === undefined

  const allFields = fields.concat(missingFields[name] ?? [])
  if (_.isEmpty(allFields)) {
    if (shouldCreateIdField()) {
      createIdField(element)
    }
    return [element]
  }

  /* Due to a SF API bug, there are field types that returned with no nested fields why they should.
   * Only a specific call to describeMetadataType with the nested type returns the inner fields.
   * e.g. the nested fields of Report fields are not returned from describeMetadataType('Report')
   */
  const shouldEnrichFieldValue = (field: ValueTypeField): boolean => {
    const isKnownType = (): boolean =>
      knownTypes.has(field.soapType) ||
      baseTypeNames.has(field.soapType) ||
      isPrimitiveType(Types.get({ name: field.soapType, customObject: false }))

    const startsWithUppercase = (): boolean =>
      // covers types like base64Binary, anyType etc.
      field.soapType[0] === field.soapType[0].toUpperCase()

    return _.isEmpty(field.fields) && _.isEmpty(field.picklistValues) && !isKnownType() && startsWithUppercase()
  }

  // We need to create embedded types BEFORE creating this element's fields
  // in order to make sure all internal types we may need are updated in the
  // knownTypes map
  const enrichedFields = await Promise.all(
    allFields.map(async field => {
      if (shouldEnrichFieldValue(field)) {
        const innerFields = await client.describeMetadataType(field.soapType)
        return { ...field, fields: innerFields.valueTypeFields }
      }
      return field
    }),
  )

  const embeddedTypes = await Promise.all(
    enrichedFields
      .filter(field => !baseTypeNames.has(field.soapType))
      .filter(field => !_.isEmpty(field.fields.concat(missingFields[field.soapType] ?? [])))
      .flatMap(field =>
        createMetadataTypeElements({
          name: field.soapType,
          fields: makeArray(field.fields),
          knownTypes,
          baseTypeNames,
          childTypeNames,
          client,
          missingFields,
          metaType,
        }),
      ),
  )

  // Enum fields sometimes show up with a type name that is not primitive but also does not
  // have fields (so we won't create an embedded type for it). it seems like these "empty" types
  // are always supposed to be a string with some restriction so we map all non primitive "empty"
  // types to string.
  // Sometimes, we get known types without fields for some reason, in this case it is not an enum
  enrichedFields
    .filter(field => _.isEmpty(field.fields))
    .filter(field => !isPrimitiveType(Types.get({ name: field.soapType, customObject: false })))
    .filter(field => !knownTypes.has(field.soapType))
    .filter(field => field.soapType !== name)
    .forEach(field => knownTypes.set(field.soapType, BuiltinTypes.STRING))

  const fieldElements = enrichedFields.map(field => getValueTypeFieldElement(element, field, knownTypes))

  // Set fields on elements
  fieldElements.forEach(field => {
    element.fields[field.name] = field
  })

  if (shouldCreateIdField()) {
    createIdField(element)
  }
  return _.flatten([element, ...embeddedTypes])
}
