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

import { BuiltinTypes, PrimitiveType } from '@salto-io/adapter-api'

export class MissingTypes {
  public static ACCOUNT_INSIGHT_SETTINGS = {
    enableAccountInsights: BuiltinTypes.BOOLEAN,
  }

  public static ACCOUNT_INTELLIGENCE_SETTINGS = {
    enableAccountLogos: BuiltinTypes.BOOLEAN,
    enableAutomatedAccountFields: BuiltinTypes.BOOLEAN,
    enableNewsStories: BuiltinTypes.BOOLEAN,
  }

  public static AUTOMATED_CONTACTS_SETTINGS = {
    enableAddContactAutomatically: BuiltinTypes.BOOLEAN,
    enableAddContactRoleAutomatically: BuiltinTypes.BOOLEAN,
    enableAddContactRoleWithSuggestion: BuiltinTypes.BOOLEAN,
    enableAddContactWithSuggestion: BuiltinTypes.BOOLEAN,
  }

  public static IOT_SETTINGS = {
    enableIoT: BuiltinTypes.BOOLEAN,
  }

  public static CHATTER_ANSWERS_SETTINGS = {
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

  public static CHATTER_EMAIL_MDSETTINGS = {
    enableChatterDigestEmailsApiOnly: BuiltinTypes.BOOLEAN,
    enableChatterEmailAttachment: BuiltinTypes.BOOLEAN,
    enableCollaborationEmail: BuiltinTypes.BOOLEAN,
    enableDisplayAppDownloadBadges: BuiltinTypes.BOOLEAN,
    enableEmailReplyToChatter: BuiltinTypes.BOOLEAN,
    enableEmailToChatter: BuiltinTypes.BOOLEAN,
  }

  public static MAP_AND_LOCATION_SETTINGS = {
    enableAddressAutoComplete: BuiltinTypes.BOOLEAN,
    enableMapsAndLocation: BuiltinTypes.BOOLEAN,
  }

  public static OBJECT_LINKING_SETTINGS = {
    enableObjectLinking: BuiltinTypes.BOOLEAN,
  }

  public static PREDICTION_BUILDER_SETTINGS = {
    enablePredictionBuilder: BuiltinTypes.BOOLEAN,
    isPredictionBuilderStarted: BuiltinTypes.BOOLEAN,
  }

  public static SOCIAL_CUSTOMER_SERVICE_SETTINGS = {
    // caseSubjectOption: BuiltinTypes.CASESUBJECTOPTION (ENUMERATION OF TYPE STRING),
    enableSocialApprovals: BuiltinTypes.BOOLEAN,
    enableSocialCaseAssignmentRules: BuiltinTypes.BOOLEAN,
    enableSocialCustomerService: BuiltinTypes.BOOLEAN,
    enableSocialPersonaHistoryTracking: BuiltinTypes.BOOLEAN,
    enableSocialPostHistoryTracking: BuiltinTypes.BOOLEAN,
    enableSocialReceiveParentPost: BuiltinTypes.BOOLEAN,
  }

  public static CASE_CLASSIFICATION_SETTINGS = {
    caseClassificationRecommendations: BuiltinTypes.BOOLEAN,
    reRunAttributeBasedRules: BuiltinTypes.BOOLEAN,
    runAssignmentRules: BuiltinTypes.BOOLEAN,
  }

  public static getAllMissingTypes = (): Record<string, Record<string, PrimitiveType>> => ({
    AccountInsightsSettings: MissingTypes.ACCOUNT_INSIGHT_SETTINGS,
    AccountIntelligenceSetings: MissingTypes.ACCOUNT_INTELLIGENCE_SETTINGS,
    AutomatedContacSettings: MissingTypes.AUTOMATED_CONTACTS_SETTINGS,
    ChatterAnswerSettings: MissingTypes.CHATTER_ANSWERS_SETTINGS,
    caseClassificationSettings: MissingTypes.CASE_CLASSIFICATION_SETTINGS,
    ChatterEmailMdSettings: MissingTypes.CHATTER_EMAIL_MDSETTINGS,
    IotSettings: MissingTypes.IOT_SETTINGS,
    MapAndLocationSettings: MissingTypes.MAP_AND_LOCATION_SETTINGS,
    ObjectLinkingSettings: MissingTypes.OBJECT_LINKING_SETTINGS,
    PredictionBuiderSettings: MissingTypes.PREDICTION_BUILDER_SETTINGS,
    SocialCustomerServiceSettings: MissingTypes.SOCIAL_CUSTOMER_SERVICE_SETTINGS,
  })
}

export class MissingSubTypes {
  public static BUSINESS_HOURS_ENTRY = {
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

  public static HOLIDAYS = {
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

  public static ORGANIZATION_SETTINGS_DETAIL = {
    settingName: BuiltinTypes.STRING,
    settingValue: BuiltinTypes.STRING,
  }

  public static getAllMissingSubTypes = (): Record<string, Record<string, PrimitiveType>> => ({
    BusinessHoursEntry: MissingSubTypes.BUSINESS_HOURS_ENTRY,
    Holidays: MissingSubTypes.HOLIDAYS,
    OrganizationSettingsDetail: MissingSubTypes.ORGANIZATION_SETTINGS_DETAIL,
  })
}
