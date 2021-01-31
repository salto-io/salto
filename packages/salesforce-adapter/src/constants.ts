/*
*                      Copyright 2021 Salto Labs Ltd.
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

export const SALESFORCE = 'salesforce'
export const CUSTOM_FIELD = 'CustomField'
export const CUSTOM_OBJECT = 'CustomObject'
export const INSTANCE_FULL_NAME_FIELD = 'fullName'
export const METADATA_CONTENT_FIELD = 'content'
export const FORMULA_TYPE_NAME = 'Formula'
export const SALESFORCE_CUSTOM_SUFFIX = '__c'
export const ADMIN_PROFILE = 'Admin'
export const NAMESPACE_SEPARATOR = '__'
export const API_NAME_SEPARATOR = '.'
export const CUSTOM_OBJECT_ID_FIELD = 'Id'
export const INTERNAL_ID_FIELD = 'internalId'
export const XML_ATTRIBUTE_PREFIX = 'attr_'
export const DEFAULT_NAMESPACE = 'standard'

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
}

export enum INTERNAL_FIELD_TYPE_NAMES {
  UNKNOWN = 'Unknown', // internal-only placeholder for fields whose type is unknown
  ANY = 'AnyType',
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

export const COMPOUND_FIELDS_SOAP_TYPE_NAMES:
  Record<string, COMPOUND_FIELD_TYPE_NAMES> = {
    address: COMPOUND_FIELD_TYPE_NAMES.ADDRESS,
    location: COMPOUND_FIELD_TYPE_NAMES.LOCATION,
    // name is handled differently with nameField
  }

// target types for creating / updating custom fields:
export const CUSTOM_FIELD_UPDATE_CREATE_ALLOWED_TYPES = [
  ...Object.values(FIELD_TYPE_NAMES),
  COMPOUND_FIELD_TYPE_NAMES.LOCATION,
  // The following types are valid according to the documentation
  // TODO - support these field types
  'MetadataRelationship',
  'ExternalLookup',
  'IndirectLookup',
  'Hierarchy',
  'File',
]

export const FIELD_SOAP_TYPE_NAMES:
Record<string, ALL_FIELD_TYPE_NAMES> = {
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

// Salto annotations
export const API_NAME = 'apiName'
export const METADATA_TYPE = 'metadataType'
export const TOPICS_FOR_OBJECTS_ANNOTATION = 'topicsForObjects'
export const FOREIGN_KEY_DOMAIN = 'foreignKeyDomain'
export const CUSTOM_SETTINGS_TYPE = 'customSettingsType'
export const LIST_CUSTOM_SETTINGS_TYPE = 'List'
export const IS_ATTRIBUTE = 'isAttribute'
// must have the same name as INTERNAL_ID_FIELD
export const INTERNAL_ID_ANNOTATION = INTERNAL_ID_FIELD

// Salesforce annotations
export const LABEL = 'label'
export const DESCRIPTION = 'description'
export const HELP_TEXT = 'inlineHelpText'
export const FORMULA = 'formula'
export const DEFAULT_VALUE_FORMULA = 'defaultValueFormula'
export const BUSINESS_OWNER_USER = 'businessOwnerUser'
export const BUSINESS_OWNER_GROUP = 'businessOwnerGroup'
export const BUSINESS_STATUS = 'businessStatus'
export const SECURITY_CLASSIFICATION = 'securityClassification'
export const COMPLIANCE_GROUP = 'complianceGroup'

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
  ALLOW_LOOKUP_RECORD_DELETION: 'allowLookupRecordDeletion',
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
  CREATABLE: 'createable',
  UPDATEABLE: 'updateable',
  // indicates whether a field is queryable by SOQL (default true)
  QUERYABLE: 'queryable',
  // when true, the field should not be deployed to the service
  LOCAL_ONLY: 'localOnly',
}

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
}

// NACL files path
export const RECORDS_PATH = 'Records'
export const SETTINGS_PATH = 'Settings'
export const OBJECTS_PATH = 'Objects'
export const TYPES_PATH = 'Types'
export const SUBTYPES_PATH = 'Subtypes'
export const INSTALLED_PACKAGES_PATH = 'InstalledPackages'

// Limits
export const MAX_METADATA_RESTRICTION_VALUES = 500
export const RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS = -1
export const DEFAULT_MAX_CONCURRENT_API_REQUESTS = {
  total: RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
  retrieve: 3,
  read: RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
  list: RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
}
export const DEFAULT_MAX_ITEMS_IN_RETRIEVE_REQUEST = 2500
export const DEFAULT_USE_OLD_PROFILES = false
export const MAX_IDS_PER_INSTANCES_QUERY = 500

// Metadata types
export const TOPICS_FOR_OBJECTS_METADATA_TYPE = 'TopicsForObjects'
export const PROFILE_METADATA_TYPE = 'Profile'
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
export const LAYOUT_ITEM_METADATA_TYPE = 'LayoutItem'
export const LIGHTNING_COMPONENT_BUNDLE_METADATA_TYPE = 'LightningComponentBundle'
export const SUMMARY_LAYOUT_ITEM_METADATA_TYPE = 'SummaryLayoutItem'
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

// Retrieve constants
export const RETRIEVE_LOAD_OF_METADATA_ERROR_REGEX = /Load of metadata from db failed for metadata of type:(?<type>\w+) and file name:(?<instance>\w+).$/

// CPQ CustomObjects
export const CPQ_PRODUCT_RULE = 'SBQQ__ProductRule__c'
export const CPQ_PRICE_RULE = 'SBQQ__PriceRule__c'
export const CPQ_LOOKUP_QUERY = 'SBQQ__LookupQuery__c'
export const CPQ_PRICE_ACTION = 'SBQQ__PriceAction__c'
export const CPQ_FIELD_METADATA = 'SBQQ__FieldMetadata__c'
export const CPQ_CUSTOM_SCRIPT = 'SBQQ__CustomScript__c'
export const CPQ_CONFIGURATION_ATTRIBUTE = 'SBQQ__ConfigurationAttribute__c'
export const CPQ_QUOTE = 'SBQQ__Quote__c'
export const CPQ_QUOTE_LINE_GROUP = 'SBQQ__QuoteLineGroup__c'
export const CPQ_QUOTE_LINE = 'SBQQ__QuoteLine__c'
export const CPQ_PRODUCT_OPTION = 'SBQQ__ProductOption__c'
export const CPQ_PRICE_SCHEDULE = 'SBQQ__PriceSchedule__c'
export const CPQ_DISCOUNT_SCHEDULE = 'SBQQ__DiscountSchedule__c'

// CPQ Fields
export const CPQ_LOOKUP_OBJECT_NAME = 'SBQQ__LookupObject__c'
export const CPQ_LOOKUP_PRODUCT_FIELD = 'SBQQ__LookupProductField__c'
export const CPQ_LOOKUP_MESSAGE_FIELD = 'SBQQ__LookupMessageField__c'
export const CPQ_LOOKUP_REQUIRED_FIELD = 'SBQQ__LookupRequiredField__c'
export const CPQ_LOOKUP_TYPE_FIELD = 'SBQQ__LookupTypeField__c'
export const CPQ_LOOKUP_FIELD = 'SBQQ__LookupField__c'
export const CPQ_RULE_LOOKUP_OBJECT_FIELD = 'SBQQ__RuleLookupObject__c'
export const CPQ_SOURCE_LOOKUP_FIELD = 'SBQQ__SourceLookupField__c'
export const CPQ_OBJECT_NAME = 'SBQQ__ObjectName__c'
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

export const CPQ_QUOTE_NO_PRE = 'Quote__c'
export const CPQ_QUOTE_LINE_GROUP_NO_PRE = 'QuoteLineGroup__c'
export const CPQ_ACCOUNT_NO_PRE = 'Account__c'
export const DEFAULT_OBJECT_TO_API_MAPPING = {
  [CPQ_QUOTE_NO_PRE]: CPQ_QUOTE,
  [CPQ_QUOTE_LINE_GROUP_NO_PRE]: CPQ_QUOTE_LINE_GROUP,
} as Record<string, string>

export const CPQ_QUOTE_NAME = 'Quote'
export const CPQ_QUOTE_LINE_NAME = 'Quote Line'
export const CPQ_PRODUCT_OPTION_NAME = 'Product Option'
export const TEST_OBJECT_TO_API_MAPPING = {
  [CPQ_QUOTE_NAME]: CPQ_QUOTE,
  [CPQ_QUOTE_LINE_NAME]: CPQ_QUOTE_LINE,
  [CPQ_PRODUCT_OPTION_NAME]: CPQ_PRODUCT_OPTION,
} as Record<string, string>

export const SCHEDULE_CONTRAINT_FIELD_TO_API_MAPPING = {
  [CPQ_ACCOUNT_NO_PRE]: CPQ_ACCOUNT,
} as Record<string, string>
