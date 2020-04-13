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

import { BuiltinTypes } from '@salto-io/adapter-api'

// Missing Types
const ACCOUNT_INSIGHT_SETTINGS = {
  enableAccountInsights: BuiltinTypes.BOOLEAN,
}

const ACCOUNT_INTELLIGENCE_SETTINGS = {
  enableAccountLogos: BuiltinTypes.BOOLEAN,
  enableAutomatedAccountFields: BuiltinTypes.BOOLEAN,
  enableNewsStories: BuiltinTypes.BOOLEAN,
}

const AUTOMATED_CONTACTS_SETTINGS = {
  enableAddContactAutomatically: BuiltinTypes.BOOLEAN,
  enableAddContactRoleAutomatically: BuiltinTypes.BOOLEAN,
  enableAddContactRoleWithSuggestion: BuiltinTypes.BOOLEAN,
  enableAddContactWithSuggestion: BuiltinTypes.BOOLEAN,
}

const IOT_SETTINGS = {
  enableIoT: BuiltinTypes.BOOLEAN,
}

const CHATTER_ANSWERS_SETTINGS = {
  emailFollowersOnBestAnswer: BuiltinTypes.BOOLEAN,
  emailFollowersOnReply: BuiltinTypes.BOOLEAN,
  emailOwnerOnPrivateReply: BuiltinTypes.BOOLEAN,
  emailOwnerOnReply: BuiltinTypes.BOOLEAN,
  enableAnswerViaEmail: BuiltinTypes.BOOLEAN,
  enableChatterAnswers: BuiltinTypes.BOOLEAN,
  enableFacebookSSO: BuiltinTypes.BOOLEAN,
  enableInlinePublisher: BuiltinTypes.BOOLEAN,
  enableReputation: BuiltinTypes.BOOLEAN,
  enableRichTextEditor: BuiltinTypes.BOOLEAN,
  facebookAuthProvider: BuiltinTypes.STRING,
  showInPortals: BuiltinTypes.BOOLEAN,
}

const CHATTER_EMAIL_MDSETTINGS = {
  enableChatterDigestEmailsApiOnly: BuiltinTypes.BOOLEAN,
  enableChatterEmailAttachment: BuiltinTypes.BOOLEAN,
  enableCollaborationEmail: BuiltinTypes.BOOLEAN,
  enableDisplayAppDownloadBadges: BuiltinTypes.BOOLEAN,
  enableEmailReplyToChatter: BuiltinTypes.BOOLEAN,
  enableEmailToChatter: BuiltinTypes.BOOLEAN,
}

const MAP_AND_LOCATION_SETTINGS = {
  enableAddressAutoComplete: BuiltinTypes.BOOLEAN,
  enableMapsAndLocation: BuiltinTypes.BOOLEAN,
}

const OBJECT_LINKING_SETTINGS = {
  enableObjectLinking: BuiltinTypes.BOOLEAN,
}

const PREDICTION_BUILDER_SETTINGS = {
  enablePredictionBuilder: BuiltinTypes.BOOLEAN,
  isPredictionBuilderStarted: BuiltinTypes.BOOLEAN,
}

const SOCIAL_CUSTOMER_SERVICE_SETTINGS = {
  // caseSubjectOption: BuiltinTypes.CASESUBJECTOPTION (ENUMERATION OF TYPE STRING),
  enableSocialApprovals: BuiltinTypes.BOOLEAN,
  enableSocialCaseAssignmentRules: BuiltinTypes.BOOLEAN,
  enableSocialCustomerService: BuiltinTypes.BOOLEAN,
  enableSocialPersonaHistoryTracking: BuiltinTypes.BOOLEAN,
  enableSocialPostHistoryTracking: BuiltinTypes.BOOLEAN,
  enableSocialReceiveParentPost: BuiltinTypes.BOOLEAN,
}

const CASE_CLASSIFICATION_SETTINGS = {
  caseClassificationRecommendations: BuiltinTypes.BOOLEAN,
  reRunAttributeBasedRules: BuiltinTypes.BOOLEAN,
  runAssignmentRules: BuiltinTypes.BOOLEAN,
}

export const allMissingTypes = {
  AccountInsightsSettings: ACCOUNT_INSIGHT_SETTINGS,
  AccountIntelligenceSetings: ACCOUNT_INTELLIGENCE_SETTINGS,
  AutomatedContacSettings: AUTOMATED_CONTACTS_SETTINGS,
  ChatterAnswerSettings: CHATTER_ANSWERS_SETTINGS,
  caseClassificationSettings: CASE_CLASSIFICATION_SETTINGS,
  ChatterEmailMdSettings: CHATTER_EMAIL_MDSETTINGS,
  IotSettings: IOT_SETTINGS,
  MapAndLocationSettings: MAP_AND_LOCATION_SETTINGS,
  ObjectLinkingSettings: OBJECT_LINKING_SETTINGS,
  PredictionBuiderSettings: PREDICTION_BUILDER_SETTINGS,
  SocialCustomerServiceSettings: SOCIAL_CUSTOMER_SERVICE_SETTINGS,
}

// Missing SubTypes
const BUSINESS_HOURS_ENTRY = {
  TimeZoneId: BuiltinTypes.STRING,
  name: BuiltinTypes.STRING,
  default: BuiltinTypes.STRING,
  mondayStartTime: BuiltinTypes.STRING,
  mondayEndTime: BuiltinTypes.STRING,
  TuesdayStartTime: BuiltinTypes.STRING,
  TuesdayEndTime: BuiltinTypes.STRING,
  wednesdayStartTime: BuiltinTypes.STRING,
  wednesdayEndTime: BuiltinTypes.STRING,
  thursdayStartTime: BuiltinTypes.STRING,
  thursdayEndTime: BuiltinTypes.STRING,
  fridayStartTime: BuiltinTypes.STRING,
  fridayEndTime: BuiltinTypes.STRING,
  saturdayStartTime: BuiltinTypes.STRING,
  saturdayEndTime: BuiltinTypes.STRING,
  sundayStartTime: BuiltinTypes.STRING,
  sundayEndTime: BuiltinTypes.STRING,
}

const HOLIDAYS = {
  name: BuiltinTypes.STRING,
  DESCRIPTION: BuiltinTypes.STRING,
  description: BuiltinTypes.STRING,
  activityDate: BuiltinTypes.STRING,
  recurrenceStartDate: BuiltinTypes.STRING,
  recurrenceEndDate: BuiltinTypes.STRING,
  startTime: BuiltinTypes.STRING,
  endTime: BuiltinTypes.STRING,
  recurrenceType: BuiltinTypes.STRING,
  reccurenceInterval: BuiltinTypes.STRING,
  recurrenceDayOfWeek: BuiltinTypes.STRING,
  recurrenceDayOfMonth: BuiltinTypes.STRING,
  recurrenceInstance: BuiltinTypes.STRING,
  recurrenceMonthOfYear: BuiltinTypes.STRING,
  businessHours: BuiltinTypes.STRING,
}

const ORGANIZATION_SETTINGS_DETAIL = {
  settingName: BuiltinTypes.STRING,
  settingValue: BuiltinTypes.STRING,
}

export const allMissingSubTypes = {
  BusinessHoursEntry: BUSINESS_HOURS_ENTRY,
  Holidays: HOLIDAYS,
  OrganizationSettingsDetail: ORGANIZATION_SETTINGS_DETAIL,
}
