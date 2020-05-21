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
  BuiltinTypes, InstanceElement, TypeElement, CORE_ANNOTATIONS, isListType,
  TypeMap, Values, isPrimitiveType, Value, ListType, createRestriction, StaticFile,
} from '@salto-io/adapter-api'
import {
  TransformFunc, naclCase, transformValues,
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
        [OPTIONS_FIELDS.LABEL]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: OPTIONS_FIELDS.LABEL,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [OPTIONS_FIELDS.VALUE]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: OPTIONS_FIELDS.VALUE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [OPTIONS_FIELDS.READONLY]: {
          type: BuiltinTypes.BOOLEAN,
          annotations: {
            name: OPTIONS_FIELDS.READONLY,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [OPTIONS_FIELDS.DISPLAYORDER]: {
          type: BuiltinTypes.NUMBER,
          annotations: {
            name: OPTIONS_FIELDS.DISPLAYORDER,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [OPTIONS_FIELDS.HIDDEN]: {
          type: BuiltinTypes.BOOLEAN,
          annotations: {
            name: OPTIONS_FIELDS.HIDDEN,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [OPTIONS_FIELDS.DESCRIPTION]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: OPTIONS_FIELDS.DESCRIPTION,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
      },
      path: [HUBSPOT, TYPES_PATH, SUBTYPES_PATH, optionsElemID.name],
    })

  private static fieldFilterType: ObjectType =
    new ObjectType({
      elemID: fieldFilterElemID,
      fields: {
        [FIELD_FILTER_FIELDS.OPERATOR]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: FIELD_FILTER_FIELDS.OPERATOR,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: true,
            // TODO: Find the values
          },
        },
        [FIELD_FILTER_FIELDS.STRVALUE]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: FIELD_FILTER_FIELDS.STRVALUE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [FIELD_FILTER_FIELDS.STRVALUES]: {
          type: new ListType(BuiltinTypes.STRING),
          annotations: {
            name: FIELD_FILTER_FIELDS.STRVALUES,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [FIELD_FILTER_FIELDS.BOOLVALUE]: {
          type: BuiltinTypes.BOOLEAN,
          annotations: {
            name: FIELD_FILTER_FIELDS.BOOLVALUE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [FIELD_FILTER_FIELDS.NUMBERVALUE]: {
          type: BuiltinTypes.NUMBER,
          annotations: {
            name: FIELD_FILTER_FIELDS.NUMBERVALUE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [FIELD_FILTER_FIELDS.NUMVALUES]: {
          type: new ListType(BuiltinTypes.NUMBER),
          annotations: {
            name: FIELD_FILTER_FIELDS.NUMVALUES,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
      },
      path: [HUBSPOT, TYPES_PATH, SUBTYPES_PATH, fieldFilterElemID.name],
    })

    private static contactPropertyOverridesType: ObjectType =
      new ObjectType({
        elemID: contactPropertyOverridesElemID,
        fields: {
          [CONTACT_PROPERTY_OVERRIDES_FIELDS.LABEL]: {
            type: BuiltinTypes.STRING,
            annotations: {
              name: CONTACT_PROPERTY_OVERRIDES_FIELDS.LABEL,
              _readOnly: false,
              [CORE_ANNOTATIONS.REQUIRED]: false,
            },
          },
          [CONTACT_PROPERTY_OVERRIDES_FIELDS.DISPLAYORDER]: {
            type: BuiltinTypes.NUMBER,
            annotations: {
              name: CONTACT_PROPERTY_OVERRIDES_FIELDS.DISPLAYORDER,
              _readOnly: false,
              [CORE_ANNOTATIONS.REQUIRED]: false,
            },
          },
          [CONTACT_PROPERTY_OVERRIDES_FIELDS.OPTIONS]: {
            type: new ListType(Types.optionsType),
            annotations: {
              name: CONTACT_PROPERTY_OVERRIDES_FIELDS.OPTIONS,
              _readOnly: false,
              [CORE_ANNOTATIONS.REQUIRED]: false,
            },
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
        [FORM_PROPERTY_INNER_FIELDS.CONTACT_PROPERTY]: {
          // TODO: This is not really a string
          type: BuiltinTypes.STRING,
          annotations: {
            name: FORM_PROPERTY_INNER_FIELDS.CONTACT_PROPERTY,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: true,
          },
        },
        [FORM_PROPERTY_INNER_FIELDS.CONTACT_PROPERTY_OVERRIDES]: {
          type: Types.contactPropertyOverridesType,
          annotations: {
            name: FORM_PROPERTY_INNER_FIELDS.CONTACT_PROPERTY_OVERRIDES,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [FORM_PROPERTY_FIELDS.DEFAULTVALUE]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: FORM_PROPERTY_FIELDS.DEFAULTVALUE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [FORM_PROPERTY_FIELDS.PLACEHOLDER]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: FORM_PROPERTY_FIELDS.PLACEHOLDER,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [FORM_PROPERTY_INNER_FIELDS.HELPTEXT]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: FORM_PROPERTY_INNER_FIELDS.HELPTEXT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [FORM_PROPERTY_FIELDS.REQUIRED]: {
          type: BuiltinTypes.BOOLEAN,
          annotations: {
            name: FORM_PROPERTY_FIELDS.REQUIRED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [FORM_PROPERTY_FIELDS.SELECTEDOPTIONS]: {
          type: new ListType(BuiltinTypes.STRING),
          annotations: {
            name: FORM_PROPERTY_FIELDS.SELECTEDOPTIONS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [FORM_PROPERTY_FIELDS.ISSMARTFIELD]: {
          type: BuiltinTypes.BOOLEAN,
          annotations: {
            name: FORM_PROPERTY_FIELDS.ISSMARTFIELD,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        ...isFatherProperty
          ? {
            [FORM_PROPERTY_FIELDS.DEPENDENTFIELDFILTERS]: {
              type: new ListType(Types.dependentFormFieldFiltersType),
              annotations: {
                name: FORM_PROPERTY_FIELDS.DEPENDENTFIELDFILTERS,
                _readOnly: false,
                [CORE_ANNOTATIONS.REQUIRED]: false,
              },
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
          type: BuiltinTypes.STRING,
          annotations: {
            name: DEPENDENT_FIELD_FILTER_FIELDS.FORMFIELDACTION,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: true,
            // TODO: See if this can be anything else other than DISPLAY
          },
        },
        [DEPENDENT_FIELD_FILTER_FIELDS.FILTERS]: {
          type: new ListType(Types.fieldFilterType),
          annotations: {
            name: DEPENDENT_FIELD_FILTER_FIELDS.FILTERS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: true,
          },
        },
        [DEPENDENT_FIELD_FILTER_FIELDS.DEPEDENTFORMFIELD]: {
          type: Types.dependeeFormFieldType,
          annotations: {
            name: DEPENDENT_FIELD_FILTER_FIELDS.DEPEDENTFORMFIELD,
            _readOnly: false,
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
        [RICHTEXT_FIELDS.CONTENT]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: RICHTEXT_FIELDS.CONTENT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
      },
      path: [HUBSPOT, TYPES_PATH, SUBTYPES_PATH, richTextElemID.name],
    })

  private static propertyGroupType: ObjectType =
    new ObjectType({
      elemID: propertyGroupElemID,
      fields: {
        [FORM_PROPERTY_GROUP_FIELDS.DEFAULT]: {
          type: BuiltinTypes.BOOLEAN,
          annotations: {
            name: FORM_PROPERTY_GROUP_FIELDS.DEFAULT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [FORM_PROPERTY_GROUP_FIELDS.FIELDS]: {
          type: new ListType(Types.dependentFormFieldType),
          annotations: {
            name: FORM_PROPERTY_GROUP_FIELDS.FIELDS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [FORM_PROPERTY_GROUP_FIELDS.ISSMARTGROUP]: {
          type: BuiltinTypes.BOOLEAN,
          annotations: {
            name: FORM_PROPERTY_GROUP_FIELDS.ISSMARTGROUP,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [FORM_PROPERTY_GROUP_FIELDS.RICHTEXT]: {
          type: Types.richTextType,
          annotations: {
            name: FORM_PROPERTY_GROUP_FIELDS.RICHTEXT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
      },
      path: [HUBSPOT, TYPES_PATH, SUBTYPES_PATH, propertyGroupElemID.name],
    })

  private static eventAnchorType: ObjectType =
    new ObjectType({
      elemID: eventAnchorElemID,
      fields: {
        [EVENTANCHOR_FIELDS.CONTACTPROPERTYANCHOR]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: EVENTANCHOR_FIELDS.CONTACTPROPERTYANCHOR,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [EVENTANCHOR_FIELDS.STATICDATEANCHOR]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: EVENTANCHOR_FIELDS.STATICDATEANCHOR,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
      },
      path: [HUBSPOT, TYPES_PATH, SUBTYPES_PATH, eventAnchorElemID.name],
    })

  private static anchorSettingType: ObjectType =
    new ObjectType({
      elemID: anchorSettingElemID,
      fields: {
        [ANCHOR_SETTING_FIELDS.EXECTIMEOFDAY]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: ANCHOR_SETTING_FIELDS.EXECTIMEOFDAY,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [ANCHOR_SETTING_FIELDS.EXECTIMEINMINUTES]: {
          type: BuiltinTypes.NUMBER,
          annotations: {
            name: ANCHOR_SETTING_FIELDS.EXECTIMEINMINUTES,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [ANCHOR_SETTING_FIELDS.BOUNDARY]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: ANCHOR_SETTING_FIELDS.BOUNDARY,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
      },
      path: [HUBSPOT, TYPES_PATH, SUBTYPES_PATH, anchorSettingElemID.name],
    })

  private static criteriaType: ObjectType =
    new ObjectType({
      elemID: criteriaElemID,
      fields: {
        [CRITERIA_FIELDS.FILTERFAMILY]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: CRITERIA_FIELDS.FILTERFAMILY,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [CRITERIA_FIELDS.OPERATOR]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: CRITERIA_FIELDS.OPERATOR,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [CRITERIA_FIELDS.PROPERTY]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: CRITERIA_FIELDS.PROPERTY,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [CRITERIA_FIELDS.PROPERTYOBJECTTYPE]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: CRITERIA_FIELDS.PROPERTYOBJECTTYPE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [CRITERIA_FIELDS.TYPE]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: CRITERIA_FIELDS.TYPE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [CRITERIA_FIELDS.VALUE]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: CRITERIA_FIELDS.VALUE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [CRITERIA_FIELDS.WITHINTIMEMODE]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: CRITERIA_FIELDS.WITHINTIMEMODE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
      },
      path: [HUBSPOT, TYPES_PATH, SUBTYPES_PATH, criteriaElemID.name],
    })

    // Create action type in steps cause of recursive fields
    private static createActionType = (): ObjectType => {
      const actionType = new ObjectType({
        elemID: actionElemID,
        fields: {
          [ACTION_FIELDS.TYPE]: {
            type: BuiltinTypes.STRING,
            annotations: {
              name: ACTION_FIELDS.TYPE,
              _readOnly: false,
              [CORE_ANNOTATIONS.REQUIRED]: false,
            },
          },
          [ACTION_FIELDS.ACTIONID]: {
            type: BuiltinTypes.NUMBER,
            annotations: {
              name: ACTION_FIELDS.ACTIONID,
              _readOnly: true,
              [CORE_ANNOTATIONS.REQUIRED]: false,
              [CORE_ANNOTATIONS.HIDDEN]: true,
            },
          },
          [ACTION_FIELDS.DELAYMILLS]: {
            type: BuiltinTypes.NUMBER,
            annotations: {
              name: ACTION_FIELDS.DELAYMILLS,
              _readOnly: false,
              [CORE_ANNOTATIONS.REQUIRED]: false,
            },
          },
          [ACTION_FIELDS.STEPID]: {
            type: BuiltinTypes.NUMBER,
            annotations: {
              name: ACTION_FIELDS.STEPID,
              _readOnly: false,
              [CORE_ANNOTATIONS.REQUIRED]: false,
              [CORE_ANNOTATIONS.HIDDEN]: true,
            },
          },
          [ACTION_FIELDS.ANCHORSETTING]: {
            type: Types.anchorSettingType,
            annotations: {
              name: ACTION_FIELDS.ANCHORSETTING,
              _readOnly: false,
              [CORE_ANNOTATIONS.REQUIRED]: false,
            },
          },
          [ACTION_FIELDS.FILTERSLISTID]: {
            type: BuiltinTypes.NUMBER,
            annotations: {
              name: ACTION_FIELDS.FILTERSLISTID,
              _readOnly: false,
              [CORE_ANNOTATIONS.REQUIRED]: false,
              [CORE_ANNOTATIONS.HIDDEN]: true,
            },
          },
          [ACTION_FIELDS.FILTERS]: {
            type: new ListType(new ListType(Types.criteriaType)),
            annotations: {
              name: ACTION_FIELDS.FILTERS,
              _readOnly: false,
              [CORE_ANNOTATIONS.REQUIRED]: false,
            },
          },
          [ACTION_FIELDS.PROPERTYNAME]: {
            type: BuiltinTypes.STRING,
            annotations: {
              name: ACTION_FIELDS.PROPERTYNAME,
              _readOnly: false,
              [CORE_ANNOTATIONS.REQUIRED]: false,
            },
          },
          [ACTION_FIELDS.BODY]: {
            type: BuiltinTypes.STRING,
            annotations: {
              name: ACTION_FIELDS.BODY,
              _readOnly: false,
              [CORE_ANNOTATIONS.REQUIRED]: false,
            },
          },
          [ACTION_FIELDS.NEWVALUE]: {
            type: BuiltinTypes.STRING,
            annotations: {
              name: ACTION_FIELDS.NEWVALUE,
              _readOnly: false,
              [CORE_ANNOTATIONS.REQUIRED]: false,
            },
          },
          [ACTION_FIELDS.STATICTO]: {
            type: BuiltinTypes.STRING,
            annotations: {
              name: ACTION_FIELDS.STATICTO,
              _readOnly: false,
              [CORE_ANNOTATIONS.REQUIRED]: false,
            },
          },
        },
        path: [HUBSPOT, TYPES_PATH, SUBTYPES_PATH, actionElemID.name],
      })

      const acceptActionsField = new Field(
        actionType, ACTION_FIELDS.ACCEPTACTIONS, new ListType(actionType), {
          name: ACTION_FIELDS.ACCEPTACTIONS,
          _readOnly: false,
          [CORE_ANNOTATIONS.REQUIRED]: false,
        },
      )
      const rejectActionsField = new Field(
        actionType, ACTION_FIELDS.REJECTACTIONS, new ListType(actionType), {
          name: ACTION_FIELDS.REJECTACTIONS,
          _readOnly: false,
          [CORE_ANNOTATIONS.REQUIRED]: false,
        },
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
          type: BuiltinTypes.BOOLEAN,
          annotations: {
            name: NURTURETIMERANGE_FIELDS.ENABLED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [NURTURETIMERANGE_FIELDS.STARTHOUR]: {
          type: BuiltinTypes.NUMBER,
          annotations: {
            name: NURTURETIMERANGE_FIELDS.STARTHOUR,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [NURTURETIMERANGE_FIELDS.STOPHOUR]: {
          type: BuiltinTypes.NUMBER,
          annotations: {
            name: NURTURETIMERANGE_FIELDS.STOPHOUR,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
      },
      path: [HUBSPOT, TYPES_PATH, SUBTYPES_PATH, nurtureTimeRangeElemID.name],
    })

  private static contactListIdsType: ObjectType =
    new ObjectType({
      elemID: contactListIdsElemID,
      fields: {
        [CONTACTLISTIDS_FIELDS.ENROLLED]: {
          type: BuiltinTypes.NUMBER,
          annotations: {
            name: CONTACTLISTIDS_FIELDS.ENROLLED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [CONTACTLISTIDS_FIELDS.ACTIVE]: {
          type: BuiltinTypes.NUMBER,
          annotations: {
            name: CONTACTLISTIDS_FIELDS.ACTIVE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [CONTACTLISTIDS_FIELDS.SUCCEEDED]: {
          type: BuiltinTypes.NUMBER,
          annotations: {
            name: CONTACTLISTIDS_FIELDS.SUCCEEDED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [CONTACTLISTIDS_FIELDS.COMPLETED]: {
          type: BuiltinTypes.NUMBER,
          annotations: {
            name: CONTACTLISTIDS_FIELDS.COMPLETED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
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
            name: RSSTOEMAILTIMING_FIELDS.REPEATS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
              values: ['instant', 'daily', 'weekly', 'monthly'],
            }),
          },
        },
        [RSSTOEMAILTIMING_FIELDS.REPEATS_ON_MONTHLY]: {
          type: BuiltinTypes.NUMBER,
          annotations: {
            name: RSSTOEMAILTIMING_FIELDS.REPEATS_ON_MONTHLY,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [RSSTOEMAILTIMING_FIELDS.REPEATS_ON_WEEKLY]: {
          type: BuiltinTypes.NUMBER,
          annotations: {
            name: RSSTOEMAILTIMING_FIELDS.REPEATS_ON_WEEKLY,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [RSSTOEMAILTIMING_FIELDS.TIME]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: RSSTOEMAILTIMING_FIELDS.TIME,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
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
          type: BuiltinTypes.STRING,
          annotations: {
            name: FORM_FIELDS.GUID,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.HIDDEN]: true,
          },
        },
        [FORM_FIELDS.NAME]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: FORM_FIELDS.NAME,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: true,
          },
        },
        [FORM_FIELDS.CSSCLASS]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: FORM_FIELDS.CSSCLASS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [FORM_FIELDS.REDIRECT]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: FORM_FIELDS.REDIRECT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [FORM_FIELDS.SUBMITTEXT]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: FORM_FIELDS.SUBMITTEXT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [FORM_FIELDS.NOTIFYRECIPIENTS]: {
          type: new ListType(Types.fieldTypes[FIELD_TYPES.USERIDENTIFIER]),
          annotations: {
            name: FORM_FIELDS.NOTIFYRECIPIENTS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [FORM_FIELDS.IGNORECURRENTVALUES]: {
          type: BuiltinTypes.BOOLEAN,
          annotations: {
            name: FORM_FIELDS.IGNORECURRENTVALUES,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [FORM_FIELDS.DELETABLE]: {
          type: BuiltinTypes.BOOLEAN,
          annotations: {
            name: FORM_FIELDS.DELETABLE,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [FORM_FIELDS.INLINEMESSAGE]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: FORM_FIELDS.INLINEMESSAGE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [FORM_FIELDS.FORMFIELDGROUPS]: {
          type: new ListType(Types.propertyGroupType),
          annotations: {
            name: FORM_FIELDS.FORMFIELDGROUPS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [FORM_FIELDS.CAPTCHAENABLED]: {
          type: BuiltinTypes.BOOLEAN,
          annotations: {
            name: FORM_FIELDS.CAPTCHAENABLED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [FORM_FIELDS.CREATEDAT]: {
          type: BuiltinTypes.NUMBER,
          annotations: {
            name: FORM_FIELDS.CREATEDAT,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.HIDDEN]: true,
          },
        },
        [FORM_FIELDS.CLONEABLE]: {
          type: BuiltinTypes.BOOLEAN,
          annotations: {
            name: FORM_FIELDS.CLONEABLE,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [FORM_FIELDS.STYLE]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: FORM_FIELDS.STYLE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [FORM_FIELDS.EDITABLE]: {
          type: BuiltinTypes.BOOLEAN,
          annotations: {
            name: FORM_FIELDS.EDITABLE,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [FORM_FIELDS.THEMENAME]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: FORM_FIELDS.THEMENAME,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
      },
      path: [HUBSPOT, TYPES_PATH, formElemID.name],
    }),
    [OBJECTS_NAMES.WORKFLOW]: new ObjectType({
      elemID: workflowsElemID,
      fields: {
        [WORKFLOWS_FIELDS.ID]: {
          type: BuiltinTypes.NUMBER,
          annotations: {
            name: WORKFLOWS_FIELDS.ID,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.HIDDEN]: true,
          },
        },
        [WORKFLOWS_FIELDS.NAME]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: WORKFLOWS_FIELDS.NAME,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: true,
          },
        },
        [WORKFLOWS_FIELDS.SEGMENTCRITERIA]: {
          type: new ListType(new ListType(Types.criteriaType)),
          annotations: {
            name: WORKFLOWS_FIELDS.SEGMENTCRITERIA,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [WORKFLOWS_FIELDS.GOALCRITERIA]: {
          type: new ListType(new ListType(Types.criteriaType)),
          annotations: {
            name: WORKFLOWS_FIELDS.GOALCRITERIA,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [WORKFLOWS_FIELDS.TYPE]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: WORKFLOWS_FIELDS.TYPE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
              enforce_value: false,
              values: ['PROPERTY_ANCHOR', 'STATIC_ANCHOR', 'DRIP_DELAY'],
            }),
          },
        },
        [WORKFLOWS_FIELDS.ENABLED]: {
          type: BuiltinTypes.BOOLEAN,
          annotations: {
            name: WORKFLOWS_FIELDS.ENABLED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [WORKFLOWS_FIELDS.INSERTEDAT]: {
          type: BuiltinTypes.NUMBER,
          annotations: {
            name: WORKFLOWS_FIELDS.INSERTEDAT,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.HIDDEN]: true,
          },
        },
        [WORKFLOWS_FIELDS.UPDATEDAT]: {
          type: BuiltinTypes.NUMBER,
          annotations: {
            name: WORKFLOWS_FIELDS.UPDATEDAT,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.HIDDEN]: true,
          },
        },
        [WORKFLOWS_FIELDS.CONTACTLISTIDS]: {
          type: Types.contactListIdsType,
          annotations: {
            name: WORKFLOWS_FIELDS.CONTACTLISTIDS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [WORKFLOWS_FIELDS.INTERNAL]: {
          type: BuiltinTypes.BOOLEAN,
          annotations: {
            name: WORKFLOWS_FIELDS.INTERNAL,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [WORKFLOWS_FIELDS.ONLYEXECONBIZDAYS]: {
          type: BuiltinTypes.BOOLEAN,
          annotations: {
            name: WORKFLOWS_FIELDS.ONLYEXECONBIZDAYS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [WORKFLOWS_FIELDS.NURTURETIMERANGE]: {
          type: Types.nurtureTimeRangeType,
          annotations: {
            name: WORKFLOWS_FIELDS.NURTURETIMERANGE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [WORKFLOWS_FIELDS.ACTIONS]: {
          type: new ListType(Types.actionType),
          annotations: {
            name: WORKFLOWS_FIELDS.ACTIONS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [WORKFLOWS_FIELDS.LISTENING]: {
          type: BuiltinTypes.BOOLEAN,
          annotations: {
            name: WORKFLOWS_FIELDS.LISTENING,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [WORKFLOWS_FIELDS.EVENTANCHOR]: {
          type: Types.eventAnchorType,
          annotations: {
            name: WORKFLOWS_FIELDS.EVENTANCHOR,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [WORKFLOWS_FIELDS.ALLOWCONTACTTOTRIGGERMULTIPLETIMES]: {
          type: BuiltinTypes.BOOLEAN,
          annotations: {
            name: WORKFLOWS_FIELDS.ALLOWCONTACTTOTRIGGERMULTIPLETIMES,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [WORKFLOWS_FIELDS.ONLYENROLLMANUALLY]: {
          type: BuiltinTypes.BOOLEAN,
          annotations: {
            name: WORKFLOWS_FIELDS.ONLYENROLLMANUALLY,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [WORKFLOWS_FIELDS.ENROLLONCRITERIAUPDATE]: {
          type: BuiltinTypes.BOOLEAN,
          annotations: {
            name: WORKFLOWS_FIELDS.ENROLLONCRITERIAUPDATE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [WORKFLOWS_FIELDS.SUPRESSIONLISTIDS]: {
          type: new ListType(BuiltinTypes.NUMBER),
          annotations: {
            name: WORKFLOWS_FIELDS.SUPRESSIONLISTIDS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
      },
      path: [HUBSPOT, TYPES_PATH, workflowsElemID.name],
    }),
    [OBJECTS_NAMES.MARKETINGEMAIL]: new ObjectType({
      elemID: marketingEmailElemID,
      fields: {
        [MARKETING_EMAIL_FIELDS.AB]: {
          type: BuiltinTypes.BOOLEAN,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.AB,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [MARKETING_EMAIL_FIELDS.ABHOURSWAIT]: {
          type: BuiltinTypes.NUMBER,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.ABHOURSWAIT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [MARKETING_EMAIL_FIELDS.ABVARIATION]: {
          type: BuiltinTypes.BOOLEAN,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.ABVARIATION,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [MARKETING_EMAIL_FIELDS.ABSAMPLESIZEDEFAULT]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.ABSAMPLESIZEDEFAULT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ values: ['master', 'variant'] }),
          },
        },
        [MARKETING_EMAIL_FIELDS.ABSAMPLINGDEFAULT]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.ABSAMPLINGDEFAULT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ values: ['master', 'variant'] }),
          },
        },
        [MARKETING_EMAIL_FIELDS.ABSTATUS]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.ABSTATUS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ values: ['master', 'variant'] }),
          },
        },
        [MARKETING_EMAIL_FIELDS.ABSUCCESSMETRIC]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.ABSUCCESSMETRIC,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
              values: ['CLICKS_BY_OPENS', 'CLICKS_BY_DELIVERED', 'OPENS_BY_DELIVERED'],
            }),
          },
        },
        [MARKETING_EMAIL_FIELDS.ABTESTID]: {
          type: BuiltinTypes.NUMBER,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.ABTESTID,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [MARKETING_EMAIL_FIELDS.ABTESTPERCENTAGE]: {
          type: BuiltinTypes.NUMBER,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.ABTESTPERCENTAGE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [MARKETING_EMAIL_FIELDS.ABSOLUTEURL]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.ABSOLUTEURL,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [MARKETING_EMAIL_FIELDS.ALLEMAILCAMPAIGNIDS]: {
          type: new ListType(BuiltinTypes.NUMBER),
          annotations: {
            name: MARKETING_EMAIL_FIELDS.ALLEMAILCAMPAIGNIDS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [MARKETING_EMAIL_FIELDS.ANALYTICSPAGEID]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.ANALYTICSPAGEID,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [MARKETING_EMAIL_FIELDS.ARCHIVED]: {
          type: BuiltinTypes.BOOLEAN,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.ARCHIVED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [MARKETING_EMAIL_FIELDS.AUTHOR]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.AUTHOR,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.HIDDEN]: true,
          },
        },
        [MARKETING_EMAIL_FIELDS.AUTHORAT]: {
          type: BuiltinTypes.NUMBER,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.AUTHORAT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.HIDDEN]: true,
          },
        },
        [MARKETING_EMAIL_FIELDS.AUTHOREMAIL]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.AUTHOREMAIL,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.HIDDEN]: true,
          },
        },
        [MARKETING_EMAIL_FIELDS.AUTHORNAME]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.AUTHORNAME,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.HIDDEN]: true,
          },
        },
        [MARKETING_EMAIL_FIELDS.AUTHORUSERID]: {
          type: BuiltinTypes.NUMBER,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.AUTHORUSERID,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.HIDDEN]: true,
          },
        },
        [MARKETING_EMAIL_FIELDS.BLOGEMAILTYPE]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.BLOGEMAILTYPE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
              values: ['instant', 'daily', 'weekly', 'monthly'],
            }),
          },
        },
        [MARKETING_EMAIL_FIELDS.BLOGRSSSETTINGS]: {
          // TODO: Format this the right way
          type: BuiltinTypes.NUMBER,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.BLOGRSSSETTINGS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [MARKETING_EMAIL_FIELDS.CAMPAIGN]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.CAMPAIGN,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [MARKETING_EMAIL_FIELDS.CAMPAIGNNAME]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.CAMPAIGNNAME,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [MARKETING_EMAIL_FIELDS.CANSPAMSETTINGSID]: {
          type: BuiltinTypes.NUMBER,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.CANSPAMSETTINGSID,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [MARKETING_EMAIL_FIELDS.CLONEDFROM]: {
          type: BuiltinTypes.NUMBER,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.CLONEDFROM,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [MARKETING_EMAIL_FIELDS.CREATEPAGE]: {
          type: BuiltinTypes.BOOLEAN,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.CREATEPAGE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [MARKETING_EMAIL_FIELDS.CREATED]: {
          type: BuiltinTypes.NUMBER,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.CREATED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.HIDDEN]: true,
          },
        },
        [MARKETING_EMAIL_FIELDS.CURRENTLYPUBLISHED]: {
          type: BuiltinTypes.BOOLEAN,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.CURRENTLYPUBLISHED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: true,
          },
        },
        [MARKETING_EMAIL_FIELDS.DOMAIN]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.DOMAIN,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [MARKETING_EMAIL_FIELDS.EMAILBODY]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.EMAILBODY,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: true,
          },
        },
        [MARKETING_EMAIL_FIELDS.EMAILNOTE]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.EMAILNOTE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [MARKETING_EMAIL_FIELDS.EMAILTYPE]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.EMAILTYPE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
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
            name: MARKETING_EMAIL_FIELDS.FEEDBACKEMAILCATEGORY,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
              enforce_value: false,
              values: ['NPS', 'CES', 'CUSTOM'],
            }),
          },
        },
        [MARKETING_EMAIL_FIELDS.FEEDBACKSURVEYID]: {
          type: BuiltinTypes.NUMBER,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.FEEDBACKSURVEYID,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [MARKETING_EMAIL_FIELDS.FLEXAREAS]: {
          type: BuiltinTypes.JSON,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.FLEXAREAS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [MARKETING_EMAIL_FIELDS.FOLDERID]: {
          type: BuiltinTypes.NUMBER,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.FOLDERID,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [MARKETING_EMAIL_FIELDS.FREEZEDATE]: {
          type: BuiltinTypes.NUMBER,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.FREEZEDATE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.HIDDEN]: true,
          },
        },
        [MARKETING_EMAIL_FIELDS.FROMNAME]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.FROMNAME,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [MARKETING_EMAIL_FIELDS.HTMLTITLE]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.HTMLTITLE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [MARKETING_EMAIL_FIELDS.ID]: {
          type: BuiltinTypes.NUMBER,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.ID,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.HIDDEN]: true,
          },
        },
        [MARKETING_EMAIL_FIELDS.ISGRAYMAILSUPPRESSIONENABLED]: {
          type: BuiltinTypes.BOOLEAN,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.ISGRAYMAILSUPPRESSIONENABLED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [MARKETING_EMAIL_FIELDS.ISLOCALTIMEZONESEND]: {
          type: BuiltinTypes.BOOLEAN,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.ISLOCALTIMEZONESEND,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [MARKETING_EMAIL_FIELDS.ISPUBLISHED]: {
          type: BuiltinTypes.BOOLEAN,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.ISPUBLISHED,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [MARKETING_EMAIL_FIELDS.ISRECIPIENTFATIGUESUPPRESSIONENABLED]: {
          type: BuiltinTypes.BOOLEAN,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.ISRECIPIENTFATIGUESUPPRESSIONENABLED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [MARKETING_EMAIL_FIELDS.LEADFLOWID]: {
          type: BuiltinTypes.NUMBER,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.LEADFLOWID,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [MARKETING_EMAIL_FIELDS.LIVEDOMAIN]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.LIVEDOMAIN,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.HIDDEN]: true,
          },
        },
        [MARKETING_EMAIL_FIELDS.MAILINGLISTSEXCLUDED]: {
          // TODO: Convert this to reference
          type: new ListType(BuiltinTypes.NUMBER),
          annotations: {
            name: MARKETING_EMAIL_FIELDS.MAILINGLISTSEXCLUDED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [MARKETING_EMAIL_FIELDS.MAILINGLISTSINCLUDED]: {
          // TODO: Convert this to reference
          type: new ListType(BuiltinTypes.NUMBER),
          annotations: {
            name: MARKETING_EMAIL_FIELDS.MAILINGLISTSINCLUDED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [MARKETING_EMAIL_FIELDS.MAXRSSENTRIES]: {
          type: BuiltinTypes.NUMBER,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.MAXRSSENTRIES,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [MARKETING_EMAIL_FIELDS.METADESCRIPTION]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.METADESCRIPTION,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [MARKETING_EMAIL_FIELDS.NAME]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.NAME,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [MARKETING_EMAIL_FIELDS.PAGEEXPIRYDATE]: {
          type: BuiltinTypes.NUMBER,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.PAGEEXPIRYDATE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.HIDDEN]: true,
          },
        },
        [MARKETING_EMAIL_FIELDS.PAGEEXPIRYREDIRECTEID]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.PAGEEXPIRYREDIRECTEID,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.HIDDEN]: true,
          },
        },
        [MARKETING_EMAIL_FIELDS.PAGEREDIRECTED]: {
          type: BuiltinTypes.BOOLEAN,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.PAGEREDIRECTED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [MARKETING_EMAIL_FIELDS.PREVIEWKEY]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.PREVIEWKEY,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [MARKETING_EMAIL_FIELDS.PROCESSINGSTATUS]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.PROCESSINGSTATUS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
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
            name: MARKETING_EMAIL_FIELDS.PUBLISHDATE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.HIDDEN]: true,
          },
        },
        [MARKETING_EMAIL_FIELDS.PUBLISHEDAT]: {
          type: BuiltinTypes.NUMBER,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.PUBLISHEDAT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.HIDDEN]: true,
          },
        },
        [MARKETING_EMAIL_FIELDS.PUBLISHEDBYID]: {
          type: BuiltinTypes.NUMBER,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.PUBLISHEDBYID,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.HIDDEN]: true,
          },
        },
        [MARKETING_EMAIL_FIELDS.PUBLISHEDBYNAME]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.PUBLISHEDBYNAME,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.HIDDEN]: true,
          },
        },
        [MARKETING_EMAIL_FIELDS.PUBLISHIMMEDIATELY]: {
          type: BuiltinTypes.BOOLEAN,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.PUBLISHIMMEDIATELY,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [MARKETING_EMAIL_FIELDS.PUBLISHEDURL]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.PUBLISHEDURL,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [MARKETING_EMAIL_FIELDS.REPLYTO]: {
          // TODO: Decide if to enforce link to fromName?
          type: BuiltinTypes.STRING,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.REPLYTO,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [MARKETING_EMAIL_FIELDS.RESOLVEDDOMAIN]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.RESOLVEDDOMAIN,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [MARKETING_EMAIL_FIELDS.RSSEMAILAUTHORLINETEMPLATE]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.RSSEMAILAUTHORLINETEMPLATE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [MARKETING_EMAIL_FIELDS.RSSEMAILBLOGIMAGEMAXWIDTH]: {
          type: BuiltinTypes.NUMBER,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.RSSEMAILBLOGIMAGEMAXWIDTH,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [MARKETING_EMAIL_FIELDS.RSSEMAILBYTEXT]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.RSSEMAILBYTEXT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [MARKETING_EMAIL_FIELDS.RSSEMAILCLICKTHROUGHTEXT]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.RSSEMAILCLICKTHROUGHTEXT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [MARKETING_EMAIL_FIELDS.RSSEMAILCOMMENTTEXT]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.RSSEMAILCOMMENTTEXT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [MARKETING_EMAIL_FIELDS.RSSEMAILENTRYTEMPLATE]: {
          type: BuiltinTypes.BOOLEAN,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.RSSEMAILENTRYTEMPLATE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [MARKETING_EMAIL_FIELDS.RSSEMAILENTRYTEMPLATEENABLED]: {
          type: BuiltinTypes.BOOLEAN,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.RSSEMAILENTRYTEMPLATEENABLED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [MARKETING_EMAIL_FIELDS.RSSEMAILURL]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.RSSEMAILURL,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [MARKETING_EMAIL_FIELDS.RSSTOEMAILTIMING]: {
          type: Types.rssToEmailTimingType,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.RSSTOEMAILTIMING,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [MARKETING_EMAIL_FIELDS.SLUG]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.SLUG,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [MARKETING_EMAIL_FIELDS.SMARTEMAILFIELDS]: {
          // TODO: Understand this and convert to a list of smart fields
          type: BuiltinTypes.JSON,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.SMARTEMAILFIELDS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [MARKETING_EMAIL_FIELDS.STYLESETTINGS]: {
          type: BuiltinTypes.JSON,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.STYLESETTINGS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [MARKETING_EMAIL_FIELDS.SUBCATEGORY]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.SUBCATEGORY,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
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
          type: BuiltinTypes.STRING,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.SUBJECT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [MARKETING_EMAIL_FIELDS.SUBSCRIPTION]: {
          // TODO: Check what email subscription type is
          type: BuiltinTypes.NUMBER,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.SUBSCRIPTION,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [MARKETING_EMAIL_FIELDS.SUBSCRIPTIONBLOGID]: {
          type: BuiltinTypes.NUMBER,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.SUBSCRIPTIONBLOGID,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [MARKETING_EMAIL_FIELDS.SUBSCRIPTIONNAME]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.SUBSCRIPTIONNAME,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [MARKETING_EMAIL_FIELDS.TEMPLATEPATH]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.TEMPLATEPATH,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [MARKETING_EMAIL_FIELDS.TRANSACTIONAL]: {
          type: BuiltinTypes.BOOLEAN,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.TRANSACTIONAL,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [MARKETING_EMAIL_FIELDS.UNPUBLISHEDAT]: {
          type: BuiltinTypes.NUMBER,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.UNPUBLISHEDAT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.HIDDEN]: true,
          },
        },
        [MARKETING_EMAIL_FIELDS.UPDATED]: {
          type: BuiltinTypes.NUMBER,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.UPDATED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.HIDDEN]: true,
          },
        },
        [MARKETING_EMAIL_FIELDS.UPDATEDBYID]: {
          type: Types.fieldTypes[FIELD_TYPES.USERIDENTIFIER],
          annotations: {
            name: MARKETING_EMAIL_FIELDS.UPDATEDBYID,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.HIDDEN]: true,
          },
        },
        [MARKETING_EMAIL_FIELDS.URL]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.URL,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [MARKETING_EMAIL_FIELDS.USERSSHEADLINEASSUBJECT]: {
          type: BuiltinTypes.BOOLEAN,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.USERSSHEADLINEASSUBJECT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [MARKETING_EMAIL_FIELDS.VIDSEXCLUDED]: {
          // TODO: No contact instances (maybe convert to email)
          type: new ListType(BuiltinTypes.NUMBER),
          annotations: {
            name: MARKETING_EMAIL_FIELDS.VIDSEXCLUDED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [MARKETING_EMAIL_FIELDS.VIDSINCLUDED]: {
          // TODO: No contact instances (maybe convert to email)
          type: new ListType(BuiltinTypes.NUMBER),
          annotations: {
            name: MARKETING_EMAIL_FIELDS.VIDSINCLUDED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [MARKETING_EMAIL_FIELDS.WIDGETS]: {
          type: BuiltinTypes.JSON,
          annotations: {
            name: MARKETING_EMAIL_FIELDS.WIDGETS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [MARKETING_EMAIL_FIELDS.WORKFLOWNAMES]: {
          // TODO: Convert to reference
          type: new ListType(BuiltinTypes.STRING),
          annotations: {
            name: MARKETING_EMAIL_FIELDS.WORKFLOWNAMES,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
      },
      path: [HUBSPOT, TYPES_PATH, marketingEmailElemID.name],
    }),
    [OBJECTS_NAMES.CONTACT_PROPERTY]: new ObjectType({
      elemID: contactPropertyElemID,
      fields: {
        [CONTACT_PROPERTY_FIELDS.NAME]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: CONTACT_PROPERTY_FIELDS.NAME,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: true,
          },
        },
        [CONTACT_PROPERTY_FIELDS.LABEL]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: CONTACT_PROPERTY_FIELDS.LABEL,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [CONTACT_PROPERTY_FIELDS.DESCRIPTION]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: CONTACT_PROPERTY_FIELDS.DESCRIPTION,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [CONTACT_PROPERTY_FIELDS.GROUPNAME]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: CONTACT_PROPERTY_FIELDS.GROUPNAME,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: true,
          },
        },
        [CONTACT_PROPERTY_FIELDS.TYPE]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: CONTACT_PROPERTY_FIELDS.TYPE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: true,
            [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
              values: contactPropertyTypeValues,
            }),
          },
        },
        [CONTACT_PROPERTY_FIELDS.FIELDTYPE]: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: CONTACT_PROPERTY_FIELDS.FIELDTYPE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: true,
            [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
              values: contactPropertyFieldTypeValues,
            }),
          },
        },
        [CONTACT_PROPERTY_FIELDS.OPTIONS]: {
          type: new ListType(Types.optionsType),
          annotations: {
            name: CONTACT_PROPERTY_FIELDS.OPTIONS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [CONTACT_PROPERTY_FIELDS.DELETED]: {
          type: BuiltinTypes.BOOLEAN,
          annotations: {
            name: CONTACT_PROPERTY_FIELDS.DELETED,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [CONTACT_PROPERTY_FIELDS.FORMFIELD]: {
          type: BuiltinTypes.BOOLEAN,
          annotations: {
            name: CONTACT_PROPERTY_FIELDS.FORMFIELD,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: true,
          },
        },
        [CONTACT_PROPERTY_FIELDS.DISPLAYORDER]: {
          type: BuiltinTypes.NUMBER,
          annotations: {
            name: CONTACT_PROPERTY_FIELDS.DISPLAYORDER,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.DEFAULT]: -1,
          },
        },
        [CONTACT_PROPERTY_FIELDS.READONLYVALUE]: {
          type: BuiltinTypes.BOOLEAN,
          annotations: {
            name: CONTACT_PROPERTY_FIELDS.READONLYVALUE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.DEFAULT]: false,
          },
        },
        [CONTACT_PROPERTY_FIELDS.READONLYDEFINITION]: {
          type: BuiltinTypes.BOOLEAN,
          annotations: {
            name: CONTACT_PROPERTY_FIELDS.READONLYDEFINITION,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.DEFAULT]: false,
          },
        },
        [CONTACT_PROPERTY_FIELDS.HIDDEN]: {
          type: BuiltinTypes.BOOLEAN,
          annotations: {
            name: CONTACT_PROPERTY_FIELDS.HIDDEN,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.DEFAULT]: false,
          },
        },
        [CONTACT_PROPERTY_FIELDS.MUTABLEDEFINITIONNOTDELETABLE]: {
          type: BuiltinTypes.BOOLEAN,
          annotations: {
            name: CONTACT_PROPERTY_FIELDS.MUTABLEDEFINITIONNOTDELETABLE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.DEFAULT]: false,
          },
        },
        [CONTACT_PROPERTY_FIELDS.CALCULATED]: {
          type: BuiltinTypes.BOOLEAN,
          annotations: {
            name: CONTACT_PROPERTY_FIELDS.CALCULATED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        [CONTACT_PROPERTY_FIELDS.CREATEDAT]: {
          type: BuiltinTypes.NUMBER,
          annotations: {
            name: CONTACT_PROPERTY_FIELDS.CREATEDAT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.HIDDEN]: true,
          },
        },
        [CONTACT_PROPERTY_FIELDS.EXTERNALOPTIONS]: {
          type: BuiltinTypes.BOOLEAN,
          annotations: {
            name: CONTACT_PROPERTY_FIELDS.EXTERNALOPTIONS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
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
    return new StaticFile(
      `${path?.getFullNameParts().filter((namePart: string): boolean => namePart !== 'instance').join('/')}.json`,
      Buffer.from(JSON.stringify(value, null, 2))
    )
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

export const getLookUpName = (refValue: Value): Value =>
  // TODO: find the correct field with Adam
  refValue
