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
import { ElemID } from '@salto-io/adapter-api'

export const HUBSPOT = 'hubspot'
export const NAME = 'name'
const LABEL = 'label'
const PROPERTY_OPTIONS = 'options'
const DISPLAYORDER = 'displayOrder'
const CREATEDAT = 'createdAt'

export const OBJECTS_NAMES = {
  FORM: 'form',
  MARKETINGEMAIL: 'marketingEmail',
  WORKFLOWS: 'workflows',

  // Subtypes
  PROPERTYGROUP: 'propertyGroup',
  PROPERTY: 'property',
  OPTIONS: 'options',
  CONTACTLISTIDS: 'contactListIds',
  RSSTOEMAILTIMING: 'rssToEmailTiming',
  NURTURETIMERANGE: 'nurtureTimeTange',
  ACTION: 'action',
  ANCHORSETTING: 'anchorSetting',
  CRITERIA: 'criteria',
  EVENTANCHOR: 'eventAnchor',
  CONDITIONACTION: 'conditionAction',
  CONTACT_PROPERTY: 'contactProperty',
  DEPENDENT_FIELD_FILTERS: 'dependentFieldFilters',
  FIELD_FILTER: 'fieldFilter',
  DEPENDEE_FORM_PROPERTY: 'dependeeFormProperty',
  RICHTEXT: 'richText',
  CONTACTPROPERTYOVERRIDES: 'contactPropertyOverrides',
}

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

export const FORM_FIELDS = {
  GUID: 'guid',
  NAME,
  CSSCLASS: 'cssClass',
  REDIRECT: 'redirect',
  SUBMITTEXT: 'submitText',
  NOTIFYRECIPIENTS: 'notifyRecipients',
  IGNORECURRENTVALUES: 'ignoreCurrentValues',
  DELETABLE: 'deletable',
  INLINEMESSAGE: 'inlineMessage',
  CREATEDAT,
  CAPTCHAENABLED: 'captchaEnabled',
  CLONEABLE: 'cloneable',
  EDITABLE: 'editable',
  STYLE: 'style',
  FORMFIELDGROUPS: 'formFieldGroups',
  THEMENAME: 'themeName',
}

export const MARKETING_EMAIL_FIELDS = {
  AB: 'ab',
  ABHOURSWAIT: 'abHoursToWait',
  ABVARIATION: 'abVariation',
  ABSAMPLESIZEDEFAULT: 'abSampleSizeDefault',
  ABSAMPLINGDEFAULT: 'abSamplingDefault',
  ABSTATUS: 'abStatus',
  ABSUCCESSMETRIC: 'abSuccessMetric',
  ABTESTID: 'abTestId',
  ABTESTPERCENTAGE: 'abTestPercentage',
  ABSOLUTEURL: 'absoluteUrl',
  ALLEMAILCAMPAIGNIDS: 'allEmailCampaignIds',
  ANALYTICSPAGEID: 'analyticsPageId',
  ANALYTICSPAGETYPE: 'analyticsPageType',
  ARCHIVED: 'archived',
  AUTHOR: 'author',
  AUTHORAT: 'authorAt',
  AUTHOREMAIL: 'authorEmail',
  AUTHORNAME: 'authorName',
  AUTHORUSERID: 'authorUserId',
  BLOGEMAILTYPE: 'blogEmailType',
  BLOGRSSSETTINGS: 'blogRssSettings',
  CAMPAIGN: 'campaign',
  CAMPAIGNNAME: 'campaignName',
  CANSPAMSETTINGSID: 'canSpamSettingsId',
  CATEGORYID: 'categoryId',
  CLONEDFROM: 'clonedFrom',
  CONTENTTYPECATEGORY: 'contentTypeCategory',
  CREATEPAGE: 'createPage',
  CREATED: 'created',
  CURRENTLYPUBLISHED: 'currentlyPublished',
  DOMAIN: 'domain',
  EMAILBODY: 'emailBody',
  EMAILNOTE: 'emailNote',
  EMAILTYPE: 'emailType',
  FEEDBACKEMAILCATEGORY: 'feedbackEmailCategory',
  FEEDBACKSURVEYID: 'feedbackSurveyId',
  FLEXAREAS: 'flexAreas',
  FOLDERID: 'folderId',
  FREEZEDATE: 'freezeDate',
  FROMNAME: 'fromName',
  HTMLTITLE: 'htmlTitle',
  ID: 'id',
  ISGRAYMAILSUPPRESSIONENABLED: 'isGraymailSuppressionEnabled',
  ISLOCALTIMEZONESEND: 'isLocalTimezoneSend',
  ISPUBLISHED: 'isPublished',
  ISRECIPIENTFATIGUESUPPRESSIONENABLED: 'isRecipientFatigueSuppressionEnabled',
  LEADFLOWID: 'leadFlowId',
  LIVEDOMAIN: 'liveDomain',
  MAILINGLISTSEXCLUDED: 'mailingListsExcluded',
  MAILINGLISTSINCLUDED: 'mailingListsIncluded',
  MAXRSSENTRIES: 'maxRssEntries',
  METADESCRIPTION: 'metaDescription',
  NAME: 'name',
  PAGEEXPIRYDATE: 'pageExpiryDate',
  PAGEEXPIRYREDIRECTEID: 'pageExpiryRedirectId',
  PAGEREDIRECTED: 'pageRedirected',
  PORTALID: 'portalId',
  PREVIEWKEY: 'previewKey',
  PROCESSINGSTATUS: 'processingStatus',
  PUBLISHDATE: 'publishDate',
  PUBLISHEDAT: 'publishedAt',
  PUBLISHEDBYID: 'publishedById',
  PUBLISHEDBYNAME: 'publishedByName',
  PUBLISHIMMEDIATELY: 'publishImmediately',
  PUBLISHEDURL: 'publishedUrl',
  REPLYTO: 'replyTo',
  RESOLVEDDOMAIN: 'resolvedDomain',
  RSSEMAILAUTHORLINETEMPLATE: 'rssEmailAuthorLineTemplate',
  RSSEMAILBLOGIMAGEMAXWIDTH: 'rssEmailBlogImageMaxWidth',
  RSSEMAILBYTEXT: 'rssEmailByText',
  RSSEMAILCLICKTHROUGHTEXT: 'rssEmailClickThroughText',
  RSSEMAILCOMMENTTEXT: 'rssEmailCommentText',
  RSSEMAILENTRYTEMPLATE: 'rssEmailEntryTemplate',
  RSSEMAILENTRYTEMPLATEENABLED: 'rssEmailEntryTemplateEnabled',
  RSSEMAILURL: 'rssEmailUrl',
  RSSTOEMAILTIMING: 'rssToEmailTiming',
  SLUG: 'slug',
  SMARTEMAILFIELDS: 'smartEmailFields',
  STYLESETTINGS: 'styleSettings',
  SUBCATEGORY: 'subcategory',
  SUBJECT: 'subject',
  SUBSCRIPTION: 'subscription',
  SUBSCRIPTIONBLOGID: 'subscriptionBlogId',
  SUBSCRIPTIONNAME: 'subscription_name',
  TEMPLATEPATH: 'templatePath',
  TRANSACTIONAL: 'transactional',
  UNPUBLISHEDAT: 'unpublishedAt',
  UPDATED: 'updated',
  UPDATEDBYID: 'updatedById',
  URL: 'url',
  USERSSHEADLINEASSUBJECT: 'useRssHeadlineAsSubject',
  VIDSEXCLUDED: 'vidsExcluded',
  VIDSINCLUDED: 'vidsIncluded',
  WIDGETS: 'widgets',
  WORKFLOWNAMES: 'workflowNames',
}

export const RSSTOEMAILTIMING_FIELDS = {
  REPEATS: 'repeats',
  REPEATS_ON_MONTHLY: 'repeats_on_monthly',
  REPEATS_ON_WEEKLY: 'repeats_on_weekly',
  TIME: 'time',
}

export const FORM_PROPERTY_GROUP_FIELDS = {
  DEFAULT: 'default',
  FIELDS: 'fields',
  ISSMARTGROUP: 'isSmartGroup',
  RICHTEXT: 'richText',
}

export const RICHTEXT_FIELDS = {
  CONTENT: 'content',
}

export const FORM_PROPERTY_FIELDS = {
  // Specific
  REQUIRED: 'required',
  ISSMARTFIELD: 'isSmartField',
  DEFAULTVALUE: 'defaultValue',
  SELECTEDOPTIONS: 'selectedOptions',
  DEPENDENTFIELDFILTERS: 'dependentFieldFilters',
  PLACEHOLDER: 'placeholder',

  // From contactProperty
  NAME,
  GROUPNAME: 'groupName',
  TYPE: 'type',
  FIELDTYPE: 'fieldType',
  HIDDEN: 'hidden',

  // Override
  DISPLAYORDER,
  LABEL,
  OPTIONS: PROPERTY_OPTIONS,
  DESCRIPTION: 'description',
}

export const FORM_PROPERTY_INNER_FIELDS = {
  CONTACT_PROPERTY: 'contactProperty',
  CONTACT_PROPERTY_OVERRIDES: 'contactPropertyOverrides',
}

export const CONTACT_PROPERTY_OVERRIDES_FIELDS = {
  LABEL,
  DISPLAYORDER,
  OPTIONS: PROPERTY_OPTIONS,
  DESCRIPTION: 'description',
}

export const DEPENDENT_FIELD_FILTER_FIELDS = {
  FILTERS: 'filters',
  DEPEDENTFORMFIELD: 'dependentFormField',
  FORMFIELDACTION: 'formFieldAction',
}

export const FIELD_FILTER_FIELDS = {
  OPERATOR: 'operator',
  STRVALUE: 'strValue',
  NUMBERVALUE: 'numValue',
  BOOLVALUE: 'boolValue',
  STRVALUES: 'strValues',
  NUMVALUES: 'mnumberValues',
}

export const CONTACT_PROPERTY_FIELDS = {
  NAME,
  LABEL,
  DESCRIPTION: 'description',
  GROUPNAME: 'groupName',
  TYPE: 'type',
  FIELDTYPE: 'fieldType',
  OPTIONS: PROPERTY_OPTIONS,
  DELETED: 'deleted',
  FORMFIELD: 'formField',
  CREATEDAT,
  DISPLAYORDER,
  READONLYVALUE: 'readOnlyValue',
  READONLYDEFINITION: 'readOnlyDefinition',
  MUTABLEDEFINITIONNOTDELETABLE: 'mutableDefinitionNotDeletable',
  HIDDEN: 'hidden',
  CALCULATED: 'calculated',
  EXTERNALOPTIONS: 'externalOptions',
}

export const OPTIONS_FIELDS = {
  LABEL,
  DESCRIPTION: 'description',
  VALUE: 'value',
  HIDDEN: 'hidden',
  ISSMARTFIELD: 'isSmartField',
  READONLY: 'readOnly',
  DISPLAYORDER,
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
  ACTIONS: 'actions',
  INTERNAL: 'internal',
  ONLYEXECONBIZDAYS: 'onlyExecOnBizDays',
  NURTURETIMERANGE: 'nurtureTimeRange',
  LISTENING: 'listening',
  ALLOWCONTACTTOTRIGGERMULTIPLETIMES: 'allowContactToTriggerMultipleTimes',
  GOALCRITERIA: 'goalCriteria',
  ONLYENROLLMANUALLY: 'onlyEnrollsManually',
  ENROLLONCRITERIAUPDATE: 'enrollOnCriteriaUpdate',
  LASTUPDATEDBY: 'lastUpdatedBy',
  SUPRESSIONLISTIDS: 'supressionListIds',
  SEGMENTCRITERIA: 'segmentCriteria',
  EVENTANCHOR: 'eventAnchor',
}

export const CRITERIA_FIELDS = {
  FILTERFAMILY: 'filterFamily',
  WITHINTIMEMODE: 'withinTimeMode',
  OPERATOR: 'operator',
  TYPE: 'type',
  PROPERTY: 'property',
  PROPERTYOBJECTTYPE: 'propertyObjectType',
  VALUE: 'value',
}

export const EVENTANCHOR_FIELDS = {
  STATICDATEANCHOR: 'staticDateAnchor',
  CONTACTPROPERTYANCHOR: 'contactPropertyAnchor',
}

export const NURTURETIMERANGE_FIELDS = {
  ENABLED: 'enabled',
  STARTHOUR: 'startHour',
  STOPHOUR: 'stopHour',
}

export const ACTION_FIELDS = {
  TYPE: 'type',
  ANCHORSETTING: 'anchorSetting',
  ACTIONID: 'actionId',
  DELAYMILLS: 'delayMillis',
  STEPID: 'stepId',
  FILTERSLISTID: 'filtersListId',
  NEWVALUE: 'newValue',
  ACCEPTACTIONS: 'acceptActions',
  PROPERTYNAME: 'propertyName',
  REJECTACTIONS: 'rejectActions',
}

export const CONDITIONACTION_FIELDS = {
  TYPE: 'type',
  BODY: 'body',
  STATICTO: 'staticTo',
  ACTIONID: 'actionId',
  STEPID: 'stepId',
}

export const ANCHOR_SETTING_FIELDS = {
  EXECTIMEOFDAY: 'execTimeOfDay',
  EXECTIMEINMINUTES: 'execTimeInMinutes',
  BOUNDARY: 'boundary',
}

export const CONTACTLISTIDS_FIELDS = {
  ENROLLED: 'enrolled',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  SUCCEEDED: 'succeeded',
}

export const contactPropertyTypeValues = ['string', 'number', 'date', 'datetime', 'enumeration', 'bool', 'phone_number']
export const contactPropertyFieldTypeValues = ['textarea', 'text', 'date', 'file', 'number', 'select', 'calculation_equation',
  'radio', 'checkbox', 'booleancheckbox', 'calculation_score', 'phonenumber', 'calculation_read_time']


// ElemIDs
export const formElemID = new ElemID(HUBSPOT, OBJECTS_NAMES.FORM)
export const workflowsElemID = new ElemID(HUBSPOT, OBJECTS_NAMES.WORKFLOWS)
export const criteriaElemID = new ElemID(HUBSPOT, OBJECTS_NAMES.CRITERIA)
export const propertyGroupElemID = new ElemID(HUBSPOT, OBJECTS_NAMES.PROPERTYGROUP)
export const propertyElemID = new ElemID(HUBSPOT, OBJECTS_NAMES.PROPERTY)
export const dependeeFormPropertyElemID = new ElemID(HUBSPOT, OBJECTS_NAMES.DEPENDEE_FORM_PROPERTY)
export const optionsElemID = new ElemID(HUBSPOT, OBJECTS_NAMES.OPTIONS)
export const contactListIdsElemID = new ElemID(HUBSPOT, OBJECTS_NAMES.CONTACTLISTIDS)
export const marketingEmailElemID = new ElemID(HUBSPOT, OBJECTS_NAMES.MARKETINGEMAIL)
export const rssToEmailTimingElemID = new ElemID(HUBSPOT, OBJECTS_NAMES.RSSTOEMAILTIMING)
export const nurtureTimeRangeElemID = new ElemID(HUBSPOT, OBJECTS_NAMES.NURTURETIMERANGE)
export const anchorSettingElemID = new ElemID(HUBSPOT, OBJECTS_NAMES.ANCHORSETTING)
export const actionElemID = new ElemID(HUBSPOT, OBJECTS_NAMES.ACTION)
export const eventAnchorElemID = new ElemID(HUBSPOT, OBJECTS_NAMES.EVENTANCHOR)
export const conditionActionElemID = new ElemID(HUBSPOT, OBJECTS_NAMES.CONDITIONACTION)
export const contactPropertyElemID = new ElemID(HUBSPOT, OBJECTS_NAMES.CONTACT_PROPERTY)
export const dependentFormFieldFiltersElemID = new ElemID(HUBSPOT,
  OBJECTS_NAMES.DEPENDENT_FIELD_FILTERS)
export const fieldFilterElemID = new ElemID(HUBSPOT, OBJECTS_NAMES.FIELD_FILTER)
export const richTextElemID = new ElemID(HUBSPOT, OBJECTS_NAMES.RICHTEXT)
export const contactPropertyOverridesElemID = new ElemID(
  HUBSPOT,
  OBJECTS_NAMES.CONTACTPROPERTYOVERRIDES
)
