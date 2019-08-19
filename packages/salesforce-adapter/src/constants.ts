export const SALESFORCE = 'salesforce'
export const CUSTOM_FIELD = 'CustomField'
export const CUSTOM_OBJECT = 'CustomObject'
export const METADATA_OBJECT_NAME_FIELD = 'fullName'
export const FORMULA_TYPE_PREFIX = 'formula_'
export const SETTINGS_METADATA_TYPE = 'Settings'
export const SALESFORCE_CUSTOM_SUFFIX = '__c'

// Anotations
export const LABEL = 'label'
export const RESTRICTED_PICKLIST = 'restricted_pick_list'
export const PICKLIST_VALUES = 'values'
export const API_NAME = 'api_name'
export const FORMULA = 'formula'
export const METADATA_TYPE = 'metadata_type'
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
}

// Limits
export const MAX_METADATA_RESTRICTION_VALUES = 500
