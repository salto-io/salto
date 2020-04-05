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
import _ from 'lodash'
import {
  ValueTypeField, Field, MetadataInfo, DefaultValueWithType, Record as SfRecord, PicklistEntry,
} from 'jsforce'
import {
  TypeElement, ObjectType, ElemID, PrimitiveTypes, PrimitiveType, Values, Value,
  BuiltinTypes, Element, isInstanceElement, InstanceElement, isPrimitiveType, ElemIdGetter,
  ServiceIds, toServiceIdsString, OBJECT_SERVICE_ID, ADAPTER, CORE_ANNOTATIONS,
  isElement, PrimitiveValue, RESTRICTION_ANNOTATIONS,
  Field as TypeField, TypeMap, ListType, isField,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import {
  bpCase, TransformPrimitiveFunc,
} from '@salto-io/adapter-utils'
import { CustomObject, CustomField } from '../client/types'
import {
  API_NAME, CUSTOM_OBJECT, LABEL, SALESFORCE, FORMULA, FIELD_TYPE_NAMES,
  METADATA_TYPE, FIELD_ANNOTATIONS, SALESFORCE_CUSTOM_SUFFIX, DEFAULT_VALUE_FORMULA,
  LOOKUP_FILTER_FIELDS, ADDRESS_FIELDS, NAME_FIELDS, GEOLOCATION_FIELDS, INSTANCE_FULL_NAME_FIELD,
  FIELD_DEPENDENCY_FIELDS, VALUE_SETTINGS_FIELDS, FILTER_ITEM_FIELDS, DESCRIPTION,
  HELP_TEXT, BUSINESS_STATUS, FORMULA_TYPE_NAME,
  SECURITY_CLASSIFICATION, BUSINESS_OWNER_GROUP, BUSINESS_OWNER_USER, COMPLIANCE_GROUP,
  CUSTOM_VALUE, API_NAME_SEPERATOR, MAX_METADATA_RESTRICTION_VALUES,
  VALUE_SET_FIELDS, COMPOUND_FIELD_TYPE_NAMES, ANNOTATION_TYPE_NAMES, FIELD_SOAP_TYPE_NAMES,
  RECORDS_PATH, SETTINGS_PATH, TYPES_PATH, SUBTYPES_PATH, INSTALLED_PACKAGES_PATH,
  VALUE_SET_DEFINITION_FIELDS, CUSTOM_FIELD, BUSINESS_HOURS_ENTRY, MISSING_SUBTYPE_NAMES,
  HOLIDAYS, ORGANIZATION_SETTINGS_DETAIL, MISSING_TYPE_NAME, CASE_CLASSIFICATION_SETTINGS,
  ACCOUNT_INSIGHT_SETTINGS, ACCOUNT_INTELLIGENCE_SETTINGS, AUTOMATED_CONTACTS_SETTINGS,
  CHATTER_ANSWERS_SETTINGS, CHATTER_EMAIL_M_D_SETTINGS, HIGH_VELOCITY_SALES_SETTINGS,
  IO_T_SETTINGS, MAP_AND_LOCATION_SETTINGS, OBJECT_LINKING_SETTINGS,
  PREDICTION_BUILDER_SETTINGS, SOCIAL_CUSTOMER_SERVICE_SETTINGS,
} from '../constants'
import SalesforceClient from '../client/client'

const { makeArray } = collections.array

export const metadataType = (element: Element): string => {
  if (isInstanceElement(element)) {
    return metadataType(element.type)
  }
  if (isField(element)) {
    // We expect to reach to this place only with field of CustomObject
    return CUSTOM_FIELD
  }
  return element.annotations[METADATA_TYPE] || CUSTOM_OBJECT
}

export const isCustomObject = (element: Element): boolean =>
  metadataType(element) === CUSTOM_OBJECT

export const isCustom = (fullName: string): boolean =>
  fullName.endsWith(SALESFORCE_CUSTOM_SUFFIX)

export const defaultApiName = (element: Element): string => {
  const { name } = element.elemID
  return isCustom(name) || isInstanceElement(element)
    ? name
    : `${name}${SALESFORCE_CUSTOM_SUFFIX}`
}

const fullApiName = (elem: Element): string => {
  if (isInstanceElement(elem)) {
    return elem.value[INSTANCE_FULL_NAME_FIELD]
  }
  const elemMetadataType = metadataType(elem)
  return elemMetadataType === CUSTOM_OBJECT || CUSTOM_FIELD
    ? elem.annotations[API_NAME] ?? elem.annotations[METADATA_TYPE]
    : elemMetadataType
}

export const apiName = (elem: Element, relative = false): string => {
  const name = fullApiName(elem)
  return name && relative ? _.last(name.split(API_NAME_SEPERATOR)) as string : name
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
const AccountInsightsSettingsId = new ElemID(
  SALESFORCE, MISSING_TYPE_NAME.ACCOUNT_INSIGHT_SETTINGS
)
const AccountIntelligenceSettingsId = new ElemID(
  SALESFORCE, MISSING_TYPE_NAME.ACCOUNT_INTELLIGENCE_SETTINGS
)
const AutomatedContactsSettingsId = new ElemID(
  SALESFORCE, MISSING_TYPE_NAME.AUTOMATED_CONTACTS_SETTINGS
)
const ChatterAnswersSettingsId = new ElemID(
  SALESFORCE, MISSING_TYPE_NAME.CHATTER_ANSWERS_SETTINGS
)
const ChatterEmailMDSettingsId = new ElemID(
  SALESFORCE, MISSING_TYPE_NAME.CHATTER_EMAIL_MDSETTINGS
)
const HighVelocitySalesSettingsId = new ElemID(
  SALESFORCE, MISSING_TYPE_NAME.HIGH_VELOCITY_SALES_SETTINGS
)
const IoTSettingsId = new ElemID(
  SALESFORCE, MISSING_TYPE_NAME.IOT_SETTINGS
)
const MapAndLocationSettingsId = new ElemID(
  SALESFORCE, MISSING_TYPE_NAME.MAP_AND_LOCATION_SETTINGS
)
const ObjectLinkingSettingsId = new ElemID(
  SALESFORCE, MISSING_TYPE_NAME.OBJECT_LINKING_SETTINGS
)
const PredictionBuilderSettingsId = new ElemID(
  SALESFORCE, MISSING_TYPE_NAME.PREDICTION_BUILDER_SETTINGS
)
const SocialCustomerServiceSettingsId = new ElemID(
  SALESFORCE, MISSING_TYPE_NAME.SOCIAL_CUSTOMER_SERVICE_SETTINGS
)


const BusinessHoursEntryID = new ElemID(SALESFORCE, MISSING_SUBTYPE_NAMES.BUSINESS_HOURS_ENTRY)
const HolidaysId = new ElemID(SALESFORCE, MISSING_SUBTYPE_NAMES.HOLIDAYS)
const CaseClassificationSettingsId = new ElemID(
  SALESFORCE, MISSING_TYPE_NAME.CASE_CLASSIFICATION_SETTINGS
)
const OrganizationSettingsDetailId = new ElemID(
  SALESFORCE, MISSING_SUBTYPE_NAMES.ORGANIZATION_SETTINGS_DETAIL
)


type RestrictedNumberName = 'TextLength' | 'TextAreaLength' | 'EncryptedTextLength'
   | 'Precision' | 'Scale' | 'LocationScale' | 'LongTextAreaVisibleLines'
   | 'MultiPicklistVisibleLines' | 'RichTextAreaVisibleLines' | 'RelationshipOrder'

const restrictedNumber = (name: RestrictedNumberName, min: number, max: number, enforce = true):
 Record<string, PrimitiveType> => ({
  [name]: new PrimitiveType({
    elemID: new ElemID(SALESFORCE, name),
    primitive: PrimitiveTypes.NUMBER,
    annotations: {
      [CORE_ANNOTATIONS.RESTRICTION]: {
        [RESTRICTION_ANNOTATIONS.ENFORCE_VALUE]: enforce,
        [RESTRICTION_ANNOTATIONS.MIN]: min,
        [RESTRICTION_ANNOTATIONS.MAX]: max,
      },
    },
  }),
})

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
    annotations: {
      [API_NAME]: 'FilterItem',
    },
  })

  private static lookupFilterElemID = new ElemID(SALESFORCE, ANNOTATION_TYPE_NAMES.LOOKUP_FILTER)
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
        new ListType(Types.filterItemType), {},
      ),
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
      [VALUE_SETTINGS_FIELDS.VALUE_NAME]: new TypeField(
        Types.valueSettingsElemID, VALUE_SETTINGS_FIELDS.VALUE_NAME, BuiltinTypes.STRING
      ),
      [VALUE_SETTINGS_FIELDS.CONTROLLING_FIELD_VALUE]: new TypeField(
        Types.valueSettingsElemID, VALUE_SETTINGS_FIELDS.CONTROLLING_FIELD_VALUE,
        new ListType(BuiltinTypes.STRING), {},
      ),
    },
    annotations: {
      [API_NAME]: 'ValueSettings',
    },
  })

  private static valueSetElemID = new ElemID(SALESFORCE, FIELD_ANNOTATIONS.VALUE_SET)
  private static valueSetType = new ObjectType({
    elemID: Types.valueSetElemID,
    fields: {
      [CUSTOM_VALUE.FULL_NAME]: new TypeField(
        Types.valueSetElemID, CUSTOM_VALUE.FULL_NAME,
        BuiltinTypes.STRING,
      ),
      [CUSTOM_VALUE.LABEL]: new TypeField(
        Types.valueSetElemID, CUSTOM_VALUE.LABEL,
        BuiltinTypes.STRING,
      ),
      [CUSTOM_VALUE.DEFAULT]: new TypeField(
        Types.valueSetElemID, CUSTOM_VALUE.DEFAULT,
        BuiltinTypes.BOOLEAN,
      ),
      [CUSTOM_VALUE.IS_ACTIVE]: new TypeField(
        Types.valueSetElemID, CUSTOM_VALUE.IS_ACTIVE,
        BuiltinTypes.BOOLEAN,
      ),
      [CUSTOM_VALUE.COLOR]: new TypeField(
        Types.valueSetElemID, CUSTOM_VALUE.COLOR,
        BuiltinTypes.STRING,
      ),
    },
  })

  private static fieldDependencyElemID = new ElemID(
    SALESFORCE, ANNOTATION_TYPE_NAMES.FIELD_DEPENDENCY,
  )

  private static fieldDependencyType = new ObjectType({
    elemID: Types.fieldDependencyElemID,
    fields: {
      [FIELD_DEPENDENCY_FIELDS.CONTROLLING_FIELD]: new TypeField(
        Types.fieldDependencyElemID, FIELD_DEPENDENCY_FIELDS.CONTROLLING_FIELD, BuiltinTypes.STRING
      ),
      [FIELD_DEPENDENCY_FIELDS.VALUE_SETTINGS]: new TypeField(
        Types.fieldDependencyElemID, FIELD_DEPENDENCY_FIELDS.VALUE_SETTINGS,
        new ListType(Types.valueSettingsType), {},
      ),
    },
  })

  private static rollupSummaryOperationTypeElemID = new ElemID(SALESFORCE,
    FIELD_ANNOTATIONS.SUMMARY_OPERATION)

  private static rollupSummaryOperationType = new PrimitiveType({
    elemID: Types.rollupSummaryOperationTypeElemID,
    primitive: PrimitiveTypes.STRING,
    annotations: {
      [CORE_ANNOTATIONS.RESTRICTION]: { [RESTRICTION_ANNOTATIONS.ENFORCE_VALUE]: true },
      [CORE_ANNOTATIONS.VALUES]: ['count', 'min', 'max', 'sum'],
    },
  })

  private static rollupSummaryFilterOperationTypeElemID = new ElemID(SALESFORCE,
    FIELD_ANNOTATIONS.SUMMARY_FILTER_ITEMS, 'type', FILTER_ITEM_FIELDS.OPERATION)

  private static rollupSummaryFilterOperationTypeType = new PrimitiveType({
    elemID: Types.rollupSummaryFilterOperationTypeElemID,
    primitive: PrimitiveTypes.STRING,
    annotations: {
      [CORE_ANNOTATIONS.RESTRICTION]: { [RESTRICTION_ANNOTATIONS.ENFORCE_VALUE]: true },
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

  private static encryptedTextMaskTypeTypeElemID = new ElemID(SALESFORCE,
    FIELD_ANNOTATIONS.MASK_TYPE, 'type')

  private static encryptedTextMaskTypeType = new PrimitiveType({
    elemID: Types.encryptedTextMaskTypeTypeElemID,
    primitive: PrimitiveTypes.STRING,
    annotations: {
      [CORE_ANNOTATIONS.RESTRICTION]: { [RESTRICTION_ANNOTATIONS.ENFORCE_VALUE]: true },
      [CORE_ANNOTATIONS.VALUES]: ['all', 'creditCard', 'ssn', 'lastFour', 'sin', 'nino'],
    },
  })

  private static encryptedTextMaskCharTypeElemID = new ElemID(SALESFORCE,
    FIELD_ANNOTATIONS.MASK_CHAR, 'type')

  private static encryptedTextMaskCharType = new PrimitiveType({
    elemID: Types.encryptedTextMaskCharTypeElemID,
    primitive: PrimitiveTypes.STRING,
    annotations: {
      [CORE_ANNOTATIONS.RESTRICTION]: { [RESTRICTION_ANNOTATIONS.ENFORCE_VALUE]: true },
      [CORE_ANNOTATIONS.VALUES]: ['X', 'asterisk'],
    },
  })

  private static BusinessStatusTypeElemID = new ElemID(SALESFORCE, BUSINESS_STATUS)

  private static BusinessStatusType = new PrimitiveType({
    elemID: Types.BusinessStatusTypeElemID,
    primitive: PrimitiveTypes.STRING,
    annotations: {
      [CORE_ANNOTATIONS.RESTRICTION]: { [RESTRICTION_ANNOTATIONS.ENFORCE_VALUE]: true },
      [CORE_ANNOTATIONS.VALUES]: ['Active', 'DeprecateCandidate', 'Hidden'],
    },
  })

  private static SecurityClassificationTypeElemID = new ElemID(SALESFORCE, SECURITY_CLASSIFICATION)

  private static SecurityClassificationType = new PrimitiveType({
    elemID: Types.SecurityClassificationTypeElemID,
    primitive: PrimitiveTypes.STRING,
    annotations: {
      [CORE_ANNOTATIONS.RESTRICTION]: { [RESTRICTION_ANNOTATIONS.ENFORCE_VALUE]: true },
      [CORE_ANNOTATIONS.VALUES]: [
        'Public', 'Internal', 'Confidential', 'Restricted', 'MissionCritical',
      ],
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
      [CORE_ANNOTATIONS.RESTRICTION]: { [RESTRICTION_ANNOTATIONS.ENFORCE_VALUE]: true },
      [CORE_ANNOTATIONS.VALUES]: [
        'BlankAsBlank', 'BlankAsZero',
      ],
    },
  })

  private static restrictedNumberTypes: Record<RestrictedNumberName, PrimitiveType> = _.merge(
    restrictedNumber('TextLength', 1, 255, false),
    restrictedNumber('TextAreaLength', 1, 131072),
    restrictedNumber('EncryptedTextLength', 1, 175),
    restrictedNumber('Precision', 1, 18, false),
    restrictedNumber('Scale', 0, 17),
    restrictedNumber('LocationScale', 0, 15),
    restrictedNumber('LongTextAreaVisibleLines', 2, 50),
    restrictedNumber('MultiPicklistVisibleLines', 3, 10, false),
    restrictedNumber('RichTextAreaVisibleLines', 10, 50),
    restrictedNumber('RelationshipOrder', 0, 1),
  )

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
  }

  // Type mapping for custom objects
  public static primitiveDataTypes: Record<FIELD_TYPE_NAMES, PrimitiveType> = {
    Text: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.TEXT),
      primitive: PrimitiveTypes.STRING,
      annotationTypes: {
        ...Types.commonAnnotationTypes,
        [FIELD_ANNOTATIONS.UNIQUE]: BuiltinTypes.BOOLEAN,
        [FIELD_ANNOTATIONS.EXTERNAL_ID]: BuiltinTypes.BOOLEAN,
        [FIELD_ANNOTATIONS.CASE_SENSITIVE]: BuiltinTypes.BOOLEAN,
        [FIELD_ANNOTATIONS.LENGTH]: Types.restrictedNumberTypes.TextLength,
        [DEFAULT_VALUE_FORMULA]: BuiltinTypes.STRING,
      },
    }),
    Number: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.NUMBER),
      primitive: PrimitiveTypes.NUMBER,
      annotationTypes: {
        ...Types.commonAnnotationTypes,
        [FIELD_ANNOTATIONS.SCALE]: Types.restrictedNumberTypes.Scale,
        [FIELD_ANNOTATIONS.PRECISION]: Types.restrictedNumberTypes.Precision,
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
        [FIELD_ANNOTATIONS.SCALE]: Types.restrictedNumberTypes.Scale,
        [FIELD_ANNOTATIONS.PRECISION]: Types.restrictedNumberTypes.Precision,
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
        [FIELD_ANNOTATIONS.VISIBLE_LINES]: Types.restrictedNumberTypes.MultiPicklistVisibleLines,
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
        [FIELD_ANNOTATIONS.SCALE]: Types.restrictedNumberTypes.Scale,
        [FIELD_ANNOTATIONS.PRECISION]: Types.restrictedNumberTypes.Precision,
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
        [FIELD_ANNOTATIONS.VISIBLE_LINES]: Types.restrictedNumberTypes.LongTextAreaVisibleLines,
        [FIELD_ANNOTATIONS.LENGTH]: Types.restrictedNumberTypes.TextAreaLength,
        [DEFAULT_VALUE_FORMULA]: BuiltinTypes.STRING,
      },
    }),
    Html: new PrimitiveType({
      elemID: new ElemID(SALESFORCE, FIELD_TYPE_NAMES.RICHTEXTAREA),
      primitive: PrimitiveTypes.STRING,
      annotationTypes: {
        ...Types.commonAnnotationTypes,
        [FIELD_ANNOTATIONS.VISIBLE_LINES]: Types.restrictedNumberTypes.RichTextAreaVisibleLines,
        [FIELD_ANNOTATIONS.LENGTH]: Types.restrictedNumberTypes.TextAreaLength,
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
        [FIELD_ANNOTATIONS.LENGTH]: Types.restrictedNumberTypes.EncryptedTextLength,
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
        [FIELD_ANNOTATIONS.RELATIONSHIP_ORDER]: Types.restrictedNumberTypes.RelationshipOrder,
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

  public static missingTypes: Record<MISSING_TYPE_NAME, ObjectType> = {
    CaseClassificationSettings: new ObjectType({
      elemID: CaseClassificationSettingsId,
      fields: {
        [CASE_CLASSIFICATION_SETTINGS.CASE_CLASSIFICATION_RECOMMENDATIONS]: new TypeField(
          CaseClassificationSettingsId,
          CASE_CLASSIFICATION_SETTINGS.CASE_CLASSIFICATION_RECOMMENDATIONS,
          BuiltinTypes.STRING
        ),
      },
    }),
    AccountInsightsSettings: new ObjectType({
      elemID: AccountInsightsSettingsId,
      fields: {
        [ACCOUNT_INSIGHT_SETTINGS.ENABLE_ACCOUNT_INSIGHTS]: new TypeField(
          AccountInsightsSettingsId,
          ACCOUNT_INSIGHT_SETTINGS.ENABLE_ACCOUNT_INSIGHTS,
          BuiltinTypes.BOOLEAN
        ),
      },
    }),
    AccountIntelligenceSettings: new ObjectType({
      elemID: AccountIntelligenceSettingsId,
      fields: {
        [ACCOUNT_INTELLIGENCE_SETTINGS.ENABLE_ACCOUNT_LOGOS]: new TypeField(
          AccountIntelligenceSettingsId,
          ACCOUNT_INTELLIGENCE_SETTINGS.ENABLE_ACCOUNT_LOGOS,
          BuiltinTypes.BOOLEAN
        ),
        [ACCOUNT_INTELLIGENCE_SETTINGS.ENABLE_AUTOMATED_ACCOUNT_FIELDS]: new TypeField(
          AccountIntelligenceSettingsId,
          ACCOUNT_INTELLIGENCE_SETTINGS.ENABLE_AUTOMATED_ACCOUNT_FIELDS,
          BuiltinTypes.BOOLEAN
        ),
        [ACCOUNT_INTELLIGENCE_SETTINGS.ENABLE_NEWS_STORIES]: new TypeField(
          AccountIntelligenceSettingsId,
          ACCOUNT_INTELLIGENCE_SETTINGS.ENABLE_NEWS_STORIES,
          BuiltinTypes.BOOLEAN
        ),
      },
    }),
    AutomatedContactsSettings: new ObjectType({
      elemID: AutomatedContactsSettingsId,
      fields: {
        [AUTOMATED_CONTACTS_SETTINGS.ENABLE_ADD_CONTACT_AUTOMATICALLY]: new TypeField(
          AutomatedContactsSettingsId,
          AUTOMATED_CONTACTS_SETTINGS.ENABLE_ADD_CONTACT_AUTOMATICALLY,
          BuiltinTypes.BOOLEAN
        ),
        [AUTOMATED_CONTACTS_SETTINGS.ENABLE_ADD_CONTACT_ROLE_AUTOMATICALLY]: new TypeField(
          AutomatedContactsSettingsId,
          AUTOMATED_CONTACTS_SETTINGS.ENABLE_ADD_CONTACT_ROLE_AUTOMATICALLY,
          BuiltinTypes.BOOLEAN
        ),
        [AUTOMATED_CONTACTS_SETTINGS.ENABLE_ADD_CONTACT_ROLE_WITH_SUGGESTION]: new TypeField(
          AutomatedContactsSettingsId,
          AUTOMATED_CONTACTS_SETTINGS.ENABLE_ADD_CONTACT_ROLE_WITH_SUGGESTION,
          BuiltinTypes.BOOLEAN
        ),
        [AUTOMATED_CONTACTS_SETTINGS.ENABLE_ADD_CONTACT_WITH_SUGGESTION]: new TypeField(
          AutomatedContactsSettingsId,
          AUTOMATED_CONTACTS_SETTINGS.ENABLE_ADD_CONTACT_WITH_SUGGESTION,
          BuiltinTypes.BOOLEAN
        ),
      },
    }),
    ChatterAnswersSettings: new ObjectType({
      elemID: ChatterAnswersSettingsId,
      fields: {
        [CHATTER_ANSWERS_SETTINGS.EMAIL_FOLLOWERS_ON_BEST_ANSWER]: new TypeField(
          ChatterAnswersSettingsId,
          CHATTER_ANSWERS_SETTINGS.EMAIL_FOLLOWERS_ON_BEST_ANSWER,
          BuiltinTypes.BOOLEAN
        ),
        [CHATTER_ANSWERS_SETTINGS.EMAIL_FOLLOWERS_ON_REPLY]: new TypeField(
          ChatterAnswersSettingsId,
          CHATTER_ANSWERS_SETTINGS.EMAIL_FOLLOWERS_ON_REPLY,
          BuiltinTypes.BOOLEAN
        ),
        [CHATTER_ANSWERS_SETTINGS.EMAIL_OWNER_ON_PRIVATE_REPLY]: new TypeField(
          ChatterAnswersSettingsId,
          CHATTER_ANSWERS_SETTINGS.EMAIL_OWNER_ON_PRIVATE_REPLY,
          BuiltinTypes.BOOLEAN
        ),
        [CHATTER_ANSWERS_SETTINGS.EMAIL_OWNER_ON_REPLY]: new TypeField(
          ChatterAnswersSettingsId,
          CHATTER_ANSWERS_SETTINGS.EMAIL_OWNER_ON_REPLY,
          BuiltinTypes.BOOLEAN
        ),
        [CHATTER_ANSWERS_SETTINGS.ENABLE_ANSWER_VIA_EMAIL]: new TypeField(
          ChatterAnswersSettingsId,
          CHATTER_ANSWERS_SETTINGS.ENABLE_ANSWER_VIA_EMAIL,
          BuiltinTypes.BOOLEAN
        ),
        [CHATTER_ANSWERS_SETTINGS.ENABLE_ANSWER_VIA_EMAIL]: new TypeField(
          ChatterAnswersSettingsId,
          CHATTER_ANSWERS_SETTINGS.ENABLE_ANSWER_VIA_EMAIL,
          BuiltinTypes.BOOLEAN
        ),
        [CHATTER_ANSWERS_SETTINGS.ENABLE_CHATTER_ANSWERS]: new TypeField(
          ChatterAnswersSettingsId,
          CHATTER_ANSWERS_SETTINGS.ENABLE_CHATTER_ANSWERS,
          BuiltinTypes.BOOLEAN
        ),
        [CHATTER_ANSWERS_SETTINGS.ENABLE_FACEBOOK_S_S_O]: new TypeField(
          ChatterAnswersSettingsId,
          CHATTER_ANSWERS_SETTINGS.ENABLE_FACEBOOK_S_S_O,
          BuiltinTypes.BOOLEAN
        ),
        [CHATTER_ANSWERS_SETTINGS.ENABLE_INLINE_PUBLISHER]: new TypeField(
          ChatterAnswersSettingsId,
          CHATTER_ANSWERS_SETTINGS.ENABLE_INLINE_PUBLISHER,
          BuiltinTypes.BOOLEAN
        ),
        [CHATTER_ANSWERS_SETTINGS.ENABLE_REPUTATION]: new TypeField(
          ChatterAnswersSettingsId,
          CHATTER_ANSWERS_SETTINGS.ENABLE_REPUTATION,
          BuiltinTypes.BOOLEAN
        ),
        [CHATTER_ANSWERS_SETTINGS.ENABLE_RICH_TEXT_EDITOR]: new TypeField(
          ChatterAnswersSettingsId,
          CHATTER_ANSWERS_SETTINGS.ENABLE_RICH_TEXT_EDITOR,
          BuiltinTypes.BOOLEAN
        ),
        [CHATTER_ANSWERS_SETTINGS.FACEBOOK_AUTH_PROVIDER]: new TypeField(
          ChatterAnswersSettingsId,
          CHATTER_ANSWERS_SETTINGS.FACEBOOK_AUTH_PROVIDER,
          BuiltinTypes.STRING
        ),
        [CHATTER_ANSWERS_SETTINGS.SHOW_IN_PORTALS]: new TypeField(
          ChatterAnswersSettingsId,
          CHATTER_ANSWERS_SETTINGS.SHOW_IN_PORTALS,
          BuiltinTypes.BOOLEAN
        ),
      },
    }),
    ChatterEmailMDSettings: new ObjectType({
      elemID: ChatterEmailMDSettingsId,
      fields: {
        [CHATTER_EMAIL_M_D_SETTINGS.ENABLE_CHATTER_DIGEST_EMAILS_API_ONLY]: new TypeField(
          ChatterEmailMDSettingsId,
          CHATTER_EMAIL_M_D_SETTINGS.ENABLE_CHATTER_DIGEST_EMAILS_API_ONLY,
          BuiltinTypes.BOOLEAN
        ),
        [CHATTER_EMAIL_M_D_SETTINGS.ENABLE_CHATTER_EMAIL_ATTACHMENT]: new TypeField(
          ChatterEmailMDSettingsId,
          CHATTER_EMAIL_M_D_SETTINGS.ENABLE_CHATTER_EMAIL_ATTACHMENT,
          BuiltinTypes.BOOLEAN
        ),
        [CHATTER_EMAIL_M_D_SETTINGS.ENABLE_COLLABORATION_EMAIL]: new TypeField(
          ChatterEmailMDSettingsId,
          CHATTER_EMAIL_M_D_SETTINGS.ENABLE_COLLABORATION_EMAIL,
          BuiltinTypes.BOOLEAN
        ),
        [CHATTER_EMAIL_M_D_SETTINGS.ENABLE_DISPLAY_APP_DOWNLOAD_BADGES]: new TypeField(
          ChatterEmailMDSettingsId,
          CHATTER_EMAIL_M_D_SETTINGS.ENABLE_DISPLAY_APP_DOWNLOAD_BADGES,
          BuiltinTypes.BOOLEAN
        ),
        [CHATTER_EMAIL_M_D_SETTINGS.ENABLE_EMAIL_REPLY_TO_CHATTER]: new TypeField(
          ChatterEmailMDSettingsId,
          CHATTER_EMAIL_M_D_SETTINGS.ENABLE_EMAIL_REPLY_TO_CHATTER,
          BuiltinTypes.BOOLEAN
        ),
        [CHATTER_EMAIL_M_D_SETTINGS.ENABLE_EMAIL_TO_CHATTER]: new TypeField(
          ChatterEmailMDSettingsId,
          CHATTER_EMAIL_M_D_SETTINGS.ENABLE_EMAIL_TO_CHATTER,
          BuiltinTypes.BOOLEAN
        ),
      },
    }),
    HighVelocitySalesSettings: new ObjectType({
      elemID: HighVelocitySalesSettingsId,
      fields: {
        [HIGH_VELOCITY_SALES_SETTINGS.ENABLE_A_C_AUTO_SEND_EMAIL]: new TypeField(
          HighVelocitySalesSettingsId,
          HIGH_VELOCITY_SALES_SETTINGS.ENABLE_A_C_AUTO_SEND_EMAIL,
          BuiltinTypes.BOOLEAN
        ),
        [HIGH_VELOCITY_SALES_SETTINGS.ENABLE_DISPOSITION_CATEGORY]: new TypeField(
          HighVelocitySalesSettingsId,
          HIGH_VELOCITY_SALES_SETTINGS.ENABLE_DISPOSITION_CATEGORY,
          BuiltinTypes.BOOLEAN
        ),
        [HIGH_VELOCITY_SALES_SETTINGS.ENABLE_ENGAGEMENT_WAVE_ANALYTICS_PREF]: new TypeField(
          HighVelocitySalesSettingsId,
          HIGH_VELOCITY_SALES_SETTINGS.ENABLE_ENGAGEMENT_WAVE_ANALYTICS_PREF,
          BuiltinTypes.BOOLEAN
        ),
        [HIGH_VELOCITY_SALES_SETTINGS.ENABLE_HIGH_VELOCITY_SALES]: new TypeField(
          HighVelocitySalesSettingsId,
          HIGH_VELOCITY_SALES_SETTINGS.ENABLE_HIGH_VELOCITY_SALES,
          BuiltinTypes.BOOLEAN
        ),
        [HIGH_VELOCITY_SALES_SETTINGS.ENABLE_HIGH_VELOCITY_SALES_SETUP]: new TypeField(
          HighVelocitySalesSettingsId,
          HIGH_VELOCITY_SALES_SETTINGS.ENABLE_HIGH_VELOCITY_SALES_SETUP,
          BuiltinTypes.BOOLEAN
        ),
      },
    }),
    IoTSettings: new ObjectType({
      elemID: IoTSettingsId,
      fields: {
        [IO_T_SETTINGS.ENABLE_IO_T]: new TypeField(
          IoTSettingsId,
          IO_T_SETTINGS.ENABLE_IO_T,
          BuiltinTypes.BOOLEAN
        ),
      },
    }),
    MapAndLocationSettings: new ObjectType({
      elemID: MapAndLocationSettingsId,
      fields: {
        [MAP_AND_LOCATION_SETTINGS.ENABLE_ADDRESS_AUTO_COMPLETE]: new TypeField(
          MapAndLocationSettingsId,
          MAP_AND_LOCATION_SETTINGS.ENABLE_ADDRESS_AUTO_COMPLETE,
          BuiltinTypes.BOOLEAN
        ),
        [MAP_AND_LOCATION_SETTINGS.ENABLE_MAPS_AND_LOCATION]: new TypeField(
          MapAndLocationSettingsId,
          MAP_AND_LOCATION_SETTINGS.ENABLE_MAPS_AND_LOCATION,
          BuiltinTypes.BOOLEAN
        ),
      },
    }),
    ObjectLinkingSettings: new ObjectType({
      elemID: ObjectLinkingSettingsId,
      fields: {
        [OBJECT_LINKING_SETTINGS.ENABLE_OBJECT_LINKING]: new TypeField(
          ObjectLinkingSettingsId,
          OBJECT_LINKING_SETTINGS.ENABLE_OBJECT_LINKING,
          BuiltinTypes.BOOLEAN
        ),
      },
    }),
    PredictionBuilderSettings: new ObjectType({
      elemID: PredictionBuilderSettingsId,
      fields: {
        [PREDICTION_BUILDER_SETTINGS.ENABLE_PREDICTION_BUILDER]: new TypeField(
          PredictionBuilderSettingsId,
          PREDICTION_BUILDER_SETTINGS.ENABLE_PREDICTION_BUILDER,
          BuiltinTypes.BOOLEAN
        ),
        [PREDICTION_BUILDER_SETTINGS.IS_PREDICTION_BUILDER_STARTED]: new TypeField(
          PredictionBuilderSettingsId,
          PREDICTION_BUILDER_SETTINGS.IS_PREDICTION_BUILDER_STARTED,
          BuiltinTypes.BOOLEAN
        ),
      },
    }),
    SocialCustomerServiceSettings: new ObjectType({
      elemID: SocialCustomerServiceSettingsId,
      fields: {
        [SOCIAL_CUSTOMER_SERVICE_SETTINGS.CASE_SUBJECT_OPTION]: new TypeField(
          SocialCustomerServiceSettingsId,
          SOCIAL_CUSTOMER_SERVICE_SETTINGS.CASE_SUBJECT_OPTION,
          BuiltinTypes.STRING
        ),
        [SOCIAL_CUSTOMER_SERVICE_SETTINGS.ENABLE_SOCIAL_APPROVALS]: new TypeField(
          SocialCustomerServiceSettingsId,
          SOCIAL_CUSTOMER_SERVICE_SETTINGS.ENABLE_SOCIAL_APPROVALS,
          BuiltinTypes.BOOLEAN
        ),
        [SOCIAL_CUSTOMER_SERVICE_SETTINGS.ENABLE_SOCIAL_CASE_ASSIGNMENT_RULES]: new TypeField(
          SocialCustomerServiceSettingsId,
          SOCIAL_CUSTOMER_SERVICE_SETTINGS.ENABLE_SOCIAL_CASE_ASSIGNMENT_RULES,
          BuiltinTypes.BOOLEAN
        ),
        [SOCIAL_CUSTOMER_SERVICE_SETTINGS.ENABLE_SOCIAL_CUSTOMER_SERVICE]: new TypeField(
          SocialCustomerServiceSettingsId,
          SOCIAL_CUSTOMER_SERVICE_SETTINGS.ENABLE_SOCIAL_CUSTOMER_SERVICE,
          BuiltinTypes.BOOLEAN
        ),
        [SOCIAL_CUSTOMER_SERVICE_SETTINGS.ENABLE_SOCIAL_PERSONA_HISTORY_TRACKING]: new TypeField(
          SocialCustomerServiceSettingsId,
          SOCIAL_CUSTOMER_SERVICE_SETTINGS.ENABLE_SOCIAL_PERSONA_HISTORY_TRACKING,
          BuiltinTypes.BOOLEAN
        ),
        [SOCIAL_CUSTOMER_SERVICE_SETTINGS.ENABLE_SOCIAL_POST_HISTORY_TRACKING]: new TypeField(
          SocialCustomerServiceSettingsId,
          SOCIAL_CUSTOMER_SERVICE_SETTINGS.ENABLE_SOCIAL_POST_HISTORY_TRACKING,
          BuiltinTypes.BOOLEAN
        ),
        [SOCIAL_CUSTOMER_SERVICE_SETTINGS.ENABLE_SOCIAL_RECEIVE_PARENT_POST]: new TypeField(
          SocialCustomerServiceSettingsId,
          SOCIAL_CUSTOMER_SERVICE_SETTINGS.ENABLE_SOCIAL_RECEIVE_PARENT_POST,
          BuiltinTypes.BOOLEAN
        ),
      },
    }),
  }

  public static missingSubTypes: Record<MISSING_SUBTYPE_NAMES, ObjectType> = {
    BusinessHoursEntry: new ObjectType({
      elemID: BusinessHoursEntryID,
      fields: {
        [BUSINESS_HOURS_ENTRY.TIME_ZONE_ID]: new TypeField(
          BusinessHoursEntryID, BUSINESS_HOURS_ENTRY.TIME_ZONE_ID, BuiltinTypes.STRING
        ),
        [BUSINESS_HOURS_ENTRY.NAME]: new TypeField(
          BusinessHoursEntryID, BUSINESS_HOURS_ENTRY.NAME, BuiltinTypes.STRING
        ),
        [BUSINESS_HOURS_ENTRY.ACTIVE]: new TypeField(
          BusinessHoursEntryID, BUSINESS_HOURS_ENTRY.ACTIVE, BuiltinTypes.STRING
        ),
        [BUSINESS_HOURS_ENTRY.DEFAULT]: new TypeField(
          BusinessHoursEntryID, BUSINESS_HOURS_ENTRY.DEFAULT, BuiltinTypes.STRING
        ),
        [BUSINESS_HOURS_ENTRY.MONDAY_START_TIME]: new TypeField(
          BusinessHoursEntryID, BUSINESS_HOURS_ENTRY.MONDAY_START_TIME, BuiltinTypes.STRING
        ),
        [BUSINESS_HOURS_ENTRY.MONDAY_END_TIME]: new TypeField(
          BusinessHoursEntryID, BUSINESS_HOURS_ENTRY.MONDAY_END_TIME, BuiltinTypes.STRING
        ),
        [BUSINESS_HOURS_ENTRY.TUESDAY_START_TIME]: new TypeField(
          BusinessHoursEntryID, BUSINESS_HOURS_ENTRY.TUESDAY_START_TIME, BuiltinTypes.STRING
        ),
        [BUSINESS_HOURS_ENTRY.TUESDAY_END_TIME]: new TypeField(
          BusinessHoursEntryID, BUSINESS_HOURS_ENTRY.TUESDAY_END_TIME, BuiltinTypes.STRING
        ),
        [BUSINESS_HOURS_ENTRY.WEDNESDAY_START_TIME]: new TypeField(
          BusinessHoursEntryID, BUSINESS_HOURS_ENTRY.WEDNESDAY_START_TIME, BuiltinTypes.STRING
        ),
        [BUSINESS_HOURS_ENTRY.WEDNESDAY_START_TIME]: new TypeField(
          BusinessHoursEntryID, BUSINESS_HOURS_ENTRY.WEDNESDAY_START_TIME, BuiltinTypes.STRING
        ),
        [BUSINESS_HOURS_ENTRY.WEDNESDAY_END_TIME]: new TypeField(
          BusinessHoursEntryID, BUSINESS_HOURS_ENTRY.WEDNESDAY_END_TIME, BuiltinTypes.STRING
        ),
        [BUSINESS_HOURS_ENTRY.THURSDAY_START_TIME]: new TypeField(
          BusinessHoursEntryID, BUSINESS_HOURS_ENTRY.THURSDAY_START_TIME, BuiltinTypes.STRING
        ),
        [BUSINESS_HOURS_ENTRY.THURSDAY_END_TIME]: new TypeField(
          BusinessHoursEntryID, BUSINESS_HOURS_ENTRY.THURSDAY_END_TIME, BuiltinTypes.STRING
        ),
        [BUSINESS_HOURS_ENTRY.FRIDAY_START_TIME]: new TypeField(
          BusinessHoursEntryID, BUSINESS_HOURS_ENTRY.FRIDAY_START_TIME, BuiltinTypes.STRING
        ),
        [BUSINESS_HOURS_ENTRY.FRIDAY_END_TIME]: new TypeField(
          BusinessHoursEntryID, BUSINESS_HOURS_ENTRY.FRIDAY_END_TIME, BuiltinTypes.STRING
        ),
        [BUSINESS_HOURS_ENTRY.SATURDAY_START_TIME]: new TypeField(
          BusinessHoursEntryID, BUSINESS_HOURS_ENTRY.SATURDAY_START_TIME, BuiltinTypes.STRING
        ),
        [BUSINESS_HOURS_ENTRY.SATURDAY_END_TIME]: new TypeField(
          BusinessHoursEntryID, BUSINESS_HOURS_ENTRY.SATURDAY_END_TIME, BuiltinTypes.STRING
        ),
        [BUSINESS_HOURS_ENTRY.SUNDAY_START_TIME]: new TypeField(
          BusinessHoursEntryID, BUSINESS_HOURS_ENTRY.SUNDAY_START_TIME, BuiltinTypes.STRING
        ),
        [BUSINESS_HOURS_ENTRY.SUNDAY_END_TIME]: new TypeField(
          BusinessHoursEntryID, BUSINESS_HOURS_ENTRY.SUNDAY_END_TIME, BuiltinTypes.STRING
        ),
      },
    }),
    Holidays: new ObjectType({
      elemID: HolidaysId,
      fields: {
        [HOLIDAYS.NAME]: new TypeField(
          HolidaysId, HOLIDAYS.NAME, BuiltinTypes.STRING
        ),
        [HOLIDAYS.DESCRIPTION]: new TypeField(
          HolidaysId, HOLIDAYS.DESCRIPTION, BuiltinTypes.STRING
        ),
        [HOLIDAYS.IS_RECURRING]: new TypeField(
          HolidaysId, HOLIDAYS.IS_RECURRING, BuiltinTypes.STRING
        ),
        [HOLIDAYS.ACTIVITY_DATE]: new TypeField(
          HolidaysId, HOLIDAYS.ACTIVITY_DATE, BuiltinTypes.STRING
        ),
        [HOLIDAYS.RECURRENCE_START_DATE]: new TypeField(
          HolidaysId, HOLIDAYS.RECURRENCE_START_DATE, BuiltinTypes.STRING
        ),
        [HOLIDAYS.RECURRENCE_END_DATE]: new TypeField(
          HolidaysId, HOLIDAYS.RECURRENCE_END_DATE, BuiltinTypes.STRING
        ),
        [HOLIDAYS.START_TIME]: new TypeField(
          HolidaysId, HOLIDAYS.START_TIME, BuiltinTypes.STRING
        ),
        [HOLIDAYS.END_TIME]: new TypeField(
          HolidaysId, HOLIDAYS.END_TIME, BuiltinTypes.STRING
        ),
        [HOLIDAYS.RECURRENCE_TYPE]: new TypeField(
          HolidaysId, HOLIDAYS.RECURRENCE_TYPE, BuiltinTypes.STRING
        ),
        [HOLIDAYS.RECURRENCE_INTERVAL]: new TypeField(
          HolidaysId, HOLIDAYS.RECURRENCE_INTERVAL, BuiltinTypes.STRING
        ),
        [HOLIDAYS.RECURRENCE_DAY_OF_THE_WEEK]: new TypeField(
          HolidaysId, HOLIDAYS.RECURRENCE_DAY_OF_THE_WEEK, BuiltinTypes.STRING
        ),
        [HOLIDAYS.RECURRENCE_DAY_OF_THE_MONTH]: new TypeField(
          HolidaysId, HOLIDAYS.RECURRENCE_DAY_OF_THE_MONTH, BuiltinTypes.STRING
        ),
        [HOLIDAYS.RECURRENCE_INSTANCE]: new TypeField(
          HolidaysId, HOLIDAYS.RECURRENCE_INSTANCE, BuiltinTypes.STRING
        ),
        [HOLIDAYS.RECURRENCE_MONTH_OF_THE_YEAR]: new TypeField(
          HolidaysId, HOLIDAYS.RECURRENCE_MONTH_OF_THE_YEAR, BuiltinTypes.STRING
        ),
        [HOLIDAYS.BUSINESS_HOURS]: new TypeField(
          HolidaysId, HOLIDAYS.BUSINESS_HOURS, BuiltinTypes.STRING
        ),
      },
    }),
    OrganizationSettingsDetail: new ObjectType({
      elemID: OrganizationSettingsDetailId,
      fields: {
        [ORGANIZATION_SETTINGS_DETAIL.SETTING_NAME]: new TypeField(
          OrganizationSettingsDetailId,
          ORGANIZATION_SETTINGS_DETAIL.SETTING_NAME,
          BuiltinTypes.STRING,
          {
            [CORE_ANNOTATIONS.VALUES]: [
              'AnalyticsSharingEnable', 'ApexApprovalLockUnlock', 'ChatterEnabled', 'CompileOnDeploy',
              'ConsentManagementEnabled', 'EnhancedEmailEnabled', 'EventLogWaveIntegEnabled', 'LoginForensicsEnabled',
              'NetworksEnabled', 'NotesReservedPref01', 'OfflineDraftsEnabled', 'PathAssistantsEnabled',
              'S1DesktopEnabled', 'S1EncryptedStoragePref2', 'S1OfflinePref', 'ScratchOrgManagementPref',
              'SendThroughGmailPref', 'SocialProfilesEnable', 'Translation',
            ],
          }
        ),
        [ORGANIZATION_SETTINGS_DETAIL.SETTING_VALUE]: new TypeField(
          OrganizationSettingsDetailId,
          ORGANIZATION_SETTINGS_DETAIL.SETTING_VALUE,
          BuiltinTypes.BOOLEAN
        ),
      },
    }),
  }

  // Type mapping for compound fields
  public static compoundDataTypes: Record<COMPOUND_FIELD_TYPE_NAMES, ObjectType> = {
    Address: new ObjectType({
      elemID: addressElemID,
      fields: {
        [ADDRESS_FIELDS.CITY]: new TypeField(
          addressElemID, ADDRESS_FIELDS.CITY, BuiltinTypes.STRING
        ),
        [ADDRESS_FIELDS.COUNTRY]: new TypeField(
          addressElemID, ADDRESS_FIELDS.COUNTRY, BuiltinTypes.STRING
        ),
        [ADDRESS_FIELDS.GEOCODE_ACCURACY]: new TypeField(
          addressElemID, ADDRESS_FIELDS.GEOCODE_ACCURACY, Types.primitiveDataTypes.Picklist
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
          addressElemID, ADDRESS_FIELDS.STREET, Types.primitiveDataTypes.TextArea
        ),
      },
      annotationTypes: {
        ...Types.commonAnnotationTypes,
      },
    }),
    Name: new ObjectType({
      elemID: nameElemID,
      fields: {
        [NAME_FIELDS.FIRST_NAME]: new TypeField(
          nameElemID, NAME_FIELDS.FIRST_NAME, BuiltinTypes.STRING
        ),
        [NAME_FIELDS.LAST_NAME]: new TypeField(
          nameElemID, NAME_FIELDS.LAST_NAME, BuiltinTypes.STRING
        ),
        [NAME_FIELDS.SALUTATION]: new TypeField(
          nameElemID, NAME_FIELDS.SALUTATION, Types.primitiveDataTypes.Picklist
        ),
      },
      annotationTypes: {
        ...Types.commonAnnotationTypes,
      },
    }),
    Location: new ObjectType({
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
        [FIELD_ANNOTATIONS.SCALE]: Types.restrictedNumberTypes.LocationScale,
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
      ? this.getElemIdFunc(SALESFORCE, serviceIds, bpCase(updatedName))
      : new ElemID(SALESFORCE, bpCase(updatedName))
  }

  static getAllFieldTypes(): TypeElement[] {
    return _.concat(
      Object.values(Types.primitiveDataTypes) as TypeElement[],
      Object.values(Types.compoundDataTypes) as TypeElement[],
      Object.values(Types.formulaDataTypes) as TypeElement[],
    ).map(type => {
      const fieldType = type.clone()
      fieldType.path = [SALESFORCE, TYPES_PATH, 'field_types']
      return fieldType
    })
  }

  static getAllMissingTypes(): TypeElement[] {
    return _.concat(
      (Object.values(Types.missingTypes) as TypeElement[])
        .map(type => {
          const missingType = type.clone()
          missingType.path = [SALESFORCE, TYPES_PATH, type.elemID.name]
          return missingType
        }),
      (Object.values(Types.missingSubTypes) as TypeElement[])
        .map(type => {
          const missingSubType = type.clone()
          missingSubType.path = [SALESFORCE, SUBTYPES_PATH, type.elemID.name]
          return missingSubType
        }),
    )
  }

  static getAnnotationTypes(): TypeElement[] {
    return [Types.fieldDependencyType, Types.rollupSummaryOperationType,
      Types.valueSettingsType, Types.lookupFilterType, Types.filterItemType,
      Types.encryptedTextMaskCharType, Types.encryptedTextMaskTypeType,
      Types.BusinessStatusType, Types.SecurityClassificationType, Types.valueSetType,
      Types.TreatBlankAsType,
      ...Object.values(Types.restrictedNumberTypes),
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
  field: TypeField, fullname = false
): CustomField => {
  const fieldDependency = field.annotations[FIELD_ANNOTATIONS.FIELD_DEPENDENCY]
  const newField = new CustomField(
    apiName(field, !fullname),
    fieldTypeName(field.type.elemID.name),
    field.annotations[CORE_ANNOTATIONS.REQUIRED],
    field.annotations[FIELD_ANNOTATIONS.DEFAULT_VALUE],
    field.annotations[DEFAULT_VALUE_FORMULA],
    field.annotations[FIELD_ANNOTATIONS.VALUE_SET],
    fieldDependency?.[FIELD_DEPENDENCY_FIELDS.CONTROLLING_FIELD],
    fieldDependency?.[FIELD_DEPENDENCY_FIELDS.VALUE_SETTINGS],
    field.annotations[FIELD_ANNOTATIONS.RESTRICTED],
    field.annotations[VALUE_SET_DEFINITION_FIELDS.SORTED],
    field.annotations[VALUE_SET_FIELDS.VALUE_SET_NAME],
    field.annotations[FORMULA],
    field.annotations[FIELD_ANNOTATIONS.SUMMARY_FILTER_ITEMS],
    field.annotations[FIELD_ANNOTATIONS.REFERENCE_TO],
    field.name.split(SALESFORCE_CUSTOM_SUFFIX)[0],
    field.annotations[FIELD_ANNOTATIONS.ALLOW_LOOKUP_RECORD_DELETION]
  )

  // Skip the assignment of the following annotations that are defined as annotationType
  const skiplistedAnnotations: string[] = [
    API_NAME, // used to mark the SERVICE_ID but does not exist in the CustomObject
    FIELD_ANNOTATIONS.ALLOW_LOOKUP_RECORD_DELETION, // handled in the CustomField constructor
    FIELD_ANNOTATIONS.VALUE_SET, // handled in the CustomField constructor
    FIELD_ANNOTATIONS.RESTRICTED, // handled in the CustomField constructor
    VALUE_SET_DEFINITION_FIELDS.SORTED, // handled in the CustomField constructor
    VALUE_SET_FIELDS.VALUE_SET_NAME, // handled in the CustomField constructor
    DEFAULT_VALUE_FORMULA, // handled in the CustomField constructor
    FIELD_ANNOTATIONS.FIELD_DEPENDENCY, // handled in field_dependencies filter
    FIELD_ANNOTATIONS.LOOKUP_FILTER, // handled in lookup_filters filter
  ]
  const isAllowed = (annotationName: string): boolean => (
    Object.keys(field.type.annotationTypes).includes(annotationName)
    && !skiplistedAnnotations.includes(annotationName)
    // Cannot specify label on standard field
    && (annotationName !== LABEL || isCustom(newField.fullName))
  )

  // Convert the annotations' names to the required API name
  _.assign(
    newField,
    _.pickBy(field.annotations, (_val, annotationName) => isAllowed(annotationName)),
  )
  return newField
}

export const toCustomObject = (
  element: ObjectType, includeFields: boolean, skipFields: string[] = [],
): CustomObject => {
  const newCustomObject = new CustomObject(
    apiName(element),
    element.annotations[LABEL],
    includeFields
      ? Object.values(element.fields)
        .map(field => toCustomField(field))
        .filter(field => !skipFields.includes(field.fullName))
      : undefined
  )
  // Skip the assignment of the following annotations that are defined as annotationType
  const skiplistedAnnotations: string[] = [
    API_NAME, // we use it as fullName
    METADATA_TYPE, // internal annotation
    LABEL, // we send it in CustomObject constructor to enable default for pluralLabels
  ]

  const isAllowed = (annotationName: string): boolean => (
    Object.keys(element.annotationTypes).includes(annotationName)
    && !skiplistedAnnotations.includes(annotationName)
  )

  _.assign(
    newCustomObject,
    _.pickBy(element.annotations, (_val, annotationName) => isAllowed(annotationName)),
  )
  return newCustomObject
}

export const getValueTypeFieldElement = (parentID: ElemID, field: ValueTypeField,
  knownTypes: Map<string, TypeElement>): TypeField => {
  const bpFieldType = (field.name === INSTANCE_FULL_NAME_FIELD)
    ? BuiltinTypes.SERVICE_ID
    : knownTypes.get(field.soapType) || Types.get(field.soapType, false)
  // mark required as false until SALTO-45 will be resolved
  const annotations: Values = {
    [CORE_ANNOTATIONS.REQUIRED]: false,
  }

  if (field.picklistValues && field.picklistValues.length > 0) {
    // picklist values in metadata types are used to restrict a field to a list of allowed values
    // because some fields can allow all fields names / all object names this restriction list
    // might be very large and cause memory problems on parsing, so we choose to omit the
    // restriction where there are too many possible values
    if (field.picklistValues.length < MAX_METADATA_RESTRICTION_VALUES) {
      annotations[CORE_ANNOTATIONS.VALUES] = _.sortedUniq(field
        .picklistValues.map(val => val.value).sort())
      annotations[CORE_ANNOTATIONS.RESTRICTION] = { [RESTRICTION_ANNOTATIONS.ENFORCE_VALUE]: false }
    }
    const defaults = field.picklistValues
      .filter(val => val.defaultValue)
      .map(val => val.value)
    if (defaults.length === 1) {
      annotations[CORE_ANNOTATIONS.DEFAULT] = defaults.pop()
    }
  }
  return new TypeField(parentID, field.name, bpFieldType, annotations)
}

type ConvertXsdTypeFunc = (v: string) => PrimitiveValue
const convertXsdTypeFuncMap: Record<string, ConvertXsdTypeFunc> = {
  'xsd:string': String,
  'xsd:boolean': v => v === 'true',
  'xsd:double': Number,
  'xsd:int': Number,
  'xsd:long': Number,
}

export const transformPrimitive: TransformPrimitiveFunc = (val, pathID, field) => {
  // We sometimes get empty strings that we want to filter out
  if (val === '') {
    return undefined
  }
  // Salesforce returns nulls as objects like { $: { 'xsi:nil': 'true' } }
  if ((_.isObject(val) && _.get(val, ['$', 'xsi:nil']) === 'true')) {
    // We transform null to undefined as currently we don't support null in Salto language
    // and the undefined values are omitted later in the code
    return undefined
  }
  // (Salto-394) Salesforce returns objects like:
  // { "_": "fieldValue", "$": { "xsi:type": "xsd:string" } }
  if (_.isObject(val) && Object.keys(val).includes('_')) {
    const convertFunc = convertXsdTypeFuncMap[_.get(val, ['$', 'xsi:type'])] || (v => v)
    return transformPrimitive(convertFunc(_.get(val, '_')), pathID, field)
  }
  switch (field?.type.primitive) {
    case PrimitiveTypes.NUMBER:
      return Number(val)
    case PrimitiveTypes.BOOLEAN:
      return val.toString().toLowerCase() === 'true'
    case PrimitiveTypes.STRING:
      return val.toString().length === 0 ? undefined : val.toString()
    default:
      return val
  }
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
export const getSObjectFieldElement = (parentElemID: ElemID, field: Field,
  parentServiceIds: ServiceIds): TypeField => {
  const fieldApiName = [parentServiceIds[API_NAME], field.name].join(API_NAME_SEPERATOR)
  const serviceIds = {
    [ADAPTER]: SALESFORCE,
    [API_NAME]: fieldApiName,
    [OBJECT_SERVICE_ID]: toServiceIdsString(parentServiceIds),
  }

  const getFieldType = (typeName: string): TypeElement => (
    Types.get(typeName, true, false, serviceIds)
  )

  let bpFieldType = getFieldType(FIELD_SOAP_TYPE_NAMES[field.type])
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
    bpFieldType = getFieldType(FIELD_TYPE_NAMES.AUTONUMBER)
  } else if (field.type === 'string' && !field.compoundFieldName) { // string
    bpFieldType = getFieldType(FIELD_TYPE_NAMES.TEXT)
  } else if ((field.type === 'double' && !field.compoundFieldName)) {
    bpFieldType = getFieldType(FIELD_TYPE_NAMES.NUMBER)
    annotations[FIELD_ANNOTATIONS.PRECISION] = field.precision
    annotations[FIELD_ANNOTATIONS.SCALE] = field.scale
  } else if (field.type === 'int') {
    bpFieldType = getFieldType(FIELD_TYPE_NAMES.NUMBER)
    annotations[FIELD_ANNOTATIONS.PRECISION] = field.digits
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
      bpFieldType = getFieldType(formulaTypeName(bpFieldType.elemID.name as FIELD_TYPE_NAMES))
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
      // e.g. salesforce.user_app_menu_item.ApplicationId, salesforce.login_event.LoginHistoryId
      annotations[FIELD_ANNOTATIONS.REFERENCE_TO] = field.referenceTo
    }
    if (field.filteredLookupInfo) {
      // will be populated in the lookup_filter filter
      annotations[FIELD_ANNOTATIONS.LOOKUP_FILTER] = {}
    }
    // Name Field
  } else if (field.nameField) {
    bpFieldType = Types.compoundDataTypes.Name
  }
  if (!_.isEmpty(bpFieldType.annotationTypes)) {
    // Get the rest of the annotations if their name matches exactly the API response
    // and they are not already assigned
    _.assign(
      annotations,
      _.pick(
        _.omit(field, Object.keys(annotations)),
        Object.keys(bpFieldType.annotationTypes),
      )
    )
  }

  const fieldName = Types.getElemId(field.name, true, serviceIds).name
  return new TypeField(parentElemID, fieldName, bpFieldType, annotations)
}

export const fromMetadataInfo = (info: MetadataInfo): Values => info

export const toMetadataInfo = (fullName: string, values: Values):
  MetadataInfo =>
  ({
    fullName,
    ...values,
  })

export const createInstanceElementFromValues = (values: Values, type: ObjectType,
  namespacePrefix?: string): InstanceElement => {
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
      [INSTANCE_FULL_NAME_FIELD]: fullName,
      [ADAPTER]: SALESFORCE,
      [OBJECT_SERVICE_ID]: toServiceIdsString(typeServiceIds()),
    }
  }

  const typeName = type.elemID.name
  const name = (): string => (
    Types.getElemId(bpCase(fullName), true, instanceServiceIds()).name
  )
  return new InstanceElement(
    type.isSettings ? ElemID.CONFIG_NAME : name(),
    type,
    values,
    [...getPackagePath(), RECORDS_PATH,
      type.isSettings ? SETTINGS_PATH : typeName, bpCase(fullName)],
  )
}

export const createInstanceElement = (value: Values, type: ObjectType,
  namespacePrefix?: string): InstanceElement =>
  createInstanceElementFromValues(value, type, namespacePrefix)

export const createMetadataTypeElements = async (
  objectName: string,
  fields: ValueTypeField[],
  knownTypes: Map<string, TypeElement>,
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
    SALESFORCE,
    TYPES_PATH,
    ...(baseTypeNames.has(objectName) ? [] : [SUBTYPES_PATH]),
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
    .filter(field => field.soapType !== objectName)
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
  const isFieldType = (fieldType: TypeElement) => (field: TypeField): boolean => (
    field.type.elemID.isEqual(fieldType.elemID)
  )
  const handleAddressFields = (object: ObjectType): void => {
    // Find the address fields
    const addressFields = _.pickBy(object.fields, isFieldType(Types.compoundDataTypes.Address))

    // For each address field, get its prefix, then find its corresponding child fields by
    // this prefix.
    Object.keys(addressFields).forEach(key => {
      const addressPrefix = key.replace(/Address/, '')
      Object.values(Types.compoundDataTypes.Address.fields).forEach(childField => {
        const clonedField = childField.clone()
        // Add the child fields to the object type
        const childFieldName = addressPrefix + clonedField.name
        clonedField.name = childFieldName
        clonedField.annotations = {
          [API_NAME]: [apiName(object), childFieldName].join(API_NAME_SEPERATOR),
        }
        object.fields[childFieldName] = clonedField
      })
      // Remove the compound field from the element
      object.fields = _.omit(object.fields, key)
    })
  }

  const handleNameField = (object: ObjectType): void => {
    const compoundNameFieldName = 'Name'
    const compoundNameFieldFullName = 'Full Name'
    // Find the name field
    const nameFields = _.pickBy(object.fields,
      (value, key) => key === compoundNameFieldName
        && value.annotations.label === compoundNameFieldFullName)

    if (_.size(nameFields) === 0) {
      return
    }
    // Add the child fields to the object type
    Object.values(Types.compoundDataTypes.Name.fields).forEach(childField => {
      const clonedField = childField.clone()
      clonedField.annotations = {
        [API_NAME]: [apiName(object), childField.name].join(API_NAME_SEPERATOR),
      }
      object.fields[childField.name] = clonedField
    })
    // Remove the compound field from the element
    object.fields = _.omit(object.fields, compoundNameFieldName)
  }

  const handleGeolocationFields = (object: ObjectType): void => {
    // Find the  geolocation fields
    const locationFields = _.pickBy(object.fields, isFieldType(Types.compoundDataTypes.Location))

    // For each geolocation field, get its name, then find its corresponding child fields by
    // this name.
    Object.keys(locationFields).forEach(key => {
      const keyBaseName = isCustom(key) ? key.slice(0, -SALESFORCE_CUSTOM_SUFFIX.length) : key
      Object.values(Types.compoundDataTypes.Location.fields).forEach(childField => {
        const clonedField = childField.clone()
        // Add the child fields to the object type
        const childFieldName = `${keyBaseName}__${clonedField.name}`
        clonedField.name = childFieldName
        clonedField.annotations = {
          [API_NAME]: `${[apiName(object), childFieldName].join(API_NAME_SEPERATOR)}${isCustom(key) ? '__s' : ''}`,
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

export const getLookUpName = (refValue: Value): Value => {
  if (isElement(refValue)) {
    return apiName(refValue)
  }
  return refValue
}
