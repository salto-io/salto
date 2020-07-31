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
/* eslint-disable @typescript-eslint/camelcase */
import _ from 'lodash'
import {
  ElemID, ObjectType, PrimitiveType, PrimitiveTypes, Field, isObjectType, getDeepInnerType,
  BuiltinTypes, InstanceElement, TypeElement, CORE_ANNOTATIONS, isListType, Element,
  TypeMap, Values, isPrimitiveType, Value, ListType, createRestriction, StaticFile,
  isReferenceExpression, isStaticFile,
} from '@salto-io/adapter-api'
import {
  TransformFunc, naclCase, transformValues, GetLookupNameFunc, transformElement,
} from '@salto-io/adapter-utils'
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
        [OPTIONS_FIELDS.LABEL]: { type: BuiltinTypes.STRING },
        [OPTIONS_FIELDS.VALUE]: { type: BuiltinTypes.STRING },
        [OPTIONS_FIELDS.READONLY]: { type: BuiltinTypes.BOOLEAN },
        [OPTIONS_FIELDS.DISPLAYORDER]: { type: BuiltinTypes.NUMBER },
        [OPTIONS_FIELDS.HIDDEN]: { type: BuiltinTypes.BOOLEAN },
        [OPTIONS_FIELDS.DESCRIPTION]: { type: BuiltinTypes.STRING },
      },
      path: [HUBSPOT, TYPES_PATH, SUBTYPES_PATH, optionsElemID.name],
    })

  private static fieldFilterType: ObjectType =
    new ObjectType({
      elemID: fieldFilterElemID,
      fields: {
        [FIELD_FILTER_FIELDS.OPERATOR]: { type: BuiltinTypes.STRING },
        [FIELD_FILTER_FIELDS.STRVALUE]: { type: BuiltinTypes.STRING },
        [FIELD_FILTER_FIELDS.STRVALUES]: { type: new ListType(BuiltinTypes.STRING) },
        [FIELD_FILTER_FIELDS.BOOLVALUE]: { type: BuiltinTypes.BOOLEAN },
        [FIELD_FILTER_FIELDS.NUMBERVALUE]: { type: BuiltinTypes.NUMBER },
        [FIELD_FILTER_FIELDS.NUMVALUES]: { type: new ListType(BuiltinTypes.NUMBER) },
      },
      path: [HUBSPOT, TYPES_PATH, SUBTYPES_PATH, fieldFilterElemID.name],
    })

    private static contactPropertyOverridesType: ObjectType =
      new ObjectType({
        elemID: contactPropertyOverridesElemID,
        fields: {
          [CONTACT_PROPERTY_OVERRIDES_FIELDS.LABEL]: { type: BuiltinTypes.STRING },
          [CONTACT_PROPERTY_OVERRIDES_FIELDS.DISPLAYORDER]: { type: BuiltinTypes.NUMBER },
          [CONTACT_PROPERTY_OVERRIDES_FIELDS.OPTIONS]: { type: new ListType(Types.optionsType) },
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
        [FORM_PROPERTY_INNER_FIELDS.CONTACT_PROPERTY]: { type: BuiltinTypes.STRING },
        [FORM_PROPERTY_INNER_FIELDS.CONTACT_PROPERTY_OVERRIDES]: {
          type: Types.contactPropertyOverridesType,
        },
        [FORM_PROPERTY_FIELDS.DEFAULTVALUE]: { type: BuiltinTypes.STRING },
        [FORM_PROPERTY_FIELDS.PLACEHOLDER]: { type: BuiltinTypes.STRING },
        [FORM_PROPERTY_INNER_FIELDS.HELPTEXT]: { type: BuiltinTypes.STRING },
        [FORM_PROPERTY_FIELDS.REQUIRED]: { type: BuiltinTypes.BOOLEAN },
        [FORM_PROPERTY_FIELDS.SELECTEDOPTIONS]: { type: new ListType(BuiltinTypes.STRING) },
        [FORM_PROPERTY_FIELDS.ISSMARTFIELD]: { type: BuiltinTypes.BOOLEAN },
        ...isFatherProperty
          ? {
            [FORM_PROPERTY_FIELDS.DEPENDENTFIELDFILTERS]:
              { type: new ListType(Types.dependentFormFieldFiltersType) },
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
          type: BuiltinTypes.STRING,
          annotations: {
            [CORE_ANNOTATIONS.REQUIRED]: true,
          },
        },
        [DEPENDENT_FIELD_FILTER_FIELDS.FILTERS]: {
          type: new ListType(Types.fieldFilterType),
          annotations: {
            [CORE_ANNOTATIONS.REQUIRED]: true,
          },
        },
        [DEPENDENT_FIELD_FILTER_FIELDS.DEPEDENTFORMFIELD]: {
          type: Types.dependeeFormFieldType,
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
        [RICHTEXT_FIELDS.CONTENT]: { type: BuiltinTypes.STRING },
      },
      path: [HUBSPOT, TYPES_PATH, SUBTYPES_PATH, richTextElemID.name],
    })

  private static propertyGroupType: ObjectType =
    new ObjectType({
      elemID: propertyGroupElemID,
      fields: {
        [FORM_PROPERTY_GROUP_FIELDS.DEFAULT]: { type: BuiltinTypes.BOOLEAN },
        [FORM_PROPERTY_GROUP_FIELDS.FIELDS]: { type: new ListType(Types.dependentFormFieldType) },
        [FORM_PROPERTY_GROUP_FIELDS.ISSMARTGROUP]: { type: BuiltinTypes.BOOLEAN },
        [FORM_PROPERTY_GROUP_FIELDS.RICHTEXT]: { type: Types.richTextType },
      },
      path: [HUBSPOT, TYPES_PATH, SUBTYPES_PATH, propertyGroupElemID.name],
    })

  private static eventAnchorType: ObjectType =
    new ObjectType({
      elemID: eventAnchorElemID,
      fields: {
        [EVENTANCHOR_FIELDS.CONTACTPROPERTYANCHOR]: { type: BuiltinTypes.STRING },
        [EVENTANCHOR_FIELDS.STATICDATEANCHOR]: { type: BuiltinTypes.STRING },
      },
      path: [HUBSPOT, TYPES_PATH, SUBTYPES_PATH, eventAnchorElemID.name],
    })

  private static anchorSettingType: ObjectType =
    new ObjectType({
      elemID: anchorSettingElemID,
      fields: {
        [ANCHOR_SETTING_FIELDS.EXECTIMEOFDAY]: { type: BuiltinTypes.STRING },
        [ANCHOR_SETTING_FIELDS.EXECTIMEINMINUTES]: { type: BuiltinTypes.NUMBER },
        [ANCHOR_SETTING_FIELDS.BOUNDARY]: { type: BuiltinTypes.STRING },
      },
      path: [HUBSPOT, TYPES_PATH, SUBTYPES_PATH, anchorSettingElemID.name],
    })

  private static criteriaType: ObjectType =
    new ObjectType({
      elemID: criteriaElemID,
      fields: {
        [CRITERIA_FIELDS.FILTERFAMILY]: { type: BuiltinTypes.STRING },
        [CRITERIA_FIELDS.OPERATOR]: { type: BuiltinTypes.STRING },
        [CRITERIA_FIELDS.PROPERTY]: { type: BuiltinTypes.STRING },
        [CRITERIA_FIELDS.PROPERTYOBJECTTYPE]: { type: BuiltinTypes.STRING },
        [CRITERIA_FIELDS.TYPE]: { type: BuiltinTypes.STRING },
        [CRITERIA_FIELDS.VALUE]: { type: BuiltinTypes.STRING },
        [CRITERIA_FIELDS.WITHINTIMEMODE]: { type: BuiltinTypes.STRING },
      },
      path: [HUBSPOT, TYPES_PATH, SUBTYPES_PATH, criteriaElemID.name],
    })

    // Create action type in steps cause of recursive fields
    private static createActionType = (): ObjectType => {
      const actionType = new ObjectType({
        elemID: actionElemID,
        fields: {
          [ACTION_FIELDS.TYPE]: { type: BuiltinTypes.STRING },
          [ACTION_FIELDS.ACTIONID]: {
            type: BuiltinTypes.NUMBER,
            annotations: {
              [CORE_ANNOTATIONS.HIDDEN]: true,
            },
          },
          [ACTION_FIELDS.DELAYMILLS]: { type: BuiltinTypes.NUMBER },
          [ACTION_FIELDS.STEPID]: {
            type: BuiltinTypes.NUMBER,
            annotations: {
              [CORE_ANNOTATIONS.HIDDEN]: true,
            },
          },
          [ACTION_FIELDS.ANCHORSETTING]: { type: Types.anchorSettingType },
          [ACTION_FIELDS.FILTERSLISTID]: {
            type: BuiltinTypes.NUMBER,
            annotations: {
              [CORE_ANNOTATIONS.HIDDEN]: true,
            },
          },
          [ACTION_FIELDS.FILTERS]: { type: new ListType(new ListType(Types.criteriaType)) },
          [ACTION_FIELDS.PROPERTYNAME]: { type: BuiltinTypes.STRING },
          [ACTION_FIELDS.BODY]: { type: BuiltinTypes.STRING },
          [ACTION_FIELDS.NEWVALUE]: { type: BuiltinTypes.STRING },
          [ACTION_FIELDS.STATICTO]: { type: BuiltinTypes.STRING },
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
        [NURTURETIMERANGE_FIELDS.ENABLED]: { type: BuiltinTypes.BOOLEAN },
        [NURTURETIMERANGE_FIELDS.STARTHOUR]: { type: BuiltinTypes.NUMBER },
        [NURTURETIMERANGE_FIELDS.STOPHOUR]: { type: BuiltinTypes.NUMBER },
      },
      path: [HUBSPOT, TYPES_PATH, SUBTYPES_PATH, nurtureTimeRangeElemID.name],
    })

  private static contactListIdsType: ObjectType =
    new ObjectType({
      elemID: contactListIdsElemID,
      fields: {
        [CONTACTLISTIDS_FIELDS.ENROLLED]: { type: BuiltinTypes.NUMBER },
        [CONTACTLISTIDS_FIELDS.ACTIVE]: { type: BuiltinTypes.NUMBER },
        [CONTACTLISTIDS_FIELDS.SUCCEEDED]: { type: BuiltinTypes.NUMBER },
        [CONTACTLISTIDS_FIELDS.COMPLETED]: { type: BuiltinTypes.NUMBER },
      },
      path: [HUBSPOT, TYPES_PATH, SUBTYPES_PATH, contactListIdsElemID.name],
    })

  private static rssToEmailTimingType: ObjectType =
    new ObjectType({
      elemID: rssToEmailTimingElemID,
      fields: {
        [RSSTOEMAILTIMING_FIELDS.REPEATS]: {
          type: BuiltinTypes.STRING,
          annotations: {
            [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
              values: ['instant', 'daily', 'weekly', 'monthly'],
            }),
          },
        },
        [RSSTOEMAILTIMING_FIELDS.REPEATS_ON_MONTHLY]: { type: BuiltinTypes.NUMBER },
        [RSSTOEMAILTIMING_FIELDS.REPEATS_ON_WEEKLY]: { type: BuiltinTypes.NUMBER },
        [RSSTOEMAILTIMING_FIELDS.TIME]: { type: BuiltinTypes.STRING },
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
          type: BuiltinTypes.STRING,
          annotations: {
            [CORE_ANNOTATIONS.HIDDEN]: true,
          },
        },
        [FORM_FIELDS.NAME]: {
          type: BuiltinTypes.STRING,
          annotations: {
            [CORE_ANNOTATIONS.REQUIRED]: true,
          },
        },
        [FORM_FIELDS.CSSCLASS]: { type: BuiltinTypes.STRING },
        [FORM_FIELDS.REDIRECT]: { type: BuiltinTypes.STRING },
        [FORM_FIELDS.SUBMITTEXT]: { type: BuiltinTypes.STRING },
        [FORM_FIELDS.NOTIFYRECIPIENTS]: {
          type: new ListType(Types.fieldTypes[FIELD_TYPES.USERIDENTIFIER]),
        },
        [FORM_FIELDS.IGNORECURRENTVALUES]: { type: BuiltinTypes.BOOLEAN },
        [FORM_FIELDS.DELETABLE]: { type: BuiltinTypes.BOOLEAN },
        [FORM_FIELDS.INLINEMESSAGE]: { type: BuiltinTypes.STRING },
        [FORM_FIELDS.FORMFIELDGROUPS]: { type: new ListType(Types.propertyGroupType) },
        [FORM_FIELDS.CAPTCHAENABLED]: { type: BuiltinTypes.BOOLEAN },
        [FORM_FIELDS.CREATEDAT]: {
          type: BuiltinTypes.NUMBER,
          annotations: {
            [CORE_ANNOTATIONS.HIDDEN]: true,
          },
        },
        [FORM_FIELDS.CLONEABLE]: { type: BuiltinTypes.BOOLEAN },
        [FORM_FIELDS.STYLE]: { type: BuiltinTypes.STRING },
        [FORM_FIELDS.EDITABLE]: { type: BuiltinTypes.BOOLEAN },
        [FORM_FIELDS.THEMENAME]: { type: BuiltinTypes.STRING },
      },
      path: [HUBSPOT, TYPES_PATH, formElemID.name],
    }),
    [OBJECTS_NAMES.WORKFLOW]: new ObjectType({
      elemID: workflowsElemID,
      fields: {
        [WORKFLOWS_FIELDS.ID]: {
          type: BuiltinTypes.NUMBER,
          annotations: {
            [CORE_ANNOTATIONS.HIDDEN]: true,
          },
        },
        [WORKFLOWS_FIELDS.NAME]: {
          type: BuiltinTypes.STRING,
          annotations: {
            [CORE_ANNOTATIONS.REQUIRED]: true,
          },
        },
        [WORKFLOWS_FIELDS.SEGMENTCRITERIA]: {
          type: new ListType(new ListType(Types.criteriaType)),
        },
        [WORKFLOWS_FIELDS.GOALCRITERIA]: {
          type: new ListType(new ListType(Types.criteriaType)),
        },
        [WORKFLOWS_FIELDS.TYPE]: {
          type: BuiltinTypes.STRING,
          annotations: {
            [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
              enforce_value: false,
              values: ['PROPERTY_ANCHOR', 'STATIC_ANCHOR', 'DRIP_DELAY'],
            }),
          },
        },
        [WORKFLOWS_FIELDS.ENABLED]: { type: BuiltinTypes.BOOLEAN },
        [WORKFLOWS_FIELDS.INSERTEDAT]: {
          type: BuiltinTypes.NUMBER,
          annotations: {
            [CORE_ANNOTATIONS.HIDDEN]: true,
          },
        },
        [WORKFLOWS_FIELDS.UPDATEDAT]: {
          type: BuiltinTypes.NUMBER,
          annotations: {
            [CORE_ANNOTATIONS.HIDDEN]: true,
          },
        },
        [WORKFLOWS_FIELDS.CONTACTLISTIDS]: { type: Types.contactListIdsType },
        [WORKFLOWS_FIELDS.INTERNAL]: { type: BuiltinTypes.BOOLEAN },
        [WORKFLOWS_FIELDS.ONLYEXECONBIZDAYS]: { type: BuiltinTypes.BOOLEAN },
        [WORKFLOWS_FIELDS.NURTURETIMERANGE]: { type: Types.nurtureTimeRangeType },
        [WORKFLOWS_FIELDS.ACTIONS]: { type: new ListType(Types.actionType) },
        [WORKFLOWS_FIELDS.LISTENING]: { type: BuiltinTypes.BOOLEAN },
        [WORKFLOWS_FIELDS.EVENTANCHOR]: { type: Types.eventAnchorType },
        [WORKFLOWS_FIELDS.ALLOWCONTACTTOTRIGGERMULTIPLETIMES]: { type: BuiltinTypes.BOOLEAN },
        [WORKFLOWS_FIELDS.ONLYENROLLMANUALLY]: { type: BuiltinTypes.BOOLEAN },
        [WORKFLOWS_FIELDS.ENROLLONCRITERIAUPDATE]: { type: BuiltinTypes.BOOLEAN },
        [WORKFLOWS_FIELDS.SUPRESSIONLISTIDS]: { type: new ListType(BuiltinTypes.NUMBER) },
      },
      path: [HUBSPOT, TYPES_PATH, workflowsElemID.name],
    }),
    [OBJECTS_NAMES.MARKETINGEMAIL]: new ObjectType({
      elemID: marketingEmailElemID,
      fields: {
        [MARKETING_EMAIL_FIELDS.AB]: { type: BuiltinTypes.BOOLEAN },
        [MARKETING_EMAIL_FIELDS.ABHOURSWAIT]: { type: BuiltinTypes.NUMBER },
        [MARKETING_EMAIL_FIELDS.ABVARIATION]: { type: BuiltinTypes.BOOLEAN },
        [MARKETING_EMAIL_FIELDS.ABSAMPLESIZEDEFAULT]: {
          type: BuiltinTypes.STRING,
          annotations: {
            [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ values: ['master', 'variant'] }),
          },
        },
        [MARKETING_EMAIL_FIELDS.ABSAMPLINGDEFAULT]: {
          type: BuiltinTypes.STRING,
          annotations: {
            [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ values: ['master', 'variant'] }),
          },
        },
        [MARKETING_EMAIL_FIELDS.ABSTATUS]: {
          type: BuiltinTypes.STRING,
          annotations: {
            [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ values: ['master', 'variant'] }),
          },
        },
        [MARKETING_EMAIL_FIELDS.ABSUCCESSMETRIC]: {
          type: BuiltinTypes.STRING,
          annotations: {
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
              values: ['CLICKS_BY_OPENS', 'CLICKS_BY_DELIVERED', 'OPENS_BY_DELIVERED'],
            }),
          },
        },
        [MARKETING_EMAIL_FIELDS.ABTESTID]: { type: BuiltinTypes.NUMBER },
        [MARKETING_EMAIL_FIELDS.ABTESTPERCENTAGE]: { type: BuiltinTypes.NUMBER },
        [MARKETING_EMAIL_FIELDS.ABSOLUTEURL]: { type: BuiltinTypes.STRING },
        [MARKETING_EMAIL_FIELDS.ALLEMAILCAMPAIGNIDS]: { type: new ListType(BuiltinTypes.NUMBER) },
        [MARKETING_EMAIL_FIELDS.ANALYTICSPAGEID]: { type: BuiltinTypes.STRING },
        [MARKETING_EMAIL_FIELDS.ARCHIVED]: { type: BuiltinTypes.BOOLEAN },
        [MARKETING_EMAIL_FIELDS.AUTHOR]: {
          type: BuiltinTypes.STRING,
          annotations: {
            [CORE_ANNOTATIONS.HIDDEN]: true,
          },
        },
        [MARKETING_EMAIL_FIELDS.AUTHORAT]: {
          type: BuiltinTypes.NUMBER,
          annotations: {
            [CORE_ANNOTATIONS.HIDDEN]: true,
          },
        },
        [MARKETING_EMAIL_FIELDS.AUTHOREMAIL]: {
          type: BuiltinTypes.STRING,
          annotations: {
            [CORE_ANNOTATIONS.HIDDEN]: true,
          },
        },
        [MARKETING_EMAIL_FIELDS.AUTHORNAME]: {
          type: BuiltinTypes.STRING,
          annotations: {
            [CORE_ANNOTATIONS.HIDDEN]: true,
          },
        },
        [MARKETING_EMAIL_FIELDS.AUTHORUSERID]: {
          type: BuiltinTypes.NUMBER,
          annotations: {
            [CORE_ANNOTATIONS.HIDDEN]: true,
          },
        },
        [MARKETING_EMAIL_FIELDS.BLOGEMAILTYPE]: {
          type: BuiltinTypes.STRING,
          annotations: {
            [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
              values: ['instant', 'daily', 'weekly', 'monthly'],
            }),
          },
        },
        [MARKETING_EMAIL_FIELDS.BLOGRSSSETTINGS]: { type: BuiltinTypes.NUMBER },
        [MARKETING_EMAIL_FIELDS.CAMPAIGN]: { type: BuiltinTypes.STRING },
        [MARKETING_EMAIL_FIELDS.CAMPAIGNNAME]: { type: BuiltinTypes.STRING },
        [MARKETING_EMAIL_FIELDS.CANSPAMSETTINGSID]: { type: BuiltinTypes.NUMBER },
        [MARKETING_EMAIL_FIELDS.CLONEDFROM]: { type: BuiltinTypes.NUMBER },
        [MARKETING_EMAIL_FIELDS.CREATEPAGE]: { type: BuiltinTypes.BOOLEAN },
        [MARKETING_EMAIL_FIELDS.CREATED]: {
          type: BuiltinTypes.NUMBER,
          annotations: {
            [CORE_ANNOTATIONS.HIDDEN]: true,
          },
        },
        [MARKETING_EMAIL_FIELDS.CURRENTLYPUBLISHED]: {
          type: BuiltinTypes.BOOLEAN,
          annotations: {
            [CORE_ANNOTATIONS.REQUIRED]: true,
          },
        },
        [MARKETING_EMAIL_FIELDS.DOMAIN]: { type: BuiltinTypes.STRING },
        [MARKETING_EMAIL_FIELDS.EMAILBODY]: {
          type: BuiltinTypes.STRING,
          annotations: {
            [CORE_ANNOTATIONS.REQUIRED]: true,
          },
        },
        [MARKETING_EMAIL_FIELDS.EMAILNOTE]: { type: BuiltinTypes.STRING },
        [MARKETING_EMAIL_FIELDS.EMAILTYPE]: {
          type: BuiltinTypes.STRING,
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
          type: BuiltinTypes.STRING,
          annotations: {
            [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
              enforce_value: false,
              values: ['NPS', 'CES', 'CUSTOM'],
            }),
          },
        },
        [MARKETING_EMAIL_FIELDS.FEEDBACKSURVEYID]: { type: BuiltinTypes.NUMBER },
        [MARKETING_EMAIL_FIELDS.FLEXAREAS]: { type: BuiltinTypes.JSON },
        [MARKETING_EMAIL_FIELDS.FOLDERID]: { type: BuiltinTypes.NUMBER },
        [MARKETING_EMAIL_FIELDS.FREEZEDATE]: {
          type: BuiltinTypes.NUMBER,
          annotations: {
            [CORE_ANNOTATIONS.HIDDEN]: true,
          },
        },
        [MARKETING_EMAIL_FIELDS.FROMNAME]: { type: BuiltinTypes.STRING },
        [MARKETING_EMAIL_FIELDS.HTMLTITLE]: { type: BuiltinTypes.STRING },
        [MARKETING_EMAIL_FIELDS.ID]: {
          type: BuiltinTypes.NUMBER,
          annotations: {
            [CORE_ANNOTATIONS.HIDDEN]: true,
          },
        },
        [MARKETING_EMAIL_FIELDS.ISGRAYMAILSUPPRESSIONENABLED]: { type: BuiltinTypes.BOOLEAN },
        [MARKETING_EMAIL_FIELDS.ISLOCALTIMEZONESEND]: { type: BuiltinTypes.BOOLEAN },
        [MARKETING_EMAIL_FIELDS.ISPUBLISHED]: { type: BuiltinTypes.BOOLEAN },
        [MARKETING_EMAIL_FIELDS.ISRECIPIENTFATIGUESUPPRESSIONENABLED]: {
          type: BuiltinTypes.BOOLEAN,
        },
        [MARKETING_EMAIL_FIELDS.LEADFLOWID]: { type: BuiltinTypes.NUMBER },
        [MARKETING_EMAIL_FIELDS.LIVEDOMAIN]: {
          type: BuiltinTypes.STRING,
          annotations: {
            [CORE_ANNOTATIONS.HIDDEN]: true,
          },
        },
        [MARKETING_EMAIL_FIELDS.MAILINGLISTSEXCLUDED]: {
          type: new ListType(BuiltinTypes.NUMBER),
        },
        [MARKETING_EMAIL_FIELDS.MAILINGLISTSINCLUDED]: {
          type: new ListType(BuiltinTypes.NUMBER),
        },
        [MARKETING_EMAIL_FIELDS.MAXRSSENTRIES]: { type: BuiltinTypes.NUMBER },
        [MARKETING_EMAIL_FIELDS.METADESCRIPTION]: { type: BuiltinTypes.STRING },
        [MARKETING_EMAIL_FIELDS.NAME]: { type: BuiltinTypes.STRING },
        [MARKETING_EMAIL_FIELDS.PAGEEXPIRYDATE]: {
          type: BuiltinTypes.NUMBER,
          annotations: {
            [CORE_ANNOTATIONS.HIDDEN]: true,
          },
        },
        [MARKETING_EMAIL_FIELDS.PAGEEXPIRYREDIRECTEID]: {
          type: BuiltinTypes.STRING,
          annotations: {
            [CORE_ANNOTATIONS.HIDDEN]: true,
          },
        },
        [MARKETING_EMAIL_FIELDS.PAGEREDIRECTED]: { type: BuiltinTypes.BOOLEAN },
        [MARKETING_EMAIL_FIELDS.PREVIEWKEY]: { type: BuiltinTypes.STRING },
        [MARKETING_EMAIL_FIELDS.PROCESSINGSTATUS]: {
          type: BuiltinTypes.STRING,
          annotations: {
            [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
              enforce_value: false,
              values: ['UNDEFINED', 'PUBLISHED', 'PUBLISHED_OR_SCHEDULED', 'SCHEDULED', 'PROCESSING',
                'PRE_PROCESSING', 'ERROR', 'CANCELED_FORCIBLY', 'CANCELED_ABUSE'],
            }),
          },
        },
        [MARKETING_EMAIL_FIELDS.PUBLISHDATE]: {
          type: BuiltinTypes.NUMBER,
          annotations: {
            [CORE_ANNOTATIONS.HIDDEN]: true,
          },
        },
        [MARKETING_EMAIL_FIELDS.PUBLISHEDAT]: {
          type: BuiltinTypes.NUMBER,
          annotations: {
            [CORE_ANNOTATIONS.HIDDEN]: true,
          },
        },
        [MARKETING_EMAIL_FIELDS.PUBLISHEDBYID]: {
          type: BuiltinTypes.NUMBER,
          annotations: {
            [CORE_ANNOTATIONS.HIDDEN]: true,
          },
        },
        [MARKETING_EMAIL_FIELDS.PUBLISHEDBYNAME]: {
          type: BuiltinTypes.STRING,
          annotations: {
            [CORE_ANNOTATIONS.HIDDEN]: true,
          },
        },
        [MARKETING_EMAIL_FIELDS.PUBLISHIMMEDIATELY]: { type: BuiltinTypes.BOOLEAN },
        [MARKETING_EMAIL_FIELDS.PUBLISHEDURL]: { type: BuiltinTypes.STRING },
        [MARKETING_EMAIL_FIELDS.REPLYTO]: { type: BuiltinTypes.STRING },
        [MARKETING_EMAIL_FIELDS.RESOLVEDDOMAIN]: { type: BuiltinTypes.STRING },
        [MARKETING_EMAIL_FIELDS.RSSEMAILAUTHORLINETEMPLATE]: { type: BuiltinTypes.STRING },
        [MARKETING_EMAIL_FIELDS.RSSEMAILBLOGIMAGEMAXWIDTH]: { type: BuiltinTypes.NUMBER },
        [MARKETING_EMAIL_FIELDS.RSSEMAILBYTEXT]: { type: BuiltinTypes.STRING },
        [MARKETING_EMAIL_FIELDS.RSSEMAILCLICKTHROUGHTEXT]: { type: BuiltinTypes.STRING },
        [MARKETING_EMAIL_FIELDS.RSSEMAILCOMMENTTEXT]: { type: BuiltinTypes.STRING },
        [MARKETING_EMAIL_FIELDS.RSSEMAILENTRYTEMPLATE]: { type: BuiltinTypes.BOOLEAN },
        [MARKETING_EMAIL_FIELDS.RSSEMAILENTRYTEMPLATEENABLED]: { type: BuiltinTypes.BOOLEAN },
        [MARKETING_EMAIL_FIELDS.RSSEMAILURL]: { type: BuiltinTypes.STRING },
        [MARKETING_EMAIL_FIELDS.RSSTOEMAILTIMING]: { type: Types.rssToEmailTimingType },
        [MARKETING_EMAIL_FIELDS.SLUG]: { type: BuiltinTypes.STRING },
        // TODO: Understand this and convert to a list of smart fields
        [MARKETING_EMAIL_FIELDS.SMARTEMAILFIELDS]: { type: BuiltinTypes.JSON },
        [MARKETING_EMAIL_FIELDS.STYLESETTINGS]: { type: BuiltinTypes.JSON },
        [MARKETING_EMAIL_FIELDS.SUBCATEGORY]: {
          type: BuiltinTypes.STRING,
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
        [MARKETING_EMAIL_FIELDS.SUBJECT]: { type: BuiltinTypes.STRING },
        [MARKETING_EMAIL_FIELDS.SUBSCRIPTION]: { type: BuiltinTypes.NUMBER },
        [MARKETING_EMAIL_FIELDS.SUBSCRIPTIONBLOGID]: { type: BuiltinTypes.NUMBER },
        [MARKETING_EMAIL_FIELDS.SUBSCRIPTIONNAME]: { type: BuiltinTypes.STRING },
        [MARKETING_EMAIL_FIELDS.TEMPLATEPATH]: { type: BuiltinTypes.STRING },
        [MARKETING_EMAIL_FIELDS.TRANSACTIONAL]: { type: BuiltinTypes.BOOLEAN },
        [MARKETING_EMAIL_FIELDS.UNPUBLISHEDAT]: {
          type: BuiltinTypes.NUMBER,
          annotations: {
            [CORE_ANNOTATIONS.HIDDEN]: true,
          },
        },
        [MARKETING_EMAIL_FIELDS.UPDATED]: {
          type: BuiltinTypes.NUMBER,
          annotations: {
            [CORE_ANNOTATIONS.HIDDEN]: true,
          },
        },
        [MARKETING_EMAIL_FIELDS.UPDATEDBYID]: {
          type: Types.fieldTypes[FIELD_TYPES.USERIDENTIFIER],
          annotations: {
            [CORE_ANNOTATIONS.HIDDEN]: true,
          },
        },
        [MARKETING_EMAIL_FIELDS.URL]: { type: BuiltinTypes.STRING },
        [MARKETING_EMAIL_FIELDS.USERSSHEADLINEASSUBJECT]: { type: BuiltinTypes.BOOLEAN },
        // TODO: Consider converting to emails list
        [MARKETING_EMAIL_FIELDS.VIDSEXCLUDED]: { type: new ListType(BuiltinTypes.NUMBER) },
        // TODO: Consider converting to emails list
        [MARKETING_EMAIL_FIELDS.VIDSINCLUDED]: { type: new ListType(BuiltinTypes.NUMBER) },
        [MARKETING_EMAIL_FIELDS.WIDGETS]: { type: BuiltinTypes.JSON },
        // TODO: Convert to reference
        [MARKETING_EMAIL_FIELDS.WORKFLOWNAMES]: { type: new ListType(BuiltinTypes.STRING) },
      },
      path: [HUBSPOT, TYPES_PATH, marketingEmailElemID.name],
    }),
    [OBJECTS_NAMES.CONTACT_PROPERTY]: new ObjectType({
      elemID: contactPropertyElemID,
      fields: {
        [CONTACT_PROPERTY_FIELDS.NAME]: {
          type: BuiltinTypes.STRING,
          annotations: {
            [CORE_ANNOTATIONS.REQUIRED]: true,
          },
        },
        [CONTACT_PROPERTY_FIELDS.LABEL]: { type: BuiltinTypes.STRING },
        [CONTACT_PROPERTY_FIELDS.DESCRIPTION]: { type: BuiltinTypes.STRING },
        [CONTACT_PROPERTY_FIELDS.GROUPNAME]: {
          type: BuiltinTypes.STRING,
          annotations: {
            [CORE_ANNOTATIONS.REQUIRED]: true,
          },
        },
        [CONTACT_PROPERTY_FIELDS.TYPE]: {
          type: BuiltinTypes.STRING,
          annotations: {
            [CORE_ANNOTATIONS.REQUIRED]: true,
            [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
              values: contactPropertyTypeValues,
            }),
          },
        },
        [CONTACT_PROPERTY_FIELDS.FIELDTYPE]: {
          type: BuiltinTypes.STRING,
          annotations: {
            [CORE_ANNOTATIONS.REQUIRED]: true,
            [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
              values: contactPropertyFieldTypeValues,
            }),
          },
        },
        [CONTACT_PROPERTY_FIELDS.OPTIONS]: { type: new ListType(Types.optionsType) },
        [CONTACT_PROPERTY_FIELDS.DELETED]: { type: BuiltinTypes.BOOLEAN },
        [CONTACT_PROPERTY_FIELDS.FORMFIELD]: {
          type: BuiltinTypes.BOOLEAN,
          annotations: {
            [CORE_ANNOTATIONS.REQUIRED]: true,
          },
        },
        [CONTACT_PROPERTY_FIELDS.DISPLAYORDER]: {
          type: BuiltinTypes.NUMBER,
          annotations: {
            [CORE_ANNOTATIONS.DEFAULT]: -1,
          },
        },
        [CONTACT_PROPERTY_FIELDS.READONLYVALUE]: {
          type: BuiltinTypes.BOOLEAN,
          annotations: {
            [CORE_ANNOTATIONS.DEFAULT]: false,
          },
        },
        [CONTACT_PROPERTY_FIELDS.READONLYDEFINITION]: {
          type: BuiltinTypes.BOOLEAN,
          annotations: {
            [CORE_ANNOTATIONS.DEFAULT]: false,
          },
        },
        [CONTACT_PROPERTY_FIELDS.HIDDEN]: {
          type: BuiltinTypes.BOOLEAN,
          annotations: {
            [CORE_ANNOTATIONS.DEFAULT]: false,
          },
        },
        [CONTACT_PROPERTY_FIELDS.MUTABLEDEFINITIONNOTDELETABLE]: {
          type: BuiltinTypes.BOOLEAN,
          annotations: {
            [CORE_ANNOTATIONS.DEFAULT]: false,
          },
        },
        [CONTACT_PROPERTY_FIELDS.CALCULATED]: { type: BuiltinTypes.BOOLEAN },
        [CONTACT_PROPERTY_FIELDS.CREATEDAT]: {
          type: BuiltinTypes.NUMBER,
          annotations: {
            [CORE_ANNOTATIONS.HIDDEN]: true,
          },
        },
        [CONTACT_PROPERTY_FIELDS.EXTERNALOPTIONS]: {
          type: BuiltinTypes.BOOLEAN,
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

export const transformPrimitive: TransformFunc = ({ value, field, path }) => {
  const fieldType = field?.type
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
      content: Buffer.from(JSON.stringify(value, null, 2), 'utf8'),
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
  clonedInstance.value = transformValues(
    {
      values: mergedValues,
      type: instance.type,
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

const doesObjectIncludeUserIdentifier = (
  objectType: Readonly<ObjectType>,
  checkedTypes: TypeElement[] = []
): boolean => {
  const doesTypeIncludeUserIdentifier = (type: TypeElement): boolean => {
    if (isObjectType(type)) {
      return doesObjectIncludeUserIdentifier(type, checkedTypes)
    }
    if (isListType(type)) {
      return doesTypeIncludeUserIdentifier(type.innerType)
    }
    return isUserIdentifierType(type)
  }
  return _.some(_.values(objectType.fields), (field: Field): boolean => {
    const fieldType = field.type
    if (!_.isUndefined(_.find(checkedTypes, (type: TypeElement): boolean =>
      type.elemID.isEqual(fieldType.elemID)))) {
      return false
    }
    checkedTypes.push(fieldType)
    return doesTypeIncludeUserIdentifier(fieldType)
  })
}

export const createHubspotMetadataFromInstanceElement = async (
  instance: Readonly<InstanceElement>,
  client: HubspotClient
):
  Promise<HubspotMetadata> => {
  let ownersMap: Map<string, number>
  if (doesObjectIncludeUserIdentifier(instance.type)) {
    ownersMap = await createOwnersMap(client)
  }
  const createMetadataValueFromObject = (objectType: ObjectType, values: Values): Values =>
    (_.mapValues(values, (val, key) => {
      const fieldType = objectType.fields[key]?.type
      if (_.isUndefined(fieldType) || _.isUndefined(val)) {
        return val
      }
      if (isFormInstance(instance) && key === FORM_FIELDS.FORMFIELDGROUPS) {
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
        const fieldDeepInnerType = getDeepInnerType(fieldType)
        if (isUserIdentifierType(fieldDeepInnerType)) {
          return _.cloneDeepWith(val, v =>
            (_.every(v, _.isString)
              // Currently all array are represented as a string in HubSpot
              // If there will be "real" array ones we need to support it
              ? val.map(strVal => ownersMap.get(strVal) || strVal).join(',')
              : undefined))
        }
        if (isObjectType(fieldDeepInnerType)) {
          return _.cloneDeepWith(val, v =>
            (!_.every(v, _.isArray)
              ? v.map((objVal: Values) =>
                createMetadataValueFromObject(fieldDeepInnerType, objVal))
              : undefined))
        }
      }
      if (isObjectType(fieldType)) {
        return createMetadataValueFromObject(fieldType, val)
      }
      return val
    }))
  return createMetadataValueFromObject(instance.type, instance.value) as HubspotMetadata
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
    [HUBSPOT, RECORDS_PATH, typeName, instanceName],
  )
}

export const getLookUpName: GetLookupNameFunc = ({ ref }) =>
  // TODO: find the correct field with Adam
  ref.value

// Temporary implementation for resolveValues in hubspot since static files in this adapter
// are always assumed to be text files.
// TODO: the encoding should be specified on the static file itself instead of assumed here
// so resolving static files would be generic and this adapter specific function can be removed
export const resolveValues = <T extends Element>(
  element: T, getLookUpNameFunc: GetLookupNameFunc
): T => {
  const transformFunc: TransformFunc = ({ value }) => {
    if (isReferenceExpression(value)) {
      return getLookUpNameFunc({ ref: value })
    }
    if (isStaticFile(value)) {
      return value.content?.toString('utf8') ?? ''
    }
    return value
  }
  return transformElement({ element, transformFunc, strict: false })
}
