export const SALESFORCE = 'salesforce'
export const CUSTOM_FIELD = 'CustomField'
export const CUSTOM_OBJECT = 'CustomObject'
export const METADATA_OBJECT_NAME_FIELD = 'fullName'
export const INSTANCE_FULL_NAME_FIELD = 'full_name'
export const FORMULA_TYPE_PREFIX = 'formula_'
export const SALESFORCE_CUSTOM_SUFFIX = '__c'
export const ADMIN_PROFILE = 'admin'
export const NAMESPACE_SEPARATOR = '__'

// Annotations
export const LABEL = 'label'
export const DESCRIPTION = 'description'
export const HELP_TEXT = 'inline_help_text'
export const API_NAME = 'api_name'
export const FORMULA = 'formula'
export const DEFAULT_VALUE_FORMULA = 'default_value_formula'
export const BUSINESS_OWNER_USER = 'business_owner_user'
export const BUSINESS_OWNER_GROUP = 'business_owner_group'
export const BUSINESS_STATUS = 'business_status'
export const SECURITY_CLASSIFICATION = 'security_classification'
export const COMPLIANCE_GROUP = 'compliance_group'
export const METADATA_TYPE = 'metadata_type'
export const FIELD_PERMISSIONS = 'field_permissions'
export const OBJECT_PERMISSIONS = 'object_permissions'
export const FIELD_LEVEL_SECURITY_ANNOTATION = 'field_level_security'
export const OBJECT_LEVEL_SECURITY_ANNOTATION = 'object_level_security'
export const TOPICS_FOR_OBJECTS_ANNOTATION = 'topics_for_objects'
export const FIELD_TYPE_NAMES = {
  STRING: 'string',
  AUTONUMBER: 'autonumber',
  TEXT: 'text',
  NUMBER: 'number',
  PERCENT: 'percent',
  CHECKBOX: 'checkbox',
  DATE: 'date',
  TIME: 'time',
  DATETIME: 'datetime',
  CURRENCY: 'currency',
  PICKLIST: 'picklist',
  MULTIPICKLIST: 'multipicklist',
  EMAIL: 'email',
  LOCATION: 'location',
  PHONE: 'phone',
  LONGTEXTAREA: 'longtextarea',
  RICHTEXTAREA: 'richtextarea',
  TEXTAREA: 'textarea',
  ENCRYPTEDTEXT: 'encryptedtext',
  URL: 'url',
  LOOKUP: 'lookup',
  MASTER_DETAIL: 'masterdetail',
  LOOKUP_FILTER: 'lookup_filter',
  FILTER_ITEM: 'filter_item',
  FIELD_DEPENDENCY: 'field_dependency',
  VALUE_SETTINGS: 'value_settings',
  ADDRESS: 'address',
  FIELD_NAME: 'field_name',
  ROLLUP_SUMMARY: 'rollupsummary',
}

export const FIELD_TYPE_API_NAMES = {
  [FIELD_TYPE_NAMES.AUTONUMBER]: 'AutoNumber',
  [FIELD_TYPE_NAMES.TEXT]: 'Text',
  [FIELD_TYPE_NAMES.NUMBER]: 'Number',
  [FIELD_TYPE_NAMES.PERCENT]: 'Percent',
  [FIELD_TYPE_NAMES.CHECKBOX]: 'Checkbox',
  [FIELD_TYPE_NAMES.DATE]: 'Date',
  [FIELD_TYPE_NAMES.TIME]: 'Time',
  [FIELD_TYPE_NAMES.DATETIME]: 'DateTime',
  [FIELD_TYPE_NAMES.CURRENCY]: 'Currency',
  [FIELD_TYPE_NAMES.PICKLIST]: 'Picklist',
  [FIELD_TYPE_NAMES.MULTIPICKLIST]: 'MultiselectPicklist',
  [FIELD_TYPE_NAMES.EMAIL]: 'Email',
  [FIELD_TYPE_NAMES.LOCATION]: 'Location',
  [FIELD_TYPE_NAMES.PHONE]: 'Phone',
  [FIELD_TYPE_NAMES.LONGTEXTAREA]: 'LongTextArea',
  [FIELD_TYPE_NAMES.RICHTEXTAREA]: 'Html',
  [FIELD_TYPE_NAMES.TEXTAREA]: 'TextArea',
  [FIELD_TYPE_NAMES.ENCRYPTEDTEXT]: 'EncryptedText',
  [FIELD_TYPE_NAMES.URL]: 'Url',
  [FIELD_TYPE_NAMES.LOOKUP]: 'Lookup',
  [FIELD_TYPE_NAMES.MASTER_DETAIL]: 'MasterDetail',
  [FIELD_TYPE_NAMES.ROLLUP_SUMMARY]: 'Summary',
}

export const FIELD_ANNOTATIONS = {
  UNIQUE: 'unique',
  EXTERNAL_ID: 'external_id',
  CASE_SENSITIVE: 'case_sensitive',
  LENGTH: 'length',
  SCALE: 'scale',
  PRECISION: 'precision',
  DISPLAY_FORMAT: 'display_format',
  VISIBLE_LINES: 'visible_lines',
  MASK_CHAR: 'mask_char',
  MASK_TYPE: 'mask_type',
  MASK: 'mask',
  DISPLAY_LOCATION_IN_DECIMAL: 'display_location_in_decimal',
  REFERENCE_TO: 'reference_to',
  ALLOW_LOOKUP_RECORD_DELETION: 'allow_lookup_record_deletion',
  REPARENTABLE_MASTER_DETAIL: 'reparentable_master_detail',
  WRITE_REQUIRES_MASTER_READ: 'write_requires_master_read',
  LOOKUP_FILTER: 'lookup_filter',
  FIELD_DEPENDENCY: 'field_dependency',
  SUMMARIZED_FIELD: 'summarized_field',
  SUMMARY_FILTER_ITEMS: 'summary_filter_items',
  SUMMARY_FOREIGN_KEY: 'summary_foreign_key',
  SUMMARY_OPERATION: 'summary_operation',
}

export const FIELD_DEPENDENCY_FIELDS = {
  CONTROLLING_FIELD: 'controlling_field',
  VALUE_SETTINGS: 'value_settings',
}

export const VALUE_SETTINGS_FIELDS = {
  CONTROLLING_FIELD_VALUE: 'controlling_field_value',
  VALUE_NAME: 'value_name',
}

export const LOOKUP_FILTER_FIELDS = {
  ACTIVE: 'active',
  BOOLEAN_FILTER: 'boolean_filter',
  ERROR_MESSAGE: 'error_message',
  INFO_MESSAGE: 'info_message',
  IS_OPTIONAL: 'is_optional',
  FILTER_ITEMS: 'filter_items',
}

export const FILTER_ITEM_FIELDS = {
  FIELD: 'field',
  OPERATION: 'operation',
  VALUE: 'value',
  VALUE_FIELD: 'value_field',
}

export const ADDRESS_FIELDS = {
  CITY: 'city',
  COUNTRY: 'country',
  GEOCODE_ACCURACY: 'geocode_accuracy',
  LATITUDE: 'latitude',
  LONGITUDE: 'longitude',
  POSTAL_CODE: 'postal_code',
  STATE: 'state',
  STREET: 'street',
}

export const NAME_FIELDS = {
  FIRST_NAME: 'first_name',
  LAST_NAME: 'last_name',
  SALUTATION: 'salutation',
}

export const GEOLOCATION_FIELDS = {
  LATITUDE: 'latitude',
  LONGITUDE: 'longitude',
}

export const FIELD_LEVEL_SECURITY_FIELDS = {
  EDITABLE: 'editable',
  READABLE: 'readable',
}

export const OBJECT_LEVEL_SECURITY_FIELDS = {
  ALLOW_CREATE: 'allow_create',
  ALLOW_DELETE: 'allow_delete',
  ALLOW_EDIT: 'allow_edit',
  ALLOW_READ: 'allow_read',
  MODIFY_ALL_RECORDS: 'modify_all_records',
  VIEW_ALL_RECORDS: 'view_all_records',
}

export const TOPICS_FOR_OBJECTS_FIELDS = {
  ENABLE_TOPICS: 'enable_topics',
  ENTITY_API_NAME: 'entity_api_name',
}

// Limits
export const MAX_METADATA_RESTRICTION_VALUES = 500

// Metadata types
export const TOPICS_FOR_OBJECTS_METADATA_TYPE = 'TopicsForObjects'
export const PROFILE_METADATA_TYPE = 'Profile'
