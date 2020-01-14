export const HUBSPOT = 'hubspot'

export const OBJECTS_NAMES = {
  FORM: 'form',
  WORKFLOWS: 'workflows',
  MARKETINGEMAIL: 'marketingEmail',

  // subtypes
  PROPERTYGROUP: 'PropertyGroup',
  PROPERTY: 'Property',
  OPTIONS: 'options',
  CONTACTLISTIDS: 'contactListIds',
}

// fields types
export const FIELD_TYPES = {
  TEXTAREA: 'textarea',
  TEXT: 'text',
  DATE: 'date',
  FILE: 'file',
  NUMBER: 'number',
  SELECT: 'select',
  RADIO: 'radio',
  CHECKBOX: 'checkbox',
  BOOLEANCHECKBOX: 'booleancheckbox',
}

// All form fields names
export const FORM_FIELDS = {
  GUID: 'guid',
  NAME: 'name',
  CSSCLASS: 'cssClass',
  REDIRECT: 'redirect',
  SUBMITTEXT: 'submitText',
  NOTIFYRECIPIENTS: 'notifyRecipients',
  IGNORECURRENTVALUES: 'ignoreCurrentValues',
  DELETABLE: 'deletable',
  INLINEMESSAGE: 'inlineMessage',
  CREATEDAT: 'createdAt',
  CAPTCHAENABLED: 'captchaEnabled',
  CLONEABLE: 'cloneable',
  EDITABLE: 'editable',
  STYLE: 'style',
  FORMFIELDGROUPS: 'formFieldGroups',
}

export const PROPERTY_GROUP_FIELDS = {
  DEFAULT: 'default',
  FIELDS: 'fields',
  ISSMARTGROUP: 'isSmartGroup',
}

export const PROPERTY_FIELDS = {
  NAME: 'name',
  LABEL: 'label',
  DESCRIPTION: 'description',
  GROUPNAME: 'groupName',
  TYPE: 'type',
  FIELDTYPE: 'fieldType',
  REQUIRED: 'required',
  HIDDEN: 'hidden',
  ISSMARTFIELD: 'isSmartField',
  DEFAULTVALUE: 'defaultValue',
  SELECTEDOPTIONS: 'selectedOptions',
  OPTIONS: 'options',
}

export const OPTIONS_FIELDS = {
  LABEL: 'label',
  DESCRIPTION: 'description',
  VALUE: 'value',
  HIDDEN: 'hidden',
  ISSMARTFIELD: 'isSmartField',
  DISPLAYORDER: 'displayOrder',
}

export const WORKFLOWS_FIELDS = {
  ID: 'id',
  NAME: 'name',
  TYPE: 'type',
  ENABLED: 'enabled',
  INSERTEDAT: 'insertedAt',
  UPDATEDAT: 'updatedAt',
  PERSONTALIDS: 'personaTagIds',
  CONTACTLISTIDS: 'contactListIds',
}

export const CONTACTLISTIDS_FIELDS = {
  ENROLLED: 'enrolled',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  SUCCEEDED: 'succeeded',
}

export const MARKETINGEMAIL_FIELDS = {
  ID: 'id',
  NAME: 'name',
  AB: 'ab',
  ABHOURSTOWAIT: 'abHoursToWait',
  ABVARIATION: 'abVariation',
  ABSAMPLESIZEDEFAULT: 'abSampleSizeDefault',
  ABSAMPLINGDEFAULT: 'abSamplingDefault',
  ABSTATUS: 'abStatus',
}
