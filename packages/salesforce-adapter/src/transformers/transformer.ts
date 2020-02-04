import _ from 'lodash'
import {
  ValueTypeField, Field, MetadataInfo, DefaultValueWithType, QueryResult,
  Record as SfRecord, PicklistEntry,
} from 'jsforce'
import {
  TypeElement, ObjectType, ElemID, PrimitiveTypes, PrimitiveType, Values, Value,
  BuiltinTypes, Element, isInstanceElement, InstanceElement, isPrimitiveType, ElemIdGetter,
  ServiceIds, toServiceIdsString, OBJECT_SERVICE_ID, ADAPTER, CORE_ANNOTATIONS,
  ReferenceExpression, isElement, PrimitiveValue, RESTRICTION_ANNOTATIONS,
  Field as TypeField, TypeMap, TransformValueFunc,
} from 'adapter-api'
import { collections } from '@salto/lowerdash'
import { CustomObject, CustomField } from '../client/types'
import {
  API_NAME, CUSTOM_OBJECT, LABEL, SALESFORCE, FORMULA, FIELD_TYPE_NAMES,
  METADATA_TYPE, FIELD_ANNOTATIONS, SALESFORCE_CUSTOM_SUFFIX, DEFAULT_VALUE_FORMULA,
  LOOKUP_FILTER_FIELDS, ADDRESS_FIELDS, NAME_FIELDS, GEOLOCATION_FIELDS, INSTANCE_FULL_NAME_FIELD,
  FIELD_LEVEL_SECURITY_ANNOTATION, FIELD_LEVEL_SECURITY_FIELDS, FIELD_DEPENDENCY_FIELDS,
  VALUE_SETTINGS_FIELDS, FILTER_ITEM_FIELDS, OBJECT_LEVEL_SECURITY_ANNOTATION,
  OBJECT_LEVEL_SECURITY_FIELDS, DESCRIPTION, HELP_TEXT, BUSINESS_STATUS, FORMULA_TYPE_NAME,
  SECURITY_CLASSIFICATION, BUSINESS_OWNER_GROUP, BUSINESS_OWNER_USER, COMPLIANCE_GROUP,
  CUSTOM_VALUE, API_NAME_SEPERATOR, MAX_METADATA_RESTRICTION_VALUES,
  VALUE_SET_FIELDS, COMPOUND_FIELD_TYPE_NAMES, ANNOTATION_TYPE_NAMES, FIELD_SOAP_TYPE_NAMES,
  RECORDS_PATH, SETTINGS_PATH, TYPES_PATH, SUBTYPES_PATH, INSTALLED_PACKAGES_PATH,
  CUSTOM_OBJECT_INDEPENDENT_ANNOTATIONS,
  VALUE_SET_DEFINITION_FIELDS,
} from '../constants'
import SalesforceClient from '../client/client'

const { makeArray } = collections.array

export const bpCase = (name?: string): string => (
  // unescape changes HTML escaped parts (&gt; for example), then the regex
  // replaces url escaped chars as well as any special character to keep names blueprint friendly
  // Match multiple consecutive chars to compact names and avoid repeated _
  name ? _.unescape(name).replace(/((%[0-9A-F]{2})|[^\w\d])+/g, '_') : ''
)

export const metadataType = (element: Element): string => (
  isInstanceElement(element)
    ? metadataType(element.type)
    : element.annotations[METADATA_TYPE] || CUSTOM_OBJECT
)

export const isCustomObject = (element: Element): boolean =>
  metadataType(element) === CUSTOM_OBJECT

export const defaultApiName = (element: Element): string => {
  const { name } = element.elemID
  return name.endsWith(SALESFORCE_CUSTOM_SUFFIX) || isInstanceElement(element)
    ? name
    : `${name}${SALESFORCE_CUSTOM_SUFFIX}`
}

export const apiName = (elem: Element, relative = false): string => {
  if (isInstanceElement(elem)) {
    return elem.value[INSTANCE_FULL_NAME_FIELD]
  }
  const elemMetadataType = metadataType(elem)
  const name = elemMetadataType === CUSTOM_OBJECT
    ? elem.annotations[API_NAME] ?? elem.annotations[METADATA_TYPE]
    : elemMetadataType
  return name && relative ? _.last(name.split(API_NAME_SEPERATOR)) : name
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
        Types.filterItemType, {}, true
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
        BuiltinTypes.STRING, {}, true
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
    restrictedNumber('Precision', 1, 18),
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
    [FIELD_LEVEL_SECURITY_ANNOTATION]: Types.fieldLevelSecurityType,
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
        [DEFAULT_VALUE_FORMULA]: BuiltinTypes.NUMBER,
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
        [DEFAULT_VALUE_FORMULA]: BuiltinTypes.NUMBER,
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
        [DEFAULT_VALUE_FORMULA]: BuiltinTypes.NUMBER,
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
    return (customObject && this.getElemIdFunc && serviceIds)
      ? (this.getElemIdFunc as ElemIdGetter)(SALESFORCE, serviceIds as ServiceIds, bpCase(name))
      : new ElemID(SALESFORCE, bpCase(name))
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

  static getAnnotationTypes(): TypeElement[] {
    return [Types.fieldLevelSecurityType, Types.fieldDependencyType,
      Types.rollupSummaryOperationType, Types.objectLevelSecurityType,
      Types.valueSettingsType, Types.lookupFilterType, Types.filterItemType,
      Types.encryptedTextMaskCharType, Types.encryptedTextMaskTypeType,
      Types.BusinessStatusType, Types.SecurityClassificationType, Types.valueSetType,
      Types.TreatBlankAsType,
      ...Object.values(Types.restrictedNumberTypes),
    ]
      .map(type => {
        const fieldType = type.clone()
        fieldType.path = [SALESFORCE, TYPES_PATH, 'annotation_types']
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
    field.annotations[LABEL],
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
  const blacklistedAnnotations: string[] = [
    API_NAME, // used to mark the SERVICE_ID but does not exist in the CustomObject
    FIELD_ANNOTATIONS.ALLOW_LOOKUP_RECORD_DELETION, // handled in the CustomField constructor
    FIELD_ANNOTATIONS.VALUE_SET, // handled in the CustomField constructor
    FIELD_ANNOTATIONS.RESTRICTED, // handled in the CustomField constructor
    VALUE_SET_DEFINITION_FIELDS.SORTED, // handled in the CustomField constructor
    VALUE_SET_FIELDS.VALUE_SET_NAME, // handled in the CustomField constructor
    DEFAULT_VALUE_FORMULA, // handled in the CustomField constructor
    FIELD_ANNOTATIONS.FIELD_DEPENDENCY, // handled in field_dependencies filter
    FIELD_ANNOTATIONS.LOOKUP_FILTER, // handled in lookup_filters filter
    FIELD_LEVEL_SECURITY_ANNOTATION,
  ]
  const isAllowed = (annotationName: string): boolean => (
    Object.keys(field.type.annotationTypes).includes(annotationName)
    && !blacklistedAnnotations.includes(annotationName)
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
  const blacklistedAnnotations: string[] = [
    API_NAME, // we use it as fullName
    METADATA_TYPE, // internal annotation
    LABEL, // we send it in CustomObject constructor to enable default for pluralLabels
    ...Object.values(CUSTOM_OBJECT_INDEPENDENT_ANNOTATIONS), // done in custom_objects filter
  ]

  const isAllowed = (annotationName: string): boolean => (
    Object.keys(element.annotationTypes).includes(annotationName)
    && !blacklistedAnnotations.includes(annotationName)
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

export const transformPrimitive: TransformValueFunc = (val, field) => {
  const fieldType = field.type
  if (!isPrimitiveType(fieldType)) {
    return val
  }
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
    return transformPrimitive(convertFunc(_.get(val, '_')), field)
  }
  switch (fieldType.primitive) {
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
export const getSObjectFieldElement = (parent: Element, field: Field,
  parentServiceIds: ServiceIds): TypeField => {
  const fieldApiName = [apiName(parent), field.name].join(API_NAME_SEPERATOR)
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
      // e.g. salesforce_user_app_menu_item.ApplicationId, salesforce_login_event.LoginHistoryId
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
  return new TypeField(parent.elemID, fieldName, bpFieldType, annotations)
}

export const fromMetadataInfo = (info: MetadataInfo): Values => info

export const toMetadataInfo = (fullName: string, values: Values):
  MetadataInfo =>
  ({
    fullName,
    ...values,
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
      [INSTANCE_FULL_NAME_FIELD]: mdInfo.fullName,
      [ADAPTER]: SALESFORCE,
      [OBJECT_SERVICE_ID]: toServiceIdsString(typeServiceIds()),
    }
  }

  const typeName = type.elemID.name
  const name = (): string => (
    Types.getElemId(bpCase(mdInfo.fullName), true, instanceServiceIds()).name
  )
  return new InstanceElement(
    type.isSettings ? ElemID.CONFIG_NAME : name(),
    type,
    fromMetadataInfo(mdInfo),
    [...getPackagePath(), RECORDS_PATH,
      type.isSettings ? SETTINGS_PATH : typeName, bpCase(mdInfo.fullName)],
  )
}


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
      const isCustomField = key.endsWith(SALESFORCE_CUSTOM_SUFFIX)
      const keyBaseName = isCustomField ? key.slice(0, -SALESFORCE_CUSTOM_SUFFIX.length) : key
      Object.values(Types.compoundDataTypes.Location.fields).forEach(childField => {
        const clonedField = childField.clone()
        // Add the child fields to the object type
        const childFieldName = `${keyBaseName}__${clonedField.name}`
        clonedField.name = childFieldName
        clonedField.annotations = {
          [API_NAME]: `${[apiName(object), childFieldName].join(API_NAME_SEPERATOR)}${isCustomField ? '__s' : ''}`,
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

const getLookUpName = (refValue: Value): Value => {
  if (isElement(refValue)) {
    return apiName(refValue)
  }
  return refValue
}

export const transformReferences = <T extends Element>(element: T): T => {
  const refReplacer = (value: Value): Value => {
    if (value instanceof ReferenceExpression) return getLookUpName(value.value)
    if (isElement(value)) return transformReferences(value)
    return undefined
  }
  return _.mergeWith(element.clone(), element, refReplacer)
}

export const restoreReferences = <T extends Element>(orig: T, modified: T): T => {
  const resResotrer = (obj: Value, src: Value): Value => {
    if (isElement(obj) && isElement(src)) {
      return restoreReferences(obj, src)
    }
    if (obj instanceof ReferenceExpression && !(src instanceof ReferenceExpression)) {
      return (getLookUpName(obj.value) === src) ? obj : src
    }
    return undefined
  }

  return _.mergeWith(orig.clone(), modified, resResotrer)
}
