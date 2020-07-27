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

import {
  BuiltinTypes, CORE_ANNOTATIONS, createRestriction, ElemID, ListType, ObjectType, PrimitiveType,
  PrimitiveTypes,
} from '@salto-io/adapter-api'
import { SALESFORCE, SUBTYPES_PATH, TYPES_PATH, XML_ATTRIBUTE_PREFIX } from '../constants'

const subTypesPath = [SALESFORCE, TYPES_PATH, SUBTYPES_PATH]

const objectType = new ObjectType({
  elemID: new ElemID(SALESFORCE, 'Object'),
  fields: {
    object: { type: BuiltinTypes.STRING },
  },
  path: [...subTypesPath, 'Object'],
})

const propertyType = new ObjectType({
  elemID: new ElemID(SALESFORCE, 'Property'),
  fields: {
    [`${XML_ATTRIBUTE_PREFIX}datasource`]: {
      type: BuiltinTypes.STRING, // todo retrieved as string delimited by ',' but is a list
    },
    [`${XML_ATTRIBUTE_PREFIX}default`]: {
      type: BuiltinTypes.STRING,
    },
    [`${XML_ATTRIBUTE_PREFIX}description`]: {
      type: BuiltinTypes.STRING,
    },
    [`${XML_ATTRIBUTE_PREFIX}label`]: {
      type: BuiltinTypes.STRING,
    },
    [`${XML_ATTRIBUTE_PREFIX}max`]: {
      type: BuiltinTypes.NUMBER,
    },
    [`${XML_ATTRIBUTE_PREFIX}min`]: {
      type: BuiltinTypes.NUMBER,
    },
    [`${XML_ATTRIBUTE_PREFIX}name`]: {
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    [`${XML_ATTRIBUTE_PREFIX}placeholder`]: {
      type: BuiltinTypes.STRING,
    },
    [`${XML_ATTRIBUTE_PREFIX}required`]: {
      type: BuiltinTypes.BOOLEAN,
    },
    [`${XML_ATTRIBUTE_PREFIX}role`]: {
      type: BuiltinTypes.STRING,
    },
    [`${XML_ATTRIBUTE_PREFIX}type`]: {
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
          values: ['Boolean', 'Integer', 'String', 'Color', 'Date', 'DateTime'],
          // eslint-disable-next-line @typescript-eslint/camelcase
          enforce_value: false,
        }),
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
  },
  path: [...subTypesPath, 'Property'],
})

const supportedFormFactorTypeType = new PrimitiveType({
  elemID: new ElemID(SALESFORCE, 'SupportedFormFactorType'),
  primitive: PrimitiveTypes.STRING,
  annotations: {
    [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ values: ['Small', 'Large'] }),
  },
  path: [...subTypesPath, 'SupportedFormFactorType'],
})

const supportedFormFactorType = new ObjectType({
  elemID: new ElemID(SALESFORCE, 'SupportedFormFactor'),
  fields: {
    [`${XML_ATTRIBUTE_PREFIX}type`]: {
      type: supportedFormFactorTypeType,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
  },
  path: [...subTypesPath, 'SupportedFormFactor'],
})

const supportedFormFactorsType = new ObjectType({
  elemID: new ElemID(SALESFORCE, 'SupportedFormFactors'),
  fields: {
    supportedFormFactor: { type: new ListType(supportedFormFactorType) },
  },
  path: [...subTypesPath, 'SupportedFormFactors'],
})

const targetConfigType = new ObjectType({
  elemID: new ElemID(SALESFORCE, 'TargetConfig'),
  fields: {
    [`${XML_ATTRIBUTE_PREFIX}targets`]: {
      type: BuiltinTypes.STRING, // todo retrieved as string delimited by ',' but is a list
    },
    [`${XML_ATTRIBUTE_PREFIX}configurationEditor`]: {
      type: BuiltinTypes.STRING,
    },
    objects: { type: new ListType(objectType) },
    property: { type: propertyType },
    supportedFormFactors: { type: supportedFormFactorsType },
  },
  path: [...subTypesPath, 'TargetConfig'],
})

const caseSubjectOptionType = new PrimitiveType({
  elemID: new ElemID(SALESFORCE, 'CaseSubjectOption'),
  primitive: PrimitiveTypes.STRING,
  annotations: {
    [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
      values: ['SocialPostSource', 'SocialPostContent', 'BuildCustom'],
    }),
  },
  path: [...subTypesPath, 'CaseSubjectOption'],
})

export const allMissingSubTypes = [
  new ObjectType({
    elemID: new ElemID(SALESFORCE, 'BusinessHoursEntry'),
    fields: {
      timeZoneId: { type: BuiltinTypes.STRING },
      name: { type: BuiltinTypes.STRING },
      default: { type: BuiltinTypes.STRING },
      mondayStartTime: { type: BuiltinTypes.STRING },
      mondayEndTime: { type: BuiltinTypes.STRING },
      tuesdayStartTime: { type: BuiltinTypes.STRING },
      tuesdayEndTime: { type: BuiltinTypes.STRING },
      wednesdayStartTime: { type: BuiltinTypes.STRING },
      wednesdayEndTime: { type: BuiltinTypes.STRING },
      thursdayStartTime: { type: BuiltinTypes.STRING },
      thursdayEndTime: { type: BuiltinTypes.STRING },
      fridayStartTime: { type: BuiltinTypes.STRING },
      fridayEndTime: { type: BuiltinTypes.STRING },
      saturdayStartTime: { type: BuiltinTypes.STRING },
      saturdayEndTime: { type: BuiltinTypes.STRING },
      sundayStartTime: { type: BuiltinTypes.STRING },
      sundayEndTime: { type: BuiltinTypes.STRING },
    },
    path: [...subTypesPath, 'BusinessHoursEntry'],
  }),
  new ObjectType({
    elemID: new ElemID(SALESFORCE, 'Holidays'),
    fields: {
      name: { type: BuiltinTypes.STRING },
      description: { type: BuiltinTypes.STRING },
      activityDate: { type: BuiltinTypes.STRING },
      recurrenceStartDate: { type: BuiltinTypes.STRING },
      recurrenceEndDate: { type: BuiltinTypes.STRING },
      startTime: { type: BuiltinTypes.STRING },
      endTime: { type: BuiltinTypes.STRING },
      recurrenceType: { type: BuiltinTypes.STRING },
      recurrenceInterval: { type: BuiltinTypes.STRING },
      recurrenceDayOfWeek: { type: BuiltinTypes.STRING },
      recurrenceDayOfMonth: { type: BuiltinTypes.STRING },
      recurrenceInstance: { type: BuiltinTypes.STRING },
      recurrenceMonthOfYear: { type: BuiltinTypes.STRING },
      businessHours: { type: BuiltinTypes.STRING },
    },
    path: [...subTypesPath, 'Holidays'],
  }),
  new ObjectType({
    elemID: new ElemID(SALESFORCE, 'OrganizationSettingsDetail'),
    fields: {
      settingName: { type: BuiltinTypes.STRING },
      settingValue: { type: BuiltinTypes.STRING },
    },
    path: [...subTypesPath, 'OrganizationSettingsDetail'],
  }),
  new ObjectType({
    elemID: new ElemID(SALESFORCE, 'TargetConfigs'),
    fields: {
      targetConfig: { type: new ListType(targetConfigType) },
    },
    path: [...subTypesPath, 'TargetConfigs'],
  }),
  targetConfigType,
  objectType,
  propertyType,
  supportedFormFactorsType,
  supportedFormFactorType,
  supportedFormFactorTypeType,
]

const typesPath = [SALESFORCE, TYPES_PATH]

export const allMissingTypes = [
  new ObjectType({
    elemID: new ElemID(SALESFORCE, 'AccountInsightsSettings'),
    fields: {
      enableAccountInsights: { type: BuiltinTypes.BOOLEAN },
    },
    path: [...typesPath, 'AccountInsightsSettings'],
  }),
  new ObjectType({
    elemID: new ElemID(SALESFORCE, 'AccountIntelligenceSettings'),
    fields: {
      enableAccountLogos: { type: BuiltinTypes.BOOLEAN },
      enableAutomatedAccountFields: { type: BuiltinTypes.BOOLEAN },
      enableNewsStories: { type: BuiltinTypes.BOOLEAN },
    },
    path: [...typesPath, 'AccountIntelligenceSettings'],
  }),
  new ObjectType({
    elemID: new ElemID(SALESFORCE, 'AutomatedContactSettings'),
    fields: {
      enableAddContactAutomatically: { type: BuiltinTypes.BOOLEAN },
      enableAddContactRoleAutomatically: { type: BuiltinTypes.BOOLEAN },
      enableAddContactRoleWithSuggestion: { type: BuiltinTypes.BOOLEAN },
      enableAddContactWithSuggestion: { type: BuiltinTypes.BOOLEAN },
    },
    path: [...typesPath, 'AutomatedContactSettings'],
  }),
  new ObjectType({
    elemID: new ElemID(SALESFORCE, 'IoTSettings'),
    fields: {
      enableIoT: { type: BuiltinTypes.BOOLEAN },
    },
    path: [...typesPath, 'IoTSettings'],
  }),
  new ObjectType({
    elemID: new ElemID(SALESFORCE, 'ChatterAnswerSettings'),
    fields: {
      emailFollowersOnBestAnswer: { type: BuiltinTypes.BOOLEAN },
      emailFollowersOnReply: { type: BuiltinTypes.BOOLEAN },
      emailOwnerOnPrivateReply: { type: BuiltinTypes.BOOLEAN },
      emailOwnerOnReply: { type: BuiltinTypes.BOOLEAN },
      enableAnswerViaEmail: { type: BuiltinTypes.BOOLEAN },
      enableChatterAnswers: { type: BuiltinTypes.BOOLEAN },
      enableFacebookSSO: { type: BuiltinTypes.BOOLEAN },
      enableInlinePublisher: { type: BuiltinTypes.BOOLEAN },
      enableReputation: { type: BuiltinTypes.BOOLEAN },
      enableRichTextEditor: { type: BuiltinTypes.BOOLEAN },
      facebookAuthProvider: { type: BuiltinTypes.STRING },
      showInPortals: { type: BuiltinTypes.BOOLEAN },
    },
    path: [...typesPath, 'ChatterAnswerSettings'],
  }),
  new ObjectType({
    elemID: new ElemID(SALESFORCE, 'ChatterEmailMdSettings'),
    fields: {
      enableChatterDigestEmailsApiOnly: { type: BuiltinTypes.BOOLEAN },
      enableChatterEmailAttachment: { type: BuiltinTypes.BOOLEAN },
      enableCollaborationEmail: { type: BuiltinTypes.BOOLEAN },
      enableDisplayAppDownloadBadges: { type: BuiltinTypes.BOOLEAN },
      enableEmailReplyToChatter: { type: BuiltinTypes.BOOLEAN },
      enableEmailToChatter: { type: BuiltinTypes.BOOLEAN },
    },
    path: [...typesPath, 'ChatterEmailMdSettings'],
  }),
  new ObjectType({
    elemID: new ElemID(SALESFORCE, 'MapAndLocationSettings'),
    fields: {
      enableAddressAutoComplete: { type: BuiltinTypes.BOOLEAN },
      enableMapsAndLocation: { type: BuiltinTypes.BOOLEAN },
    },
    path: [...typesPath, 'MapAndLocationSettings'],
  }),
  new ObjectType({
    elemID: new ElemID(SALESFORCE, 'ObjectLinkingSettings'),
    fields: {
      enableObjectLinking: { type: BuiltinTypes.BOOLEAN },
    },
    path: [...typesPath, 'ObjectLinkingSettings'],
  }),
  new ObjectType({
    elemID: new ElemID(SALESFORCE, 'PredictionBuiderSettings'),
    fields: {
      enablePredictionBuilder: { type: BuiltinTypes.BOOLEAN },
      isPredictionBuilderStarted: { type: BuiltinTypes.BOOLEAN },
    },
    path: [...typesPath, 'PredictionBuiderSettings'],
  }),
  new ObjectType({
    elemID: new ElemID(SALESFORCE, 'SocialCustomerServiceSettings'),
    fields: {
      caseSubjectOption: {
        type: caseSubjectOptionType,
        annotations: { [CORE_ANNOTATIONS.REQUIRED]: true },
      },
      enableSocialApprovals: { type: BuiltinTypes.BOOLEAN },
      enableSocialCaseAssignmentRules: { type: BuiltinTypes.BOOLEAN },
      enableSocialCustomerService: { type: BuiltinTypes.BOOLEAN },
      enableSocialPersonaHistoryTracking: { type: BuiltinTypes.BOOLEAN },
      enableSocialPostHistoryTracking: { type: BuiltinTypes.BOOLEAN },
      enableSocialReceiveParentPost: { type: BuiltinTypes.BOOLEAN },
    },
    path: [...typesPath, 'SocialCustomerServiceSettings'],
  }),
  new ObjectType({
    elemID: new ElemID(SALESFORCE, 'CaseClassificationSettings'),
    fields: {
      caseClassificationRecommendations: { type: BuiltinTypes.BOOLEAN },
      reRunAttributeBasedRules: { type: BuiltinTypes.BOOLEAN },
      runAssignmentRules: { type: BuiltinTypes.BOOLEAN },
    },
    path: [...typesPath, 'CaseClassificationSettings'],
  }),
]
