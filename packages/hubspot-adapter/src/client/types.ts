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

export interface MarketingEmail extends HubspotMetadata {
  ab: boolean
  // Whether or not the page is part of an AB test.
  abHoursToWait: number
  // on AB emails, if test results are inconclusive after 4 hours, variation A will be sent.
  abVariation: boolean
  // Whether or not the page is the variation (as opposed to the master)
  // if the page is part of an AB test
  abSampleSizeDefault: string
  // [MASTER, VARIANT] if there are less than 1000 recipients, only one variation will be sent.
  abSamplingDefault: string
  // [MASTER, VARIANT] if AB test results are inconclusive in the test group,
  // choose a variation to send (resp. A or B) to the remaining contacts.
  abStatus: string
  // [MASTER, VARIANT] determines if the current email is variation A or variation B.
  abSuccessMetric: string
  // [ CLICKS_BY_OPENS, CLICKS_BY_DELIVERED, OPENS_BY_DELIVERED ]
  // metric that will be used to determine the winning variation.
  abTestId: string
  // String; id shared between variation A and B
  abTestPercentage: number
  // the size of the test group (40% will receive variation A, the other 60% variation B).
  absoluteUrl: string
  // The URL of the web version of the email.
  allEmailCampaignIds: number[]
  // A list of email IDs that are associated with the email.
  analyticsPageId: string
  // the id used to access the analytics page of the email(in most cases, the same as the email ID)
  archived: boolean
  // determines whether the email is archived or not.
  author: string
  // the email of the user who made the last update to the email.
  authorEmail: string
  // the email of the user who made the last update to the email.
  authorName: string
  // the name of the user who made the last update to the email.
  blogEmailType: string
  // [instant, daily, weekly, monthly] the cadence for how often blog emails should be sent.
  campaign: string
  // the ID of an email's marketing campaign.
  campaignName: string
  // the name of the email's marketing campaign.
  canSpamSettingsId: number
  // ID used to retrieve the company address, shown in the footer.
  clonedFrom: number
  // if the email was cloned, ID of the email it was cloned from.
  createPage: boolean
  // enables a web version of the email when set to true.
  created: number
  // the timestamp of the email's creation, in milliseconds.
  currentlyPublished: boolean
  // determines the publish status of the email.
  domain: string
  // the domain of the web version of the email. Defaults to the primary domain.
  emailBody: string
  // the main content of the email within the 'main email body' module.
  emailNote: string
  // optional email notes, included in the details page of the email.
  emailType: string
  // BATCH_EMAIL, AB_EMAIL, AUTOMATED_EMAIL, BLOG_EMAIL, BLOG_EMAIL_CHILD, FOLLOWUP_EMAIL,
  // LOCALTIME_EMAIL, OPTIN_EMAIL, OPTIN_FOLLOWUP_EMAIL, RESUBSCRIBE_EMAIL,
  // RSS_EMAIL, RSS_EMAIL_CHILD, SINGLE_SEND_API, SMTP_TOKEN, LEADFLOW_EMAIL,
  // FEEDBACK_CES_EMAIL, FEEDBACK_NPS_EMAIL, FEEDBACK_CUSTOM_EMAIL, TICKET_EMAIL ]
  feedbackEmailCategory: string
  // [ NPS, CES, CUSTOM ] If the email is a feedback email, determines type of feedback email.
  feedbackSurveyId: number
  // the id of the feedback survey that is linked to the email.
  folderId: number
  // if the email is in a folder, id of that folder.
  freezeDate: number
  // The publish date or updated date if the email is not published.
  fromName: string
  // the sender name recipients will see (linked to the replyTo address).
  htmlTitle: string
  // the page title of the web version of the email.
  id: number
  // the id of the email.
  isGraymailSuppressionEnabled: boolean
  // if true, the email will not send to unengaged contacts.
  isLocalTimezoneSend: boolean
  // if true, the email will adjust its send time relative to the recipients timezone.
  isPublished: boolean
  // if true, the email is in a published state.
}
