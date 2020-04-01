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
export interface HubspotMetadata {
  name: string
}

export interface ContactProperty extends HubspotMetadata {
  // String; The internal name of the property.
  // The name should be used when referencing the property through the API
  name: string
  // String; A human readable label for the property.
  // The label is used to display the property in the HubSpot UI.
  label: string
  // String; A description of the property. May be an empty string.
  description: string
  // String; The property group that the property belongs to.
  groupName: string
  // String, one of string, number, date, datetime, or enumeration
  // The data type of the property. See creating a property for more details.
  type: string
  // String, one of textarea, text, date, file, number, select, radio, checkbox, or booleancheckbox
  // Controls how the property appears in a form when the property is used as a form field.
  fieldType: string
  options: Options[]

  // Boolean; This will effectively be false for all properties,
  // as deleted properties will not appear in the API
  deleted: boolean
  // Boolean; controls whether or not the property will show up as an option to be used in forms.
  formField: boolean
  // Integer; Properties are displayed based this value,
  // properties with negative values appear in the order they're created
  // after properties with positive values.
  displayOrder: number
  // Boolean; A value of true means that the value cannot be set manually,
  // and that only the HubSpot system can update the property.
  // Custom properties should always have this set to false,
  // or the value can't be updated through the API.
  readOnlyValue: boolean
  // Boolean; A value of true means that the property settings can't be modified.
  // Custom properties should always have this as false,
  // or the property can't be updated or deleted.
  readOnlyDefinition: boolean
  // Boolean; Hidden fields do not appear in the HubSpot UI
  hidden: boolean
  // Boolean; true indicates that the property settings can be modified,
  // but the property cannot be deleted
  // Custom properties should use false
  mutableDefinitionNotDeletable: boolean
   // Boolean; For system properties,
  // true indicates that the property is calculated by a HubSpot process
  // Has no effect for custom properties
  calculated: boolean
  // Boolean; For system properties,
  // true indicates that the options are stored
  // Has no effect on custom properties
  externalOptions: boolean
  createdAt: number
}

export interface Form extends HubspotMetadata {
  // String, read-only; The internal ID of the form
  guid: string
  // String; The name of the form
  name: string
  // String; The default css classes added to the form when embedded.
  // Can be overridden when embedding the form using the 'cssClass' option.
  cssClass: string
  // String; The URL that the visitor will be redirected to after filling out the form.
  redirect: string
  // String; The text used for the submit button.
  submitText: string
  // String; A comma-separated list of user IDs that should receive submission notifications.
  // Email addresses will be returned for individuals who aren't users.
  notifyRecipients: string
  // Boolean; If true, the form will pre-populate fields with known values for know contacts.
  ignoreCurrentValues: boolean
  // Boolean; If false, the form is a system form
  // (such as a blog comment or subscription form) and cannot be deleted.
  // This will default to true and should also be set to true for forms created through the API.
  deletable: boolean
  // String; A thank you message to display on the page after the form is submitted.
  inlineMessage: string
  // A list of field groups. Each group represents a group of fields
  // (displayed as a row when the form is embedded)
  formFieldGroups: PropertyGroup[]
  // Integer, read-only; A Unix timestamp (in milliseconds) for when the form was created.
  createdAt: number
  // Integer, read-only; A Unix timestamp (in milliseconds) for when the form was last modified.
  updatedAt: number
  // Boolean; Will be set to true for forms with captcha enabled.
  // If you're submitting form data through the API, this should be set to false,
  // and any captcha or other spam protection
  // should be implemented in your form before sending the data to HubSpot
  captchaEnabled: boolean
  // Boolean; Whether or not the form can be cloned.
  // Forms created through the API should leave this as true (the default).
  cloneable: boolean
  // Boolean; Whether or not the form can be edited.
  // Forms created through the API should leave this as true (the default).
  editable: boolean
  themeName: string
}

interface PropertyGroup {
  // A list of fields in the group
  fields: FormProperty[]
  default: boolean
  isSmartGroup: boolean
  richText: RichText
}

interface RichText {
  content: string
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

interface RssToEmailTiming {
  repeats: string
  // Integer, what day of the month should the monthly email be sent [1-31]
  repeats_on_monthly: number
  // Integer, what day of the week should the weekly email be sent [1=monday - 7=sunday]
  repeats_on_weekly: number
  time: string // time the email should be sent at (9:00 am)
}

export interface FormProperty {
  // String; The internal name of the property.
  // The name should be used when referencing the property through the API
  name: string
  // String; A human readable label for the property.
  // The label is used to display the property in the HubSpot UI.
  label: string
  description: string
  // The property group that the property belongs to.
  groupName: string
  // String, one of string, number, date, datetime, or enumeration
  // This needs to match the 'type' field of the corresponding contact property.
  type: string
  // String, one of textarea, text, date, file, number, select, radio, checkbox or boolean checkbox
  // Controls how the property appears in a form when the property is used as a form field.
  fieldType: string
  // Required fields must be filled out to submit the form.
  required: boolean
  // Hidden fields do not appear in the HubSpot UI
  hidden: boolean
  // Whether or not the field is a smart field.
  // Smart fields are hidden if the visitor is a known contact that already has a value for
  // the field.
  isSmartField: boolean
  // The default value of the field
  defaultValue: string
  // For enumerated fields, this will be a list of Strings.
  // Representing the options that will be selected by default
  selectedOptions: string[]
  // For enumerated fields, this will be a list of Strings representing the options for the field
  // Will be empty for non-enumerated fields.
  options: Options[]
  // String; The placeholder text for the field, which will display
  placeholder: string
  // Integer; The order to display the fields in.
  // If the values are negative, the fields appear in the order they appear in the 'fields' list
  displayOrder: number
  // A list of filters that will be used to display dependent fields.
  dependentFieldFilters: DependentFieldFilter[]
}

interface DependentFieldFilter {
  filters: Filter[]
  dependentFormField: FormProperty
  formFieldAction: string
}

interface Filter {
  operator: string
  strValue: string
  boolValue: boolean
  numberValue: number
  strValues: string[]
  numberValues: number[]
}

export interface Workflows extends HubspotMetadata {
  id: number
  name: string
  type: string
  enabled: boolean
  insertedAt: number
  updatedAt: number
  contactListIds: ContactListIds
  actions: Action[]
  internal: boolean
  onlyExecOnBizDays: boolean
  nurtureTimeRange: NurtureTimeRange
  listening: boolean
  allowContactToTriggerMultipleTimes: boolean
  onlyEnrollsManually: boolean
  enrollOnCriteriaUpdate: boolean
  lastUpdatedBy: string
  eventAnchor: EventAnchor
  supressionListIds: number[]
  segmentCriteria: Criteria[][]
  goalCriteria: Criteria[][]
}

interface Criteria {
  filterFamily: string
  withinTimeMode: string
  operator: string
  type: string
  property: string
  propertyObjectType: string
  value: string
}

interface EventAnchor {
  staticDateAnchor: string
  contactPropertyAnchor: string
}

interface Action {
  type: string
  anchorSetting: AnchorSetting
  delayMillis: number
  filterListId: number
  filters: Criteria[][]
  newValue: string
  propertyName: string
  actionId: number
  stepId: number
  body: string
  staticTo: string
  acceptActions: Action[]
  rejectActions: Action[]
}

interface AnchorSetting {
  execTimeOfDay: string
  execTimeInMinutes: number
  boundary: string
}

interface NurtureTimeRange {
  enabled: boolean
  startHour: number
  stopHour: number
}

interface ContactListIds {
  enrolled: number
  active: number
  completed: number
  succeeded: number
}

export interface MarketingEmail extends HubspotMetadata {
  // Whether or not the page is part of an AB test.
  ab: boolean
  // on AB emails, if test results are inconclusive after 4 hours, variation A will be sent.
  abHoursToWait: number
  // Whether or not the page is the variation (as opposed to the master)
  // if the page is part of an AB test
  abVariation: boolean
  // [MASTER, VARIANT] if there are less than 1000 recipients, only one variation will be sent.
  abSampleSizeDefault: string
  // [MASTER, VARIANT] if AB test results are inconclusive in the test group,
  // choose a variation to send (resp. A or B) to the remaining contacts.
  abSamplingDefault: string
  // [MASTER, VARIANT] determines if the current email is variation A or variation B.
  abStatus: string
  // [ CLICKS_BY_OPENS, CLICKS_BY_DELIVERED, OPENS_BY_DELIVERED ]
  // metric that will be used to determine the winning variation.
  abSuccessMetric: string
  // String; id shared between variation A and B
  abTestId: string
  // the size of the test group (40% will receive variation A, the other 60% variation B).
  abTestPercentage: number
  // The URL of the web version of the email.
  absoluteUrl: string
  // A list of email IDs that are associated with the email.
  allEmailCampaignIds: number[]
  // the id used to access the analytics page of the email(in most cases, the same as the email ID)
  analyticsPageId: string
  // determines whether the email is archived or not.
  archived: boolean
  // the email of the user who made the last update to the email.
  author: string
  // the email of the user who made the last update to the email.
  authorEmail: string
  // the name of the user who made the last update to the email.
  authorName: string
  // [instant, daily, weekly, monthly] the cadence for how often blog emails should be sent.
  blogEmailType: string
  // the ID of an email's marketing campaign.
  campaign: string
  // the name of the email's marketing campaign.
  campaignName: string
  // ID used to retrieve the company address, shown in the footer.
  canSpamSettingsId: number
  // if the email was cloned, ID of the email it was cloned from.
  clonedFrom: number
  // enables a web version of the email when set to true.
  createPage: boolean
  // the timestamp of the email's creation, in milliseconds.
  created: number
  // determines the publish status of the email.
  currentlyPublished: boolean
  // the domain of the web version of the email. Defaults to the primary domain.
  domain: string
  // the main content of the email within the 'main email body' module.
  emailBody: string
  // optional email notes, included in the details page of the email.
  emailNote: string
  // BATCH_EMAIL, AB_EMAIL, AUTOMATED_EMAIL, BLOG_EMAIL, BLOG_EMAIL_CHILD, FOLLOWUP_EMAIL,
  // LOCALTIME_EMAIL, OPTIN_EMAIL, OPTIN_FOLLOWUP_EMAIL, RESUBSCRIBE_EMAIL,
  // RSS_EMAIL, RSS_EMAIL_CHILD, SINGLE_SEND_API, SMTP_TOKEN, LEADFLOW_EMAIL,
  // FEEDBACK_CES_EMAIL, FEEDBACK_NPS_EMAIL, FEEDBACK_CUSTOM_EMAIL, TICKET_EMAIL ]
  emailType: string
  // [ NPS, CES, CUSTOM ] If the email is a feedback email, determines type of feedback email.
  feedbackEmailCategory: string
  // the id of the feedback survey that is linked to the email.
  feedbackSurveyId: number
  // if the email is in a folder, id of that folder.
  folderId: number
  // Describes the layout of the drag and drop email template.
  flexAreas: {}
  // The publish date or updated date if the email is not published.
  freezeDate: number
  // the sender name recipients will see (linked to the replyTo address).
  fromName: string
  // the page title of the web version of the email.
  htmlTitle: string
  // the id of the email.
  id: number
  // if true, the email will not send to unengaged contacts.
  isGraymailSuppressionEnabled: boolean
  // if true, the email will adjust its send time relative to the recipients timezone.
  isLocalTimezoneSend: boolean
  // if true, the email is in a published state.
  isPublished: boolean
  // Boolean; if true, enables a send frequency cap (a feature available to enterprise accounts).
  isRecipientFatigueSuppressionEnabled: boolean
  // Integer; the id of the parent leadflow if the email is a leadflow email.
  leadFlowId: number
  // String; domain actually used in the web version (read only)
  liveDomain: string
  // A list of all contact lists to exclude from the email send.
  mailingListsExcluded: []
  // A list of all contact lists included in the email send.
  mailingListsIncluded: []
  // in blog and recurring emails, the max number of entries to include.
  maxRssEntries: number
  // String; meta description of the web version of the email,
  // to drive search engine traffic to your page
  metaDescription: string
  // String; the name of the email, as displayed on the email dashboard.
  name: string
  // Integer; the expiration date of the web version of an email, in milliseconds.
  pageExpiryDate: number
  // String; the url of the page the user will be redirected to
  // after the web version of the email expires.
  pageExpiryRedirectId: number
  // Boolean; indicates if the email's web version has already been set to redirect
  pageRedirected: boolean
  // String; the preview key used to generate the preview url before the email is published
  previewKey: string
  // String; [ UNDEFINED, PUBLISHED, PUBLISHED_OR_SCHEDULED, SCHEDULED, PROCESSING,
  // PRE_PROCESSING, ERROR, CANCELED_FORCIBLY, CANCELED_ABUSE ]
  // the email's processing status.
  processingStatus: string
  // Integer; the timestamp in milliseconds that the email has been published at,
  // or scheduled to send at.
  publishDate: number
  // Integer; if the email has been published, the time when the publish button has been pressed.
  publishedAt: number
  // Integer; if the email has been published,
  // email of the user that pressed the publish button (read only).
  publishedById: number
  // String; if the email has been published,
  // name of the user that pressed the publish button (read only).
  publishedByName: string
  // Boolean; true if the email is not scheduled but will send at publish time.
  publishImmediately: boolean
  // String; absoluteUrl, only if the email is currentlyPublished (read-only),
  publishedUrl: string
  // String; The email address the recipient will see and reply to (linked to fromName).
  replyTo: string
  // String; the domain used in the web version:
  // either the primary one or the one set in the domain field (read only)
  resolvedDomain: string
  // String; text shown before the "author_line" tag in blog & RSS email's items.
  rssEmailAuthorLineTemplate: string
  // Integer; the max width for blog post images in RSS emails.
  rssEmailBlogImageMaxWidth: number
  // String; if rssEmailAuthorLineTemplate is not set,
  // word before the author name in blog & RSS email's items.
  rssEmailByText: string
  // String; text shown on the link to see the full post in blog & RSS email's items.
  rssEmailClickThroughText: string
  // String; text shown on the link to comment the post in blog & RSS email's items.
  rssEmailCommentText: string
  // String; optional, custom template for every RSS entry.
  rssEmailEntryTemplate: string
  // Boolean; determines if the Entry Template is used for an RSS email.
  rssEmailEntryTemplateEnabled: boolean
  // String; URL used for social sharing.
  rssEmailUrl: string
  // A dictionary that determines what time the RSS email should be sent out.
  rssToEmailTiming: RssToEmailTiming
  // String; path of the web version URL.
  slug: string
  // String; lists the smart objects in email fields (from address, subject..)
  smartEmailFields: {}
  // String; Custom email style settings (background color, primary font);
  styleSettings: string
  // [ ab_master, ab_variant, automated, automated_for_deal, automated_for_form,
  // automated_for_form_legacy, automated_for_form_buffer, automated_for_form_draft,
  // rss_to_email, rss_to_email_child, blog_email, blog_email_child, optin_email,
  // optin_followup_email, batch, resubscribe_email, single_send_api, smtp_token,
  // localtime, automated_for_ticket, automated_for_leadflow, automated_for_feedback_ces,
  // automated_for_feedback_nps, automated_for_feedback_custom ]
  subcategory: string
  // String; the subject of the email.
  subject: string
  // Integer; the id of the email's subscription type.
  subscription: number
  // Integer; for blog emails, id of the linked blog.
  subscriptionBlogId: number
  // String; the name of the email's subscription type.
  subscription_name: string
  // String; the path of the email's body template within the design manager.
  templatePath: string
  // Boolean; determines whether the email is a transactional email or not.
  transactional: boolean
  // Integer; the timestamp in milliseconds of when the email was unpublished.
  unpublishedAt: number
  // Integer; timestamp of the last update in milliseconds.
  updated: number
  // Integer; the ID of the last user who updated the email.
  updatedById: number
  // String; the web version URL (read-only).
  url: string
  // Boolean; Setting for RSS emails, uses the latest RSS entry as the email subject.
  useRssHeadlineAsSubject: boolean
  // A list of contact IDs to exclude from being sent the email.
  vidsExcluded: []
  // A list of contacts IDs to include in the email send.
  vidsIncluded: []
  // The content of layout sections of the email (widgets).
  widgets: {}
  // a list of all linked workflows to this email.
  workflowNames: []
}
