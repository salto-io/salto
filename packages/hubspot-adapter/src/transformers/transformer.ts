/*
*                      Copyright 2022 Salto Labs Ltd.
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
/* eslint-disable camelcase */
import _ from 'lodash'
import { ElemID, ObjectType, PrimitiveType, PrimitiveTypes, Field, isObjectType, getDeepInnerType, BuiltinTypes, InstanceElement, TypeElement, CORE_ANNOTATIONS, isListType, TypeMap, Values, isPrimitiveType, Value, ListType, createRestriction, StaticFile, isContainerType, isMapType } from '@salto-io/adapter-api'
import { TransformFunc, transformValues, GetLookupNameFunc, toObjectType, naclCase, pathNaclCase,
  safeJsonStringify } from '@salto-io/adapter-utils'
import { promises } from '@salto-io/lowerdash'
import { isFormInstance } from '../filters/form_field'
import {
  FIELD_TYPES, FORM_FIELDS, HUBSPOT, OBJECTS_NAMES, FORM_PROPERTY_FIELDS,
  NURTURETIMERANGE_FIELDS, ANCHOR_SETTING_FIELDS, FORM_PROPERTY_INNER_FIELDS,
  EVENTANCHOR_FIELDS, ACTION_FIELDS, FORM_PROPERTY_GROUP_FIELDS, OPTIONS_FIELDS,
  CONTACT_PROPERTY_FIELDS, CONTACTLISTIDS_FIELDS, RSSTOEMAILTIMING_FIELDS, userIdentifierElemID,
  DEPENDENT_FIELD_FILTER_FIELDS, FIELD_FILTER_FIELDS, WORKFLOWS_FIELDS, optionsElemID,
  MARKETING_EMAIL_FIELDS, RICHTEXT_FIELDS, formElemID, workflowsElemID, CRITERIA_FIELDS,
  propertyGroupElemID, propertyElemID, CONTACT_PROPERTY_OVERRIDES_FIELDS, rssToEmailTimingElemID,
  contactListIdsElemID, marketingEmailElemID, dependeeFormPropertyElemID, criteriaElemID,
  nurtureTimeRangeElemID, anchorSettingElemID, actionElemID, eventAnchorElemID,
  contactPropertyElemID, dependentFormFieldFiltersElemID, contactPropertyFieldTypeValues,
  fieldFilterElemID, richTextElemID, contactPropertyTypeValues, contactPropertyOverridesElemID,
  SUBTYPES_PATH, TYPES_PATH, RECORDS_PATH,
} from '../constants'
import {
  HubspotMetadata,
} from '../client/types'
import HubspotClient from '../client/client'

const { mapValuesAsync } = promises.object

export class Types {
  private static fieldTypes: TypeMap = {
    [FIELD_TYPES.TEXTAREA]: new PrimitiveType({
      elemID: new ElemID(HUBSPOT, FIELD_TYPES.TEXTAREA),
      primitive: PrimitiveTypes.STRING,
    }),
    [FIELD_TYPES.TEXT]: new PrimitiveType({
      elemID: new ElemID(HUBSPOT, FIELD_TYPES.TEXT),
      primitive: PrimitiveTypes.STRING,
    }),
    [FIELD_TYPES.DATE]: new PrimitiveType({
      elemID: new ElemID(HUBSPOT, FIELD_TYPES.DATE),
      primitive: PrimitiveTypes.STRING,
    }),
    [FIELD_TYPES.FILE]: new PrimitiveType({
      elemID: new ElemID(HUBSPOT, FIELD_TYPES.FILE),
      primitive: PrimitiveTypes.STRING,
    }),
    [FIELD_TYPES.NUMBER]: new PrimitiveType({
      elemID: new ElemID(HUBSPOT, FIELD_TYPES.NUMBER),
      primitive: PrimitiveTypes.NUMBER,
    }),
    [FIELD_TYPES.SELECT]: new PrimitiveType({
      elemID: new ElemID(HUBSPOT, FIELD_TYPES.SELECT),
      primitive: PrimitiveTypes.NUMBER,
    }),
    [FIELD_TYPES.RADIO]: new PrimitiveType({
      elemID: new ElemID(HUBSPOT, FIELD_TYPES.RADIO),
      primitive: PrimitiveTypes.NUMBER,
    }),
    [FIELD_TYPES.CHECKBOX]: new PrimitiveType({
      elemID: new ElemID(HUBSPOT, FIELD_TYPES.CHECKBOX),
      primitive: PrimitiveTypes.NUMBER,
    }),
    [FIELD_TYPES.BOOLEANCHECKBOX]: new PrimitiveType({
      elemID: new ElemID(HUBSPOT, FIELD_TYPES.BOOLEANCHECKBOX),
      primitive: PrimitiveTypes.NUMBER,
    }),
    [FIELD_TYPES.USERIDENTIFIER]: new PrimitiveType({
      elemID: userIdentifierElemID,
      primitive: PrimitiveTypes.STRING,
    }),
  }

  public static userIdentifierType = Types.fieldTypes[FIELD_TYPES.USERIDENTIFIER]

  private static optionsType: ObjectType =
    new ObjectType({
      elemID: optionsElemID,
      fields: {
        [OPTIONS_FIELDS.LABEL]: { refType: BuiltinTypes.STRING },
        [OPTIONS_FIELDS.VALUE]: { refType: BuiltinTypes.STRING },
        [OPTIONS_FIELDS.READONLY]: { refType: BuiltinTypes.BOOLEAN },
        [OPTIONS_FIELDS.DISPLAYORDER]: { refType: BuiltinTypes.NUMBER },
        [OPTIONS_FIELDS.HIDDEN]: { refType: BuiltinTypes.BOOLEAN },
        [OPTIONS_FIELDS.DESCRIPTION]: { refType: BuiltinTypes.STRING },
      },
      path: [HUBSPOT, TYPES_PATH, SUBTYPES_PATH, optionsElemID.name],
    })

  private static fieldFilterType: ObjectType =
    new ObjectType({
      elemID: fieldFilterElemID,
      fields: {
        [FIELD_FILTER_FIELDS.OPERATOR]: {
          refType: BuiltinTypes.STRING,
        },
        [FIELD_FILTER_FIELDS.STRVALUE]: {
          refType: BuiltinTypes.STRING,
        },
        [FIELD_FILTER_FIELDS.STRVALUES]: {
          refType: new ListType(BuiltinTypes.STRING),
        },
        [FIELD_FILTER_FIELDS.BOOLVALUE]: {
          refType: BuiltinTypes.BOOLEAN,
        },
        [FIELD_FILTER_FIELDS.NUMBERVALUE]: {
          refType: BuiltinTypes.NUMBER,
        },
        [FIELD_FILTER_FIELDS.NUMVALUES]: {
          refType: new ListType(BuiltinTypes.NUMBER),
        },
      },
      path: [HUBSPOT, TYPES_PATH, SUBTYPES_PATH, fieldFilterElemID.name],
    })

    private static contactPropertyOverridesType: ObjectType =
      new ObjectType({
        elemID: contactPropertyOverridesElemID,
        fields: {
          [CONTACT_PROPERTY_OVERRIDES_FIELDS.LABEL]: {
            refType: BuiltinTypes.STRING,
          },
          [CONTACT_PROPERTY_OVERRIDES_FIELDS.DISPLAYORDER]: {
            refType: BuiltinTypes.NUMBER,
          },
          [CONTACT_PROPERTY_OVERRIDES_FIELDS.OPTIONS]: {
            refType: new ListType(Types.optionsType),
          },
        },
        path: [HUBSPOT, TYPES_PATH, SUBTYPES_PATH, contactPropertyOverridesElemID.name],
      })

    private static createFormFieldType = (
      elemID: ElemID,
      isFatherProperty: boolean
    ): ObjectType => new ObjectType({
      elemID,
      fields: {
        // TODO: This is not really a string
        [FORM_PROPERTY_INNER_FIELDS.CONTACT_PROPERTY]: {
          refType: BuiltinTypes.STRING,
        },
        [FORM_PROPERTY_INNER_FIELDS.CONTACT_PROPERTY_OVERRIDES]: {
          refType: Types.contactPropertyOverridesType,
        },
        [FORM_PROPERTY_FIELDS.DEFAULTVALUE]: {
          refType: BuiltinTypes.STRING,
        },
        [FORM_PROPERTY_FIELDS.PLACEHOLDER]: {
          refType: BuiltinTypes.STRING,
        },
        [FORM_PROPERTY_INNER_FIELDS.HELPTEXT]: {
          refType: BuiltinTypes.STRING,
        },
        [FORM_PROPERTY_FIELDS.REQUIRED]: {
          refType: BuiltinTypes.BOOLEAN,
        },
        [FORM_PROPERTY_FIELDS.SELECTEDOPTIONS]: {
          refType: new ListType(BuiltinTypes.STRING),
        },
        [FORM_PROPERTY_FIELDS.ISSMARTFIELD]: {
          refType: BuiltinTypes.BOOLEAN,
        },
        ...isFatherProperty
          ? {
            [FORM_PROPERTY_FIELDS.DEPENDENTFIELDFILTERS]:
              {
                refType: new ListType(Types.dependentFormFieldFiltersType),
              },
          }
          : {},
      },
      path: [HUBSPOT, TYPES_PATH, SUBTYPES_PATH, elemID.name],
    })

  private static dependeeFormFieldType = Types.createFormFieldType(
    dependeeFormPropertyElemID,
    false
  )

  private static dependentFormFieldFiltersType: ObjectType =
    new ObjectType({
      elemID: dependentFormFieldFiltersElemID,
      fields: {
        [DEPENDENT_FIELD_FILTER_FIELDS.FORMFIELDACTION]: {
          refType: BuiltinTypes.STRING,
          annotations: {
            [CORE_ANNOTATIONS.REQUIRED]: true,
          },
        },
        [DEPENDENT_FIELD_FILTER_FIELDS.FILTERS]: {
          refType: new ListType(Types.fieldFilterType),
          annotations: {
            [CORE_ANNOTATIONS.REQUIRED]: true,
          },
        },
        [DEPENDENT_FIELD_FILTER_FIELDS.DEPEDENTFORMFIELD]: {
          refType: Types.dependeeFormFieldType,
          annotations: {
            [CORE_ANNOTATIONS.REQUIRED]: true,
          },
        },
      },
      path: [HUBSPOT, TYPES_PATH, SUBTYPES_PATH, dependentFormFieldFiltersElemID.name],
    })

  private static dependentFormFieldType = Types.createFormFieldType(
    propertyElemID,
    true
  )

  private static richTextType: ObjectType =
    new ObjectType({
      elemID: richTextElemID,
      fields: {
        [RICHTEXT_FIELDS.CONTENT]: { refType: BuiltinTypes.STRING },
      },
      path: [HUBSPOT, TYPES_PATH, SUBTYPES_PATH, richTextElemID.name],
    })

  private static propertyGroupType: ObjectType =
    new ObjectType({
      elemID: propertyGroupElemID,
      fields: {
        [FORM_PROPERTY_GROUP_FIELDS.DEFAULT]: {
          refType: BuiltinTypes.BOOLEAN,
        },
        [FORM_PROPERTY_GROUP_FIELDS.FIELDS]: {
          refType: new ListType(Types.dependentFormFieldType),
        },
        [FORM_PROPERTY_GROUP_FIELDS.ISSMARTGROUP]: {
          refType: BuiltinTypes.BOOLEAN,
        },
        [FORM_PROPERTY_GROUP_FIELDS.RICHTEXT]: {
          refType: Types.richTextType,
        },
      },
      path: [HUBSPOT, TYPES_PATH, SUBTYPES_PATH, propertyGroupElemID.name],
    })

  private static eventAnchorType: ObjectType =
    new ObjectType({
      elemID: eventAnchorElemID,
      fields: {
        [EVENTANCHOR_FIELDS.CONTACTPROPERTYANCHOR]: {
          refType: BuiltinTypes.STRING,
        },
        [EVENTANCHOR_FIELDS.STATICDATEANCHOR]: {
          refType: BuiltinTypes.STRING,
        },
      },
      path: [HUBSPOT, TYPES_PATH, SUBTYPES_PATH, eventAnchorElemID.name],
    })

  private static anchorSettingType: ObjectType =
    new ObjectType({
      elemID: anchorSettingElemID,
      fields: {
        [ANCHOR_SETTING_FIELDS.EXECTIMEOFDAY]: {
          refType: BuiltinTypes.STRING,
        },
        [ANCHOR_SETTING_FIELDS.EXECTIMEINMINUTES]: {
          refType: BuiltinTypes.NUMBER,
        },
        [ANCHOR_SETTING_FIELDS.BOUNDARY]: {
          refType: BuiltinTypes.STRING,
        },
      },
      path: [HUBSPOT, TYPES_PATH, SUBTYPES_PATH, anchorSettingElemID.name],
    })

  private static criteriaType: ObjectType =
    new ObjectType({
      elemID: criteriaElemID,
      fields: {
        [CRITERIA_FIELDS.FILTERFAMILY]: {
          refType: BuiltinTypes.STRING,
        },
        [CRITERIA_FIELDS.OPERATOR]: { refType: BuiltinTypes.STRING },
        [CRITERIA_FIELDS.PROPERTY]: { refType: BuiltinTypes.STRING },
        [CRITERIA_FIELDS.PROPERTYOBJECTTYPE]: {
          refType: BuiltinTypes.STRING,
        },
        [CRITERIA_FIELDS.TYPE]: { refType: BuiltinTypes.STRING },
        [CRITERIA_FIELDS.VALUE]: { refType: BuiltinTypes.STRING },
        [CRITERIA_FIELDS.WITHINTIMEMODE]: {
          refType: BuiltinTypes.STRING,
        },
      },
      path: [HUBSPOT, TYPES_PATH, SUBTYPES_PATH, criteriaElemID.name],
    })

    // Create action type in steps cause of recursive fields
    private static createActionType = (): ObjectType => {
      const actionType = new ObjectType({
        elemID: actionElemID,
        fields: {
          [ACTION_FIELDS.TYPE]: { refType: BuiltinTypes.STRING },
          [ACTION_FIELDS.ACTIONID]: { refType: BuiltinTypes.NUMBER },
          [ACTION_FIELDS.DELAYMILLS]: { refType: BuiltinTypes.NUMBER },
          [ACTION_FIELDS.STEPID]: { refType: BuiltinTypes.NUMBER },
          [ACTION_FIELDS.ANCHORSETTING]: {
            refType: Types.anchorSettingType,
          },
          [ACTION_FIELDS.FILTERSLISTID]: { refType: BuiltinTypes.NUMBER },
          [ACTION_FIELDS.FILTERS]: {
            refType: new ListType(new ListType(Types.criteriaType)),
          },
          [ACTION_FIELDS.PROPERTYNAME]: { refType: BuiltinTypes.STRING },
          [ACTION_FIELDS.BODY]: { refType: BuiltinTypes.STRING },
          [ACTION_FIELDS.NEWVALUE]: { refType: BuiltinTypes.STRING },
          [ACTION_FIELDS.STATICTO]: { refType: BuiltinTypes.STRING },
        },
        path: [HUBSPOT, TYPES_PATH, SUBTYPES_PATH, actionElemID.name],
      })

      const acceptActionsField = new Field(
        actionType,
        ACTION_FIELDS.ACCEPTACTIONS,
        new ListType(actionType)
      )
      const rejectActionsField = new Field(
        actionType,
        ACTION_FIELDS.REJECTACTIONS,
        new ListType(actionType),
      )
      actionType.fields[ACTION_FIELDS.ACCEPTACTIONS] = acceptActionsField
      actionType.fields[ACTION_FIELDS.REJECTACTIONS] = rejectActionsField
      return actionType
    }

  private static actionType: ObjectType = Types.createActionType()

  private static nurtureTimeRangeType: ObjectType =
    new ObjectType({
      elemID: nurtureTimeRangeElemID,
      fields: {
        [NURTURETIMERANGE_FIELDS.ENABLED]: {
          refType: BuiltinTypes.BOOLEAN,
        },
        [NURTURETIMERANGE_FIELDS.STARTHOUR]: {
          refType: BuiltinTypes.NUMBER,
        },
        [NURTURETIMERANGE_FIELDS.STOPHOUR]: {
          refType: BuiltinTypes.NUMBER,
        },
      },
      path: [HUBSPOT, TYPES_PATH, SUBTYPES_PATH, nurtureTimeRangeElemID.name],
    })

  private static contactListIdsType: ObjectType =
    new ObjectType({
      elemID: contactListIdsElemID,
      fields: {
        [CONTACTLISTIDS_FIELDS.ENROLLED]: {
          refType: BuiltinTypes.NUMBER,
        },
        [CONTACTLISTIDS_FIELDS.ACTIVE]: {
          refType: BuiltinTypes.NUMBER,
        },
        [CONTACTLISTIDS_FIELDS.SUCCEEDED]: {
          refType: BuiltinTypes.NUMBER,
        },
        [CONTACTLISTIDS_FIELDS.COMPLETED]: {
          refType: BuiltinTypes.NUMBER,
        },
      },
      path: [HUBSPOT, TYPES_PATH, SUBTYPES_PATH, contactListIdsElemID.name],
    })

  private static rssToEmailTimingType: ObjectType =
    new ObjectType({
      elemID: rssToEmailTimingElemID,
      fields: {
        [RSSTOEMAILTIMING_FIELDS.REPEATS]: {
          refType: BuiltinTypes.STRING,
          annotations: {
            [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
              values: ['instant', 'daily', 'weekly', 'monthly'],
            }),
          },
        },
        [RSSTOEMAILTIMING_FIELDS.REPEATS_ON_MONTHLY]: {
          refType: BuiltinTypes.NUMBER,
        },
        [RSSTOEMAILTIMING_FIELDS.REPEATS_ON_WEEKLY]: {
          refType: BuiltinTypes.NUMBER,
        },
        [RSSTOEMAILTIMING_FIELDS.TIME]: {
          refType: BuiltinTypes.STRING,
        },
      },
      path: [HUBSPOT, TYPES_PATH, SUBTYPES_PATH, rssToEmailTimingElemID.name],
    })

  /**
   * This method create array of all supported Hubspot objects.
   * This is static creation cause hubspot API support only instances.
   */
  public static hubspotObjects: Record<string, ObjectType> = {
    [OBJECTS_NAMES.FORM]: new ObjectType({
      elemID: formElemID,
      fields: {
        [FORM_FIELDS.GUID]: {
          refType: BuiltinTypes.STRING,
          annotations: {
            [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
          },
        },
        [FORM_FIELDS.NAME]: {
          refType: BuiltinTypes.STRING,
          annotations: {
            [CORE_ANNOTATIONS.REQUIRED]: true,
          },
        },
        [FORM_FIELDS.CSSCLASS]: { refType: BuiltinTypes.STRING },
        [FORM_FIELDS.REDIRECT]: { refType: BuiltinTypes.STRING },
        [FORM_FIELDS.SUBMITTEXT]: { refType: BuiltinTypes.STRING },
        [FORM_FIELDS.NOTIFYRECIPIENTS]: {
          refType: new ListType(Types.fieldTypes[FIELD_TYPES.USERIDENTIFIER]),
        },
        [FORM_FIELDS.IGNORECURRENTVALUES]: {
          refType: BuiltinTypes.BOOLEAN,
        },
        [FORM_FIELDS.DELETABLE]: {
          refType: BuiltinTypes.BOOLEAN,
        },
        [FORM_FIELDS.INLINEMESSAGE]: {
          refType: BuiltinTypes.STRING,
        },
        [FORM_FIELDS.FORMFIELDGROUPS]: {
          refType: new ListType(Types.propertyGroupType),
        },
        [FORM_FIELDS.CAPTCHAENABLED]: {
          refType: BuiltinTypes.BOOLEAN,
        },
        [FORM_FIELDS.CREATEDAT]: {
          refType: BuiltinTypes.NUMBER,
          annotations: {
            [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
          },
        },
        [FORM_FIELDS.CLONEABLE]: { refType: BuiltinTypes.BOOLEAN },
        [FORM_FIELDS.STYLE]: { refType: BuiltinTypes.STRING },
        [FORM_FIELDS.EDITABLE]: { refType: BuiltinTypes.BOOLEAN },
        [FORM_FIELDS.THEMENAME]: { refType: BuiltinTypes.STRING },
      },
      path: [HUBSPOT, TYPES_PATH, formElemID.name],
    }),
    [OBJECTS_NAMES.WORKFLOW]: new ObjectType({
      elemID: workflowsElemID,
      fields: {
        [WORKFLOWS_FIELDS.ID]: {
          refType: BuiltinTypes.NUMBER,
          annotations: {
            [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
          },
        },
        [WORKFLOWS_FIELDS.NAME]: {
          refType: BuiltinTypes.STRING,
          annotations: {
            [CORE_ANNOTATIONS.REQUIRED]: true,
          },
        },
        [WORKFLOWS_FIELDS.SEGMENTCRITERIA]: {
          refType: new ListType(new ListType(Types.criteriaType)),
        },
        [WORKFLOWS_FIELDS.GOALCRITERIA]: {
          refType: new ListType(new ListType(Types.criteriaType)),
        },
        [WORKFLOWS_FIELDS.TYPE]: {
          refType: BuiltinTypes.STRING,
          annotations: {
            [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
              enforce_value: false,
              values: ['PROPERTY_ANCHOR', 'STATIC_ANCHOR', 'DRIP_DELAY'],
            }),
          },
        },
        [WORKFLOWS_FIELDS.ENABLED]: { refType: BuiltinTypes.BOOLEAN },
        [WORKFLOWS_FIELDS.INSERTEDAT]: {
          refType: BuiltinTypes.NUMBER,
          annotations: {
            [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
          },
        },
        [WORKFLOWS_FIELDS.UPDATEDAT]: {
          refType: BuiltinTypes.NUMBER,
          annotations: {
            [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
          },
        },
        [WORKFLOWS_FIELDS.CONTACTLISTIDS]: {
          refType: Types.contactListIdsType,
        },
        [WORKFLOWS_FIELDS.INTERNAL]: {
          refType: BuiltinTypes.BOOLEAN,
        },
        [WORKFLOWS_FIELDS.ONLYEXECONBIZDAYS]: {
          refType: BuiltinTypes.BOOLEAN,
        },
        [WORKFLOWS_FIELDS.NURTURETIMERANGE]: {
          refType: Types.nurtureTimeRangeType,
        },
        [WORKFLOWS_FIELDS.ACTIONS]: {
          refType: new ListType(Types.actionType),
        },
        [WORKFLOWS_FIELDS.LISTENING]: {
          refType: BuiltinTypes.BOOLEAN,
        },
        [WORKFLOWS_FIELDS.EVENTANCHOR]: {
          refType: Types.eventAnchorType,
        },
        [WORKFLOWS_FIELDS.ALLOWCONTACTTOTRIGGERMULTIPLETIMES]: {
          refType: BuiltinTypes.BOOLEAN,
        },
        [WORKFLOWS_FIELDS.ONLYENROLLMANUALLY]: {
          refType: BuiltinTypes.BOOLEAN,
        },
        [WORKFLOWS_FIELDS.ENROLLONCRITERIAUPDATE]: {
          refType: BuiltinTypes.BOOLEAN,
        },
        [WORKFLOWS_FIELDS.SUPRESSIONLISTIDS]: {
          refType: new ListType(BuiltinTypes.NUMBER),
        },
      },
      path: [HUBSPOT, TYPES_PATH, workflowsElemID.name],
    }),
    [OBJECTS_NAMES.MARKETINGEMAIL]: new ObjectType({
      elemID: marketingEmailElemID,
      fields: {
        [MARKETING_EMAIL_FIELDS.AB]: {
          refType: BuiltinTypes.BOOLEAN,
        },
        [MARKETING_EMAIL_FIELDS.ABHOURSWAIT]: {
          refType: BuiltinTypes.NUMBER,
        },
        [MARKETING_EMAIL_FIELDS.ABVARIATION]: {
          refType: BuiltinTypes.BOOLEAN,
        },
        [MARKETING_EMAIL_FIELDS.ABSAMPLESIZEDEFAULT]: {
          refType: BuiltinTypes.STRING,
          annotations: {
            [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ values: ['master', 'variant'] }),
          },
        },
        [MARKETING_EMAIL_FIELDS.ABSAMPLINGDEFAULT]: {
          refType: BuiltinTypes.STRING,
          annotations: {
            [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ values: ['master', 'variant'] }),
          },
        },
        [MARKETING_EMAIL_FIELDS.ABSTATUS]: {
          refType: BuiltinTypes.STRING,
          annotations: {
            [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ values: ['master', 'variant'] }),
          },
        },
        [MARKETING_EMAIL_FIELDS.ABSUCCESSMETRIC]: {
          refType: BuiltinTypes.STRING,
          annotations: {
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
              values: ['CLICKS_BY_OPENS', 'CLICKS_BY_DELIVERED', 'OPENS_BY_DELIVERED'],
            }),
          },
        },
        [MARKETING_EMAIL_FIELDS.ABTESTID]: {
          refType: BuiltinTypes.NUMBER,
        },
        [MARKETING_EMAIL_FIELDS.ABTESTPERCENTAGE]: {
          refType: BuiltinTypes.NUMBER,
        },
        [MARKETING_EMAIL_FIELDS.ABSOLUTEURL]: {
          refType: BuiltinTypes.STRING,
        },
        [MARKETING_EMAIL_FIELDS.ALLEMAILCAMPAIGNIDS]: {
          refType: new ListType(BuiltinTypes.NUMBER),
        },
        [MARKETING_EMAIL_FIELDS.ANALYTICSPAGEID]: {
          refType: BuiltinTypes.STRING,
        },
        [MARKETING_EMAIL_FIELDS.ARCHIVED]: {
          refType: BuiltinTypes.BOOLEAN,
        },
        [MARKETING_EMAIL_FIELDS.AUTHOR]: {
          refType: BuiltinTypes.STRING,
          annotations: {
            [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
          },
        },
        [MARKETING_EMAIL_FIELDS.AUTHORAT]: {
          refType: BuiltinTypes.NUMBER,
          annotations: {
            [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
          },
        },
        [MARKETING_EMAIL_FIELDS.AUTHOREMAIL]: {
          refType: BuiltinTypes.STRING,
          annotations: {
            [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
          },
        },
        [MARKETING_EMAIL_FIELDS.AUTHORNAME]: {
          refType: BuiltinTypes.STRING,
          annotations: {
            [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
          },
        },
        [MARKETING_EMAIL_FIELDS.AUTHORUSERID]: {
          refType: BuiltinTypes.NUMBER,
          annotations: {
            [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
          },
        },
        [MARKETING_EMAIL_FIELDS.BLOGEMAILTYPE]: {
          refType: BuiltinTypes.STRING,
          annotations: {
            [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
              values: ['instant', 'daily', 'weekly', 'monthly'],
            }),
          },
        },
        [MARKETING_EMAIL_FIELDS.BLOGRSSSETTINGS]: {
          refType: BuiltinTypes.NUMBER,
        },
        [MARKETING_EMAIL_FIELDS.CAMPAIGN]: {
          refType: BuiltinTypes.STRING,
        },
        [MARKETING_EMAIL_FIELDS.CAMPAIGNNAME]: {
          refType: BuiltinTypes.STRING,
        },
        [MARKETING_EMAIL_FIELDS.CANSPAMSETTINGSID]: {
          refType: BuiltinTypes.NUMBER,
        },
        [MARKETING_EMAIL_FIELDS.CLONEDFROM]: {
          refType: BuiltinTypes.NUMBER,
        },
        [MARKETING_EMAIL_FIELDS.CREATEPAGE]: {
          refType: BuiltinTypes.BOOLEAN,
        },
        [MARKETING_EMAIL_FIELDS.CREATED]: {
          refType: BuiltinTypes.NUMBER,
          annotations: {
            [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
          },
        },
        [MARKETING_EMAIL_FIELDS.CURRENTLYPUBLISHED]: {
          refType: BuiltinTypes.BOOLEAN,
          annotations: {
            [CORE_ANNOTATIONS.REQUIRED]: true,
          },
        },
        [MARKETING_EMAIL_FIELDS.DOMAIN]: {
          refType: BuiltinTypes.STRING,
        },
        [MARKETING_EMAIL_FIELDS.EMAILBODY]: {
          refType: BuiltinTypes.STRING,
          annotations: {
            [CORE_ANNOTATIONS.REQUIRED]: true,
          },
        },
        [MARKETING_EMAIL_FIELDS.EMAILNOTE]: {
          refType: BuiltinTypes.STRING,
        },
        [MARKETING_EMAIL_FIELDS.EMAILTYPE]: {
          refType: BuiltinTypes.STRING,
          annotations: {
            [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
              enforce_value: false,
              values: ['BATCH_EMAIL', 'AB_EMAIL', 'AUTOMATED_EMAIL', 'BLOG_EMAIL', 'BLOG_EMAIL_CHILD', 'FOLLOWUP_EMAIL',
                'LOCALTIME_EMAIL', 'OPTIN_EMAIL', 'OPTIN_FOLLOWUP_EMAIL', 'RESUBSCRIBE_EMAIL', 'RSS_EMAIL', 'RSS_EMAIL_CHILD', 'SINGLE_SEND_API',
                'SMTP_TOKEN', 'LEADFLOW_EMAIL', 'FEEDBACK_CES_EMAIL', 'FEEDBACK_NPS_EMAIL', 'FEEDBACK_CUSTOM_EMAIL', 'TICKET_EMAIL',
              ],
            }),
          },
        },
        [MARKETING_EMAIL_FIELDS.FEEDBACKEMAILCATEGORY]: {
          refType: BuiltinTypes.STRING,
          annotations: {
            [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
              enforce_value: false,
              values: ['NPS', 'CES', 'CUSTOM'],
            }),
          },
        },
        [MARKETING_EMAIL_FIELDS.FEEDBACKSURVEYID]: {
          refType: BuiltinTypes.NUMBER,
        },
        [MARKETING_EMAIL_FIELDS.FLEXAREAS]: {
          refType: BuiltinTypes.JSON,
        },
        [MARKETING_EMAIL_FIELDS.FOLDERID]: {
          refType: BuiltinTypes.NUMBER,
        },
        [MARKETING_EMAIL_FIELDS.FREEZEDATE]: {
          refType: BuiltinTypes.NUMBER,
          annotations: {
            [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
          },
        },
        [MARKETING_EMAIL_FIELDS.FROMNAME]: {
          refType: BuiltinTypes.STRING,
        },
        [MARKETING_EMAIL_FIELDS.HTMLTITLE]: {
          refType: BuiltinTypes.STRING,
        },
        [MARKETING_EMAIL_FIELDS.ID]: {
          refType: BuiltinTypes.NUMBER,
          annotations: {
            [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
          },
        },
        [MARKETING_EMAIL_FIELDS.ISGRAYMAILSUPPRESSIONENABLED]: {
          refType: BuiltinTypes.BOOLEAN,
        },
        [MARKETING_EMAIL_FIELDS.ISLOCALTIMEZONESEND]: {
          refType: BuiltinTypes.BOOLEAN,
        },
        [MARKETING_EMAIL_FIELDS.ISPUBLISHED]: {
          refType: BuiltinTypes.BOOLEAN,
        },
        [MARKETING_EMAIL_FIELDS.ISRECIPIENTFATIGUESUPPRESSIONENABLED]: {
          refType: BuiltinTypes.BOOLEAN,
        },
        [MARKETING_EMAIL_FIELDS.LEADFLOWID]: {
          refType: BuiltinTypes.NUMBER,
        },
        [MARKETING_EMAIL_FIELDS.LIVEDOMAIN]: {
          refType: BuiltinTypes.STRING,
          annotations: {
            [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
          },
        },
        [MARKETING_EMAIL_FIELDS.MAILINGLISTSEXCLUDED]: {
          refType: new ListType(BuiltinTypes.NUMBER),
        },
        [MARKETING_EMAIL_FIELDS.MAILINGLISTSINCLUDED]: {
          refType: new ListType(BuiltinTypes.NUMBER),
        },
        [MARKETING_EMAIL_FIELDS.MAXRSSENTRIES]: {
          refType: BuiltinTypes.NUMBER,
        },
        [MARKETING_EMAIL_FIELDS.METADESCRIPTION]: {
          refType: BuiltinTypes.STRING,
        },
        [MARKETING_EMAIL_FIELDS.NAME]: {
          refType: BuiltinTypes.STRING,
        },
        [MARKETING_EMAIL_FIELDS.PAGEEXPIRYDATE]: {
          refType: BuiltinTypes.NUMBER,
          annotations: {
            [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
          },
        },
        [MARKETING_EMAIL_FIELDS.PAGEEXPIRYREDIRECTEID]: {
          refType: BuiltinTypes.STRING,
          annotations: {
            [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
          },
        },
        [MARKETING_EMAIL_FIELDS.PAGEREDIRECTED]: {
          refType: BuiltinTypes.BOOLEAN,
        },
        [MARKETING_EMAIL_FIELDS.PREVIEWKEY]: {
          refType: BuiltinTypes.STRING,
        },
        [MARKETING_EMAIL_FIELDS.PROCESSINGSTATUS]: {
          refType: BuiltinTypes.STRING,
          annotations: {
            [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
              enforce_value: false,
              values: ['UNDEFINED', 'PUBLISHED', 'PUBLISHED_OR_SCHEDULED', 'SCHEDULED', 'PROCESSING',
                'PRE_PROCESSING', 'ERROR', 'CANCELED_FORCIBLY', 'CANCELED_ABUSE'],
            }),
          },
        },
        [MARKETING_EMAIL_FIELDS.PUBLISHDATE]: {
          refType: BuiltinTypes.NUMBER,
          annotations: {
            [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
          },
        },
        [MARKETING_EMAIL_FIELDS.PUBLISHEDAT]: {
          refType: BuiltinTypes.NUMBER,
          annotations: {
            [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
          },
        },
        [MARKETING_EMAIL_FIELDS.PUBLISHEDBYID]: {
          refType: BuiltinTypes.NUMBER,
          annotations: {
            [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
          },
        },
        [MARKETING_EMAIL_FIELDS.PUBLISHEDBYNAME]: {
          refType: BuiltinTypes.STRING,
          annotations: {
            [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
          },
        },
        [MARKETING_EMAIL_FIELDS.PUBLISHIMMEDIATELY]: {
          refType: BuiltinTypes.BOOLEAN,
        },
        [MARKETING_EMAIL_FIELDS.PUBLISHEDURL]: {
          refType: BuiltinTypes.STRING,
        },
        [MARKETING_EMAIL_FIELDS.REPLYTO]: {
          refType: BuiltinTypes.STRING,
        },
        [MARKETING_EMAIL_FIELDS.RESOLVEDDOMAIN]: {
          refType: BuiltinTypes.STRING,
        },
        [MARKETING_EMAIL_FIELDS.RSSEMAILAUTHORLINETEMPLATE]: {
          refType: BuiltinTypes.STRING,
        },
        [MARKETING_EMAIL_FIELDS.RSSEMAILBLOGIMAGEMAXWIDTH]: {
          refType: BuiltinTypes.NUMBER,
        },
        [MARKETING_EMAIL_FIELDS.RSSEMAILBYTEXT]: {
          refType: BuiltinTypes.STRING,
        },
        [MARKETING_EMAIL_FIELDS.RSSEMAILCLICKTHROUGHTEXT]: {
          refType: BuiltinTypes.STRING,
        },
        [MARKETING_EMAIL_FIELDS.RSSEMAILCOMMENTTEXT]: {
          refType: BuiltinTypes.STRING,
        },
        [MARKETING_EMAIL_FIELDS.RSSEMAILENTRYTEMPLATE]: {
          refType: BuiltinTypes.BOOLEAN,
        },
        [MARKETING_EMAIL_FIELDS.RSSEMAILENTRYTEMPLATEENABLED]: {
          refType: BuiltinTypes.BOOLEAN,
        },
        [MARKETING_EMAIL_FIELDS.RSSEMAILURL]: {
          refType: BuiltinTypes.STRING,
        },
        [MARKETING_EMAIL_FIELDS.RSSTOEMAILTIMING]: {
          refType: Types.rssToEmailTimingType,
        },
        [MARKETING_EMAIL_FIELDS.SLUG]: {
          refType: BuiltinTypes.STRING,
        },
        // TODO: Understand this and convert to a list of smart fields
        [MARKETING_EMAIL_FIELDS.SMARTEMAILFIELDS]: {
          refType: BuiltinTypes.JSON,
        },
        [MARKETING_EMAIL_FIELDS.STYLESETTINGS]: {
          refType: BuiltinTypes.JSON,
        },
        [MARKETING_EMAIL_FIELDS.SUBCATEGORY]: {
          refType: BuiltinTypes.STRING,
          annotations: {
            [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
              enforce_value: false,
              values: ['ab_master', 'ab_variant', 'automated', 'automated_for_deal', 'automated_for_form',
                'automated_for_form_legacy', 'automated_for_form_buffer', 'automated_for_form_draft',
                'rss_to_email', 'rss_to_email_child', 'blog_email', 'blog_email_child', 'optin_email', 'optin_followup_email',
                'batch', 'resubscribe_email', 'single_send_api', 'smtp_token', 'localtime', 'automated_for_ticket', 'automated_for_leadflow',
                'automated_for_feedback_ces', 'automated_for_feedback_nps', 'automated_for_feedback_custom',
              ],
            }),
          },
        },
        [MARKETING_EMAIL_FIELDS.SUBJECT]: {
          refType: BuiltinTypes.STRING,
        },
        [MARKETING_EMAIL_FIELDS.SUBSCRIPTION]: {
          refType: BuiltinTypes.NUMBER,
        },
        [MARKETING_EMAIL_FIELDS.SUBSCRIPTIONBLOGID]: {
          refType: BuiltinTypes.NUMBER,
        },
        [MARKETING_EMAIL_FIELDS.SUBSCRIPTIONNAME]: {
          refType: BuiltinTypes.STRING,
        },
        [MARKETING_EMAIL_FIELDS.TEMPLATEPATH]: {
          refType: BuiltinTypes.STRING,
        },
        [MARKETING_EMAIL_FIELDS.TRANSACTIONAL]: {
          refType: BuiltinTypes.BOOLEAN,
        },
        [MARKETING_EMAIL_FIELDS.UNPUBLISHEDAT]: {
          refType: BuiltinTypes.NUMBER,
          annotations: {
            [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
          },
        },
        [MARKETING_EMAIL_FIELDS.UPDATED]: {
          refType: BuiltinTypes.NUMBER,
          annotations: {
            [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
          },
        },
        [MARKETING_EMAIL_FIELDS.UPDATEDBYID]: {
          refType: Types.fieldTypes[FIELD_TYPES.USERIDENTIFIER],
          annotations: {
            [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
          },
        },
        [MARKETING_EMAIL_FIELDS.URL]: {
          refType: BuiltinTypes.STRING,
        },
        [MARKETING_EMAIL_FIELDS.USERSSHEADLINEASSUBJECT]: {
          refType: BuiltinTypes.BOOLEAN,
        },
        // TODO: Consider converting to emails list
        [MARKETING_EMAIL_FIELDS.VIDSEXCLUDED]: {
          refType: new ListType(BuiltinTypes.NUMBER),
        },
        // TODO: Consider converting to emails list
        [MARKETING_EMAIL_FIELDS.VIDSINCLUDED]: {
          refType: new ListType(BuiltinTypes.NUMBER),
        },
        [MARKETING_EMAIL_FIELDS.WIDGETS]: {
          refType: BuiltinTypes.JSON,
        },
        // TODO: Convert to reference
        [MARKETING_EMAIL_FIELDS.WORKFLOWNAMES]: {
          refType: new ListType(BuiltinTypes.STRING),
        },
      },
      path: [HUBSPOT, TYPES_PATH, marketingEmailElemID.name],
    }),
    [OBJECTS_NAMES.CONTACT_PROPERTY]: new ObjectType({
      elemID: contactPropertyElemID,
      fields: {
        [CONTACT_PROPERTY_FIELDS.NAME]: {
          refType: BuiltinTypes.STRING,
          annotations: {
            [CORE_ANNOTATIONS.REQUIRED]: true,
          },
        },
        [CONTACT_PROPERTY_FIELDS.LABEL]: {
          refType: BuiltinTypes.STRING,
        },
        [CONTACT_PROPERTY_FIELDS.DESCRIPTION]: {
          refType: BuiltinTypes.STRING,
        },
        [CONTACT_PROPERTY_FIELDS.GROUPNAME]: {
          refType: BuiltinTypes.STRING,
          annotations: {
            [CORE_ANNOTATIONS.REQUIRED]: true,
          },
        },
        [CONTACT_PROPERTY_FIELDS.TYPE]: {
          refType: BuiltinTypes.STRING,
          annotations: {
            [CORE_ANNOTATIONS.REQUIRED]: true,
            [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
              values: contactPropertyTypeValues,
            }),
          },
        },
        [CONTACT_PROPERTY_FIELDS.FIELDTYPE]: {
          refType: BuiltinTypes.STRING,
          annotations: {
            [CORE_ANNOTATIONS.REQUIRED]: true,
            [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
              values: contactPropertyFieldTypeValues,
            }),
          },
        },
        [CONTACT_PROPERTY_FIELDS.OPTIONS]: {
          refType: new ListType(Types.optionsType),
        },
        [CONTACT_PROPERTY_FIELDS.DELETED]: {
          refType: BuiltinTypes.BOOLEAN,
        },
        [CONTACT_PROPERTY_FIELDS.FORMFIELD]: {
          refType: BuiltinTypes.BOOLEAN,
          annotations: {
            [CORE_ANNOTATIONS.REQUIRED]: true,
          },
        },
        [CONTACT_PROPERTY_FIELDS.DISPLAYORDER]: {
          refType: BuiltinTypes.NUMBER,
          annotations: {
            [CORE_ANNOTATIONS.DEFAULT]: -1,
          },
        },
        [CONTACT_PROPERTY_FIELDS.READONLYVALUE]: {
          refType: BuiltinTypes.BOOLEAN,
          annotations: {
            [CORE_ANNOTATIONS.DEFAULT]: false,
          },
        },
        [CONTACT_PROPERTY_FIELDS.READONLYDEFINITION]: {
          refType: BuiltinTypes.BOOLEAN,
          annotations: {
            [CORE_ANNOTATIONS.DEFAULT]: false,
          },
        },
        [CONTACT_PROPERTY_FIELDS.HIDDEN]: {
          refType: BuiltinTypes.BOOLEAN,
          annotations: {
            [CORE_ANNOTATIONS.DEFAULT]: false,
          },
        },
        [CONTACT_PROPERTY_FIELDS.MUTABLEDEFINITIONNOTDELETABLE]: {
          refType: BuiltinTypes.BOOLEAN,
          annotations: {
            [CORE_ANNOTATIONS.DEFAULT]: false,
          },
        },
        [CONTACT_PROPERTY_FIELDS.CALCULATED]: {
          refType: BuiltinTypes.BOOLEAN,
        },
        [CONTACT_PROPERTY_FIELDS.CREATEDAT]: {
          refType: BuiltinTypes.NUMBER,
          annotations: {
            [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
          },
        },
        [CONTACT_PROPERTY_FIELDS.EXTERNALOPTIONS]: {
          refType: BuiltinTypes.BOOLEAN,
          annotations: {
            [CORE_ANNOTATIONS.DEFAULT]: false,
          },
        },
      },
      path: [HUBSPOT, TYPES_PATH, contactPropertyElemID.name],
    }),
  }


  public static hubspotSubTypes: ObjectType[] = [
    Types.propertyGroupType,
    Types.optionsType,
    Types.contactListIdsType,
    Types.eventAnchorType,
    Types.nurtureTimeRangeType,
    Types.actionType,
    Types.anchorSettingType,
    Types.fieldFilterType,
    Types.richTextType,
    Types.contactPropertyOverridesType,
    Types.dependentFormFieldFiltersType,
    Types.dependentFormFieldType,
    Types.dependeeFormFieldType,
    Types.criteriaType,
  ]

  /**
   * This method create all the (basic) field types
   */
  static getAllFieldTypes(): TypeElement[] {
    return _.concat(
      Object.values(Types.fieldTypes),
    ).map(type => {
      const fieldType = type.clone()
      fieldType.path = [HUBSPOT, TYPES_PATH, SUBTYPES_PATH, 'field_types']
      return fieldType
    })
  }
}

export const createInstanceName = (
  name: string
): string => naclCase(name.trim())

export const transformPrimitive: TransformFunc = async ({ value, field, path }) => {
  const fieldType = await field?.getType()
  if (!isPrimitiveType(fieldType)) {
    return value
  }
  // remove values that are just an empty string or null
  if (value === '' || value === null) {
    return undefined
  }
  if (fieldType.isEqual(BuiltinTypes.JSON) && _.isPlainObject(value)) {
    if (_.isEmpty(value)) {
      return undefined
    }
    return new StaticFile({
      filepath: `${path?.getFullNameParts().filter((namePart: string): boolean => namePart !== 'instance').join('/')}.json`,
      content: Buffer.from(safeJsonStringify(value, undefined, 2)),
      encoding: 'utf-8',
    })
  }
  return value
}

export const transformAfterUpdateOrAdd = async (
  instance: Readonly<InstanceElement>,
  updateResult: HubspotMetadata,
): Promise<InstanceElement> => {
  const clonedInstance = instance.clone()
  const mergeCustomizer = (resultVal: Value, instanceVal: Value): Value | undefined => {
    if (_.isArray(resultVal) && _.isArray(instanceVal)) {
      return _.zip(resultVal.slice(0, instanceVal.length), instanceVal).map((zipped: Value[]) => {
        if (!_.isObject(zipped[1])) {
          return zipped[1]
        }
        return _.mergeWith(zipped[0], zipped[1], mergeCustomizer)
      })
    }
    return undefined
  }
  // Add auto-generated fields to the before element
  // If transform/filter moves auto-generated fields from being at the same
  // "location" as it comes from the api then we need transform^-1 here before this merge
  const mergedValues = _.mergeWith(updateResult as Values, clonedInstance.value, mergeCustomizer)
  clonedInstance.value = await transformValues(
    {
      values: mergedValues,
      type: await instance.getType(),
      transformFunc: transformPrimitive,
    }
  ) || {}
  return clonedInstance
}

/*
* Merge the values of a Form Field from the 3 values source available
*   1. The field specific override values (values that can come from property but are overriden)
*   2. The related Contact Property
*   3. The field specific values (values that are only relevant to the field, not the property)
*
* #3 are values not in 1 & 2. #1 overrides values in #2 and rest relevant values come from #2.
* Mathematically - (#3 + (#2-#1) + #1)
*
* A special case is 'helpText' that is stored at #3 but actually overrides 'description' from #2
*/
const mergeFormFieldAndContactProperty = (field: Value): Value => {
  const newField = _.clone(field)
  const fieldHelpText = newField[FORM_PROPERTY_INNER_FIELDS.HELPTEXT] || ''
  const contactPropertyValues = _.clone(field[FORM_PROPERTY_INNER_FIELDS.CONTACT_PROPERTY].value)
  const fieldAndOverridesValues = _.merge(
    newField,
    field[FORM_PROPERTY_INNER_FIELDS.CONTACT_PROPERTY_OVERRIDES]
  )
  const fieldAndContactPropertyValues = _.merge(contactPropertyValues, fieldAndOverridesValues)
  const relevantFormPropertyValues = _.pick(
    fieldAndContactPropertyValues,
    Object.values(FORM_PROPERTY_FIELDS)
  )

  // Override description with helpText
  relevantFormPropertyValues[FORM_PROPERTY_FIELDS.DESCRIPTION] = fieldHelpText

  // Only available at top level so there's no endless recursion
  if (relevantFormPropertyValues.dependentFieldFilters) {
    relevantFormPropertyValues.dependentFieldFilters = relevantFormPropertyValues
      .dependentFieldFilters.map(
        (dependentFieldFilter: Value) => {
          dependentFieldFilter.dependentFormField = mergeFormFieldAndContactProperty(
            dependentFieldFilter.dependentFormField
          )
          return dependentFieldFilter
        }
      )
  }
  return relevantFormPropertyValues
}

const createOwnersMap = async (client: HubspotClient): Promise<Map<string, number>> => {
  const ownersRes = await client.getOwners()
  return new Map(ownersRes.map(
    (ownerRes): [string, number] => [ownerRes.email, ownerRes.activeUserId]
  ))
}

export const isUserIdentifierType = (type: TypeElement): boolean =>
  isPrimitiveType(type) && type.elemID.isEqual(Types.userIdentifierType.elemID)

const doesObjectIncludeUserIdentifier = async (
  objectType: Readonly<ObjectType>,
  checkedTypes: TypeElement[] = []
): Promise<boolean> => {
  const doesTypeIncludeUserIdentifier = async (type: TypeElement): Promise<boolean> => {
    if (isObjectType(type)) {
      return doesObjectIncludeUserIdentifier(type, checkedTypes)
    }
    if (isContainerType(type)) {
      return doesTypeIncludeUserIdentifier(await type.getInnerType())
    }
    return isUserIdentifierType(type)
  }
  return _.some(await Promise.all(_.values(objectType.fields)
    .map(async (field: Field): Promise<boolean> => {
      const fieldType = await field.getType()
      if (!_.isUndefined(_.find(checkedTypes, (type: TypeElement): boolean =>
        type.elemID.isEqual(fieldType.elemID)))) {
        return false
      }
      checkedTypes.push(fieldType)
      return doesTypeIncludeUserIdentifier(fieldType)
    })))
}

export const createHubspotMetadataFromInstanceElement = async (
  instance: Readonly<InstanceElement>,
  client: HubspotClient
):
  Promise<HubspotMetadata> => {
  let ownersMap: Map<string, number>
  if (await doesObjectIncludeUserIdentifier(await instance.getType())) {
    ownersMap = await createOwnersMap(client)
  }
  const createMetadataValueFromObject = async (
    objectType: ObjectType,
    values: Values
  ): Promise<Values> => (
    mapValuesAsync(values, async (val, key) => {
      const fieldType = await objectType.fields[key]?.getType()
      if (_.isUndefined(fieldType) || _.isUndefined(val)) {
        return val
      }
      if (await isFormInstance(instance) && key === FORM_FIELDS.FORMFIELDGROUPS) {
        return val.map((formFieldGroup: Value) => (_.mapValues(formFieldGroup,
          (formFieldGroupVal, formFieldGroupKey) => {
            if (!(formFieldGroupKey === FORM_PROPERTY_GROUP_FIELDS.FIELDS)) {
              return formFieldGroupVal
            }
            return formFieldGroupVal.map(
              (innerField: Value) => mergeFormFieldAndContactProperty(innerField)
            )
          })
        ))
      }
      if (isPrimitiveType(fieldType) && fieldType.isEqual(BuiltinTypes.JSON)) {
        return JSON.parse(val)
      }
      if (isUserIdentifierType(fieldType)) {
        const numVal = !Number.isNaN(Number(val)) ? Number(val) : null
        return ownersMap.get(val) || numVal
      }
      if (isListType(fieldType) && _.isArray(val)) {
        const fieldDeepInnerType = await getDeepInnerType(fieldType)
        if (isUserIdentifierType(fieldDeepInnerType)) {
          const a = _.cloneDeepWith(val, v =>
            (_.every(v, _.isString)
              // Currently all array are represented as a string in HubSpot
              // If there will be "real" array ones we need to support it
              ? val.map(strVal => ownersMap.get(strVal) || strVal).join(',')
              : undefined))
          return a
        }
        if (isObjectType(fieldDeepInnerType) || isMapType(fieldDeepInnerType)) {
          const transformFunc: TransformFunc = async ({ value }) => (
            _.isArray(value) && !_.every(value, _.isArray)
              ? Promise.all(value.map(
                (objVal: Values) => createMetadataValueFromObject(toObjectType(
                  fieldDeepInnerType,
                  objVal
                ),
                objVal)
              ))
              : value)
          return transformValues({
            values: val,
            transformFunc,
            strict: false,
            type: fieldDeepInnerType,
          })
        }
      }
      if (isObjectType(fieldType) || isMapType(fieldType)) {
        return createMetadataValueFromObject(toObjectType(fieldType, val), val)
      }
      return val
    }))
  return createMetadataValueFromObject(
    await instance.getType(),
    instance.value
  ) as Promise<HubspotMetadata>
}

/**
 * Creating all the instance for specific type
 * @param hubspotMetadata the instance metadata from hubspot
 * @param type the objectType
 */
export const createHubspotInstanceElement = (
  hubspotMetadata: HubspotMetadata,
  type: ObjectType
): InstanceElement => {
  const typeName = type.elemID.name
  const instanceName = createInstanceName(hubspotMetadata.name)
  return new InstanceElement(
    new ElemID(HUBSPOT, instanceName).name,
    type,
    hubspotMetadata as Values,
    [HUBSPOT, RECORDS_PATH, typeName, pathNaclCase(instanceName)],
  )
}

export const getLookUpName: GetLookupNameFunc = ({ ref }) =>
  // TODO: find the correct field with Adam
  ref.value
