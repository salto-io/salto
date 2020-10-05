/*
*                      Copyright 2020 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
/* eslint-disable @typescript-eslint/camelcase */
import _ from 'lodash'
import {
  ValueTypeField, MetadataInfo, DefaultValueWithType, PicklistEntry, Field as SalesforceField,
} from 'jsforce'
import {
  TypeElement, ObjectType, ElemID, PrimitiveTypes, PrimitiveType, Values,
  BuiltinTypes, Element, isInstanceElement, InstanceElement, isPrimitiveType, ElemIdGetter,
  ServiceIds, toServiceIdsString, OBJECT_SERVICE_ID, ADAPTER, CORE_ANNOTATIONS,
  PrimitiveValue,
  Field, TypeMap, ListType, isField, createRestriction, isPrimitiveValue, Value, isObjectType,
} from '@salto-io/adapter-api'
import { collections, values as lowerDashValues } from '@salto-io/lowerdash'
import { naclCase, TransformFunc, transformElement } from '@salto-io/adapter-utils'
import { CustomObject, CustomField, SalesforceRecord, CustomProperties } from '../client/types'
import {
  API_NAME, CUSTOM_OBJECT, LABEL, SALESFORCE, FORMULA, FIELD_TYPE_NAMES, ALL_FIELD_TYPE_NAMES,
  METADATA_TYPE, FIELD_ANNOTATIONS, SALESFORCE_CUSTOM_SUFFIX, DEFAULT_VALUE_FORMULA,
  LOOKUP_FILTER_FIELDS, ADDRESS_FIELDS, NAME_FIELDS, GEOLOCATION_FIELDS, INSTANCE_FULL_NAME_FIELD,
  FIELD_DEPENDENCY_FIELDS, VALUE_SETTINGS_FIELDS, FILTER_ITEM_FIELDS, DESCRIPTION,
  HELP_TEXT, BUSINESS_STATUS, FORMULA_TYPE_NAME,
  SECURITY_CLASSIFICATION, BUSINESS_OWNER_GROUP, BUSINESS_OWNER_USER, COMPLIANCE_GROUP,
  CUSTOM_VALUE, API_NAME_SEPARATOR, MAX_METADATA_RESTRICTION_VALUES,
  VALUE_SET_FIELDS, COMPOUND_FIELD_TYPE_NAMES, ANNOTATION_TYPE_NAMES, FIELD_SOAP_TYPE_NAMES,
  RECORDS_PATH, SETTINGS_PATH, TYPES_PATH, SUBTYPES_PATH, INSTALLED_PACKAGES_PATH,
  VALUE_SET_DEFINITION_FIELDS, CUSTOM_FIELD,
  COMPOUND_FIELDS_SOAP_TYPE_NAMES, CUSTOM_OBJECT_ID_FIELD, FOREIGN_KEY_DOMAIN,
  XML_ATTRIBUTE_PREFIX, INTERNAL_ID_FIELD, INTERNAL_FIELD_TYPE_NAMES, CUSTOM_SETTINGS_TYPE,
} from '../constants'
import SalesforceClient from '../client/client'
import { allMissingSubTypes } from './salesforce_types'

const { makeArray } = collections.array
const { isDefined } = lowerDashValues

export const metadataType = (element: Element): string => {
  if (isInstanceElement(element)) {
    return metadataType(element.type)
  }
  if (isField(element)) {
    // We expect to reach to this place only with field of CustomObject
    return CUSTOM_FIELD
  }
  return element.annotations[METADATA_TYPE] || 'unknown'
}

export const isCustomObject = (element: Element): boolean =>
  metadataType(element) === CUSTOM_OBJECT

export const isFieldOfCustomObject = (field: Field): boolean =>
  isCustomObject(field.parent)

export const isInstanceOfCustomObject = (element: Element): element is InstanceElement =>
  isInstanceElement(element) && isCustomObject(element.type)

export const isCustom = (fullName: string): boolean =>
  fullName.endsWith(SALESFORCE_CUSTOM_SUFFIX)

export const isCustomSettings = (object: ObjectType): boolean =>
  object.annotations[CUSTOM_SETTINGS_TYPE]

export const defaultApiName = (element: Element): string => {
  const { name } = element.elemID
  return isCustom(name) || isInstanceElement(element)
    ? name
    : `${name}${SALESFORCE_CUSTOM_SUFFIX}`
}

const fullApiName = (elem: Element): string => {
  if (isInstanceElement(elem)) {
    return isCustomObject(elem)
      ? elem.value[CUSTOM_OBJECT_ID_FIELD] : elem.value[INSTANCE_FULL_NAME_FIELD]
  }
  return elem.annotations[API_NAME] ?? elem.annotations[METADATA_TYPE]
}

export const relativeApiName = (name: string): string => (
  _.last(name.split(API_NAME_SEPARATOR)) as string
)

export const apiName = (elem: Element, relative = false): string => {
  const name = fullApiName(elem)
  return name && relative ? relativeApiName(name) : name
}

export const formulaTypeName = (baseTypeName: FIELD_TYPE_NAMES): string =>
  `${FORMULA_TYPE_NAME}${baseTypeName}`

const fieldTypeName = (typeName: string): string => (
  typeName.startsWith(FORMULA_TYPE_NAME) ? typeName.slice(FORMULA_TYPE_NAME.length) : typeName
)

const createPicklistValuesAnnotations = (picklistValues: PicklistEntry[]): Values =>
  picklistValues.map(val => ({
    [CUSTOM_VALUE.FULL_NAME]: val.value,
    [CUSTOM_VALUE.DEFAULT]: val.defaultValue,
    [CUSTOM_VALUE.LABEL]: val.label || val.value,
    [CUSTOM_VALUE.IS_ACTIVE]: val.active,
  }))

const addPicklistAnnotations = (
  picklistValues: PicklistEntry[],
  restricted: boolean,
  annotations: Values,
): void => {
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
const geoLocationElemID = new ElemID(SALESFORCE, COMPOUND_FIELD_TYPE_NAMES.LOCATION)

const restrictedNumberTypeDefinitions = {
  TextLength: createRestriction({ min: 1, max: 255, enforce_value: false }),
  TextAreaLength: createRestriction({ min: 1, max: 131072 }),
  EncryptedTextLength: createRestriction({ min: 1, max: 175 }),
  LongTextAreaVisibleLines: createRestriction({ min: 2, max: 50 }),
  MultiPicklistVisibleLines: createRestriction({ min: 3, max: 10, enforce_value: false }),
  RichTextAreaVisibleLines: createRestriction({ min: 10, max: 50 }),
  RelationshipOrder: createRestriction({ min: 0, max: 1 }),
}

const restrictedNumberTypes = _.mapValues(
  restrictedNumberTypeDefinitions,
  (restriction, name) => new PrimitiveType({
    elemID: new ElemID(SALESFORCE, name),
    primitive: PrimitiveTypes.NUMBER,
    annotations: { [CORE_ANNOTATIONS.RESTRICTION]: restriction },
  })
)

export const METADATA_TYPES_TO_RENAME: Map<string, string> = new Map([
  ['FlexiPage', 'LightningPage'],
  ['FlexiPageRegion', 'LightningPageRegion'],
  ['FlexiPageTemplateInstance', 'LightningPageTemplateInstance'],
])

export class Types {
  private static getElemIdFunc: ElemIdGetter

  private static filterItemElemID = new ElemID(SALESFORCE, ANNOTATION_TYPE_NAMES.FILTER_ITEM)
  private static filterItemType = new ObjectType({
    elemID: Types.filterItemElemID,
    fields: {
      [FILTER_ITEM_FIELDS.FIELD]: { type: BuiltinTypes.STRING },
      [FILTER_ITEM_FIELDS.OPERATION]: { type: BuiltinTypes.STRING },
      [FILTER_ITEM_FIELDS.VALUE_FIELD]: { type: BuiltinTypes.STRING },
      [FILTER_ITEM_FIELDS.VALUE]: { type: BuiltinTypes.STRING },
    },
    annotations: {
      [API_NAME]: 'FilterItem',
    },
  })

  private static lookupFilterElemID = new ElemID(SALESFORCE, ANNOTATION_TYPE_NAMES.LOOKUP_FILTER)
  private static lookupFilterType = new ObjectType({
    elemID: Types.lookupFilterElemID,
    fields: {
      [LOOKUP_FILTER_FIELDS.ACTIVE]: { type: BuiltinTypes.BOOLEAN },
      [LOOKUP_FILTER_FIELDS.BOOLEAN_FILTER]: { type: BuiltinTypes.STRING },
      [LOOKUP_FILTER_FIELDS.ERROR_MESSAGE]: { type: BuiltinTypes.STRING },
      [LOOKUP_FILTER_FIELDS.INFO_MESSAGE]: { type: BuiltinTypes.STRING },
      [LOOKUP_FILTER_FIELDS.IS_OPTIONAL]: { type: BuiltinTypes.BOOLEAN },
      [LOOKUP_FILTER_FIELDS.FILTER_ITEMS]: { type: new ListType(Types.filterItemType) },
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
      [VALUE_SETTINGS_FIELDS.VALUE_NAME]: { type: BuiltinTypes.STRING },
      [VALUE_SETTINGS_FIELDS.CONTROLLING_FIELD_VALUE]: {
        type: new ListType(BuiltinTypes.STRING),
      },
    },
    annotations: {
      [API_NAME]: 'ValueSettings',
    },
  })

  private static valueSetElemID = new ElemID(SALESFORCE, FIELD_ANNOTATIONS.VALUE_SET)
  private static valueSetType = new ObjectType({
    elemID: Types.valueSetElemID,
    fields: {
      [CUSTOM_VALUE.FULL_NAME]: { type: BuiltinTypes.STRING },
      [CUSTOM_VALUE.LABEL]: { type: BuiltinTypes.STRING },
      [CUSTOM_VALUE.DEFAULT]: { type: BuiltinTypes.BOOLEAN },
      [CUSTOM_VALUE.IS_ACTIVE]: { type: BuiltinTypes.BOOLEAN },
      [CUSTOM_VALUE.COLOR]: { type: BuiltinTypes.STRING },
    },
  })

  private static fieldDependencyElemID = new ElemID(
    SALESFORCE, ANNOTATION_TYPE_NAMES.FIELD_DEPENDENCY,
  )

  private static fieldDependencyType = new ObjectType({
    elemID: Types.fieldDependencyElemID,
    fields: {
      [FIELD_DEPENDENCY_FIELDS.CONTROLLING_FIELD]: { type: BuiltinTypes.STRING },
      [FIELD_DEPENDENCY_FIELDS.VALUE_SETTINGS]: { type: new ListType(Types.valueSettingsType) },
    },
  })

  private static rollupSummaryOperationTypeElemID = new ElemID(SALESFORCE,
    FIELD_ANNOTATIONS.SUMMARY_OPERATION)

  private static rollupSummaryOperationType = new PrimitiveType({
    elemID: Types.rollupSummaryOperationTypeElemID,
    primitive: PrimitiveTypes.STRING,
    annotations: {
      [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
        values: ['count', 'min', 'max', 'sum'],
      }),
    },
  })

  private static rollupSummaryFilterOperationTypeElemID = new ElemID(SALESFORCE,
    FIELD_ANNOTATIONS.SUMMARY_FILTER_ITEMS, 'type', FILTER_ITEM_FIELDS.OPERATION)

  private static rollupSummaryFilterOperationTypeType = new PrimitiveType({
    elemID: Types.rollupSummaryFilterOperationTypeElemID,
    primitive: PrimitiveTypes.STRING,
    annotations: {
      [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
        values: [
          'equals', 'notEqual', 'lessThan', 'greaterThan', 'lessOrEqual',
          'greaterOrEqual', 'contains', 'notContain', 'startsWith',
          'includes', 'excludes', 'within',
        ],
      }),
    },
  })

  private static rollupSummaryFilterItemsElemID = new ElemID(SALESFORCE,
    FIELD_ANNOTATIONS.SUMMARY_FILTER_ITEMS)

  private static rollupSummaryFilterItemsType = new ObjectType({
    elemID: Types.rollupSummaryFilterItemsElemID,
    fields: {
      [FILTER_ITEM_FIELDS.FIELD]: { type: BuiltinTypes.STRING },
      [FILTER_ITEM_FIELDS.OPERATION]: { type: Types.rollupSummaryFilterOperationTypeType },
      [FILTER_ITEM_FIELDS.VALUE]: { type: BuiltinTypes.STRING },
      [FILTER_ITEM_FIELDS.VALUE_FIELD]: { type: BuiltinTypes.STRING },
    },
  })

  private static encryptedTextMaskTypeTypeElemID = new ElemID(SALESFORCE,
    FIELD_ANNOTATIONS.MASK_TYPE, 'type')

  private static encryptedTextMaskTypeType = new PrimitiveType({
    elemID: Types.encryptedTextMaskTypeTypeElemID,
    primitive: PrimitiveTypes.STRING,
    annotations: {
      [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
        values: ['all', 'creditCard', 'ssn', 'lastFour', 'sin', 'nino'],
      }),
    },
  })

  private static encryptedTextMaskCharTypeElemID = new ElemID(SALESFORCE,
    FIELD_ANNOTATIONS.MASK_CHAR, 'type')

  private static encryptedTextMaskCharType = new PrimitiveType({
    elemID: Types.encryptedTextMaskCharTypeElemID,
    primitive: PrimitiveTypes.STRING,
    annotations: {
      [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ values: ['X', 'asterisk'] }),
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

  private static TreatBlankAsTypeElemID = new ElemID(
    SALESFORCE,
    FIELD_ANNOTATIONS.FORMULA_TREAT_BLANKS_AS
  )

  private static TreatBlankAsType = new PrimitiveType({
    elemID: Types.TreatBlankAsTypeElemID,
    primitive: PrimitiveTypes.STRING,
    annotations: {
      [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ values: ['BlankAsBlank', 'BlankAsZero'] }),
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
  }

  // Type mapping for custom objects
  public static primitiveDataTypes: Record<ALL_FIELD_TYPE_NAMES, PrimitiveType> = {
    Text: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.TEXT),
      primitive: PrimitiveTypes.STRING,
      annotationTypes: {
        ...Types.commonAnnotationTypes,
        [FIELD_ANNOTATIONS.UNIQUE]: BuiltinTypes.BOOLEAN,
        [FIELD_ANNOTATIONS.EXTERNAL_ID]: BuiltinTypes.BOOLEAN,
        [FIELD_ANNOTATIONS.CASE_SENSITIVE]: BuiltinTypes.BOOLEAN,
        [FIELD_ANNOTATIONS.LENGTH]: restrictedNumberTypes.TextLength,
        [DEFAULT_VALUE_FORMULA]: BuiltinTypes.STRING,
      },
    }),
    Number: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.NUMBER),
      primitive: PrimitiveTypes.NUMBER,
      annotationTypes: {
        ...Types.commonAnnotationTypes,
        [FIELD_ANNOTATIONS.SCALE]: BuiltinTypes.NUMBER,
        [FIELD_ANNOTATIONS.PRECISION]: BuiltinTypes.NUMBER,
        [FIELD_ANNOTATIONS.UNIQUE]: BuiltinTypes.BOOLEAN,
        [FIELD_ANNOTATIONS.EXTERNAL_ID]: BuiltinTypes.BOOLEAN,
        [DEFAULT_VALUE_FORMULA]: BuiltinTypes.STRING,
      },
    }),
    AutoNumber: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.AUTONUMBER),
      primitive: PrimitiveTypes.STRING,
      annotationTypes: {
        ...Types.commonAnnotationTypes,
        [FIELD_ANNOTATIONS.EXTERNAL_ID]: BuiltinTypes.BOOLEAN,
        [FIELD_ANNOTATIONS.DISPLAY_FORMAT]: BuiltinTypes.STRING,
      },
    }),
    Checkbox: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.CHECKBOX),
      primitive: PrimitiveTypes.BOOLEAN,
      annotationTypes: {
        ...Types.commonAnnotationTypes,
        [FIELD_ANNOTATIONS.DEFAULT_VALUE]: BuiltinTypes.BOOLEAN,
      },
    }),
    Date: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.DATE),
      primitive: PrimitiveTypes.STRING,
      annotationTypes: {
        ...Types.commonAnnotationTypes,
        [DEFAULT_VALUE_FORMULA]: BuiltinTypes.STRING,
      },
    }),
    Time: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.TIME),
      primitive: PrimitiveTypes.STRING,
      annotationTypes: {
        ...Types.commonAnnotationTypes,
        [DEFAULT_VALUE_FORMULA]: BuiltinTypes.STRING,
      },
    }),
    DateTime: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.DATETIME),
      primitive: PrimitiveTypes.STRING,
      annotationTypes: {
        ...Types.commonAnnotationTypes,
        [DEFAULT_VALUE_FORMULA]: BuiltinTypes.STRING,
      },
    }),
    Currency: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.CURRENCY),
      primitive: PrimitiveTypes.NUMBER,
      annotationTypes: {
        ...Types.commonAnnotationTypes,
        [FIELD_ANNOTATIONS.SCALE]: BuiltinTypes.NUMBER,
        [FIELD_ANNOTATIONS.PRECISION]: BuiltinTypes.NUMBER,
        [DEFAULT_VALUE_FORMULA]: BuiltinTypes.STRING,
      },
    }),
    Picklist: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.PICKLIST),
      primitive: PrimitiveTypes.STRING,
      annotationTypes: {
        ...Types.commonAnnotationTypes,
        [FIELD_ANNOTATIONS.FIELD_DEPENDENCY]: Types.fieldDependencyType,
        [FIELD_ANNOTATIONS.VALUE_SET]: Types.valueSetType,
        [FIELD_ANNOTATIONS.RESTRICTED]: BuiltinTypes.BOOLEAN,
        [VALUE_SET_FIELDS.VALUE_SET_NAME]: BuiltinTypes.STRING,
        [VALUE_SET_DEFINITION_FIELDS.SORTED]: BuiltinTypes.BOOLEAN,
        [DEFAULT_VALUE_FORMULA]: BuiltinTypes.STRING,
      },
    }),
    MultiselectPicklist: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.MULTIPICKLIST),
      primitive: PrimitiveTypes.STRING,
      annotationTypes: {
        ...Types.commonAnnotationTypes,
        [FIELD_ANNOTATIONS.VISIBLE_LINES]: restrictedNumberTypes.MultiPicklistVisibleLines,
        [FIELD_ANNOTATIONS.FIELD_DEPENDENCY]: Types.fieldDependencyType,
        [FIELD_ANNOTATIONS.VALUE_SET]: Types.valueSetType,
        [FIELD_ANNOTATIONS.RESTRICTED]: BuiltinTypes.BOOLEAN,
        [VALUE_SET_FIELDS.VALUE_SET_NAME]: BuiltinTypes.STRING,
        [VALUE_SET_DEFINITION_FIELDS.SORTED]: BuiltinTypes.BOOLEAN,
        [DEFAULT_VALUE_FORMULA]: BuiltinTypes.STRING,
      },
    }),
    Email: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.EMAIL),
      primitive: PrimitiveTypes.STRING,
      annotationTypes: {
        ...Types.commonAnnotationTypes,
        [FIELD_ANNOTATIONS.UNIQUE]: BuiltinTypes.BOOLEAN,
        [FIELD_ANNOTATIONS.EXTERNAL_ID]: BuiltinTypes.BOOLEAN,
        [DEFAULT_VALUE_FORMULA]: BuiltinTypes.STRING,
      },
    }),
    Percent: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.PERCENT),
      primitive: PrimitiveTypes.NUMBER,
      annotationTypes: {
        ...Types.commonAnnotationTypes,
        [FIELD_ANNOTATIONS.SCALE]: BuiltinTypes.NUMBER,
        [FIELD_ANNOTATIONS.PRECISION]: BuiltinTypes.NUMBER,
        [DEFAULT_VALUE_FORMULA]: BuiltinTypes.STRING,
      },
    }),
    Phone: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.PHONE),
      primitive: PrimitiveTypes.STRING,
      annotationTypes: {
        ...Types.commonAnnotationTypes,
        [DEFAULT_VALUE_FORMULA]: BuiltinTypes.STRING,
      },
    }),
    LongTextArea: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.LONGTEXTAREA),
      primitive: PrimitiveTypes.STRING,
      annotationTypes: {
        ...Types.commonAnnotationTypes,
        [FIELD_ANNOTATIONS.VISIBLE_LINES]: restrictedNumberTypes.LongTextAreaVisibleLines,
        [FIELD_ANNOTATIONS.LENGTH]: restrictedNumberTypes.TextAreaLength,
        [DEFAULT_VALUE_FORMULA]: BuiltinTypes.STRING,
      },
    }),
    Html: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.RICHTEXTAREA),
      primitive: PrimitiveTypes.STRING,
      annotationTypes: {
        ...Types.commonAnnotationTypes,
        [FIELD_ANNOTATIONS.VISIBLE_LINES]: restrictedNumberTypes.RichTextAreaVisibleLines,
        [FIELD_ANNOTATIONS.LENGTH]: restrictedNumberTypes.TextAreaLength,
      },
    }),
    TextArea: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.TEXTAREA),
      primitive: PrimitiveTypes.STRING,
      annotationTypes: {
        ...Types.commonAnnotationTypes,
        [DEFAULT_VALUE_FORMULA]: BuiltinTypes.STRING,
      },
    }),
    EncryptedText: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.ENCRYPTEDTEXT),
      primitive: PrimitiveTypes.STRING,
      annotationTypes: {
        ...Types.commonAnnotationTypes,
        [FIELD_ANNOTATIONS.MASK_CHAR]: Types.encryptedTextMaskCharType,
        [FIELD_ANNOTATIONS.MASK_TYPE]: Types.encryptedTextMaskTypeType,
        [FIELD_ANNOTATIONS.LENGTH]: restrictedNumberTypes.EncryptedTextLength,
      },
    }),
    Url: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.URL),
      primitive: PrimitiveTypes.STRING,
      annotationTypes: {
        ...Types.commonAnnotationTypes,
        [DEFAULT_VALUE_FORMULA]: BuiltinTypes.STRING,
      },
    }),
    Lookup: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.LOOKUP),
      primitive: PrimitiveTypes.STRING,
      annotationTypes: {
        ...Types.commonAnnotationTypes,
        [FIELD_ANNOTATIONS.ALLOW_LOOKUP_RECORD_DELETION]: BuiltinTypes.BOOLEAN,
        [FIELD_ANNOTATIONS.REFERENCE_TO]: BuiltinTypes.STRING,
        [FIELD_ANNOTATIONS.LOOKUP_FILTER]: Types.lookupFilterType,
      },
    }),
    MasterDetail: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.MASTER_DETAIL),
      primitive: PrimitiveTypes.STRING,
      annotationTypes: {
        ...Types.commonAnnotationTypes,
        [FIELD_ANNOTATIONS.REPARENTABLE_MASTER_DETAIL]: BuiltinTypes.BOOLEAN,
        [FIELD_ANNOTATIONS.WRITE_REQUIRES_MASTER_READ]: BuiltinTypes.BOOLEAN,
        [FIELD_ANNOTATIONS.LOOKUP_FILTER]: Types.lookupFilterType,
        [FIELD_ANNOTATIONS.REFERENCE_TO]: BuiltinTypes.STRING,
        [FIELD_ANNOTATIONS.RELATIONSHIP_ORDER]: restrictedNumberTypes.RelationshipOrder,
      },
    }),
    Summary: new PrimitiveType({
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
    Unknown: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, INTERNAL_FIELD_TYPE_NAMES.UNKNOWN),
      primitive: PrimitiveTypes.STRING,
      annotationTypes: {
        ...Types.commonAnnotationTypes,
      },
    }),
    AnyType: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, INTERNAL_FIELD_TYPE_NAMES.ANY),
      primitive: PrimitiveTypes.UNKNOWN,
      annotationTypes: {
        ...Types.commonAnnotationTypes,
      },
    }),
  }

  private static getFormulaDataType = (baseTypeName: FIELD_TYPE_NAMES):
    Record<string, PrimitiveType> => {
    const baseType = Types.primitiveDataTypes[baseTypeName]
    const typeName = formulaTypeName(baseTypeName)
    return { [typeName]: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, typeName),
      primitive: baseType.primitive,
      annotationTypes: {
        ...baseType.annotationTypes,
        [FORMULA]: BuiltinTypes.STRING,
        [FIELD_ANNOTATIONS.FORMULA_TREAT_BLANKS_AS]: Types.TreatBlankAsType,
      },
    }) }
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

  // Type mapping for compound fields
  public static compoundDataTypes: Record<COMPOUND_FIELD_TYPE_NAMES, ObjectType> = {
    Address: new ObjectType({
      elemID: addressElemID,
      fields: {
        [ADDRESS_FIELDS.CITY]: { type: BuiltinTypes.STRING },
        [ADDRESS_FIELDS.COUNTRY]: { type: BuiltinTypes.STRING },
        [ADDRESS_FIELDS.GEOCODE_ACCURACY]: { type: Types.primitiveDataTypes.Picklist },
        [ADDRESS_FIELDS.LATITUDE]: { type: BuiltinTypes.NUMBER },
        [ADDRESS_FIELDS.LONGITUDE]: { type: BuiltinTypes.NUMBER },
        [ADDRESS_FIELDS.POSTAL_CODE]: { type: BuiltinTypes.STRING },
        [ADDRESS_FIELDS.STATE]: { type: BuiltinTypes.STRING },
        [ADDRESS_FIELDS.STREET]: { type: Types.primitiveDataTypes.TextArea },
      },
      annotationTypes: {
        ...Types.commonAnnotationTypes,
      },
    }),
    Name: new ObjectType({
      elemID: nameElemID,
      fields: {
        [NAME_FIELDS.FIRST_NAME]: { type: BuiltinTypes.STRING },
        [NAME_FIELDS.LAST_NAME]: { type: BuiltinTypes.STRING },
        [NAME_FIELDS.SALUTATION]: { type: Types.primitiveDataTypes.Picklist },
      },
      annotationTypes: {
        ...Types.commonAnnotationTypes,
      },
    }),
    Location: new ObjectType({
      elemID: geoLocationElemID,
      fields: {
        [GEOLOCATION_FIELDS.LATITUDE]: { type: BuiltinTypes.NUMBER },
        [GEOLOCATION_FIELDS.LONGITUDE]: { type: BuiltinTypes.NUMBER },
      },
      annotationTypes: {
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
  }

  static setElemIdGetter(getElemIdFunc: ElemIdGetter): void {
    this.getElemIdFunc = getElemIdFunc
  }

  static getKnownType(name: string, customObject = true): TypeElement {
    return customObject
      ? this.primitiveDataTypes[name as FIELD_TYPE_NAMES]
      || this.compoundDataTypes[name as COMPOUND_FIELD_TYPE_NAMES]
      || this.formulaDataTypes[name as FIELD_TYPE_NAMES]
      : this.metadataPrimitiveTypes[name.toLowerCase()]
  }

  static get(name: string, customObject = true, isSettings = false, serviceIds?: ServiceIds):
    TypeElement {
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
    const updatedName = METADATA_TYPES_TO_RENAME.get(name) ?? name
    return (customObject && this.getElemIdFunc && serviceIds)
      ? this.getElemIdFunc(SALESFORCE, serviceIds, naclCase(updatedName))
      : new ElemID(SALESFORCE, naclCase(updatedName))
  }

  static getAllFieldTypes(): TypeElement[] {
    return _.concat(
      Object.values(Types.primitiveDataTypes),
      Object.values(Types.compoundDataTypes) as TypeElement[],
      Object.values(Types.formulaDataTypes),
    ).map(type => {
      const fieldType = type.clone()
      fieldType.path = [SALESFORCE, TYPES_PATH, 'field_types']
      return fieldType
    })
  }

  static getAllMissingTypes(): ObjectType[] {
    return allMissingSubTypes
  }

  static getAnnotationTypes(): TypeElement[] {
    return [Types.fieldDependencyType, Types.rollupSummaryOperationType,
      Types.valueSettingsType, Types.lookupFilterType, Types.filterItemType,
      Types.encryptedTextMaskCharType, Types.encryptedTextMaskTypeType,
      Types.BusinessStatusType, Types.SecurityClassificationType, Types.valueSetType,
      Types.TreatBlankAsType,
      ...Object.values(restrictedNumberTypes),
    ]
      .map(type => {
        const fieldType = type.clone()
        fieldType.path = fieldType.elemID.isEqual(Types.filterItemElemID)
          ? [SALESFORCE, TYPES_PATH, Types.filterItemElemID.name]
          : [SALESFORCE, TYPES_PATH, 'annotation_types']
        return fieldType
      })
  }
}

const transformCompoundValues = (
  record: SalesforceRecord,
  instance: InstanceElement
): SalesforceRecord => {
  const compoundFieldsElemIDs = Object.values(Types.compoundDataTypes).map(o => o.elemID)
  const relevantCompoundFields = _.pickBy(instance.type.fields,
    (field, fieldKey) => Object.keys(record).includes(fieldKey)
    && !_.isUndefined(_.find(compoundFieldsElemIDs, e => field.type.elemID.isEqual(e))))
  if (_.isEmpty(relevantCompoundFields)) {
    return record
  }
  const transformedCompoundValues = _.mapValues(
    relevantCompoundFields,
    (compoundField, compoundFieldKey) => {
      // Name fields are without a prefix
      if (compoundField.type.elemID.isEqual(Types.compoundDataTypes.Name.elemID)) {
        return record[compoundFieldKey]
      }
      // Other compound fields are added a prefix according to the field name
      // ie. LocalAddrress -> LocalCity, LocalState etc.
      const typeName = compoundField.type.elemID.isEqual(Types.compoundDataTypes.Address.elemID)
        ? COMPOUND_FIELD_TYPE_NAMES.ADDRESS : COMPOUND_FIELD_TYPE_NAMES.LOCATION
      const fieldPrefix = compoundFieldKey.slice(0, -typeName.length)
      return _.mapKeys(record[compoundFieldKey], (_vv, key) => fieldPrefix.concat(key))
    }
  )
  return Object.assign(
    _.omit(record, Object.keys(relevantCompoundFields)),
    ...Object.values(transformedCompoundValues)
  )
}

const toRecord = (
  instance: InstanceElement,
  fieldAnnotationToFilterBy: string,
): SalesforceRecord => {
  const filteredRecordValues = {
    [CUSTOM_OBJECT_ID_FIELD]: instance.value[CUSTOM_OBJECT_ID_FIELD],
    ..._.pickBy(
      instance.value,
      (_v, k) => instance.type.fields[k]?.annotations[fieldAnnotationToFilterBy]
    ),
  }
  return transformCompoundValues(filteredRecordValues, instance)
}

export const instancesToUpdateRecords = (instances: InstanceElement[]): SalesforceRecord[] =>
  instances.map(instance => toRecord(instance, FIELD_ANNOTATIONS.UPDATEABLE))

export const instancesToCreateRecords = (instances: InstanceElement[]): SalesforceRecord[] =>
  instances.map(instance => toRecord(instance, FIELD_ANNOTATIONS.CREATABLE))

export const instancesToDeleteRecords = (instances: InstanceElement[]): SalesforceRecord[] =>
  instances.map(instance => ({ Id: instance.value[CUSTOM_OBJECT_ID_FIELD] }))

export const toCustomField = (
  field: Field, fullname = false
): CustomField => {
  const fieldDependency = field.annotations[FIELD_ANNOTATIONS.FIELD_DEPENDENCY]
  const newField = new CustomField(
    apiName(field, !fullname),
    fieldTypeName(field.type.elemID.name),
    field.annotations[CORE_ANNOTATIONS.REQUIRED],
    field.annotations[FIELD_ANNOTATIONS.DEFAULT_VALUE],
    field.annotations[DEFAULT_VALUE_FORMULA],
    makeArray(field.annotations[FIELD_ANNOTATIONS.VALUE_SET]),
    fieldDependency?.[FIELD_DEPENDENCY_FIELDS.CONTROLLING_FIELD],
    fieldDependency?.[FIELD_DEPENDENCY_FIELDS.VALUE_SETTINGS],
    field.annotations[FIELD_ANNOTATIONS.RESTRICTED],
    field.annotations[VALUE_SET_DEFINITION_FIELDS.SORTED],
    field.annotations[VALUE_SET_FIELDS.VALUE_SET_NAME],
    field.annotations[FORMULA],
    field.annotations[FIELD_ANNOTATIONS.SUMMARY_FILTER_ITEMS],
    field.annotations[FIELD_ANNOTATIONS.REFERENCE_TO],
    field.name.split(SALESFORCE_CUSTOM_SUFFIX)[0],
    field.annotations[FIELD_ANNOTATIONS.ALLOW_LOOKUP_RECORD_DELETION],
    field.annotations[FIELD_ANNOTATIONS.LENGTH],
  )

  // Skip the assignment of the following annotations that are defined as annotationType
  const annotationsHandledInCtor = [
    FIELD_ANNOTATIONS.ALLOW_LOOKUP_RECORD_DELETION,
    FIELD_ANNOTATIONS.VALUE_SET,
    FIELD_ANNOTATIONS.RESTRICTED,
    VALUE_SET_DEFINITION_FIELDS.SORTED,
    VALUE_SET_FIELDS.VALUE_SET_NAME,
    DEFAULT_VALUE_FORMULA,
    FIELD_ANNOTATIONS.LENGTH,
    FIELD_ANNOTATIONS.DEFAULT_VALUE,
    CORE_ANNOTATIONS.REQUIRED,
    FIELD_ANNOTATIONS.RELATIONSHIP_NAME,
    FIELD_ANNOTATIONS.REFERENCE_TO,
    FIELD_ANNOTATIONS.SUMMARY_FILTER_ITEMS,
  ]

  // Annotations that are used by the adapter but do not exist in the CustomObject
  const internalUseAnnotations = [
    API_NAME,
    FIELD_ANNOTATIONS.CREATABLE,
    FIELD_ANNOTATIONS.UPDATEABLE,
    FIELD_ANNOTATIONS.QUERYABLE,
  ]

  const annotationsToSkip = [
    ...annotationsHandledInCtor,
    ...internalUseAnnotations,
    FIELD_ANNOTATIONS.FIELD_DEPENDENCY, // handled in field_dependencies filter
    FIELD_ANNOTATIONS.LOOKUP_FILTER, // handled in lookup_filters filter
  ]
  const isAllowed = (annotationName: string): boolean => (
    Object.keys(field.type.annotationTypes).includes(annotationName)
    && !annotationsToSkip.includes(annotationName)
  )
  // Convert the annotations' names to the required API name
  _.assign(
    newField,
    _.pickBy(field.annotations, (_val, annotationName) => isAllowed(annotationName)),
  )
  return newField
}

const isLocalOnly = (field?: Field): boolean => (
  field !== undefined && field.annotations[FIELD_ANNOTATIONS.LOCAL_ONLY] === true
)

const getFieldsIfIncluded = (
  includeFields: boolean, element: ObjectType, skipFields: string[]
): CustomField[] | undefined =>
  (includeFields ? Object.values(element.fields)
    .filter(field => !isLocalOnly(field))
    .map(field => toCustomField(field))
    .filter(field => !skipFields.includes(field.fullName))
    : undefined)

export const toCustomProperties = (
  element: ObjectType, includeFields: boolean, skipFields: string[] = [],
): CustomProperties => {
  let newCustomObject: CustomProperties
  if (element.annotations[CUSTOM_SETTINGS_TYPE]) {
    newCustomObject = new CustomProperties(
      apiName(element),
      element.annotations[LABEL],
      getFieldsIfIncluded(includeFields, element, skipFields)
    )
  } else {
    newCustomObject = new CustomObject(
      apiName(element),
      element.annotations[LABEL],
      getFieldsIfIncluded(includeFields, element, skipFields)
    )
  }
  // Skip the assignment of the following annotations that are defined as annotationType
  const annotationsToSkip: string[] = [
    API_NAME, // we use it as fullName
    METADATA_TYPE, // internal annotation
    LABEL, // we send it in CustomObject constructor to enable default for pluralLabels
  ]

  const isAllowed = (annotationName: string): boolean => (
    Object.keys(element.annotationTypes).includes(annotationName)
    && !annotationsToSkip.includes(annotationName)
  )
  _.assign(
    newCustomObject,
    _.pickBy(element.annotations, (_val, annotationName) => isAllowed(annotationName)),
  )
  return newCustomObject
}

export const getValueTypeFieldElement = (parent: ObjectType, field: ValueTypeField,
  knownTypes: Map<string, TypeElement>, additionalAnnotations?: Values): Field => {
  const naclFieldType = (field.name === INSTANCE_FULL_NAME_FIELD)
    ? BuiltinTypes.SERVICE_ID
    : knownTypes.get(field.soapType) || Types.get(field.soapType, false)
  // mark required as false until SALTO-45 will be resolved
  const annotations: Values = {
    [CORE_ANNOTATIONS.REQUIRED]: false,
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
    const defaults = field.picklistValues
      .filter(val => val.defaultValue)
      .map(val => val.value)
    if (defaults.length === 1) {
      annotations[CORE_ANNOTATIONS.DEFAULT] = defaults.pop()
    }
  }

  if (field.isForeignKey) {
    annotations[FOREIGN_KEY_DOMAIN] = makeArray(field.foreignKeyDomain)
  }

  return new Field(parent, field.name, naclFieldType, annotations)
}

type ConvertXsdTypeFunc = (v: string) => PrimitiveValue
const convertXsdTypeFuncMap: Record<string, ConvertXsdTypeFunc> = {
  'xsd:string': String,
  'xsd:boolean': v => v === 'true',
  'xsd:double': Number,
  'xsd:int': Number,
  'xsd:long': Number,
}

// Salesforce returns nulls in metadata API as objects like { $: { 'xsi:nil': 'true' } }
// and in retrieve API like <activateRSS xsi:nil="true"/>
// which is transformed to { `${XML_ATTRIBUTE_PREFIX}xsi:nil`): 'true' }
const isNull = (value: Value): boolean =>
  _.isNull(value) || (_.isObject(value)
    && (_.get(value, ['$', 'xsi:nil']) === 'true'
      || _.get(value, `${XML_ATTRIBUTE_PREFIX}xsi:nil`) === 'true'))

export const transformPrimitive: TransformFunc = ({ value, path, field }) => {
  if (isNull(value)) {
    // We transform null to undefined as currently we don't support null in Salto language
    // and the undefined values are omitted later in the code
    return undefined
  }
  // (Salto-394) Salesforce returns objects like:
  // { "_": "fieldValue", "$": { "xsi:type": "xsd:string" } }
  if (_.isObject(value) && Object.keys(value).includes('_')) {
    const convertFunc = convertXsdTypeFuncMap[_.get(value, ['$', 'xsi:type'])] || (v => v)
    return transformPrimitive({ value: convertFunc(_.get(value, '_')), path, field })
  }
  const fieldType = field?.type
  if (!isPrimitiveType(fieldType) || !isPrimitiveValue(value)) {
    return value
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

const isDefaultWithType = (val: PrimitiveValue | DefaultValueWithType):
  val is DefaultValueWithType => new Set(_.keys(val)).has('_')

const valueFromXsdType = (val: DefaultValueWithType): PrimitiveValue => {
  const convertFunc = convertXsdTypeFuncMap[val.$['xsi:type']] || (v => v)
  return convertFunc(val._)
}

const getDefaultValue = (field: SalesforceField): PrimitiveValue | undefined => {
  if (field.defaultValue === null || field.defaultValue === undefined) {
    return undefined
  }

  return isDefaultWithType(field.defaultValue)
    ? valueFromXsdType(field.defaultValue) : field.defaultValue
}

// The following method is used during the fetchy process and is used in building the objects
// and their fields described in the Nacl file
export const getSObjectFieldElement = (
  parent: ObjectType,
  field: SalesforceField,
  parentServiceIds: ServiceIds,
  objCompoundFieldNames: string[] = [],
  systemFields: string[] = []
): Field => {
  const fieldApiName = [parentServiceIds[API_NAME], field.name].join(API_NAME_SEPARATOR)
  const serviceIds = {
    [ADAPTER]: SALESFORCE,
    [API_NAME]: fieldApiName,
    [OBJECT_SERVICE_ID]: toServiceIdsString(parentServiceIds),
  }

  const getFieldType = (typeName: string): TypeElement => (
    Types.get(typeName, true, false, serviceIds)
  )
  let naclFieldType = getFieldType(FIELD_SOAP_TYPE_NAMES[field.type])
  const annotations: Values = {
    [API_NAME]: fieldApiName,
    [LABEL]: field.label,
  }
  if (field.type !== 'boolean') {
    // nillable is the closest thing we could find to infer if a field is required, it might not
    // be perfect
    // boolean (i.e. Checkbox) must not have required field
    annotations[CORE_ANNOTATIONS.REQUIRED] = !field.nillable
  }

  if (field.defaultValueFormula) {
    annotations[DEFAULT_VALUE_FORMULA] = field.defaultValueFormula
  }

  const defaultValue = getDefaultValue(field)
  if ((defaultValue !== undefined) && (_.isEmpty(field.picklistValues))) {
    annotations[FIELD_ANNOTATIONS.DEFAULT_VALUE] = defaultValue
  }

  // Handle specific field types that need to be converted from their primitive type to their
  // Salesforce field type
  if (field.autoNumber) { // autonumber (needs to be first because its type in the field
    // returned from the API is string)
    naclFieldType = getFieldType(FIELD_TYPE_NAMES.AUTONUMBER)
  } else if (field.idLookup && field.type === 'id') {
    naclFieldType = BuiltinTypes.SERVICE_ID
  } else if (field.type === 'string' && !field.compoundFieldName) { // string
    naclFieldType = getFieldType(FIELD_TYPE_NAMES.TEXT)
  } else if ((field.type === 'double' && !field.compoundFieldName)) {
    naclFieldType = getFieldType(FIELD_TYPE_NAMES.NUMBER)
    annotations[FIELD_ANNOTATIONS.PRECISION] = field.precision
    annotations[FIELD_ANNOTATIONS.SCALE] = field.scale
  } else if (field.type === 'int') {
    naclFieldType = getFieldType(FIELD_TYPE_NAMES.NUMBER)
    annotations[FIELD_ANNOTATIONS.PRECISION] = field.digits
  } else if (field.type === 'textarea' && field.length > 255) { // long text area & rich text area
    if (field.extraTypeInfo === 'plaintextarea') {
      naclFieldType = getFieldType(FIELD_TYPE_NAMES.LONGTEXTAREA)
    } else if (field.extraTypeInfo === 'richtextarea') {
      naclFieldType = getFieldType(FIELD_TYPE_NAMES.RICHTEXTAREA)
    }
  } else if (field.type === 'encryptedstring') { // encrypted string
    naclFieldType = getFieldType(FIELD_TYPE_NAMES.ENCRYPTEDTEXT)
  }
  // Picklists
  if (field.picklistValues && field.picklistValues.length > 0) {
    addPicklistAnnotations(field.picklistValues,
      Boolean(field.restrictedPicklist), annotations)
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
      annotations[CORE_ANNOTATIONS.REQUIRED] = false
      annotations[FIELD_ANNOTATIONS.WRITE_REQUIRES_MASTER_READ] = Boolean(
        field.writeRequiresMasterRead
      )
      annotations[FIELD_ANNOTATIONS.REPARENTABLE_MASTER_DETAIL] = Boolean(field.updateable)
    } else {
      naclFieldType = getFieldType(FIELD_TYPE_NAMES.LOOKUP)
      annotations[FIELD_ANNOTATIONS.ALLOW_LOOKUP_RECORD_DELETION] = !(_.get(field, 'restrictedDelete'))
    }
    if (!_.isEmpty(field.referenceTo)) {
      // todo: currently this field is populated with the referenced object's API name,
      //  should be modified to elemID reference once we'll use HIL
      // there are some SF reference fields without related fields
      // e.g. salesforce.user_app_menu_item.ApplicationId, salesforce.login_event.LoginHistoryId
      annotations[FIELD_ANNOTATIONS.REFERENCE_TO] = field.referenceTo
    }
    if (field.filteredLookupInfo) {
      // will be populated in the lookup_filter filter
      annotations[FIELD_ANNOTATIONS.LOOKUP_FILTER] = {}
    }
  // Compound Fields
  } else if (!_.isUndefined(COMPOUND_FIELDS_SOAP_TYPE_NAMES[field.type]) || field.nameField) {
    // Only fields that are compound in this object get compound type
    if (objCompoundFieldNames.includes(field.name)) {
      naclFieldType = field.nameField
        ? Types.compoundDataTypes.Name
        : Types.compoundDataTypes[COMPOUND_FIELDS_SOAP_TYPE_NAMES[field.type]]
    }
  }

  if (!_.isEmpty(naclFieldType.annotationTypes)) {
    // Get the rest of the annotations if their name matches exactly the API response
    // and they are not already assigned
    _.assign(
      annotations,
      _.pick(
        _.omit(field, Object.keys(annotations)),
        Object.keys(naclFieldType.annotationTypes),
      )
    )
  }
  // mark all fields from the SOAP API as queryable (internal annotation)
  annotations[FIELD_ANNOTATIONS.QUERYABLE] = true

  // System fields besides name should be hidden and not be creatable, updateable nor required
  // Because they differ between envs and should not be edited through salto
  // Name is an exception because it can be editable and visible to the user
  if (!field.nameField && systemFields.includes(field.name)) {
    annotations[CORE_ANNOTATIONS.HIDDEN] = true
    annotations[FIELD_ANNOTATIONS.UPDATEABLE] = false
    annotations[FIELD_ANNOTATIONS.CREATABLE] = false
    annotations[CORE_ANNOTATIONS.REQUIRED] = false
  }

  // An autoNumber field should be hidden because it will differ between enviorments
  if (field.autoNumber) {
    annotations[CORE_ANNOTATIONS.HIDDEN] = true
  }

  const fieldName = Types.getElemId(field.name, true, serviceIds).name
  return new Field(parent, fieldName, naclFieldType, annotations)
}

export const toDeployableInstance = (element: InstanceElement): InstanceElement => {
  const removeLocalOnly: TransformFunc = ({ value, field }) => (
    (isLocalOnly(field))
      ? undefined
      : value
  )

  return transformElement({
    element,
    transformFunc: removeLocalOnly,
    strict: false,
  })
}

export const fromMetadataInfo = (info: MetadataInfo): Values => info

export const toMetadataInfo = (instance: InstanceElement):
  MetadataInfo =>
  ({
    fullName: apiName(instance),
    ...toDeployableInstance(instance).value,
  })

export const createInstanceServiceIds = (
  serviceIdsValues: Values,
  type: ObjectType,
): ServiceIds => {
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
    ...serviceIdsValues,
    [ADAPTER]: SALESFORCE,
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

const metadataAnnotationTypes: Record<keyof MetadataTypeAnnotations, TypeElement> = {
  [METADATA_TYPE]: BuiltinTypes.SERVICE_ID,
  hasMetaFile: BuiltinTypes.BOOLEAN,
  folderType: BuiltinTypes.STRING,
  folderContentType: BuiltinTypes.STRING,
  suffix: BuiltinTypes.STRING,
  dirName: BuiltinTypes.STRING,
}

export type MetadataObjectType = ObjectType & {
  annotations: ObjectType['annotations'] & MetadataTypeAnnotations
  annotationTypes: ObjectType['annotationTypes'] & typeof metadataAnnotationTypes
}

export const isMetadataObjectType = (elem: Element): elem is MetadataObjectType => (
  isObjectType(elem) && elem.annotations[METADATA_TYPE] !== undefined
)

export type MetadataValues = MetadataInfo & Values

export type MetadataInstanceElement = InstanceElement & {
  type: MetadataObjectType
  value: MetadataValues
}

export const isMetadataInstanceElement = (
  inst: InstanceElement
): inst is MetadataInstanceElement => (
  isMetadataObjectType(inst.type) && inst.value[INSTANCE_FULL_NAME_FIELD] !== undefined
)

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

  const typeName = type.elemID.name
  const { name } = Types.getElemId(
    naclCase(values[INSTANCE_FULL_NAME_FIELD]),
    true,
    createInstanceServiceIds(_.pick(values, INSTANCE_FULL_NAME_FIELD), type)
  )
  return new InstanceElement(
    type.isSettings ? ElemID.CONFIG_NAME : name,
    type,
    values,
    [...getPackagePath(), RECORDS_PATH,
      type.isSettings ? SETTINGS_PATH : typeName, naclCase(fullName)],
    annotations,
  ) as MetadataInstanceElement
}

const createIdField = (parent: ObjectType): void => {
  parent.fields[INTERNAL_ID_FIELD] = new Field(
    parent,
    INTERNAL_ID_FIELD,
    BuiltinTypes.STRING,
    {
      [CORE_ANNOTATIONS.REQUIRED]: false,
      [CORE_ANNOTATIONS.HIDDEN]: true,
      [FIELD_ANNOTATIONS.LOCAL_ONLY]: true,
    }
  )
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
}
export const createMetadataTypeElements = async ({
  name, fields, knownTypes = new Map(), baseTypeNames, childTypeNames, client,
  isSettings = false, annotations = {},
}: CreateMetadataTypeParams): Promise<MetadataObjectType[]> => {
  if (knownTypes.has(name)) {
    // Already created this type, no new types to return here
    return []
  }

  const element = Types.get(name, false, isSettings) as MetadataObjectType
  knownTypes.set(name, element)
  const isTopLevelType = baseTypeNames.has(name) || annotations.folderContentType !== undefined
  element.annotationTypes = _.clone(metadataAnnotationTypes)
  element.annotate({
    ..._.pickBy(annotations, isDefined),
    [METADATA_TYPE]: name,
  })
  element.path = [
    SALESFORCE,
    TYPES_PATH,
    ...isTopLevelType ? [] : [SUBTYPES_PATH],
    element.elemID.name,
  ]

  const shouldCreateIdField = (): boolean => (
    (isTopLevelType || childTypeNames.has(name))
    && element.fields[INTERNAL_ID_FIELD] === undefined
  )

  if (!fields || _.isEmpty(fields)) {
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
        fields: innerFields.valueTypeFields }
    }
    return field
  }))

  const embeddedTypes = await Promise.all(enrichedFields
    .filter(field => !baseTypeNames.has(field.soapType))
    .filter(field => !_.isEmpty(field.fields))
    .flatMap(field => createMetadataTypeElements({
      name: field.soapType,
      fields: makeArray(field.fields),
      knownTypes,
      baseTypeNames,
      childTypeNames,
      client,
    })))

  // Enum fields sometimes show up with a type name that is not primitive but also does not
  // have fields (so we won't create an embedded type for it). it seems like these "empty" types
  // are always supposed to be a string with some restriction so we map all non primitive "empty"
  // types to string.
  // Sometimes, we get known types without fields for some reason, in this case it is not an enum
  enrichedFields
    .filter(field => _.isEmpty(field.fields))
    .filter(field => !isPrimitiveType(Types.get(field.soapType, false)))
    .filter(field => !knownTypes.has(field.soapType))
    .filter(field => field.soapType !== name)
    .forEach(field => knownTypes.set(field.soapType, BuiltinTypes.STRING))

  const fieldElements = enrichedFields.map(field =>
    getValueTypeFieldElement(element, field, knownTypes))

  // Set fields on elements
  fieldElements.forEach(field => {
    element.fields[field.name] = field
  })

  if (shouldCreateIdField()) {
    createIdField(element)
  }
  return _.flatten([element, ...embeddedTypes])
}
