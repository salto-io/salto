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
export const SALESFORCE = 'salesforce'
export const CUSTOM_FIELD = 'CustomField'
export const CUSTOM_OBJECT = 'CustomObject'
export const INSTANCE_FULL_NAME_FIELD = 'fullName'
export const FORMULA_TYPE_NAME = 'Formula'
export const SALESFORCE_CUSTOM_SUFFIX = '__c'
export const ADMIN_PROFILE = 'Admin'
export const NAMESPACE_SEPARATOR = '__'
export const API_NAME_SEPERATOR = '.'

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
export const FIELD_TYPE_NAME_VALUES = [FIELD_TYPE_NAMES.AUTONUMBER, FIELD_TYPE_NAMES.TEXT,
  FIELD_TYPE_NAMES.NUMBER, FIELD_TYPE_NAMES.PERCENT, FIELD_TYPE_NAMES.CHECKBOX,
  FIELD_TYPE_NAMES.DATE, FIELD_TYPE_NAMES.TIME, FIELD_TYPE_NAMES.DATETIME,
  FIELD_TYPE_NAMES.CURRENCY, FIELD_TYPE_NAMES.PICKLIST, FIELD_TYPE_NAMES.MULTIPICKLIST,
  FIELD_TYPE_NAMES.EMAIL, FIELD_TYPE_NAMES.PHONE, FIELD_TYPE_NAMES.LONGTEXTAREA,
  FIELD_TYPE_NAMES.RICHTEXTAREA, FIELD_TYPE_NAMES.TEXTAREA, FIELD_TYPE_NAMES.ENCRYPTEDTEXT,
  FIELD_TYPE_NAMES.URL, FIELD_TYPE_NAMES.LOOKUP, FIELD_TYPE_NAMES.MASTER_DETAIL,
  FIELD_TYPE_NAMES.ROLLUP_SUMMARY]

export enum COMPOUND_FIELD_TYPE_NAMES {
  ADDRESS = 'Address',
  FIELD_NAME = 'Name',
  LOCATION = 'Location',
}

export enum MISSING_TYPE_NAME {
  CASE_CLASSIFICATION_SETTINGS = 'CaseClassificationSettings',
  ACCOUNT_INSIGHT_SETTINGS = 'AccountInsightsSettings',
  ACCOUNT_INTELLIGENCE_SETTINGS = 'AccountIntelligenceSettings',
  AUTOMATED_CONTACTS_SETTINGS = 'AutomatedContactsSettings',
  CHATTER_ANSWERS_SETTINGS = 'ChatterAnswersSettings',
  CHATTER_EMAIL_MDSETTINGS = 'ChatterEmailMDSettings',
  HIGH_VELOCITY_SALES_SETTINGS = 'HighVelocitySalesSettings',
  IOT_SETTINGS = 'IoTSettings',
  MAP_AND_LOCATION_SETTINGS = 'MapAndLocationSettings',
  OBJECT_LINKING_SETTINGS = 'ObjectLinkingSettings',
  PREDICTION_BUILDER_SETTINGS = 'PredictionBuilderSettings',
  SOCIAL_CUSTOMER_SERVICE_SETTINGS = 'SocialCustomerServiceSettings',
}

export enum MISSING_SUBTYPE_NAMES {
  BUSINESS_HOURS_ENTRY = 'BusinessHoursEntry',
  HOLIDAYS = 'Holidays',
  ORGANIZATION_SETTINGS_DETAIL = 'OrganizationSettingsDetail',
}

export const FIELD_SOAP_TYPE_NAMES:
Record<string, FIELD_TYPE_NAMES | COMPOUND_FIELD_TYPE_NAMES> = {
  address: COMPOUND_FIELD_TYPE_NAMES.ADDRESS,
  anyType: FIELD_TYPE_NAMES.TEXT, // TODO: define specific type
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
  location: COMPOUND_FIELD_TYPE_NAMES.LOCATION,
  multipicklist: FIELD_TYPE_NAMES.MULTIPICKLIST,
  percent: FIELD_TYPE_NAMES.PERCENT,
  phone: FIELD_TYPE_NAMES.PHONE,
  picklist: FIELD_TYPE_NAMES.PICKLIST,
  // reference: FIELD_TYPE_NAMES.LOOKUP, // Has special treatment in the code
  string: FIELD_TYPE_NAMES.TEXT,
  textarea: FIELD_TYPE_NAMES.TEXTAREA,
  time: FIELD_TYPE_NAMES.TIME,
  url: FIELD_TYPE_NAMES.URL,
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
  CITY: 'City',
  COUNTRY: 'Country',
  GEOCODE_ACCURACY: 'GeocodeAccuracy',
  LATITUDE: 'Latitude',
  LONGITUDE: 'Longitude',
  POSTAL_CODE: 'PostalCode',
  STATE: 'State',
  STREET: 'Street',
}

export const NAME_FIELDS = {
  FIRST_NAME: 'FirstName',
  LAST_NAME: 'LastName',
  SALUTATION: 'Salutation',
}

export const GEOLOCATION_FIELDS = {
  LATITUDE: 'Latitude',
  LONGITUDE: 'Longitude',
}

export const TOPICS_FOR_OBJECTS_FIELDS = {
  ENABLE_TOPICS: 'enableTopics',
  ENTITY_API_NAME: 'entityApiName',
}

export const CASE_CLASSIFICATION_SETTINGS = {
  CASE_CLASSIFICATION_RECOMMENDATIONS: 'caseClassificationRecommendations',
  RE_RUN_ATTRIBUTE_BASED_RULES: 'reRunAttributeBasedRules',
  RUN_ASSIGNMENT_RULES: 'runAssignmentRules',
}

export const ACCOUNT_INSIGHT_SETTINGS = {
  ENABLE_ACCOUNT_INSIGHTS: 'enableAccountInsights',
}

export const ACCOUNT_INTELLIGENCE_SETTINGS = {
  ENABLE_ACCOUNT_LOGOS: 'enableAccountLogos',
  ENABLE_AUTOMATED_ACCOUNT_FIELDS: 'enableAutomatedAccountFields',
  ENABLE_NEWS_STORIES: 'enableNewsStories',
}

export const AUTOMATED_CONTACTS_SETTINGS = {
  ENABLE_ADD_CONTACT_AUTOMATICALLY: 'enableAddContactAutomatically',
  ENABLE_ADD_CONTACT_ROLE_AUTOMATICALLY: 'enableAddContactRoleAutomatically',
  ENABLE_ADD_CONTACT_ROLE_WITH_SUGGESTION: 'enableAddContactRoleWithSuggestion',
  ENABLE_ADD_CONTACT_WITH_SUGGESTION: 'enableAddContactWithSuggestion',
}

export const CHATTER_ANSWERS_SETTINGS = {
  EMAIL_FOLLOWERS_ON_BEST_ANSWER: 'emailFollowersOnBestAnswer',
  EMAIL_FOLLOWERS_ON_REPLY: 'emailFollowersOnReply',
  EMAIL_OWNER_ON_PRIVATE_REPLY: 'emailOwnerOnPrivateReply',
  EMAIL_OWNER_ON_REPLY: 'emailOwnerOnReply',
  ENABLE_ANSWER_VIA_EMAIL: 'enableAnswerViaEmail',
  ENABLE_CHATTER_ANSWERS: 'enableChatterAnswers',
  ENABLE_FACEBOOK_S_S_O: 'enableFacebookSSO',
  ENABLE_INLINE_PUBLISHER: 'enableInlinePublisher',
  ENABLE_REPUTATION: 'enableReputation',
  ENABLE_RICH_TEXT_EDITOR: 'enableRichTextEditor',
  FACEBOOK_AUTH_PROVIDER: 'facebookAuthProvider',
  SHOW_IN_PORTALS: 'showInPortals',
}

export const CHATTER_EMAIL_M_D_SETTINGS = {
  ENABLE_CHATTER_DIGEST_EMAILS_API_ONLY: 'enableChatterDigestEmailsApiOnly',
  ENABLE_CHATTER_EMAIL_ATTACHMENT: 'enableChatterEmailAttachment',
  ENABLE_COLLABORATION_EMAIL: 'enableCollaborationEmail',
  ENABLE_DISPLAY_APP_DOWNLOAD_BADGES: 'enableDisplayAppDownloadBadges',
  ENABLE_EMAIL_REPLY_TO_CHATTER: 'enableEmailReplyToChatter',
  ENABLE_EMAIL_TO_CHATTER: 'enableEmailToChatter',
}

export const IO_T_SETTINGS = {
  ENABLE_IO_T: 'enableIoT',
}

export const OBJECT_LINKING_SETTINGS = {
  ENABLE_OBJECT_LINKING: 'enableObjectLinking',
}

export const MAP_AND_LOCATION_SETTINGS = {
  ENABLE_ADDRESS_AUTO_COMPLETE: 'enableAddressAutoComplete',
  ENABLE_MAPS_AND_LOCATION: 'enableMapsAndLocation',
}

export const HIGH_VELOCITY_SALES_SETTINGS = {
  ENABLE_A_C_AUTO_SEND_EMAIL: 'enableACAutoSendEmail',
  ENABLE_DISPOSITION_CATEGORY: 'enableDispositionCategory',
  ENABLE_ENGAGEMENT_WAVE_ANALYTICS_PREF: 'enableEngagementWaveAnalyticsPref',
  ENABLE_HIGH_VELOCITY_SALES: 'enableHighVelocitySales',
  ENABLE_HIGH_VELOCITY_SALES_SETUP: 'enableHighVelocitySalesSetup',
}

export const PREDICTION_BUILDER_SETTINGS = {
  ENABLE_PREDICTION_BUILDER: 'enablePredictionBuilder',
  IS_PREDICTION_BUILDER_STARTED: 'isPredictionBuilderStarted',
}

export const SOCIAL_CUSTOMER_SERVICE_SETTINGS = {
  CASE_SUBJECT_OPTION: 'caseSubjectOption',
  ENABLE_SOCIAL_APPROVALS: 'enableSocialApprovals',
  ENABLE_SOCIAL_CASE_ASSIGNMENT_RULES: 'enableSocialCaseAssignmentRules',
  ENABLE_SOCIAL_CUSTOMER_SERVICE: 'enableSocialCustomerService',
  ENABLE_SOCIAL_PERSONA_HISTORY_TRACKING: 'enableSocialPersonaHistoryTracking',
  ENABLE_SOCIAL_POST_HISTORY_TRACKING: 'enableSocialPostHistoryTracking',
  ENABLE_SOCIAL_RECEIVE_PARENT_POST: 'enableSocialReceiveParentPost',
}

export const BUSINESS_HOURS_ENTRY = {
  TIME_ZONE_ID: 'timeZoneId',
  NAME: 'name',
  ACTIVE: 'active',
  DEFAULT: 'default',
  MONDAY_START_TIME: 'mondayStartTime',
  MONDAY_END_TIME: 'mondayEndTime',
  TUESDAY_START_TIME: 'TuesdayStartTime',
  TUESDAY_END_TIME: 'TuesdayEndTime',
  WEDNESDAY_START_TIME: 'wednesdayStartTime',
  WEDNESDAY_END_TIME: 'wednesdayEndTime',
  THURSDAY_START_TIME: 'thursdayStartTime',
  THURSDAY_END_TIME: 'thursdayEndTime',
  FRIDAY_START_TIME: 'fridayStartTime',
  FRIDAY_END_TIME: 'fridayEndTime',
  SATURDAY_START_TIME: 'saturdayStartTime',
  SATURDAY_END_TIME: 'saturdayEndTime',
  SUNDAY_START_TIME: 'sundayStartTime',
  SUNDAY_END_TIME: 'sundayEndTime',
}

export const HOLIDAYS = {
  NAME: 'name',
  DESCRIPTION: 'description',
  IS_RECURRING: 'isRecurring',
  ACTIVITY_DATE: 'activityDate',
  RECURRENCE_START_DATE: 'recurrenceStartDate',
  RECURRENCE_END_DATE: 'recurrenceEndDate',
  START_TIME: 'startTime',
  END_TIME: 'endTime',
  RECURRENCE_TYPE: 'recurrenceType',
  RECURRENCE_INTERVAL: 'recurrenceType',
  RECURRENCE_DAY_OF_THE_WEEK: 'recurrenceDayOfWeek',
  RECURRENCE_DAY_OF_THE_MONTH: 'recurrenceDayOfMonth',
  RECURRENCE_INSTANCE: 'recurrenceInstance',
  RECURRENCE_MONTH_OF_THE_YEAR: 'recurrenceMonthOfYear',
  BUSINESS_HOURS: 'businessHours',
}

export const ORGANIZATION_SETTINGS_DETAIL = {
  SETTING_NAME: 'settingName',
  SETTING_VALUE: 'settingValue',
}

// BPs path
export const RECORDS_PATH = 'Records'
export const SETTINGS_PATH = 'Settings'
export const OBJECTS_PATH = 'Objects'
export const TYPES_PATH = 'Types'
export const SUBTYPES_PATH = 'Subtypes'
export const INSTALLED_PACKAGES_PATH = 'InstalledPackages'

// Limits
export const MAX_METADATA_RESTRICTION_VALUES = 500
export const DEFAULT_MAX_CONCURRENT_RETRIEVE_REQUESTS = 3
export const DEFAULT_MAX_ITEMS_IN_RETRIEVE_REQUEST = 2500

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

// Retrieve constants
export const RETRIEVE_LOAD_OF_METADATA_ERROR_REGEX = /Load of metadata from db failed for metadata of type:(?<type>\w+) and file name:(?<instance>\w+).$/
