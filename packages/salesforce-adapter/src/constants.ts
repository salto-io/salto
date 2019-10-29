export const SALESFORCE = 'salesforce'
export const CUSTOM_FIELD = 'CustomField'
export const CUSTOM_OBJECT = 'CustomObject'
export const METADATA_OBJECT_NAME_FIELD = 'fullName'
export const FORMULA_TYPE_PREFIX = 'formula_'
export const SETTINGS_METADATA_TYPE = 'Settings'
export const SALESFORCE_CUSTOM_SUFFIX = '__c'

// Annotations
export const LABEL = 'label'
export const API_NAME = 'api_name'
export const FORMULA = 'formula'
export const DEFAULT_VALUE_FORMULA = 'default_value_formula'
export const METADATA_TYPE = 'metadata_type'
export const FIELD_PERMISSIONS = 'field_permissions'
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
  ADDRESS: 'address',
  NAME: 'name',
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
}

export const FIELD_ANNOTATIONS = {
  UNIQUE: 'unique',
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
  RELATED_TO: 'related_to',
  ALLOW_LOOKUP_RECORD_DELETION: 'allow_lookup_record_deletion',
  REPARENTABLE_MASTER_DETAIL: 'reparentable_master_detail',
  WRITE_REQUIRES_MASTER_READ: 'write_requires_master_read',
  LOOKUP_FILTER: 'lookup_filter',
}

export const LOOKUP_FILTER_FIELDS = {
  ACTIVE: 'active',
  BOOLEAN_FILTER: 'boolean_filter',
  ERROR_MESSAGE: 'error_message',
  INFO_MESSAGE: 'info_message',
  IS_OPTIONAL: 'is_optional',
  FILTER_ITEMS: 'filter_items',
  FIELD: 'field',
  OPERATION: 'operation',
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
  LATITUDE: 'latitude_s',
  LONGITUDE: 'longitude_s',
}

// Limits
export const MAX_METADATA_RESTRICTION_VALUES = 500
