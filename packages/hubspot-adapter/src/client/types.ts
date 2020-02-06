export interface HubspotMetadata {
  name: string
}

export interface ContactProperty extends HubspotMetadata {
  name: string
  // String; The internal name of the property.
  // The name should be used when referencing the property through the API
  label: string
  // String; A human readable label for the property.
  // The label is used to display the property in the HubSpot UI.
  description: string
  // String; A description of the property. May be an empty string.
  groupName: string
  // String; The property group that the property belongs to.
  type: string
  // String, one of string, number, date, datetime, or enumeration
  // The data type of the property. See creating a property for more details.
  fieldType: string
  // String, one of textarea, text, date, file, number, select, radio, checkbox, or booleancheckbox
  // Controls how the property appears in a form when the property is used as a form field.
  options: Options[]

  deleted: boolean
  // Boolean; This will effectively be false for all properties,
  // as deleted properties will not appear in the API
  formField: boolean
  // Boolean; controls whether or not the property will show up as an option to be used in forms.
  displayOrder: number
  // Integer; Properties are displayed based this value,
  // properties with negative values appear in the order they're created
  // after properties with positive values.
  readOnlyValue: boolean
  // Boolean; A value of true means that the value cannot be set manually,
  // and that only the HubSpot system can update the property.
  // Custom properties should always have this set to false,
  // or the value can't be updated through the API.
  readOnlyDefinition: boolean
  // Boolean; A value of true means that the property settings can't be modified.
  // Custom properties should always have this as false,
  // or the property can't be updated or deleted.
  hidden: boolean
  // Boolean; Hidden fields do not appear in the HubSpot UI
  mutableDefinitionNotDeletable: boolean
  // Boolean; true indicates that the property settings can be modified,
  // but the property cannot be deleted
  // Custom properties should use false
  calculated: boolean
  // Boolean; For system properties,
  // true indicates that the property is calculated by a HubSpot process
  // Has no effect for custom properties
  externalOptions: boolean
  // Boolean; For system properties,
  // true indicates that the options are stored
  // Has no effect on custom properties
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
  themeName: string
}

interface PropertyGroup {
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
  repeats_on_monthly: number
  // Integer, what day of the month should the monthly email be sent [1-31]
  repeats_on_weekly: number
  // Integer, what day of the week should the weekly email be sent [1=monday - 7=sunday]
  time: string // time the email should be sent at (9:00 am)
}

export interface FormProperty {
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
  // For enumerated fields, this will be a list of Strings.
  // Representing the options that will be selected by default
  options: Options[]
  // For enumerated fields, this will be a list of Strings representing the options for the field
  // Will be empty for non-enumerated fields.
  placeholder: string
  // String; The placeholder text for the field, which will display
  displayOrder: number
  // Integer; The order to display the fields in.
  // If the values are negative, the fields appear in the order they appear in the 'fields' list
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
}

interface EventAnchor {
  staticDateAnchor: string
  contactPropertyAnchor: string
}

interface Action {
  type: string
  anchorSetting: AnchorSetting
  actionId: number
  delayMillis: number
  stepId: number
  filterListId: number
  filters: string[]
  newValue: string
  propertyName: string
  acceptActions: ConditionAction[]
  rejectActions: ConditionAction[]
}

interface ConditionAction {
  type: string
  body: string
  staticTo: string
  actionId: number
  stepId: number
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
  flexAreas: {}
  // Describes the layout of the drag and drop email template.
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
  isRecipientFatigueSuppressionEnabled: boolean
  // Boolean; if true, enables a send frequency cap (a feature available to enterprise accounts).
  leadFlowId: number
  // Integer; the id of the parent leadflow if the email is a leadflow email.
  liveDomain: string
  // String; domain actually used in the web version (read only)
  mailingListsExcluded: []
  // A list of all contact lists to exclude from the email send.
  mailingListsIncluded: []
  // A list of all contact lists included in the email send.
  maxRssEntries: number
  // in blog and recurring emails, the max number of entries to include.
  metaDescription: string
  // String; meta description of the web version of the email,
  // to drive search engine traffic to your page
  name: string
  // String; the name of the email, as displayed on the email dashboard.
  pageExpiryDate: number
  // Integer; the expiration date of the web version of an email, in milliseconds.
  pageExpiryRedirectId: number
  // String; the url of the page the user will be redirected to
  // after the web version of the email expires.
  pageRedirected: boolean
  // Boolean; indicates if the email's web version has already been set to redirect
  previewKey: string
  // String; the preview key used to generate the preview url before the email is published
  processingStatus: string
  // String; [ UNDEFINED, PUBLISHED, PUBLISHED_OR_SCHEDULED, SCHEDULED, PROCESSING,
  // PRE_PROCESSING, ERROR, CANCELED_FORCIBLY, CANCELED_ABUSE ]
  // the email's processing status.
  publishDate: number
  // Integer; the timestamp in milliseconds that the email has been published at,
  // or scheduled to send at.
  publishedAt: number
  // Integer; if the email has been published, the time when the publish button has been pressed.
  publishedById: number
  // Integer; if the email has been published,
  // email of the user that pressed the publish button (read only).
  publishedByName: string
  // String; if the email has been published,
  // name of the user that pressed the publish button (read only).
  publishImmediately: boolean
  // Boolean; true if the email is not scheduled but will send at publish time.
  publishedUrl: string
  // String; absoluteUrl, only if the email is currentlyPublished (read-only),
  replyTo: string
  // String; The email address the recipient will see and reply to (linked to fromName).
  resolvedDomain: string
  // String; the domain used in the web version:
  // either the primary one or the one set in the domain field (read only)
  rssEmailAuthorLineTemplate: string
  // String; text shown before the "author_line" tag in blog & RSS email's items.
  rssEmailBlogImageMaxWidth: number
  // Integer; the max width for blog post images in RSS emails.
  rssEmailByText: string
  // String; if rssEmailAuthorLineTemplate is not set,
  // word before the author name in blog & RSS email's items.
  rssEmailClickThroughText: string
  // String; text shown on the link to see the full post in blog & RSS email's items.
  rssEmailCommentText: string
  // String; text shown on the link to comment the post in blog & RSS email's items.
  rssEmailEntryTemplate: string
  // String; optional, custom template for every RSS entry.
  rssEmailEntryTemplateEnabled: boolean
  // Boolean; determines if the Entry Template is used for an RSS email.
  rssEmailUrl: string
  // String; URL used for social sharing.
  rssToEmailTiming: RssToEmailTiming
  // A dictionary that determines what time the RSS email should be sent out.
  slug: string
  // String; path of the web version URL.
  smartEmailFields: {}
  // String; lists the smart objects in email fields (from address, subject..)
  styleSettings: string
  // String; Custom email style settings (background color, primary font);
  subcategory: string
  // [ ab_master, ab_variant, automated, automated_for_deal, automated_for_form,
  // automated_for_form_legacy, automated_for_form_buffer, automated_for_form_draft,
  // rss_to_email, rss_to_email_child, blog_email, blog_email_child, optin_email,
  // optin_followup_email, batch, resubscribe_email, single_send_api, smtp_token,
  // localtime, automated_for_ticket, automated_for_leadflow, automated_for_feedback_ces,
  // automated_for_feedback_nps, automated_for_feedback_custom ]
  subject: string
  // String; the subject of the email.
  subscription: number
  // Integer; the id of the email's subscription type.
  subscriptionBlogId: number
  // Integer; for blog emails, id of the linked blog.
  subscription_name: string
  // String; the name of the email's subscription type.
  templatePath: string
  // String; the path of the email's body template within the design manager.
  transactional: boolean
  // Boolean; determines whether the email is a transactional email or not.
  unpublishedAt: number
  // Integer; the timestamp in milliseconds of when the email was unpublished.
  updated: number
  // Integer; timestamp of the last update in milliseconds.
  updatedById: number
  // Integer; the ID of the last user who updated the email.
  url: string
  // String; the web version URL (read-only).
  useRssHeadlineAsSubject: boolean
  // Boolean; Setting for RSS emails, uses the latest RSS entry as the email subject.
  vidsExcluded: []
  // A list of contact IDs to exclude from being sent the email.
  vidsIncluded: []
  // A list of contacts IDs to include in the email send.
  widgets: {}
  // The content of layout sections of the email (widgets).
  workflowNames: []
  // a list of all linked workflows to this email.
}
