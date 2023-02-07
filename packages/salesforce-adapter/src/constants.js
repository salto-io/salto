"use strict";
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
var _a, _b, _c;
exports.__esModule = true;
exports.VALUE_SETTINGS_FIELDS = exports.FIELD_DEPENDENCY_FIELDS = exports.VALUE_SET_FIELDS = exports.FIELD_ANNOTATIONS = exports.KEY_PREFIX = exports.COMPLIANCE_GROUP = exports.SECURITY_CLASSIFICATION = exports.BUSINESS_STATUS = exports.BUSINESS_OWNER_GROUP = exports.BUSINESS_OWNER_USER = exports.DEFAULT_VALUE_FORMULA = exports.FORMULA = exports.HELP_TEXT = exports.DESCRIPTION = exports.LABEL = exports.INTERNAL_ID_ANNOTATION = exports.FOLDER_CONTENT_TYPE = exports.IS_ATTRIBUTE = exports.LIST_CUSTOM_SETTINGS_TYPE = exports.CUSTOM_SETTINGS_TYPE = exports.FOREIGN_KEY_DOMAIN = exports.TOPICS_FOR_OBJECTS_ANNOTATION = exports.METADATA_TYPE = exports.API_NAME = exports.ANNOTATION_TYPE_NAMES = exports.FIELD_SOAP_TYPE_NAMES = exports.CUSTOM_FIELD_UPDATE_CREATE_ALLOWED_TYPES = exports.COMPOUND_FIELDS_SOAP_TYPE_NAMES = exports.LOCATION_INTERNAL_COMPOUND_FIELD_TYPE_NAME = exports.COMPOUND_FIELD_TYPE_NAMES = exports.INTERNAL_FIELD_TYPE_NAMES = exports.isRelationshipFieldName = exports.FIELD_TYPE_NAMES = exports.SALESFORCE_DATE_PLACEHOLDER = exports.DEFAULT_NAMESPACE = exports.XML_ATTRIBUTE_PREFIX = exports.INTERNAL_ID_FIELD = exports.CUSTOM_OBJECT_ID_FIELD = exports.API_NAME_SEPARATOR = exports.NAMESPACE_SEPARATOR = exports.ADMIN_PROFILE = exports.CUSTOM_METADATA_SUFFIX = exports.SALESFORCE_CUSTOM_SUFFIX = exports.FORMULA_TYPE_NAME = exports.METADATA_CONTENT_FIELD = exports.INSTANCE_FULL_NAME_FIELD = exports.CUSTOM_OBJECT = exports.CUSTOM_FIELD = exports.SALESFORCE = exports.RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS = void 0;
exports.WORKFLOW_KNOWLEDGE_PUBLISH_METADATA_TYPE = exports.WORKFLOW_FLOW_ACTION_METADATA_TYPE = exports.WORKFLOW_FIELD_UPDATE_METADATA_TYPE = exports.WORKFLOW_ACTION_REFERENCE_METADATA_TYPE = exports.WORKFLOW_ACTION_ALERT_METADATA_TYPE = exports.SUMMARY_LAYOUT_ITEM_METADATA_TYPE = exports.LIGHTNING_COMPONENT_BUNDLE_METADATA_TYPE = exports.LAYOUT_ITEM_METADATA_TYPE = exports.LAYOUT_TYPE_ID_METADATA_TYPE = exports.SHARING_RULES_TYPE = exports.CUSTOM_OBJECT_TRANSLATION_METADATA_TYPE = exports.DUPLICATE_RULE_METADATA_TYPE = exports.CUSTOM_TAB_METADATA_TYPE = exports.QUICK_ACTION_METADATA_TYPE = exports.LEAD_CONVERT_SETTINGS_METADATA_TYPE = exports.RECORD_TYPE_METADATA_TYPE = exports.BUSINESS_PROCESS_METADATA_TYPE = exports.VALIDATION_RULES_METADATA_TYPE = exports.ASSIGNMENT_RULES_METADATA_TYPE = exports.WORKFLOW_METADATA_TYPE = exports.PERMISSION_SET_METADATA_TYPE = exports.PROFILE_METADATA_TYPE = exports.TOPICS_FOR_OBJECTS_METADATA_TYPE = exports.CURRENCY_ISO_CODE = exports.MAX_TYPES_TO_SEPARATE_TO_FILE_PER_FIELD = exports.DEFAULT_CUSTOM_OBJECTS_DEFAULT_RETRY_OPTIONS = exports.DEFAULT_ENUM_FIELD_PERMISSIONS = exports.MAX_QUERY_LENGTH = exports.MAXIMUM_MAX_ITEMS_IN_RETRIEVE_REQUEST = exports.MINIMUM_MAX_ITEMS_IN_RETRIEVE_REQUEST = exports.DEFAULT_MAX_INSTANCES_PER_TYPE = exports.DEFAULT_MAX_ITEMS_IN_RETRIEVE_REQUEST = exports.DEFAULT_MAX_CONCURRENT_API_REQUESTS = exports.MAX_TOTAL_CONCURRENT_API_REQUEST = exports.MAX_METADATA_RESTRICTION_VALUES = exports.OBJECT_FIELDS_PATH = exports.INSTALLED_PACKAGES_PATH = exports.SUBTYPES_PATH = exports.TYPES_PATH = exports.OBJECTS_PATH = exports.SETTINGS_PATH = exports.RECORDS_PATH = exports.TOPICS_FOR_OBJECTS_FIELDS = exports.GEOLOCATION_FIELDS = exports.NAME_FIELDS = exports.ADDRESS_FIELDS = exports.FILTER_ITEM_FIELDS = exports.LOOKUP_FILTER_FIELDS = exports.CUSTOM_VALUE = exports.VALUE_SET_DEFINITION_FIELDS = void 0;
exports.CPQ_CONSUMPTION_RATE_FIELDS = exports.CPQ_OBJECT_NAME = exports.CPQ_SOURCE_LOOKUP_FIELD = exports.CPQ_RULE_LOOKUP_OBJECT_FIELD = exports.CPQ_LOOKUP_FIELD = exports.CPQ_LOOKUP_TYPE_FIELD = exports.CPQ_LOOKUP_REQUIRED_FIELD = exports.CPQ_LOOKUP_MESSAGE_FIELD = exports.CPQ_LOOKUP_PRODUCT_FIELD = exports.CPQ_LOOKUP_OBJECT_NAME = exports.CPQ_SUBSCRIPTION = exports.CPQ_DISCOUNT_SCHEDULE = exports.CPQ_PRICE_SCHEDULE = exports.CPQ_PRODUCT_OPTION = exports.CPQ_QUOTE_LINE = exports.CPQ_QUOTE_LINE_GROUP = exports.CPQ_QUOTE = exports.CPQ_CONFIGURATION_ATTRIBUTE = exports.CPQ_CUSTOM_SCRIPT = exports.CPQ_FIELD_METADATA = exports.CPQ_PRICE_ACTION = exports.CPQ_LOOKUP_QUERY = exports.CPQ_PRICE_RULE = exports.CPQ_PRODUCT_RULE = exports.CPQ_NAMESPACE = exports.KEY_PREFIX_LENGTH = exports.RETRIEVE_SIZE_LIMIT_ERROR = exports.RETRIEVE_LOAD_OF_METADATA_ERROR_REGEX = exports.CURRENCY_CODE_TYPE_NAME = exports.ACTIVATE_RSS = exports.INSTALLED_PACKAGE_METADATA = exports.FLOW_DEFINITION_METADATA_TYPE = exports.CUSTOM_METADATA = exports.EMAIL_TEMPLATE_METADATA_TYPE = exports.FLOW_METADATA_TYPE = exports.GROUP_METADATA_TYPE = exports.ROLE_METADATA_TYPE = exports.CUSTOM_LABELS_METADATA_TYPE = exports.CUSTOM_LABEL_METADATA_TYPE = exports.FLEXI_PAGE_TYPE = exports.LIGHTNING_PAGE_TYPE = exports.TERRITORY2_RULE_TYPE = exports.TERRITORY2_MODEL_TYPE = exports.TERRITORY2_TYPE = exports.SETTINGS_METADATA_TYPE = exports.BUSINESS_HOURS_METADATA_TYPE = exports.WEBLINK_METADATA_TYPE = exports.WORKFLOW_TASK_METADATA_TYPE = exports.WORKFLOW_RULE_METADATA_TYPE = exports.WORKFLOW_OUTBOUND_MESSAGE_METADATA_TYPE = void 0;
exports.ENOTFOUND = exports.INVALID_GRANT = exports.SF_REQUEST_LIMIT_EXCEEDED = exports.ERROR_HTTP_502 = exports.UNKNOWN_EXCEPTION = exports.INVALID_TYPE = exports.INVALID_FIELD = exports.INVALID_ID_FIELD = exports.DUPLICATE_VALUE = exports.INVALID_CROSS_REFERENCE_KEY = exports.SOCKET_TIMEOUT = exports.UNLIMITED_INSTANCES_VALUE = exports.SBAA_APPROVAL_RULE = exports.SBAA_APPROVAL_CONDITION = exports.SBAA_NAMESPACE = exports.SCHEDULE_CONTRAINT_FIELD_TO_API_MAPPING = exports.TEST_OBJECT_TO_API_MAPPING = exports.CPQ_PRODUCT_OPTION_NAME = exports.CPQ_QUOTE_LINE_NAME = exports.CPQ_QUOTE_NAME = exports.DEFAULT_OBJECT_TO_API_MAPPING = exports.CPQ_ACCOUNT_NO_PRE = exports.CPQ_QUOTE_LINE_GROUP_NO_PRE = exports.CPQ_QUOTE_NO_PRE = exports.CPQ_TARGET_OBJECT = exports.CPQ_TARGET_FIELD = exports.CPQ_HIDDEN_SOURCE_OBJECT = exports.CPQ_HIDDEN_SOURCE_FIELD = exports.CPQ_FILTER_SOURCE_OBJECT = exports.CPQ_FILTER_SOURCE_FIELD = exports.CPQ_ACCOUNT = exports.CPQ_CONSTRAINT_FIELD = exports.CPQ_TESTED_OBJECT = exports.CPQ_DEFAULT_OBJECT_FIELD = exports.CPQ_CODE_FIELD = exports.CPQ_QUOTE_LINE_FIELDS = exports.CPQ_QUOTE_FIELDS = exports.CPQ_GROUP_FIELDS = exports.CPQ_CONSUMPTION_SCHEDULE_FIELDS = void 0;
/*
*                      Copyright 2023 Salto Labs Ltd.
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
var adapter_components_1 = require("@salto-io/adapter-components");
exports.RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS = adapter_components_1.client.RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS;
exports.SALESFORCE = 'salesforce';
exports.CUSTOM_FIELD = 'CustomField';
exports.CUSTOM_OBJECT = 'CustomObject';
exports.INSTANCE_FULL_NAME_FIELD = 'fullName';
exports.METADATA_CONTENT_FIELD = 'content';
exports.FORMULA_TYPE_NAME = 'Formula';
exports.SALESFORCE_CUSTOM_SUFFIX = '__c';
exports.CUSTOM_METADATA_SUFFIX = '__mdt';
exports.ADMIN_PROFILE = 'Admin';
exports.NAMESPACE_SEPARATOR = '__';
exports.API_NAME_SEPARATOR = '.';
exports.CUSTOM_OBJECT_ID_FIELD = 'Id';
exports.INTERNAL_ID_FIELD = 'internalId';
exports.XML_ATTRIBUTE_PREFIX = 'attr_';
exports.DEFAULT_NAMESPACE = 'standard';
exports.SALESFORCE_DATE_PLACEHOLDER = '1970-01-01T00:00:00.000Z';
var FIELD_TYPE_NAMES;
(function (FIELD_TYPE_NAMES) {
    FIELD_TYPE_NAMES["AUTONUMBER"] = "AutoNumber";
    FIELD_TYPE_NAMES["TEXT"] = "Text";
    FIELD_TYPE_NAMES["NUMBER"] = "Number";
    FIELD_TYPE_NAMES["PERCENT"] = "Percent";
    FIELD_TYPE_NAMES["CHECKBOX"] = "Checkbox";
    FIELD_TYPE_NAMES["DATE"] = "Date";
    FIELD_TYPE_NAMES["TIME"] = "Time";
    FIELD_TYPE_NAMES["DATETIME"] = "DateTime";
    FIELD_TYPE_NAMES["CURRENCY"] = "Currency";
    FIELD_TYPE_NAMES["PICKLIST"] = "Picklist";
    FIELD_TYPE_NAMES["MULTIPICKLIST"] = "MultiselectPicklist";
    FIELD_TYPE_NAMES["EMAIL"] = "Email";
    FIELD_TYPE_NAMES["PHONE"] = "Phone";
    FIELD_TYPE_NAMES["LONGTEXTAREA"] = "LongTextArea";
    FIELD_TYPE_NAMES["RICHTEXTAREA"] = "Html";
    FIELD_TYPE_NAMES["TEXTAREA"] = "TextArea";
    FIELD_TYPE_NAMES["ENCRYPTEDTEXT"] = "EncryptedText";
    FIELD_TYPE_NAMES["URL"] = "Url";
    FIELD_TYPE_NAMES["LOOKUP"] = "Lookup";
    FIELD_TYPE_NAMES["MASTER_DETAIL"] = "MasterDetail";
    FIELD_TYPE_NAMES["ROLLUP_SUMMARY"] = "Summary";
    FIELD_TYPE_NAMES["HIERARCHY"] = "Hierarchy";
    FIELD_TYPE_NAMES["METADATA_RELATIONSHIP"] = "MetadataRelationship";
    FIELD_TYPE_NAMES["EXTERNAL_LOOKUP"] = "ExternalLookup";
    FIELD_TYPE_NAMES["INDIRECT_LOOKUP"] = "IndirectLookup";
    FIELD_TYPE_NAMES["FILE"] = "File";
})(FIELD_TYPE_NAMES = exports.FIELD_TYPE_NAMES || (exports.FIELD_TYPE_NAMES = {}));
var RELATIONSHIP_FIELD_NAMES = [
    'MetadataRelationship',
    'Lookup',
    'MasterDetail',
];
var isRelationshipFieldName = function (fieldName) { return (RELATIONSHIP_FIELD_NAMES.includes(fieldName)); };
exports.isRelationshipFieldName = isRelationshipFieldName;
var INTERNAL_FIELD_TYPE_NAMES;
(function (INTERNAL_FIELD_TYPE_NAMES) {
    INTERNAL_FIELD_TYPE_NAMES["UNKNOWN"] = "Unknown";
    INTERNAL_FIELD_TYPE_NAMES["ANY"] = "AnyType";
    INTERNAL_FIELD_TYPE_NAMES["SERVICE_ID"] = "serviceid";
})(INTERNAL_FIELD_TYPE_NAMES = exports.INTERNAL_FIELD_TYPE_NAMES || (exports.INTERNAL_FIELD_TYPE_NAMES = {}));
var COMPOUND_FIELD_TYPE_NAMES;
(function (COMPOUND_FIELD_TYPE_NAMES) {
    COMPOUND_FIELD_TYPE_NAMES["ADDRESS"] = "Address";
    COMPOUND_FIELD_TYPE_NAMES["FIELD_NAME"] = "Name";
    COMPOUND_FIELD_TYPE_NAMES["FIELD_NAME_NO_SALUTATION"] = "Name2";
    COMPOUND_FIELD_TYPE_NAMES["LOCATION"] = "Location";
})(COMPOUND_FIELD_TYPE_NAMES = exports.COMPOUND_FIELD_TYPE_NAMES || (exports.COMPOUND_FIELD_TYPE_NAMES = {}));
// We use Geolocation internally to avoid conflicts with the Location standard object
exports.LOCATION_INTERNAL_COMPOUND_FIELD_TYPE_NAME = 'Geolocation';
exports.COMPOUND_FIELDS_SOAP_TYPE_NAMES = {
    address: COMPOUND_FIELD_TYPE_NAMES.ADDRESS,
    location: COMPOUND_FIELD_TYPE_NAMES.LOCATION,
};
// target types for creating / updating custom fields:
exports.CUSTOM_FIELD_UPDATE_CREATE_ALLOWED_TYPES = __spreadArrays(Object.values(FIELD_TYPE_NAMES), [
    COMPOUND_FIELD_TYPE_NAMES.LOCATION,
    COMPOUND_FIELD_TYPE_NAMES.ADDRESS,
]);
exports.FIELD_SOAP_TYPE_NAMES = {
    anyType: INTERNAL_FIELD_TYPE_NAMES.ANY,
    base64: FIELD_TYPE_NAMES.TEXT,
    boolean: FIELD_TYPE_NAMES.CHECKBOX,
    combobox: FIELD_TYPE_NAMES.PICKLIST,
    complexvalue: FIELD_TYPE_NAMES.TEXT,
    currency: FIELD_TYPE_NAMES.CURRENCY,
    date: FIELD_TYPE_NAMES.DATE,
    datetime: FIELD_TYPE_NAMES.DATETIME,
    double: FIELD_TYPE_NAMES.NUMBER,
    email: FIELD_TYPE_NAMES.EMAIL,
    encryptedstring: FIELD_TYPE_NAMES.ENCRYPTEDTEXT,
    id: FIELD_TYPE_NAMES.TEXT,
    int: FIELD_TYPE_NAMES.NUMBER,
    json: FIELD_TYPE_NAMES.TEXT,
    multipicklist: FIELD_TYPE_NAMES.MULTIPICKLIST,
    percent: FIELD_TYPE_NAMES.PERCENT,
    phone: FIELD_TYPE_NAMES.PHONE,
    picklist: FIELD_TYPE_NAMES.PICKLIST,
    // reference: FIELD_TYPE_NAMES.LOOKUP, // Has special treatment in the code
    string: FIELD_TYPE_NAMES.TEXT,
    textarea: FIELD_TYPE_NAMES.TEXTAREA,
    time: FIELD_TYPE_NAMES.TIME,
    url: FIELD_TYPE_NAMES.URL,
};
var ANNOTATION_TYPE_NAMES;
(function (ANNOTATION_TYPE_NAMES) {
    ANNOTATION_TYPE_NAMES["LOOKUP_FILTER"] = "LookupFilter";
    ANNOTATION_TYPE_NAMES["FILTER_ITEM"] = "FilterItem";
    ANNOTATION_TYPE_NAMES["FIELD_DEPENDENCY"] = "FieldDependency";
    ANNOTATION_TYPE_NAMES["VALUE_SETTINGS"] = "ValueSettings";
})(ANNOTATION_TYPE_NAMES = exports.ANNOTATION_TYPE_NAMES || (exports.ANNOTATION_TYPE_NAMES = {}));
// Salto annotations
exports.API_NAME = 'apiName';
exports.METADATA_TYPE = 'metadataType';
exports.TOPICS_FOR_OBJECTS_ANNOTATION = 'topicsForObjects';
exports.FOREIGN_KEY_DOMAIN = 'foreignKeyDomain';
exports.CUSTOM_SETTINGS_TYPE = 'customSettingsType';
exports.LIST_CUSTOM_SETTINGS_TYPE = 'List';
exports.IS_ATTRIBUTE = 'isAttribute';
exports.FOLDER_CONTENT_TYPE = 'folderContentType';
// must have the same name as INTERNAL_ID_FIELD
exports.INTERNAL_ID_ANNOTATION = exports.INTERNAL_ID_FIELD;
// Salesforce annotations
exports.LABEL = 'label';
exports.DESCRIPTION = 'description';
exports.HELP_TEXT = 'inlineHelpText';
exports.FORMULA = 'formula';
exports.DEFAULT_VALUE_FORMULA = 'defaultValueFormula';
exports.BUSINESS_OWNER_USER = 'businessOwnerUser';
exports.BUSINESS_OWNER_GROUP = 'businessOwnerGroup';
exports.BUSINESS_STATUS = 'businessStatus';
exports.SECURITY_CLASSIFICATION = 'securityClassification';
exports.COMPLIANCE_GROUP = 'complianceGroup';
exports.KEY_PREFIX = 'keyPrefix';
exports.FIELD_ANNOTATIONS = {
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
};
exports.VALUE_SET_FIELDS = {
    RESTRICTED: 'restricted',
    VALUE_SET_DEFINITION: 'valueSetDefinition',
    VALUE_SET_NAME: 'valueSetName',
};
exports.FIELD_DEPENDENCY_FIELDS = {
    CONTROLLING_FIELD: 'controllingField',
    VALUE_SETTINGS: 'valueSettings',
};
exports.VALUE_SETTINGS_FIELDS = {
    CONTROLLING_FIELD_VALUE: 'controllingFieldValue',
    VALUE_NAME: 'valueName',
};
exports.VALUE_SET_DEFINITION_FIELDS = {
    SORTED: 'sorted',
    VALUE: 'value',
};
exports.CUSTOM_VALUE = {
    FULL_NAME: exports.INSTANCE_FULL_NAME_FIELD,
    DEFAULT: 'default',
    LABEL: 'label',
    IS_ACTIVE: 'isActive',
    COLOR: 'color',
};
exports.LOOKUP_FILTER_FIELDS = {
    ACTIVE: 'active',
    BOOLEAN_FILTER: 'booleanFilter',
    ERROR_MESSAGE: 'errorMessage',
    INFO_MESSAGE: 'infoMessage',
    IS_OPTIONAL: 'isOptional',
    FILTER_ITEMS: 'filterItems',
};
exports.FILTER_ITEM_FIELDS = {
    FIELD: 'field',
    OPERATION: 'operation',
    VALUE: 'value',
    VALUE_FIELD: 'valueField',
};
exports.ADDRESS_FIELDS = {
    CITY: 'city',
    COUNTRY: 'country',
    GEOCODE_ACCURACY: 'geocodeAccuracy',
    LATITUDE: 'latitude',
    LONGITUDE: 'longitude',
    POSTAL_CODE: 'postalCode',
    STATE: 'state',
    STREET: 'street',
};
exports.NAME_FIELDS = {
    FIRST_NAME: 'FirstName',
    LAST_NAME: 'LastName',
    SALUTATION: 'Salutation',
    MIDDLE_NAME: 'MiddleName',
    SUFFIX: 'Suffix',
};
exports.GEOLOCATION_FIELDS = {
    LATITUDE: 'latitude',
    LONGITUDE: 'longitude',
};
exports.TOPICS_FOR_OBJECTS_FIELDS = {
    ENABLE_TOPICS: 'enableTopics',
    ENTITY_API_NAME: 'entityApiName',
};
// NACL files path
exports.RECORDS_PATH = 'Records';
exports.SETTINGS_PATH = 'Settings';
exports.OBJECTS_PATH = 'Objects';
exports.TYPES_PATH = 'Types';
exports.SUBTYPES_PATH = 'Subtypes';
exports.INSTALLED_PACKAGES_PATH = 'InstalledPackages';
exports.OBJECT_FIELDS_PATH = 'Fields';
// Limits
exports.MAX_METADATA_RESTRICTION_VALUES = 500;
exports.MAX_TOTAL_CONCURRENT_API_REQUEST = 100;
exports.DEFAULT_MAX_CONCURRENT_API_REQUESTS = {
    total: exports.MAX_TOTAL_CONCURRENT_API_REQUEST,
    retrieve: 3,
    read: exports.RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
    list: exports.RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
    query: 4,
    describe: exports.RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
    deploy: exports.RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
};
exports.DEFAULT_MAX_ITEMS_IN_RETRIEVE_REQUEST = 2500;
exports.DEFAULT_MAX_INSTANCES_PER_TYPE = 5000;
exports.MINIMUM_MAX_ITEMS_IN_RETRIEVE_REQUEST = 500;
exports.MAXIMUM_MAX_ITEMS_IN_RETRIEVE_REQUEST = 10000;
exports.MAX_QUERY_LENGTH = 2000;
exports.DEFAULT_ENUM_FIELD_PERMISSIONS = true;
exports.DEFAULT_CUSTOM_OBJECTS_DEFAULT_RETRY_OPTIONS = {
    maxAttempts: 3,
    retryDelay: 1000,
    retryableFailures: [
        'FIELD_CUSTOM_VALIDATION_EXCEPTION',
        'UNABLE_TO_LOCK_ROW',
    ],
};
exports.MAX_TYPES_TO_SEPARATE_TO_FILE_PER_FIELD = 20;
// Fields
exports.CURRENCY_ISO_CODE = 'CurrencyIsoCode';
// Metadata types
exports.TOPICS_FOR_OBJECTS_METADATA_TYPE = 'TopicsForObjects';
exports.PROFILE_METADATA_TYPE = 'Profile';
exports.PERMISSION_SET_METADATA_TYPE = 'PermissionSet';
exports.WORKFLOW_METADATA_TYPE = 'Workflow';
exports.ASSIGNMENT_RULES_METADATA_TYPE = 'AssignmentRules';
exports.VALIDATION_RULES_METADATA_TYPE = 'ValidationRule';
exports.BUSINESS_PROCESS_METADATA_TYPE = 'BusinessProcess';
exports.RECORD_TYPE_METADATA_TYPE = 'RecordType';
exports.LEAD_CONVERT_SETTINGS_METADATA_TYPE = 'LeadConvertSettings';
exports.QUICK_ACTION_METADATA_TYPE = 'QuickAction';
exports.CUSTOM_TAB_METADATA_TYPE = 'CustomTab';
exports.DUPLICATE_RULE_METADATA_TYPE = 'DuplicateRule';
exports.CUSTOM_OBJECT_TRANSLATION_METADATA_TYPE = 'CustomObjectTranslation';
exports.SHARING_RULES_TYPE = 'SharingRules';
exports.LAYOUT_TYPE_ID_METADATA_TYPE = 'Layout';
exports.LAYOUT_ITEM_METADATA_TYPE = 'LayoutItem';
exports.LIGHTNING_COMPONENT_BUNDLE_METADATA_TYPE = 'LightningComponentBundle';
exports.SUMMARY_LAYOUT_ITEM_METADATA_TYPE = 'SummaryLayoutItem';
exports.WORKFLOW_ACTION_ALERT_METADATA_TYPE = 'WorkflowAlert';
exports.WORKFLOW_ACTION_REFERENCE_METADATA_TYPE = 'WorkflowActionReference';
exports.WORKFLOW_FIELD_UPDATE_METADATA_TYPE = 'WorkflowFieldUpdate';
exports.WORKFLOW_FLOW_ACTION_METADATA_TYPE = 'WorkflowFlowAction';
exports.WORKFLOW_KNOWLEDGE_PUBLISH_METADATA_TYPE = 'WorkflowKnowledgePublish';
exports.WORKFLOW_OUTBOUND_MESSAGE_METADATA_TYPE = 'WorkflowOutboundMessage';
exports.WORKFLOW_RULE_METADATA_TYPE = 'WorkflowRule';
exports.WORKFLOW_TASK_METADATA_TYPE = 'WorkflowTask';
exports.WEBLINK_METADATA_TYPE = 'WebLink';
exports.BUSINESS_HOURS_METADATA_TYPE = 'BusinessHoursSettings';
exports.SETTINGS_METADATA_TYPE = 'Settings';
exports.TERRITORY2_TYPE = 'Territory2';
exports.TERRITORY2_MODEL_TYPE = 'Territory2Model';
exports.TERRITORY2_RULE_TYPE = 'Territory2Rule';
exports.LIGHTNING_PAGE_TYPE = 'LightningPage';
exports.FLEXI_PAGE_TYPE = 'FlexiPage';
exports.CUSTOM_LABEL_METADATA_TYPE = 'CustomLabel';
exports.CUSTOM_LABELS_METADATA_TYPE = 'CustomLabels';
exports.ROLE_METADATA_TYPE = 'Role';
exports.GROUP_METADATA_TYPE = 'Group';
exports.FLOW_METADATA_TYPE = 'Flow';
exports.EMAIL_TEMPLATE_METADATA_TYPE = 'EmailTemplate';
exports.CUSTOM_METADATA = 'CustomMetadata';
exports.FLOW_DEFINITION_METADATA_TYPE = 'FlowDefinition';
exports.INSTALLED_PACKAGE_METADATA = 'InstalledPackage';
exports.ACTIVATE_RSS = 'activateRSS';
// Artifitial Types
exports.CURRENCY_CODE_TYPE_NAME = 'CurrencyIsoCodes';
// Retrieve constants
exports.RETRIEVE_LOAD_OF_METADATA_ERROR_REGEX = /Load of metadata from db failed for metadata of type:(?<type>\w+) and file name:(?<instance>\w+).$/;
exports.RETRIEVE_SIZE_LIMIT_ERROR = 'LIMIT_EXCEEDED';
// According to Salesforce spec the keyPrefix length is 3
// If this changes in the future we need to change this and add further logic where it's used
exports.KEY_PREFIX_LENGTH = 3;
// CPQ CustomObjects
exports.CPQ_NAMESPACE = 'SBQQ';
exports.CPQ_PRODUCT_RULE = 'SBQQ__ProductRule__c';
exports.CPQ_PRICE_RULE = 'SBQQ__PriceRule__c';
exports.CPQ_LOOKUP_QUERY = 'SBQQ__LookupQuery__c';
exports.CPQ_PRICE_ACTION = 'SBQQ__PriceAction__c';
exports.CPQ_FIELD_METADATA = 'SBQQ__FieldMetadata__c';
exports.CPQ_CUSTOM_SCRIPT = 'SBQQ__CustomScript__c';
exports.CPQ_CONFIGURATION_ATTRIBUTE = 'SBQQ__ConfigurationAttribute__c';
exports.CPQ_QUOTE = 'SBQQ__Quote__c';
exports.CPQ_QUOTE_LINE_GROUP = 'SBQQ__QuoteLineGroup__c';
exports.CPQ_QUOTE_LINE = 'SBQQ__QuoteLine__c';
exports.CPQ_PRODUCT_OPTION = 'SBQQ__ProductOption__c';
exports.CPQ_PRICE_SCHEDULE = 'SBQQ__PriceSchedule__c';
exports.CPQ_DISCOUNT_SCHEDULE = 'SBQQ__DiscountSchedule__c';
exports.CPQ_SUBSCRIPTION = 'SBQQ__Subscription__c';
// CPQ Fields
exports.CPQ_LOOKUP_OBJECT_NAME = 'SBQQ__LookupObject__c';
exports.CPQ_LOOKUP_PRODUCT_FIELD = 'SBQQ__LookupProductField__c';
exports.CPQ_LOOKUP_MESSAGE_FIELD = 'SBQQ__LookupMessageField__c';
exports.CPQ_LOOKUP_REQUIRED_FIELD = 'SBQQ__LookupRequiredField__c';
exports.CPQ_LOOKUP_TYPE_FIELD = 'SBQQ__LookupTypeField__c';
exports.CPQ_LOOKUP_FIELD = 'SBQQ__LookupField__c';
exports.CPQ_RULE_LOOKUP_OBJECT_FIELD = 'SBQQ__RuleLookupObject__c';
exports.CPQ_SOURCE_LOOKUP_FIELD = 'SBQQ__SourceLookupField__c';
exports.CPQ_OBJECT_NAME = 'SBQQ__ObjectName__c';
exports.CPQ_CONSUMPTION_RATE_FIELDS = 'SBQQ__ConsumptionRateFields__c';
exports.CPQ_CONSUMPTION_SCHEDULE_FIELDS = 'SBQQ__ConsumptionScheduleFields__c';
exports.CPQ_GROUP_FIELDS = 'SBQQ__GroupFields__c';
exports.CPQ_QUOTE_FIELDS = 'SBQQ__QuoteFields__c';
exports.CPQ_QUOTE_LINE_FIELDS = 'SBQQ__QuoteLineFields__c';
exports.CPQ_CODE_FIELD = 'SBQQ__Code__c';
exports.CPQ_DEFAULT_OBJECT_FIELD = 'SBQQ__DefaultObject__c';
exports.CPQ_TESTED_OBJECT = 'SBQQ__TestedObject__c';
exports.CPQ_CONSTRAINT_FIELD = 'SBQQ__ConstraintField__c';
exports.CPQ_ACCOUNT = 'SBQQ__Account__c';
exports.CPQ_FILTER_SOURCE_FIELD = 'SBQQ__FilterSourceField__c';
exports.CPQ_FILTER_SOURCE_OBJECT = 'SBQQ__FilterSourceObject__c';
exports.CPQ_HIDDEN_SOURCE_FIELD = 'SBQQ__HiddenSourceField__c';
exports.CPQ_HIDDEN_SOURCE_OBJECT = 'SBQQ__HiddenSourceObject__c';
exports.CPQ_TARGET_FIELD = 'SBQQ__TargetField__c';
exports.CPQ_TARGET_OBJECT = 'SBQQ__TargetObject__c';
exports.CPQ_QUOTE_NO_PRE = 'Quote__c';
exports.CPQ_QUOTE_LINE_GROUP_NO_PRE = 'QuoteLineGroup__c';
exports.CPQ_ACCOUNT_NO_PRE = 'Account__c';
exports.DEFAULT_OBJECT_TO_API_MAPPING = (_a = {},
    _a[exports.CPQ_QUOTE_NO_PRE] = exports.CPQ_QUOTE,
    _a[exports.CPQ_QUOTE_LINE_GROUP_NO_PRE] = exports.CPQ_QUOTE_LINE_GROUP,
    _a);
exports.CPQ_QUOTE_NAME = 'Quote';
exports.CPQ_QUOTE_LINE_NAME = 'Quote Line';
exports.CPQ_PRODUCT_OPTION_NAME = 'Product Option';
exports.TEST_OBJECT_TO_API_MAPPING = (_b = {},
    _b[exports.CPQ_QUOTE_NAME] = exports.CPQ_QUOTE,
    _b[exports.CPQ_QUOTE_LINE_NAME] = exports.CPQ_QUOTE_LINE,
    _b[exports.CPQ_PRODUCT_OPTION_NAME] = exports.CPQ_PRODUCT_OPTION,
    _b);
exports.SCHEDULE_CONTRAINT_FIELD_TO_API_MAPPING = (_c = {},
    _c[exports.CPQ_ACCOUNT_NO_PRE] = exports.CPQ_ACCOUNT,
    _c);
// sbaa
exports.SBAA_NAMESPACE = 'sbaa';
// sbaa Objects
exports.SBAA_APPROVAL_CONDITION = 'sbaa__ApprovalCondition__c';
exports.SBAA_APPROVAL_RULE = 'sbaa__ApprovalRule__c';
exports.UNLIMITED_INSTANCES_VALUE = -1;
// Errors
exports.SOCKET_TIMEOUT = 'ESOCKETTIMEDOUT';
exports.INVALID_CROSS_REFERENCE_KEY = 'sf:INVALID_CROSS_REFERENCE_KEY';
exports.DUPLICATE_VALUE = 'sf:DUPLICATE_VALUE';
exports.INVALID_ID_FIELD = 'sf:INVALID_ID_FIELD';
exports.INVALID_FIELD = 'sf:INVALID_FIELD';
exports.INVALID_TYPE = 'sf:INVALID_TYPE';
exports.UNKNOWN_EXCEPTION = 'sf:UNKNOWN_EXCEPTION';
exports.ERROR_HTTP_502 = 'ERROR_HTTP_502';
exports.SF_REQUEST_LIMIT_EXCEEDED = 'sf:REQUEST_LIMIT_EXCEEDED';
exports.INVALID_GRANT = 'invalid_grant';
exports.ENOTFOUND = 'ENOTFOUND';
