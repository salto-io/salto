export interface HubspotMetadata {
  name: string
}

export interface Form extends HubspotMetadata {
  guid: string
  cssClass: string
  redirect: string
  submitText: string
  notifyRecipients: string
  ignoreCurrentValues: boolean
  deletable: boolean
  inlineMessage: string
  formFieldGroups: PropertyGroup[]
  createdAt: number
  captchaEnabled: boolean
  cloneable: boolean
  editable: boolean
}

interface PropertyGroup {
  fields: Property[]
  default: boolean
  isSmartGroup: boolean
}

interface Options {
  label: string
  value: string
  displayOrder: number
  doubleData: number
  hidden: boolean
  description: string
  readOnly: boolean
}

export interface Property {
  name: string
  // String; The internal name of the property.
  // The name should be used when referencing the property through the API
  label: string
  // String; A human readable label for the property.
  // The label is used to display the property in the HubSpot UI.
  description: string
  groupName: string
  // The property group that the property belongs to.
  type: string
  // String, one of string, number, date, datetime, or enumeration
  // This needs to match the 'type' field of the corresponding contact property.
  fieldType: string
  // String, one of textarea, text, date, file, number, select, radio, checkbox or boolean checkbox
  // Controls how the property appears in a form when the property is used as a form field.
  required: boolean
  // Required fields must be filled out to submit the form.
  hidden: boolean
  // Hidden fields do not appear in the HubSpot UI
  isSmartField: boolean
  // Whether or not the field is a smart field.
  // Smart fields are hidden if the visitor is a known contact that already has a value for
  // the field.
  defaultValue: string
  // The default value of the field
  selectedOptions: string[]
  options: Options[]
}

export interface Workflows extends HubspotMetadata {
  id: number
  type: string
  enabled: boolean
  insertedAt: number
  updatedAt: number
  contactListIds: ContactListIds
}

interface ContactListIds {
  enrolled: number
  active: number
  completed: number
  succeeded: number
}
