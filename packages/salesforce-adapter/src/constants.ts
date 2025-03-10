/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { client as clientUtils } from '@salto-io/adapter-components'
import { types } from '@salto-io/lowerdash'
import _ from 'lodash'
import {
  ActionName,
  BuiltinTypes,
  CORE_ANNOTATIONS,
  ElemID,
  ListType,
  MapType,
  ObjectType,
} from '@salto-io/adapter-api'

export const { RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS } = clientUtils

export const UNIX_TIME_ZERO_STRING = '1970-01-01T00:00:00.000Z'

// Adapter name
export const SALESFORCE = 'salesforce'

// Service constants
export const CUSTOM_FIELD = 'CustomField'
export const CUSTOM_OBJECT = 'CustomObject'
export const INSTANCE_FULL_NAME_FIELD = 'fullName'
export const METADATA_CONTENT_FIELD = 'content'
export const FORMULA_TYPE_NAME = 'Formula'
export const SALESFORCE_CUSTOM_SUFFIX = '__c'
export const SALESFORCE_BIG_OBJECT_SUFFIX = '__b'
export const CUSTOM_METADATA_SUFFIX = '__mdt'
export const GLOBAL_VALUE_SET_SUFFIX = '__gvs'
export const ADMIN_PROFILE = 'Admin'
export const NAMESPACE_SEPARATOR = '__'
export const API_NAME_SEPARATOR = '.'
export const CUSTOM_OBJECT_ID_FIELD = 'Id'

// Internal constants
export const INTERNAL_ID_FIELD = 'internalId'
export const XML_ATTRIBUTE_PREFIX = 'attr_'
export const DEFAULT_NAMESPACE = 'standard'
export const SALESFORCE_DATE_PLACEHOLDER = '1970-01-01T00:00:00.000Z'

export const DEFAULT_FLS_PROFILES = [ADMIN_PROFILE]

export enum FIELD_TYPE_NAMES {
  AUTONUMBER = 'AutoNumber',
  TEXT = 'Text',
  NUMBER = 'Number',
  PERCENT = 'Percent',
  CHECKBOX = 'Checkbox',
  DATE = 'Date',
  TIME = 'Time',
  DATETIME = 'DateTime',
  CURRENCY = 'Currency',
  PICKLIST = 'Picklist',
  MULTIPICKLIST = 'MultiselectPicklist',
  EMAIL = 'Email',
  PHONE = 'Phone',
  LONGTEXTAREA = 'LongTextArea',
  RICHTEXTAREA = 'Html',
  TEXTAREA = 'TextArea',
  ENCRYPTEDTEXT = 'EncryptedText',
  URL = 'Url',
  LOOKUP = 'Lookup',
  MASTER_DETAIL = 'MasterDetail',
  ROLLUP_SUMMARY = 'Summary',
  HIERARCHY = 'Hierarchy',
  METADATA_RELATIONSHIP = 'MetadataRelationship',
  EXTERNAL_LOOKUP = 'ExternalLookup',
  INDIRECT_LOOKUP = 'IndirectLookup',
  FILE = 'File',
}

// FlexiPage constants
export const UI_FORMULA_CRITERION = 'UiFormulaCriterion'
export const UI_FORMULA_RULE = 'UiFormulaRule'
export const COMPONENT_INSTANCE_PROPERTY = 'ComponentInstanceProperty'
export const COMPONENT_INSTANCE = 'ComponentInstance'
export const FIELD_INSTANCE = 'FieldInstance'
export const ITEM_INSTANCE = 'ItemInstance'
export const FLEXI_PAGE_REGION = 'flexiPageRegion'
export enum UI_FORMULA_CRITERION_FIELD_NAMES {
  LEFT_VALUE = 'leftValue',
}
export enum UI_FORMULA_RULE_FIELD_NAMES {
  CRITERIA = 'criteria',
}
export enum COMPONENT_INSTANCE_PROPERTY_FIELD_NAMES {
  VALUE = 'value',
}
export enum FIELD_INSTANCE_FIELD_NAMES {
  VISIBILITY_RULE = 'visibilityRule',
}
export enum COMPONENT_INSTANCE_FIELD_NAMES {
  COMPONENT_INSTANCE_PROPERTIES = 'componentInstanceProperties',
  VISIBILITY_RULE = 'visibilityRule',
}
export enum ITEM_INSTANCE_FIELD_NAMES {
  COMPONENT = 'componentInstance',
  FIELD = 'fieldInstance',
}
export enum FLEXI_PAGE_REGION_FIELD_NAMES {
  COMPONENT_INSTANCES = 'componentInstances',
  ITEM_INSTANCES = 'itemInstances',
  NAME = 'name',
  TYPE = 'type',
}
export enum PAGE_REGION_TYPE_VALUES {
  FACET = 'Facet',
}
export enum FLEXI_PAGE_FIELD_NAMES {
  FLEXI_PAGE_REGIONS = 'flexiPageRegions',
}

// Flow constants
export const START_ELEMENT_REFERENCE = 'startElementReference'
export const TARGET_REFERENCE = 'targetReference'
export const ELEMENT_REFERENCE = 'elementReference'
export const LEFT_VALUE_REFERENCE = 'leftValueReference'
export const ASSIGN_TO_REFERENCE = 'assignToReference'
export enum FLOW_NODE_FIELD_NAMES {
  NAME = 'name',
  LOCATION_X = 'locationX',
  LOCATION_Y = 'locationY',
}
export const FLOW_ELEMENTS_WITH_UNIQUE_NAMES = [
  'FlowChoice',
  'FlowConstant',
  'FlowDynamicChoiceSet',
  'FlowExitRule',
  'FlowExperimentPath',
  'FlowFormula',
  'FlowNode',
  'FlowRule',
  'FlowScheduledPath',
  'FlowScreenField',
  'FlowStage',
  'FlowCapability',
  'FlowCapabilityInput',
  'FlowTextTemplate',
  'FlowVariable',
  'FlowWaitEvent',
  'FlowScreenAction',
  'FlowStageStep',
]

export const FLOW_FIELD_TYPE_NAMES = {
  FLOW_ASSIGNMENT_ITEM: 'FlowAssignmentItem',
  FLOW_STAGE_STEP_OUTPUT_PARAMETER: 'FlowStageStepOutputParameter',
  FLOW_SUBFLOW_OUTPUT_ASSIGNMENT: 'FlowSubflowOutputAssignment',
  FLOW_TRANSFORM_VALUE_ACTION: 'FlowTransformValueAction',
  FLOW_SCREEN_FIELD_OUTPUT_PARAMETER: 'FlowScreenFieldOutputParameter',
  FLOW_WAIT_EVENT_OUTPUT_PARAMETER: 'FlowWaitEventOutputParameter',
  FLOW_STAGE_STEP_EXIT_ACTION_OUTPUT_PARAMETER: 'FlowStageStepExitActionOutputParameter',
  FLOW_APEX_PLUGIN_CALL_OUTPUT_PARAMETER: 'FlowApexPluginCallOutputParameter',
  FLOW_ACTION_CALL_OUTPUT_PARAMETER: 'FlowActionCallOutputParameter',
  FLOW_OUTPUT_FIELD_ASSIGNMENT: 'FlowOutputFieldAssignment',
  FLOW_STAGE_STEP_ENTRY_ACTION_OUTPUT_PARAMETER: 'FlowStageStepEntryActionOutputParameter',
} as const

export enum INTERNAL_FIELD_TYPE_NAMES {
  UNKNOWN = 'Unknown', // internal-only placeholder for fields whose type is unknown
  ANY = 'AnyType',
  SERVICE_ID = 'serviceid',
}

export type ALL_FIELD_TYPE_NAMES = FIELD_TYPE_NAMES | INTERNAL_FIELD_TYPE_NAMES

export enum COMPOUND_FIELD_TYPE_NAMES {
  ADDRESS = 'Address',
  FIELD_NAME = 'Name',
  FIELD_NAME_NO_SALUTATION = 'Name2',
  LOCATION = 'Location',
}
// We use Geolocation internally to avoid conflicts with the Location standard object
export const LOCATION_INTERNAL_COMPOUND_FIELD_TYPE_NAME = 'Geolocation'

export const COMPOUND_FIELDS_SOAP_TYPE_NAMES: Record<string, COMPOUND_FIELD_TYPE_NAMES> = {
  address: COMPOUND_FIELD_TYPE_NAMES.ADDRESS,
  location: COMPOUND_FIELD_TYPE_NAMES.LOCATION,
  // name is handled differently with nameField
}

// target types for creating / updating custom fields
// we can create fields of these types or update the types of existing fields to these types
export const CUSTOM_FIELD_UPDATE_CREATE_ALLOWED_TYPES: (string | undefined)[] = [
  ...Object.values(FIELD_TYPE_NAMES),
  COMPOUND_FIELD_TYPE_NAMES.LOCATION,
  COMPOUND_FIELD_TYPE_NAMES.ADDRESS,
]

export const CUSTOM_FIELD_DEPLOYABLE_TYPES: (string | undefined)[] = [
  ...CUSTOM_FIELD_UPDATE_CREATE_ALLOWED_TYPES,
  // We cannot create new fields with an unknown type or modify a field to have an unknown type
  // but if a field is already of an unknown type, we can deploy it as long as we do not specify the type explicitly
  undefined,
]

export const FIELD_SOAP_TYPE_NAMES: Record<string, ALL_FIELD_TYPE_NAMES> = {
  anyType: INTERNAL_FIELD_TYPE_NAMES.ANY,
  base64: FIELD_TYPE_NAMES.TEXT, // TODO: define specific type
  boolean: FIELD_TYPE_NAMES.CHECKBOX,
  combobox: FIELD_TYPE_NAMES.PICKLIST,
  complexvalue: FIELD_TYPE_NAMES.TEXT, // TODO: define specific type
  currency: FIELD_TYPE_NAMES.CURRENCY,
  date: FIELD_TYPE_NAMES.DATE,
  datetime: FIELD_TYPE_NAMES.DATETIME,
  double: FIELD_TYPE_NAMES.NUMBER,
  email: FIELD_TYPE_NAMES.EMAIL,
  encryptedstring: FIELD_TYPE_NAMES.ENCRYPTEDTEXT,
  id: FIELD_TYPE_NAMES.TEXT, // TODO: define specific type
  int: FIELD_TYPE_NAMES.NUMBER,
  json: FIELD_TYPE_NAMES.TEXT, // TODO: define specific type
  multipicklist: FIELD_TYPE_NAMES.MULTIPICKLIST,
  percent: FIELD_TYPE_NAMES.PERCENT,
  phone: FIELD_TYPE_NAMES.PHONE,
  picklist: FIELD_TYPE_NAMES.PICKLIST,
  // reference: FIELD_TYPE_NAMES.LOOKUP, // Has special treatment in the code
  string: FIELD_TYPE_NAMES.TEXT,
  textarea: FIELD_TYPE_NAMES.TEXTAREA,
  time: FIELD_TYPE_NAMES.TIME,
  url: FIELD_TYPE_NAMES.URL,
  // address, location & name: returned from the SOAP api
  // but have special treatment (compound fields)
}

export enum ANNOTATION_TYPE_NAMES {
  LOOKUP_FILTER = 'LookupFilter',
  FILTER_ITEM = 'FilterItem',
  FIELD_DEPENDENCY = 'FieldDependency',
  VALUE_SETTINGS = 'ValueSettings',
}

// Salesforce System Fields
export const OWNER_ID = 'OwnerId'
export const LAST_MODIFIED_DATE = 'LastModifiedDate'

// Salto annotations
export const API_NAME = 'apiName'
export const METADATA_TYPE = 'metadataType'
export const TOPICS_FOR_OBJECTS_ANNOTATION = 'topicsForObjects'
export const FOREIGN_KEY_DOMAIN = 'foreignKeyDomain'
export const CUSTOM_SETTINGS_TYPE = 'customSettingsType'
export const LIST_CUSTOM_SETTINGS_TYPE = 'List'
export const IS_ATTRIBUTE = 'isAttribute'
export const FOLDER_CONTENT_TYPE = 'folderContentType'
// Must have the same name as INTERNAL_ID_FIELD
export const INTERNAL_ID_ANNOTATION = `${INTERNAL_ID_FIELD}`
export const HISTORY_TRACKED_FIELDS = 'historyTrackedFields'
export const FEED_HISTORY_TRACKED_FIELDS = 'feedHistoryTrackedFields'

// Salesforce annotations
export const LABEL = 'label'
export const PLURAL_LABEL = 'pluralLabel'
export const DESCRIPTION = 'description'
export const HELP_TEXT = 'inlineHelpText'
export const FORMULA = 'formula'
export const DEFAULT_VALUE_FORMULA = 'defaultValueFormula'
export const BUSINESS_OWNER_USER = 'businessOwnerUser'
export const BUSINESS_OWNER_GROUP = 'businessOwnerGroup'
export const BUSINESS_STATUS = 'businessStatus'
export const SECURITY_CLASSIFICATION = 'securityClassification'
export const COMPLIANCE_GROUP = 'complianceGroup'
export const KEY_PREFIX = 'keyPrefix'
export const OBJECT_HISTORY_TRACKING_ENABLED = 'enableHistory'
export const RECORD_TYPE_HISTORY_TRACKING_ENABLED = 'recordTypeTrackHistory'
export const OBJECT_FEED_HISTORY_TRACKING_ENABLED = 'enableFeeds'
export const RECORD_TYPE_FEED_HISTORY_TRACKING_ENABLED = 'recordTypeTrackFeedHistory'

export const FIELD_ANNOTATIONS = {
  UNIQUE: 'unique',
  EXTERNAL_ID: 'externalId',
  CASE_SENSITIVE: 'caseSensitive',
  LENGTH: 'length',
  SCALE: 'scale',
  PRECISION: 'precision',
  DISPLAY_FORMAT: 'displayFormat',
  VISIBLE_LINES: 'visibleLines',
  MASK_CHAR: 'maskChar',
  MASK_TYPE: 'maskType',
  MASK: 'mask',
  DISPLAY_LOCATION_IN_DECIMAL: 'displayLocationInDecimal',
  REFERENCE_TO: 'referenceTo',
  RELATIONSHIP_NAME: 'relationshipName',
  RELATIONSHIP_LABEL: 'relationshipLabel',
  TRACK_TRENDING: 'trackTrending',
  TRACK_FEED_HISTORY: 'trackFeedHistory',
  DEPRECATED: 'deprecated',
  DELETE_CONSTRAINT: 'deleteConstraint',
  REPARENTABLE_MASTER_DETAIL: 'reparentableMasterDetail',
  WRITE_REQUIRES_MASTER_READ: 'writeRequiresMasterRead',
  RELATIONSHIP_ORDER: 'relationshipOrder',
  LOOKUP_FILTER: 'lookupFilter',
  FIELD_DEPENDENCY: 'fieldDependency',
  SUMMARIZED_FIELD: 'summarizedField',
  SUMMARY_FILTER_ITEMS: 'summaryFilterItems',
  SUMMARY_FOREIGN_KEY: 'summaryForeignKey',
  SUMMARY_OPERATION: 'summaryOperation',
  RESTRICTED: 'restricted',
  VALUE_SET: 'valueSet',
  DEFAULT_VALUE: 'defaultValue',
  FORMULA_TREAT_BLANKS_AS: 'formulaTreatBlanksAs',
  TRACK_HISTORY: 'trackHistory',
  CREATABLE: 'createable',
  UPDATEABLE: 'updateable',
  QUERYABLE: 'queryable',
  // when true, the field should not be deployed to the service
  LOCAL_ONLY: 'localOnly',
  ROLLUP_SUMMARY_FILTER_OPERATION: 'rollupSummaryFilterOperation',
  METADATA_RELATIONSHIP_CONTROLLING_FIELD: 'metadataRelationshipControllingField',
  DEFAULTED_ON_CREATE: 'defaultedOnCreate',
} as const

export const VALUE_SET_FIELDS = {
  RESTRICTED: 'restricted',
  VALUE_SET_DEFINITION: 'valueSetDefinition',
  VALUE_SET_NAME: 'valueSetName',
}

export const FIELD_DEPENDENCY_FIELDS = {
  CONTROLLING_FIELD: 'controllingField',
  VALUE_SETTINGS: 'valueSettings',
}

export const VALUE_SETTINGS_FIELDS = {
  CONTROLLING_FIELD_VALUE: 'controllingFieldValue',
  VALUE_NAME: 'valueName',
}

export const VALUE_SET_DEFINITION_FIELDS = {
  SORTED: 'sorted',
  VALUE: 'value',
}

export const CUSTOM_VALUE = {
  FULL_NAME: INSTANCE_FULL_NAME_FIELD,
  DEFAULT: 'default',
  LABEL: 'label',
  IS_ACTIVE: 'isActive',
  COLOR: 'color',
}

export const LOOKUP_FILTER_FIELDS = {
  ACTIVE: 'active',
  BOOLEAN_FILTER: 'booleanFilter',
  ERROR_MESSAGE: 'errorMessage',
  INFO_MESSAGE: 'infoMessage',
  IS_OPTIONAL: 'isOptional',
  FILTER_ITEMS: 'filterItems',
}

export const FILTER_ITEM_FIELDS = {
  FIELD: 'field',
  OPERATION: 'operation',
  VALUE: 'value',
  VALUE_FIELD: 'valueField',
}

export const ADDRESS_FIELDS = {
  CITY: 'city',
  COUNTRY: 'country',
  GEOCODE_ACCURACY: 'geocodeAccuracy',
  LATITUDE: 'latitude',
  LONGITUDE: 'longitude',
  POSTAL_CODE: 'postalCode',
  STATE: 'state',
  STREET: 'street',
}

export const NAME_FIELDS = {
  FIRST_NAME: 'FirstName',
  LAST_NAME: 'LastName',
  SALUTATION: 'Salutation',
  MIDDLE_NAME: 'MiddleName',
  SUFFIX: 'Suffix',
}

export const GEOLOCATION_FIELDS = {
  LATITUDE: 'latitude',
  LONGITUDE: 'longitude',
}

export const TOPICS_FOR_OBJECTS_FIELDS = {
  ENABLE_TOPICS: 'enableTopics',
  ENTITY_API_NAME: 'entityApiName',
} as const

// NACL files path
export const RECORDS_PATH = 'Records'
export const SETTINGS_PATH = 'Settings'
export const OBJECTS_PATH = 'Objects'
export const TYPES_PATH = 'Types'
export const META_TYPES_PATH = 'MetaTypes'
export const SUBTYPES_PATH = 'Subtypes'
export const INSTALLED_PACKAGES_PATH = 'InstalledPackages'
export const OBJECT_FIELDS_PATH = 'Fields'

export const SETTINGS_DIR_NAME = 'settings'

// Limits
export const MAX_METADATA_RESTRICTION_VALUES = 500
export const MAX_TOTAL_CONCURRENT_API_REQUEST = 100
export const DEFAULT_MAX_CONCURRENT_API_REQUESTS = {
  total: MAX_TOTAL_CONCURRENT_API_REQUEST,
  retrieve: 3,
  read: RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
  list: RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
  query: 4,
  describe: RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
  deploy: RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
}
export const DEFAULT_MAX_ITEMS_IN_RETRIEVE_REQUEST = 2500
export const DEFAULT_MAX_INSTANCES_PER_TYPE = 5000
export const MINIMUM_MAX_ITEMS_IN_RETRIEVE_REQUEST = 500
export const MAXIMUM_MAX_ITEMS_IN_RETRIEVE_REQUEST = 10000

export const DEFAULT_CUSTOM_OBJECT_DEPLOY_RETRY_DELAY = 1000

export const DEFAULT_CUSTOM_OBJECT_DEPLOY_RETRY_DELAY_MULTIPLIER = 1.5

export const DEFAULT_CUSTOM_OBJECTS_DEFAULT_RETRY_OPTIONS = {
  maxAttempts: 5,
  retryDelay: DEFAULT_CUSTOM_OBJECT_DEPLOY_RETRY_DELAY,
  retryDelayMultiplier: DEFAULT_CUSTOM_OBJECT_DEPLOY_RETRY_DELAY_MULTIPLIER,
  retryableFailures: ['FIELD_CUSTOM_VALIDATION_EXCEPTION', 'UNABLE_TO_LOCK_ROW'],
}
export const MAX_TYPES_TO_SEPARATE_TO_FILE_PER_FIELD = 20

// ref. https://developer.salesforce.com/docs/atlas.en-us.salesforce_app_limits_cheatsheet.meta/salesforce_app_limits_cheatsheet/salesforce_app_limits_platform_soslsoql.htm

export type SoqlQueryLimits = {
  maxQueryLength: number
  maxWhereClauseLength: number
}
export const DefaultSoqlQueryLimits: SoqlQueryLimits = {
  maxQueryLength: 100000,
  maxWhereClauseLength: 2000,
}

// Renamed types
export const CUSTOM_OBJECT_TYPE_NAME = '_CustomObject'
export const CUSTOM_METADATA_TYPE_NAME = '_CustomMetadata'

// Fields and Values
export const CURRENCY_ISO_CODE = 'CurrencyIsoCode'
export const ACTIVE_VERSION_NUMBER = 'activeVersionNumber'
export const STATUS = 'status'
export const ACTIVE = 'Active'
export const INVALID_DRAFT = 'InvalidDraft'

// Metadata types
export const PATH_ASSISTANT_METADATA_TYPE = 'PathAssistant'
export const TOPICS_FOR_OBJECTS_METADATA_TYPE = 'TopicsForObjects'
export const PROFILE_METADATA_TYPE = 'Profile'
export const PERMISSION_SET_METADATA_TYPE = 'PermissionSet'
export const MUTING_PERMISSION_SET_METADATA_TYPE = 'MutingPermissionSet'
export const PERMISSION_SET_GROUP_METADATA_TYPE = 'PermissionSetGroup'
export const FIELD_PERMISSIONS = 'fieldPermissions'
export const WORKFLOW_METADATA_TYPE = 'Workflow'
export const ASSIGNMENT_RULES_METADATA_TYPE = 'AssignmentRules'
export const VALIDATION_RULES_METADATA_TYPE = 'ValidationRule'
export const BUSINESS_PROCESS_METADATA_TYPE = 'BusinessProcess'
export const RECORD_TYPE_METADATA_TYPE = 'RecordType'
export const LEAD_CONVERT_SETTINGS_METADATA_TYPE = 'LeadConvertSettings'
export const QUICK_ACTION_METADATA_TYPE = 'QuickAction'
export const CUSTOM_TAB_METADATA_TYPE = 'CustomTab'
export const DUPLICATE_RULE_METADATA_TYPE = 'DuplicateRule'
export const CUSTOM_OBJECT_TRANSLATION_METADATA_TYPE = 'CustomObjectTranslation'
export const SHARING_RULES_TYPE = 'SharingRules'
export const LAYOUT_TYPE_ID_METADATA_TYPE = 'Layout'
export const LIGHTNING_COMPONENT_BUNDLE_METADATA_TYPE = 'LightningComponentBundle'
export const WORKFLOW_ACTION_ALERT_METADATA_TYPE = 'WorkflowAlert'
export const WORKFLOW_ACTION_REFERENCE_METADATA_TYPE = 'WorkflowActionReference'
export const WORKFLOW_FIELD_UPDATE_METADATA_TYPE = 'WorkflowFieldUpdate'
export const WORKFLOW_FLOW_ACTION_METADATA_TYPE = 'WorkflowFlowAction'
export const WORKFLOW_KNOWLEDGE_PUBLISH_METADATA_TYPE = 'WorkflowKnowledgePublish'
export const WORKFLOW_OUTBOUND_MESSAGE_METADATA_TYPE = 'WorkflowOutboundMessage'
export const WORKFLOW_RULE_METADATA_TYPE = 'WorkflowRule'
export const WORKFLOW_TASK_METADATA_TYPE = 'WorkflowTask'
export const WEBLINK_METADATA_TYPE = 'WebLink'
export const BUSINESS_HOURS_METADATA_TYPE = 'BusinessHoursSettings'
export const SETTINGS_METADATA_TYPE = 'Settings'
export const TERRITORY2_TYPE = 'Territory2'
export const TERRITORY2_MODEL_TYPE = 'Territory2Model'
export const TERRITORY2_RULE_TYPE = 'Territory2Rule'
export const LIGHTNING_PAGE_TYPE = 'LightningPage'
export const FLEXI_PAGE_TYPE = 'FlexiPage'
export const CUSTOM_LABEL_METADATA_TYPE = 'CustomLabel'
export const CUSTOM_LABELS_METADATA_TYPE = 'CustomLabels'
export const ROLE_METADATA_TYPE = 'Role'
export const GROUP_METADATA_TYPE = 'Group'
export const FLOW_METADATA_TYPE = 'Flow'
export const EMAIL_TEMPLATE_METADATA_TYPE = 'EmailTemplate'
export const CUSTOM_METADATA = 'CustomMetadata'
export const FLOW_DEFINITION_METADATA_TYPE = 'FlowDefinition'
export const FLOW_METADATA_VALUE_METADATA_TYPE = 'FlowMetadataValue'
export const INSTALLED_PACKAGE_METADATA = 'InstalledPackage'
export const ACCOUNT_SETTINGS_METADATA_TYPE = 'AccountSettings'
export const DATA_CATEGORY_GROUP_METADATA_TYPE = 'DataCategoryGroup'
export const CUSTOM_APPLICATION_METADATA_TYPE = 'CustomApplication'
export const APEX_CLASS_METADATA_TYPE = 'ApexClass'
export const APEX_PAGE_METADATA_TYPE = 'ApexPage'
export const APEX_TRIGGER_METADATA_TYPE = 'ApexTrigger'
export const APEX_COMPONENT_METADATA_TYPE = 'ApexComponent'
export const GLOBAL_VALUE_SET_TRANSLATION_METADATA_TYPE = 'GlobalValueSetTranslation'
export const ASSIGNMENT_RULE_METADATA_TYPE = 'AssignmentRule'
const AUTO_RESPONSE_RULES_METADATA_TYPE = 'AutoResponseRules'
export const AUTO_RESPONSE_RULE_METADATA_TYPE = 'AutoResponseRule'
const ESCALATION_RULES_TYPE = 'EscalationRules'
export const ESCALATION_RULE_TYPE = 'EscalationRule'
export const CUSTOM_PERMISSION_METADATA_TYPE = 'CustomPermission'
export const EXTERNAL_DATA_SOURCE_METADATA_TYPE = 'ExternalDataSource'
export const OPPORTUNITY_METADATA_TYPE = 'Opportunity'
export const ANIMATION_RULE_METADATA_TYPE = 'AnimationRule'
export const CANVAS_METADATA_TYPE = 'CanvasMetadata'
export const STATIC_RESOURCE_METADATA_TYPE = 'StaticResource'
export const AURA_DEFINITION_BUNDLE_METADATA_TYPE = 'AuraDefinitionBundle'
export const GEN_AI_FUNCTION_METADATA_TYPE = 'GenAiFunction'
export const LIVE_CHAT_BUTTON = 'LiveChatButton'
export const APPROVAL_PROCESS_METADATA_TYPE = 'ApprovalProcess'

// Wave Metadata Types
export const WAVE_RECIPE_METADATA_TYPE = 'WaveRecipe'
export const WAVE_DATAFLOW_METADATA_TYPE = 'WaveDataflow'
export const WAVE_DASHBOARD_METADATA_TYPE = 'WaveDashboard'
export const WAVE_LENS_METADATA_TYPE = 'WaveLens'

export const WAVE_RECIPE_FILE_EXTENSION = '.wdpr'
export const WAVE_DATAFLOW_FILE_EXTENSION = '.wdf'

// Meta Types
export const METADATA_META_TYPE = 'Metadata'
export const STANDARD_OBJECT_META_TYPE = 'StandardObject'
export const STANDARD_SETTINGS_META_TYPE = 'StandardSettings'
export const CUSTOM_OBJECT_META_TYPE = 'CustomObject'
export const CUSTOM_SETTINGS_META_TYPE = 'CustomSettings'
export const CUSTOM_METADATA_META_TYPE = 'CustomMetadata'

// Artificial Types
export const CURRENCY_CODE_TYPE_NAME = 'CurrencyIsoCodes'
export const CHANGED_AT_SINGLETON = 'ChangedAtSingleton'
export const PROFILE_AND_PERMISSION_SETS_BROKEN_PATHS = 'ProfilesAndPermissionSetsBrokenPaths'
export const PATHS_FIELD = 'paths'
export const FETCH_TARGETS = 'FetchTargets'
export const CUSTOM_OBJECTS_FIELD = 'customObjects'
export const CUSTOM_OBJECTS_LOOKUPS_FIELD = 'customObjectsLookups'
export const METADATA_TYPES_FIELD = 'metadataTypes'

export const ORDERED_MAP_PREFIX = 'OrderedMapOf'

// Related Types
export const PERMISSIONS_TYPES = [
  PROFILE_METADATA_TYPE,
  PERMISSION_SET_METADATA_TYPE,
  MUTING_PERMISSION_SET_METADATA_TYPE,
]

export const getTypePath = (name: string, isTopLevelType = true): string[] => [
  SALESFORCE,
  TYPES_PATH,
  ...(isTopLevelType ? [] : [SUBTYPES_PATH]),
  name,
]

export const ArtificialTypes = {
  [CHANGED_AT_SINGLETON]: new ObjectType({
    elemID: new ElemID(SALESFORCE, CHANGED_AT_SINGLETON),
    isSettings: true,
    annotations: {
      [CORE_ANNOTATIONS.HIDDEN]: true,
      [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
    },
  }),
  [PROFILE_AND_PERMISSION_SETS_BROKEN_PATHS]: new ObjectType({
    elemID: new ElemID(SALESFORCE, PROFILE_AND_PERMISSION_SETS_BROKEN_PATHS),
    isSettings: true,
    path: getTypePath(PROFILE_AND_PERMISSION_SETS_BROKEN_PATHS),
    fields: {
      [PATHS_FIELD]: { refType: new ListType(BuiltinTypes.STRING) },
    },
    annotations: {
      [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
    },
  }),
  [FETCH_TARGETS]: new ObjectType({
    elemID: new ElemID(SALESFORCE, FETCH_TARGETS),
    isSettings: true,
    path: getTypePath(FETCH_TARGETS),
    fields: {
      [CUSTOM_OBJECTS_FIELD]: { refType: new ListType(BuiltinTypes.STRING) },
      [CUSTOM_OBJECTS_LOOKUPS_FIELD]: { refType: new MapType(new ListType(BuiltinTypes.STRING)) },
    },
  }),
} as const

// Standard Object Types
export const ORGANIZATION_SETTINGS = 'Organization'

// Retrieve constants
export const RETRIEVE_LOAD_OF_METADATA_ERROR_REGEX =
  /Load of metadata from db failed for metadata of type:(?<type>\w+) and file name:(?<instance>\w+).$/
export const RETRIEVE_SIZE_LIMIT_ERROR = 'LIMIT_EXCEEDED'

// According to Salesforce spec the keyPrefix length is 3
// If this changes in the future we need to change this and add further logic where it's used
export const KEY_PREFIX_LENGTH = 3

// Magics
export const DETECTS_PARENTS_INDICATOR = '##allMasterDetailFields##'
export const DATA_INSTANCES_CHANGED_AT_MAGIC = '__DataInstances__'

// CPQ CustomObjects
export const CPQ_NAMESPACE = 'SBQQ'
export const CPQ_PRODUCT_RULE = 'SBQQ__ProductRule__c'
export const CPQ_ERROR_CONDITION = 'SBQQ__ErrorCondition__c'
export const CPQ_PRICE_RULE = 'SBQQ__PriceRule__c'
export const CPQ_PRICE_CONDITION = 'SBQQ__PriceCondition__c'
export const CPQ_LOOKUP_QUERY = 'SBQQ__LookupQuery__c'
export const CPQ_CUSTOM_SCRIPT = 'SBQQ__CustomScript__c'
export const CPQ_CONFIGURATION_ATTRIBUTE = 'SBQQ__ConfigurationAttribute__c'
export const CPQ_QUOTE = 'SBQQ__Quote__c'
const CPQ_QUOTE_LINE_GROUP = 'SBQQ__QuoteLineGroup__c'
const CPQ_QUOTE_LINE = 'SBQQ__QuoteLine__c'
const CPQ_PRODUCT_OPTION = 'SBQQ__ProductOption__c'
export const CPQ_PRICE_SCHEDULE = 'SBQQ__PriceSchedule__c'
export const CPQ_DISCOUNT_SCHEDULE = 'SBQQ__DiscountSchedule__c'
export const CPQ_SUBSCRIPTION = 'SBQQ__Subscription__c'
export const CPQ_TERM_CONDITION = 'SBQQ__TermCondition__c'
export const CPQ_QUOTE_TERM = 'SBQQ__QuoteTerm__c'
export const CPQ_TERM_CONDITON = 'SBQQ__TermCondition__c'

// CPQ Fields
export const CPQ_LOOKUP_OBJECT_NAME = 'SBQQ__LookupObject__c'
export const CPQ_LOOKUP_PRODUCT_FIELD = 'SBQQ__LookupProductField__c'
export const CPQ_LOOKUP_MESSAGE_FIELD = 'SBQQ__LookupMessageField__c'
export const CPQ_LOOKUP_FIELD = 'SBQQ__LookupField__c'
export const CPQ_RULE_LOOKUP_OBJECT_FIELD = 'SBQQ__RuleLookupObject__c'
export const CPQ_CONSUMPTION_RATE_FIELDS = 'SBQQ__ConsumptionRateFields__c'
export const CPQ_CONSUMPTION_SCHEDULE_FIELDS = 'SBQQ__ConsumptionScheduleFields__c'
export const CPQ_GROUP_FIELDS = 'SBQQ__GroupFields__c'
export const CPQ_QUOTE_FIELDS = 'SBQQ__QuoteFields__c'
export const CPQ_QUOTE_LINE_FIELDS = 'SBQQ__QuoteLineFields__c'
export const CPQ_CODE_FIELD = 'SBQQ__Code__c'
export const CPQ_DEFAULT_OBJECT_FIELD = 'SBQQ__DefaultObject__c'
export const CPQ_TESTED_OBJECT = 'SBQQ__TestedObject__c'
export const CPQ_CONSTRAINT_FIELD = 'SBQQ__ConstraintField__c'
export const CPQ_ACCOUNT = 'SBQQ__Account__c'
export const CPQ_FILTER_SOURCE_FIELD = 'SBQQ__FilterSourceField__c'
export const CPQ_FILTER_SOURCE_OBJECT = 'SBQQ__FilterSourceObject__c'
export const CPQ_HIDDEN_SOURCE_FIELD = 'SBQQ__HiddenSourceField__c'
export const CPQ_HIDDEN_SOURCE_OBJECT = 'SBQQ__HiddenSourceObject__c'
export const CPQ_TARGET_FIELD = 'SBQQ__TargetField__c'
export const CPQ_TARGET_OBJECT = 'SBQQ__TargetObject__c'
export const CPQ_CONDITIONS_MET = 'SBQQ__ConditionsMet__c'
export const CPQ_PRICE_CONDITION_RULE_FIELD = 'SBQQ__Rule__c'
export const CPQ_ERROR_CONDITION_RULE_FIELD = 'SBQQ__Rule__c'
export const CPQ_INDEX_FIELD = 'SBQQ__Index__c'
export const CPQ_ADVANCED_CONDITION_FIELD = 'SBQQ__AdvancedCondition__c'
export const CPQ_RULE_FIELD = 'SBQQ__Rule__c'
export const CPQ_QUOTE_TERM_FIELD = 'SBQQ__QuoteTerm__c'
export const SBAA_ADVANCED_CONDITION_FIELD = 'sbaa__AdvancedCondition__c'
export const SBAA_INDEX_FIELD = 'sbaa__Index__c'

export const CPQ_QUOTE_NO_PRE = 'Quote__c'
const CPQ_QUOTE_LINE_GROUP_NO_PRE = 'QuoteLineGroup__c'
export const CPQ_ACCOUNT_NO_PRE = 'Account__c'
export const DEFAULT_OBJECT_TO_API_MAPPING = {
  [CPQ_QUOTE_NO_PRE]: CPQ_QUOTE,
  [CPQ_QUOTE_LINE_GROUP_NO_PRE]: CPQ_QUOTE_LINE_GROUP,
} as Record<string, string>

const CPQ_QUOTE_NAME = 'Quote'
const CPQ_QUOTE_LINE_NAME = 'Quote Line'
const CPQ_PRODUCT_OPTION_NAME = 'Product Option'
export const TEST_OBJECT_TO_API_MAPPING = {
  [CPQ_QUOTE_NAME]: CPQ_QUOTE,
  [CPQ_QUOTE_LINE_NAME]: CPQ_QUOTE_LINE,
  [CPQ_PRODUCT_OPTION_NAME]: CPQ_PRODUCT_OPTION,
} as Record<string, string>

export const SCHEDULE_CONSTRAINT_FIELD_TO_API_MAPPING = {
  [CPQ_ACCOUNT_NO_PRE]: CPQ_ACCOUNT,
} as Record<string, string>

// sbaa Objects
export const SBAA_APPROVAL_CONDITION = 'sbaa__ApprovalCondition__c'
export const SBAA_APPROVAL_RULE = 'sbaa__ApprovalRule__c'

// sbaa Fields
export const SBAA_CONDITIONS_MET = 'sbaa__ConditionsMet__c'

// CPQ Billing
export const BILLING_NAMESPACE = 'blng'

// Change Groups
export const groupIdForInstanceChangeGroup = (action: ActionName, typeName: string): string => {
  const toVerbalNoun = (actionName: ActionName): string => {
    switch (actionName) {
      case 'add':
        return 'addition'
      case 'modify':
        return 'modification'
      case 'remove':
        return 'removal'
      default:
        // should not happen
        return actionName
    }
  }
  return `${_.capitalize(toVerbalNoun(action))} of data instances of type '${typeName}'`
}

// Custom Rules And Conditions Groups

export const CUSTOM_APPROVAL_RULE_AND_CONDITION = 'Custom ApprovalRule and ApprovalCondition'
export const CUSTOM_PRICE_RULE_AND_CONDITION = 'Custom PriceRule and PriceCondition'
export const CUSTOM_PRODUCT_RULE_AND_CONDITION = 'Custom ProductRule and ErrorCondition'
export const CUSTOM_QUOTE_TERM_AND_CONDITION = 'Custom QuoteTerm and TermCondition'

export const ADD_SBAA_CUSTOM_APPROVAL_RULE_AND_CONDITION_GROUP = groupIdForInstanceChangeGroup(
  'add',
  CUSTOM_APPROVAL_RULE_AND_CONDITION,
)
export const ADD_CPQ_CUSTOM_PRICE_RULE_AND_CONDITION_GROUP = groupIdForInstanceChangeGroup(
  'add',
  CUSTOM_PRICE_RULE_AND_CONDITION,
)
export const ADD_CPQ_CUSTOM_PRODUCT_RULE_AND_CONDITION_GROUP = groupIdForInstanceChangeGroup(
  'add',
  CUSTOM_PRODUCT_RULE_AND_CONDITION,
)
export const ADD_CPQ_QUOTE_TERM_AND_CONDITION_GROUP = groupIdForInstanceChangeGroup(
  'add',
  CUSTOM_QUOTE_TERM_AND_CONDITION,
)

export const REMOVE_SBAA_CUSTOM_APPROVAL_RULE_AND_CONDITION_GROUP = groupIdForInstanceChangeGroup(
  'remove',
  CUSTOM_APPROVAL_RULE_AND_CONDITION,
)
export const REMOVE_CPQ_CUSTOM_PRICE_RULE_AND_CONDITION_GROUP = groupIdForInstanceChangeGroup(
  'remove',
  CUSTOM_PRICE_RULE_AND_CONDITION,
)
export const REMOVE_CPQ_CUSTOM_PRODUCT_RULE_AND_CONDITION_GROUP = groupIdForInstanceChangeGroup(
  'remove',
  CUSTOM_PRODUCT_RULE_AND_CONDITION,
)
export const REMOVE_CPQ_QUOTE_TERM_AND_CONDITION_GROUP = groupIdForInstanceChangeGroup(
  'remove',
  CUSTOM_QUOTE_TERM_AND_CONDITION,
)

export const METADATA_CHANGE_GROUP = 'Salesforce Metadata'

export const UNLIMITED_INSTANCES_VALUE = -1

// See: https://developer.salesforce.com/docs/atlas.en-us.api.meta/api/sforce_api_objects_custom_object__c.htm
export const SYSTEM_FIELDS = [
  'ConnectionReceivedId',
  'ConnectionSentId',
  'CreatedById',
  'CreatedDate',
  'Id',
  'IsDeleted',
  'LastActivityDate',
  'LastModifiedDate',
  'LastModifiedById',
  'LastReferencedDate',
  'LastViewedDate',
  'Name',
  'RecordTypeId',
  'SystemModstamp',
  OWNER_ID,
  'SetupOwnerId',
]

export const UNSUPPORTED_SYSTEM_FIELDS = ['LastReferencedDate', 'LastViewedDate']

// Errors
export const SOCKET_TIMEOUT = 'ESOCKETTIMEDOUT'
export const INVALID_GRANT = 'invalid_grant'
export const ENOTFOUND = 'ENOTFOUND'
export const ERROR_HTTP_502 = 'ERROR_HTTP_502'

export const ACTIVITY_CUSTOM_OBJECT = 'Activity'
export const TASK_CUSTOM_OBJECT = 'Task'
export const EVENT_CUSTOM_OBJECT = 'Event'

export const ERROR_PROPERTIES = {
  MESSAGE: 'message',
  STACKTRACE: 'stacktrace',
  NAME: 'name',
  HOSTNAME: 'hostname',
  CODE: 'code',
  ERROR_CODE: 'errorCode',
} as const

export type ErrorProperty = types.ValueOf<typeof ERROR_PROPERTIES>

// Salesforce Errors
const SALESFORCE_ERROR_PREFIX = 'sf:'

export const SALESFORCE_ERRORS = {
  INVALID_CROSS_REFERENCE_KEY: `${SALESFORCE_ERROR_PREFIX}INVALID_CROSS_REFERENCE_KEY`,
  DUPLICATE_VALUE: `${SALESFORCE_ERROR_PREFIX}DUPLICATE_VALUE`,
  INVALID_ID_FIELD: `${SALESFORCE_ERROR_PREFIX}INVALID_ID_FIELD`,
  INVALID_FIELD: `${SALESFORCE_ERROR_PREFIX}INVALID_FIELD`,
  INVALID_TYPE: `${SALESFORCE_ERROR_PREFIX}INVALID_TYPE`,
  UNKNOWN_EXCEPTION: `${SALESFORCE_ERROR_PREFIX}UNKNOWN_EXCEPTION`,
  REQUEST_LIMIT_EXCEEDED: `${SALESFORCE_ERROR_PREFIX}REQUEST_LIMIT_EXCEEDED`,
  INVALID_QUERY_FILTER_OPERATOR: `${SALESFORCE_ERROR_PREFIX}INVALID_QUERY_FILTER_OPERATOR`,
  INSUFFICIENT_ACCESS: `${SALESFORCE_ERROR_PREFIX}INSUFFICIENT_ACCESS`,
  EXPIRED_PASSWORD: `${SALESFORCE_ERROR_PREFIX}INVALID_OPERATION_WITH_EXPIRED_PASSWORD`,
} as const

export type SalesforceErrorName = types.ValueOf<typeof SALESFORCE_ERRORS>

export type SalesforceError = Error & {
  [ERROR_PROPERTIES.ERROR_CODE]: SalesforceErrorName
}

export const isSalesforceError = (error: Error): error is SalesforceError => {
  const errorCode = _.get(error, ERROR_PROPERTIES.ERROR_CODE)
  return _.isString(errorCode) && (Object.values(SALESFORCE_ERRORS) as ReadonlyArray<string>).includes(errorCode)
}

// Salesforce Deploy Error Messages
export const SALESFORCE_DEPLOY_ERROR_MESSAGES = {
  SCHEDULABLE_CLASS: 'This schedulable class has jobs pending or in progress',
  MAX_METADATA_DEPLOY_LIMIT: 'Maximum size of request reached. Maximum size of request is 52428800 bytes.',
  INVALID_DASHBOARD_UNIQUE_NAME: 'Invalid dashboard Unique Name',
  FIELD_CUSTOM_VALIDATION_EXCEPTION: 'FIELD_CUSTOM_VALIDATION_EXCEPTION',
  CANNOT_INSERT_UPDATE: 'CANNOT_INSERT_UPDATE_ACTIVATE_ENTITY',
} as const

// Artifacts
export const SalesforceArtifacts = {
  DeployPackageXml: 'package.xml',
  PostDeployRetrieveZip: 'post-deploy-retrieve.zip',
} as const

// Since the adapter relies on lists in some scenarios (e.g. deletions in partial fetch)
// Elements that are not listed should be ignored from such flows.
export const NON_LISTED_ELEMENT_IDS = [
  // This RecordType is not presented when listing RecordTypes,
  // but returns as sub-instance of the CustomObject Idea.
  'salesforce.RecordType.instance.Idea_InternalIdeasIdeaRecordType',
]

export const TYPES_WITH_NESTED_INSTANCES = [CUSTOM_LABELS_METADATA_TYPE] as const

export const TYPES_WITH_NESTED_INSTANCES_PER_PARENT = [
  CUSTOM_OBJECT,
  ASSIGNMENT_RULES_METADATA_TYPE,
  AUTO_RESPONSE_RULES_METADATA_TYPE,
  SHARING_RULES_TYPE,
  ESCALATION_RULES_TYPE,
  WORKFLOW_METADATA_TYPE,
] as const

export const PROFILE_RELATED_METADATA_TYPES = [
  CUSTOM_APPLICATION_METADATA_TYPE,
  APEX_CLASS_METADATA_TYPE,
  CUSTOM_OBJECT,
  CUSTOM_PERMISSION_METADATA_TYPE,
  EXTERNAL_DATA_SOURCE_METADATA_TYPE,
  FLOW_DEFINITION_METADATA_TYPE,
  LAYOUT_TYPE_ID_METADATA_TYPE,
  APEX_PAGE_METADATA_TYPE,
] as const

export const ProgressReporterSuffix = {
  QuickDeploy: 'Attempting quick deploy',
  QuickDeployFailed: 'Quick deploy failed. Attempting regular deploy',
}

export const METADATA_DEPLOY_PENDING_STATUS = 'Pending'
