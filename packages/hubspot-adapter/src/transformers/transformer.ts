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
  ElemID, ObjectType, PrimitiveType, PrimitiveTypes, Field,
  BuiltinTypes, InstanceElement, TypeElement, CORE_ANNOTATIONS,
  TypeMap, Values, isPrimitiveType, Value, ListType, createRestriction, isPrimitiveValue,
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
        [OPTIONS_FIELDS.LABEL]: new Field(
          optionsElemID, OPTIONS_FIELDS.LABEL, BuiltinTypes.STRING, {
            name: OPTIONS_FIELDS.LABEL,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [OPTIONS_FIELDS.VALUE]: new Field(
          optionsElemID, OPTIONS_FIELDS.VALUE, BuiltinTypes.STRING, {
            name: OPTIONS_FIELDS.VALUE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [OPTIONS_FIELDS.READONLY]: new Field(
          optionsElemID, OPTIONS_FIELDS.READONLY, BuiltinTypes.BOOLEAN, {
            name: OPTIONS_FIELDS.READONLY,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [OPTIONS_FIELDS.DISPLAYORDER]: new Field(
          optionsElemID, OPTIONS_FIELDS.DISPLAYORDER, BuiltinTypes.NUMBER, {
            name: OPTIONS_FIELDS.DISPLAYORDER,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [OPTIONS_FIELDS.HIDDEN]: new Field(
          optionsElemID, OPTIONS_FIELDS.HIDDEN, BuiltinTypes.BOOLEAN, {
            name: OPTIONS_FIELDS.HIDDEN,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [OPTIONS_FIELDS.DESCRIPTION]: new Field(
          optionsElemID, OPTIONS_FIELDS.DESCRIPTION, BuiltinTypes.STRING, {
            name: OPTIONS_FIELDS.DESCRIPTION,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
      },
      path: [HUBSPOT, TYPES_PATH, SUBTYPES_PATH, optionsElemID.name],
    })

  private static fieldFilterType: ObjectType =
    new ObjectType({
      elemID: fieldFilterElemID,
      fields: {
        [FIELD_FILTER_FIELDS.OPERATOR]: new Field(
          fieldFilterElemID, FIELD_FILTER_FIELDS.OPERATOR, BuiltinTypes.STRING, {
            name: FIELD_FILTER_FIELDS.OPERATOR,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: true,
            // TODO: Find the values
          },
        ),
        [FIELD_FILTER_FIELDS.STRVALUE]: new Field(
          fieldFilterElemID, FIELD_FILTER_FIELDS.STRVALUE, BuiltinTypes.STRING, {
            name: FIELD_FILTER_FIELDS.STRVALUE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [FIELD_FILTER_FIELDS.STRVALUES]: new Field(
          fieldFilterElemID, FIELD_FILTER_FIELDS.STRVALUES, new ListType(BuiltinTypes.STRING), {
            name: FIELD_FILTER_FIELDS.STRVALUES,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [FIELD_FILTER_FIELDS.BOOLVALUE]: new Field(
          fieldFilterElemID, FIELD_FILTER_FIELDS.BOOLVALUE, BuiltinTypes.BOOLEAN, {
            name: FIELD_FILTER_FIELDS.BOOLVALUE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [FIELD_FILTER_FIELDS.NUMBERVALUE]: new Field(
          fieldFilterElemID, FIELD_FILTER_FIELDS.NUMBERVALUE, BuiltinTypes.NUMBER, {
            name: FIELD_FILTER_FIELDS.NUMBERVALUE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [FIELD_FILTER_FIELDS.NUMVALUES]: new Field(
          fieldFilterElemID, FIELD_FILTER_FIELDS.NUMVALUES, new ListType(BuiltinTypes.NUMBER), {
            name: FIELD_FILTER_FIELDS.NUMVALUES,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
      },
      path: [HUBSPOT, TYPES_PATH, SUBTYPES_PATH, fieldFilterElemID.name],
    })

    private static contactPropertyOverridesType: ObjectType =
      new ObjectType({
        elemID: contactPropertyOverridesElemID,
        fields: {
          [CONTACT_PROPERTY_OVERRIDES_FIELDS.LABEL]: new Field(
            contactPropertyOverridesElemID, CONTACT_PROPERTY_OVERRIDES_FIELDS.LABEL,
            BuiltinTypes.STRING, {
              name: CONTACT_PROPERTY_OVERRIDES_FIELDS.LABEL,
              _readOnly: false,
              [CORE_ANNOTATIONS.REQUIRED]: false,
            },
          ),
          [CONTACT_PROPERTY_OVERRIDES_FIELDS.DISPLAYORDER]: new Field(
            contactPropertyOverridesElemID, CONTACT_PROPERTY_OVERRIDES_FIELDS.DISPLAYORDER,
            BuiltinTypes.NUMBER,
            {
              name: CONTACT_PROPERTY_OVERRIDES_FIELDS.DISPLAYORDER,
              _readOnly: false,
              [CORE_ANNOTATIONS.REQUIRED]: false,
            },
          ),
          [CONTACT_PROPERTY_OVERRIDES_FIELDS.OPTIONS]: new Field(
            contactPropertyOverridesElemID, CONTACT_PROPERTY_OVERRIDES_FIELDS.OPTIONS,
            new ListType(Types.optionsType), {
              name: CONTACT_PROPERTY_OVERRIDES_FIELDS.OPTIONS,
              _readOnly: false,
              [CORE_ANNOTATIONS.REQUIRED]: false,
            },
          ),
        },
        path: [HUBSPOT, TYPES_PATH, SUBTYPES_PATH, contactPropertyOverridesElemID.name],
      })

    private static createFormFieldType = (
      elemID: ElemID,
      isFatherProperty: boolean
    ): ObjectType => {
      const formPropertyType = new ObjectType({
        elemID,
        fields: {
          [FORM_PROPERTY_INNER_FIELDS.CONTACT_PROPERTY]: new Field(
            // TODO: This is not really a string
            elemID, FORM_PROPERTY_INNER_FIELDS.CONTACT_PROPERTY, BuiltinTypes.STRING, {
              name: FORM_PROPERTY_INNER_FIELDS.CONTACT_PROPERTY,
              _readOnly: false,
              [CORE_ANNOTATIONS.REQUIRED]: true,
            }
          ),
          [FORM_PROPERTY_INNER_FIELDS.CONTACT_PROPERTY_OVERRIDES]: new Field(
            elemID, FORM_PROPERTY_INNER_FIELDS.CONTACT_PROPERTY_OVERRIDES,
            Types.contactPropertyOverridesType, {
              name: FORM_PROPERTY_INNER_FIELDS.CONTACT_PROPERTY_OVERRIDES,
              _readOnly: false,
              [CORE_ANNOTATIONS.REQUIRED]: false,
            },
          ),
          [FORM_PROPERTY_FIELDS.DEFAULTVALUE]: new Field(
            elemID, FORM_PROPERTY_FIELDS.DEFAULTVALUE, BuiltinTypes.STRING, {
              name: FORM_PROPERTY_FIELDS.DEFAULTVALUE,
              _readOnly: false,
              [CORE_ANNOTATIONS.REQUIRED]: false,
            },
          ),
          [FORM_PROPERTY_FIELDS.PLACEHOLDER]: new Field(
            elemID, FORM_PROPERTY_FIELDS.PLACEHOLDER, BuiltinTypes.STRING, {
              name: FORM_PROPERTY_FIELDS.PLACEHOLDER,
              _readOnly: false,
              [CORE_ANNOTATIONS.REQUIRED]: false,
            },
          ),
          [FORM_PROPERTY_INNER_FIELDS.HELPTEXT]: new Field(
            elemID, FORM_PROPERTY_INNER_FIELDS.HELPTEXT,
            BuiltinTypes.STRING, {
              name: FORM_PROPERTY_INNER_FIELDS.HELPTEXT,
              _readOnly: false,
              [CORE_ANNOTATIONS.REQUIRED]: false,
            }
          ),
          [FORM_PROPERTY_FIELDS.REQUIRED]: new Field(
            elemID, FORM_PROPERTY_FIELDS.REQUIRED, BuiltinTypes.BOOLEAN, {
              name: FORM_PROPERTY_FIELDS.REQUIRED,
              _readOnly: false,
              [CORE_ANNOTATIONS.REQUIRED]: false,
            },
          ),
          [FORM_PROPERTY_FIELDS.SELECTEDOPTIONS]: new Field(
            elemID, FORM_PROPERTY_FIELDS.SELECTEDOPTIONS, new ListType(BuiltinTypes.STRING), {
              name: FORM_PROPERTY_FIELDS.SELECTEDOPTIONS,
              _readOnly: false,
              [CORE_ANNOTATIONS.REQUIRED]: false,
            },
          ),
          [FORM_PROPERTY_FIELDS.ISSMARTFIELD]: new Field(
            elemID, FORM_PROPERTY_FIELDS.ISSMARTFIELD, BuiltinTypes.BOOLEAN, {
              name: FORM_PROPERTY_FIELDS.ISSMARTFIELD,
              _readOnly: false,
              [CORE_ANNOTATIONS.REQUIRED]: false,
            },
          ),
        },
        path: [HUBSPOT, TYPES_PATH, SUBTYPES_PATH, elemID.name],
      })
      if (isFatherProperty) {
        Object.assign(formPropertyType.fields, {
          [FORM_PROPERTY_FIELDS.DEPENDENTFIELDFILTERS]: new Field(
            elemID, FORM_PROPERTY_FIELDS.DEPENDENTFIELDFILTERS,
            new ListType(Types.dependentFormFieldFiltersType), {
              name: FORM_PROPERTY_FIELDS.DEPENDENTFIELDFILTERS,
              _readOnly: false,
              [CORE_ANNOTATIONS.REQUIRED]: false,
            },
          ),
        })
      }
      return formPropertyType
    }

  private static dependeeFormFieldType = Types.createFormFieldType(
    dependeeFormPropertyElemID,
    false
  )

  private static dependentFormFieldFiltersType: ObjectType =
    new ObjectType({
      elemID: dependentFormFieldFiltersElemID,
      fields: {
        [DEPENDENT_FIELD_FILTER_FIELDS.FORMFIELDACTION]: new Field(
          dependentFormFieldFiltersElemID, DEPENDENT_FIELD_FILTER_FIELDS.FORMFIELDACTION,
          BuiltinTypes.STRING, {
            name: DEPENDENT_FIELD_FILTER_FIELDS.FORMFIELDACTION,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: true,
            // TODO: See if this can be anything else other than DISPLAY
          },
        ),
        [DEPENDENT_FIELD_FILTER_FIELDS.FILTERS]: new Field(
          dependentFormFieldFiltersElemID, DEPENDENT_FIELD_FILTER_FIELDS.FILTERS,
          new ListType(Types.fieldFilterType), {
            name: DEPENDENT_FIELD_FILTER_FIELDS.FILTERS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: true,
          },
        ),
        [DEPENDENT_FIELD_FILTER_FIELDS.DEPEDENTFORMFIELD]: new Field(
          dependentFormFieldFiltersElemID, DEPENDENT_FIELD_FILTER_FIELDS.DEPEDENTFORMFIELD,
          Types.dependeeFormFieldType, {
            name: DEPENDENT_FIELD_FILTER_FIELDS.DEPEDENTFORMFIELD,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: true,
          }
        ),
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
        [RICHTEXT_FIELDS.CONTENT]: new Field(
          richTextElemID, RICHTEXT_FIELDS.CONTENT, BuiltinTypes.STRING, {
            name: RICHTEXT_FIELDS.CONTENT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
      },
      path: [HUBSPOT, TYPES_PATH, SUBTYPES_PATH, richTextElemID.name],
    })

  private static propertyGroupType: ObjectType =
    new ObjectType({
      elemID: propertyGroupElemID,
      fields: {
        [FORM_PROPERTY_GROUP_FIELDS.DEFAULT]: new Field(
          propertyGroupElemID, FORM_PROPERTY_GROUP_FIELDS.DEFAULT, BuiltinTypes.BOOLEAN, {
            name: FORM_PROPERTY_GROUP_FIELDS.DEFAULT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [FORM_PROPERTY_GROUP_FIELDS.FIELDS]: new Field(
          propertyGroupElemID, FORM_PROPERTY_GROUP_FIELDS.FIELDS,
          new ListType(Types.dependentFormFieldType), {
            name: FORM_PROPERTY_GROUP_FIELDS.FIELDS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [FORM_PROPERTY_GROUP_FIELDS.ISSMARTGROUP]: new Field(
          propertyGroupElemID, FORM_PROPERTY_GROUP_FIELDS.ISSMARTGROUP, BuiltinTypes.BOOLEAN, {
            name: FORM_PROPERTY_GROUP_FIELDS.ISSMARTGROUP,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [FORM_PROPERTY_GROUP_FIELDS.RICHTEXT]: new Field(
          propertyGroupElemID, FORM_PROPERTY_GROUP_FIELDS.RICHTEXT, Types.richTextType, {
            name: FORM_PROPERTY_GROUP_FIELDS.RICHTEXT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
      },
      path: [HUBSPOT, TYPES_PATH, SUBTYPES_PATH, propertyGroupElemID.name],
    })

  private static eventAnchorType: ObjectType =
    new ObjectType({
      elemID: eventAnchorElemID,
      fields: {
        [EVENTANCHOR_FIELDS.CONTACTPROPERTYANCHOR]: new Field(
          eventAnchorElemID, EVENTANCHOR_FIELDS.CONTACTPROPERTYANCHOR, BuiltinTypes.STRING, {
            name: EVENTANCHOR_FIELDS.CONTACTPROPERTYANCHOR,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [EVENTANCHOR_FIELDS.STATICDATEANCHOR]: new Field(
          eventAnchorElemID, EVENTANCHOR_FIELDS.STATICDATEANCHOR,
          BuiltinTypes.STRING, {
            name: EVENTANCHOR_FIELDS.STATICDATEANCHOR,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
      },
      path: [HUBSPOT, TYPES_PATH, SUBTYPES_PATH, eventAnchorElemID.name],
    })

  private static anchorSettingType: ObjectType =
    new ObjectType({
      elemID: anchorSettingElemID,
      fields: {
        [ANCHOR_SETTING_FIELDS.EXECTIMEOFDAY]: new Field(
          anchorSettingElemID, ANCHOR_SETTING_FIELDS.EXECTIMEOFDAY, BuiltinTypes.STRING, {
            name: ANCHOR_SETTING_FIELDS.EXECTIMEOFDAY,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [ANCHOR_SETTING_FIELDS.EXECTIMEINMINUTES]: new Field(
          anchorSettingElemID, ANCHOR_SETTING_FIELDS.EXECTIMEINMINUTES, BuiltinTypes.NUMBER, {
            name: ANCHOR_SETTING_FIELDS.EXECTIMEINMINUTES,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [ANCHOR_SETTING_FIELDS.BOUNDARY]: new Field(
          anchorSettingElemID, ANCHOR_SETTING_FIELDS.BOUNDARY, BuiltinTypes.STRING, {
            name: ANCHOR_SETTING_FIELDS.BOUNDARY,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
      },
      path: [HUBSPOT, TYPES_PATH, SUBTYPES_PATH, anchorSettingElemID.name],
    })

  private static criteriaType: ObjectType =
    new ObjectType({
      elemID: criteriaElemID,
      fields: {
        [CRITERIA_FIELDS.FILTERFAMILY]: new Field(
          criteriaElemID, CRITERIA_FIELDS.FILTERFAMILY, BuiltinTypes.STRING, {
            name: CRITERIA_FIELDS.FILTERFAMILY,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [CRITERIA_FIELDS.OPERATOR]: new Field(
          criteriaElemID, CRITERIA_FIELDS.OPERATOR, BuiltinTypes.STRING, {
            name: CRITERIA_FIELDS.OPERATOR,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [CRITERIA_FIELDS.PROPERTY]: new Field(
          criteriaElemID, CRITERIA_FIELDS.PROPERTY, BuiltinTypes.STRING, {
            name: CRITERIA_FIELDS.PROPERTY,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [CRITERIA_FIELDS.PROPERTYOBJECTTYPE]: new Field(
          criteriaElemID, CRITERIA_FIELDS.PROPERTYOBJECTTYPE, BuiltinTypes.STRING, {
            name: CRITERIA_FIELDS.PROPERTYOBJECTTYPE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [CRITERIA_FIELDS.TYPE]: new Field(
          criteriaElemID, CRITERIA_FIELDS.TYPE, BuiltinTypes.STRING, {
            name: CRITERIA_FIELDS.TYPE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [CRITERIA_FIELDS.VALUE]: new Field(
          criteriaElemID, CRITERIA_FIELDS.VALUE, BuiltinTypes.STRING, {
            name: CRITERIA_FIELDS.VALUE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [CRITERIA_FIELDS.WITHINTIMEMODE]: new Field(
          criteriaElemID, CRITERIA_FIELDS.WITHINTIMEMODE, BuiltinTypes.STRING, {
            name: CRITERIA_FIELDS.WITHINTIMEMODE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
      },
      path: [HUBSPOT, TYPES_PATH, SUBTYPES_PATH, criteriaElemID.name],
    })

    // Create action type in steps cause of recursive fields
    private static createActionType = (): ObjectType => {
      const actionType = new ObjectType({
        elemID: actionElemID,
        fields: {
          [ACTION_FIELDS.TYPE]: new Field(
            actionElemID, ACTION_FIELDS.TYPE, BuiltinTypes.STRING, {
              name: ACTION_FIELDS.TYPE,
              _readOnly: false,
              [CORE_ANNOTATIONS.REQUIRED]: false,
            },
          ),
          [ACTION_FIELDS.ACTIONID]: new Field(
            actionElemID, ACTION_FIELDS.ACTIONID, BuiltinTypes.NUMBER, {
              name: ACTION_FIELDS.ACTIONID,
              _readOnly: true,
              [CORE_ANNOTATIONS.REQUIRED]: false,
              [CORE_ANNOTATIONS.HIDDEN]: true,
            },
          ),
          [ACTION_FIELDS.DELAYMILLS]: new Field(
            actionElemID, ACTION_FIELDS.DELAYMILLS, BuiltinTypes.NUMBER, {
              name: ACTION_FIELDS.DELAYMILLS,
              _readOnly: false,
              [CORE_ANNOTATIONS.REQUIRED]: false,
            },
          ),
          [ACTION_FIELDS.STEPID]: new Field(
            actionElemID, ACTION_FIELDS.STEPID, BuiltinTypes.NUMBER, {
              name: ACTION_FIELDS.STEPID,
              _readOnly: false,
              [CORE_ANNOTATIONS.REQUIRED]: false,
              [CORE_ANNOTATIONS.HIDDEN]: true,
            },
          ),
          [ACTION_FIELDS.ANCHORSETTING]: new Field(
            actionElemID, ACTION_FIELDS.ANCHORSETTING, Types.anchorSettingType, {
              name: ACTION_FIELDS.ANCHORSETTING,
              _readOnly: false,
              [CORE_ANNOTATIONS.REQUIRED]: false,
            },
          ),
          [ACTION_FIELDS.FILTERSLISTID]: new Field(
            actionElemID, ACTION_FIELDS.FILTERSLISTID, BuiltinTypes.NUMBER, {
              name: ACTION_FIELDS.FILTERSLISTID,
              _readOnly: false,
              [CORE_ANNOTATIONS.REQUIRED]: false,
              [CORE_ANNOTATIONS.HIDDEN]: true,
            },
          ),
          [ACTION_FIELDS.FILTERS]: new Field(
            actionElemID, ACTION_FIELDS.FILTERS, new ListType(new ListType(Types.criteriaType)), {
              name: ACTION_FIELDS.FILTERS,
              _readOnly: false,
              [CORE_ANNOTATIONS.REQUIRED]: false,
            },
          ),
          [ACTION_FIELDS.PROPERTYNAME]: new Field(
            actionElemID, ACTION_FIELDS.PROPERTYNAME, BuiltinTypes.STRING, {
              name: ACTION_FIELDS.PROPERTYNAME,
              _readOnly: false,
              [CORE_ANNOTATIONS.REQUIRED]: false,
            },
          ),
          [ACTION_FIELDS.BODY]: new Field(
            actionElemID, ACTION_FIELDS.BODY, BuiltinTypes.STRING, {
              name: ACTION_FIELDS.BODY,
              _readOnly: false,
              [CORE_ANNOTATIONS.REQUIRED]: false,
            },
          ),
          [ACTION_FIELDS.NEWVALUE]: new Field(
            actionElemID, ACTION_FIELDS.NEWVALUE, BuiltinTypes.STRING, {
              name: ACTION_FIELDS.NEWVALUE,
              _readOnly: false,
              [CORE_ANNOTATIONS.REQUIRED]: false,
            },
          ),
          [ACTION_FIELDS.STATICTO]: new Field(
            actionElemID, ACTION_FIELDS.STATICTO, BuiltinTypes.STRING, {
              name: ACTION_FIELDS.STATICTO,
              _readOnly: false,
              [CORE_ANNOTATIONS.REQUIRED]: false,
            },
          ),
        },
        path: [HUBSPOT, TYPES_PATH, SUBTYPES_PATH, actionElemID.name],
      })

      const acceptActionsField = new Field(
        actionElemID, ACTION_FIELDS.ACCEPTACTIONS, new ListType(actionType), {
          name: ACTION_FIELDS.ACCEPTACTIONS,
          _readOnly: false,
          [CORE_ANNOTATIONS.REQUIRED]: false,
        },
      )
      const rejectActionsField = new Field(
        actionElemID, ACTION_FIELDS.REJECTACTIONS, new ListType(actionType), {
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
        [NURTURETIMERANGE_FIELDS.ENABLED]: new Field(
          nurtureTimeRangeElemID, NURTURETIMERANGE_FIELDS.ENABLED, BuiltinTypes.BOOLEAN, {
            name: NURTURETIMERANGE_FIELDS.ENABLED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [NURTURETIMERANGE_FIELDS.STARTHOUR]: new Field(
          nurtureTimeRangeElemID, NURTURETIMERANGE_FIELDS.STARTHOUR, BuiltinTypes.NUMBER, {
            name: NURTURETIMERANGE_FIELDS.STARTHOUR,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [NURTURETIMERANGE_FIELDS.STOPHOUR]: new Field(
          nurtureTimeRangeElemID, NURTURETIMERANGE_FIELDS.STOPHOUR, BuiltinTypes.NUMBER, {
            name: NURTURETIMERANGE_FIELDS.STOPHOUR,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
      },
      path: [HUBSPOT, TYPES_PATH, SUBTYPES_PATH, nurtureTimeRangeElemID.name],
    })

  private static contactListIdsType: ObjectType =
    new ObjectType({
      elemID: contactListIdsElemID,
      fields: {
        [CONTACTLISTIDS_FIELDS.ENROLLED]: new Field(
          contactListIdsElemID, CONTACTLISTIDS_FIELDS.ENROLLED, BuiltinTypes.NUMBER, {
            name: CONTACTLISTIDS_FIELDS.ENROLLED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [CONTACTLISTIDS_FIELDS.ACTIVE]: new Field(
          contactListIdsElemID, CONTACTLISTIDS_FIELDS.ACTIVE, BuiltinTypes.NUMBER, {
            name: CONTACTLISTIDS_FIELDS.ACTIVE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [CONTACTLISTIDS_FIELDS.SUCCEEDED]: new Field(
          contactListIdsElemID, CONTACTLISTIDS_FIELDS.SUCCEEDED, BuiltinTypes.NUMBER, {
            name: CONTACTLISTIDS_FIELDS.SUCCEEDED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [CONTACTLISTIDS_FIELDS.COMPLETED]: new Field(
          contactListIdsElemID, CONTACTLISTIDS_FIELDS.COMPLETED, BuiltinTypes.NUMBER, {
            name: CONTACTLISTIDS_FIELDS.COMPLETED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
      },
      path: [HUBSPOT, TYPES_PATH, SUBTYPES_PATH, contactListIdsElemID.name],
    })

  private static rssToEmailTimingType: ObjectType =
    new ObjectType({
      elemID: rssToEmailTimingElemID,
      fields: {
        [RSSTOEMAILTIMING_FIELDS.REPEATS]: new Field(
          rssToEmailTimingElemID, RSSTOEMAILTIMING_FIELDS.REPEATS, BuiltinTypes.STRING, {
            name: RSSTOEMAILTIMING_FIELDS.REPEATS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
              values: ['instant', 'daily', 'weekly', 'monthly'],
            }),
          },
        ),
        [RSSTOEMAILTIMING_FIELDS.REPEATS_ON_MONTHLY]: new Field(
          rssToEmailTimingElemID, RSSTOEMAILTIMING_FIELDS.REPEATS_ON_MONTHLY, BuiltinTypes.NUMBER, {
            name: RSSTOEMAILTIMING_FIELDS.REPEATS_ON_MONTHLY,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [RSSTOEMAILTIMING_FIELDS.REPEATS_ON_WEEKLY]: new Field(
          rssToEmailTimingElemID, RSSTOEMAILTIMING_FIELDS.REPEATS_ON_WEEKLY, BuiltinTypes.NUMBER, {
            name: RSSTOEMAILTIMING_FIELDS.REPEATS_ON_WEEKLY,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [RSSTOEMAILTIMING_FIELDS.TIME]: new Field(
          rssToEmailTimingElemID, RSSTOEMAILTIMING_FIELDS.TIME, BuiltinTypes.STRING, {
            name: RSSTOEMAILTIMING_FIELDS.TIME,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
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
        [FORM_FIELDS.GUID]: new Field(
          formElemID, FORM_FIELDS.GUID, BuiltinTypes.STRING, {
            name: FORM_FIELDS.GUID,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.HIDDEN]: true,
          },
        ),
        [FORM_FIELDS.NAME]: new Field(
          formElemID, FORM_FIELDS.NAME, BuiltinTypes.STRING, {
            name: FORM_FIELDS.NAME,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: true,
          },
        ),
        [FORM_FIELDS.CSSCLASS]: new Field(
          formElemID, FORM_FIELDS.CSSCLASS, BuiltinTypes.STRING, {
            name: FORM_FIELDS.CSSCLASS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [FORM_FIELDS.REDIRECT]: new Field(
          formElemID, FORM_FIELDS.REDIRECT, BuiltinTypes.STRING, {
            name: FORM_FIELDS.REDIRECT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [FORM_FIELDS.SUBMITTEXT]: new Field(
          formElemID, FORM_FIELDS.SUBMITTEXT, BuiltinTypes.STRING, {
            name: FORM_FIELDS.SUBMITTEXT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [FORM_FIELDS.NOTIFYRECIPIENTS]: new Field(
          formElemID, FORM_FIELDS.NOTIFYRECIPIENTS,
          new ListType(Types.fieldTypes[FIELD_TYPES.USERIDENTIFIER]), {
            name: FORM_FIELDS.NOTIFYRECIPIENTS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [FORM_FIELDS.IGNORECURRENTVALUES]: new Field(
          formElemID, FORM_FIELDS.IGNORECURRENTVALUES, BuiltinTypes.BOOLEAN, {
            name: FORM_FIELDS.IGNORECURRENTVALUES,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [FORM_FIELDS.DELETABLE]: new Field(
          formElemID, FORM_FIELDS.DELETABLE, BuiltinTypes.BOOLEAN, {
            name: FORM_FIELDS.DELETABLE,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [FORM_FIELDS.INLINEMESSAGE]: new Field(
          formElemID, FORM_FIELDS.INLINEMESSAGE, BuiltinTypes.STRING, {
            name: FORM_FIELDS.INLINEMESSAGE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [FORM_FIELDS.FORMFIELDGROUPS]: new Field(
          formElemID, FORM_FIELDS.FORMFIELDGROUPS, new ListType(Types.propertyGroupType), {
            name: FORM_FIELDS.FORMFIELDGROUPS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [FORM_FIELDS.CAPTCHAENABLED]: new Field(
          formElemID, FORM_FIELDS.CAPTCHAENABLED, BuiltinTypes.BOOLEAN, {
            name: FORM_FIELDS.CAPTCHAENABLED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [FORM_FIELDS.CREATEDAT]: new Field(
          formElemID, FORM_FIELDS.CREATEDAT, BuiltinTypes.NUMBER, {
            name: FORM_FIELDS.CREATEDAT,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.HIDDEN]: true,
          },
        ),
        [FORM_FIELDS.CLONEABLE]: new Field(
          formElemID, FORM_FIELDS.CLONEABLE, BuiltinTypes.BOOLEAN, {
            name: FORM_FIELDS.CLONEABLE,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [FORM_FIELDS.STYLE]: new Field(
          formElemID, FORM_FIELDS.STYLE, BuiltinTypes.STRING, {
            name: FORM_FIELDS.STYLE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [FORM_FIELDS.EDITABLE]: new Field(
          formElemID, FORM_FIELDS.EDITABLE, BuiltinTypes.BOOLEAN, {
            name: FORM_FIELDS.EDITABLE,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [FORM_FIELDS.THEMENAME]: new Field(
          formElemID, FORM_FIELDS.THEMENAME, BuiltinTypes.STRING, {
            name: FORM_FIELDS.THEMENAME,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
      },
      path: [HUBSPOT, TYPES_PATH, formElemID.name],
    }),
    [OBJECTS_NAMES.WORKFLOWS]: new ObjectType({
      elemID: workflowsElemID,
      fields: {
        [WORKFLOWS_FIELDS.ID]: new Field(
          workflowsElemID, WORKFLOWS_FIELDS.ID, BuiltinTypes.NUMBER, {
            name: WORKFLOWS_FIELDS.ID,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.HIDDEN]: true,
          },
        ),
        [WORKFLOWS_FIELDS.NAME]: new Field(
          workflowsElemID, WORKFLOWS_FIELDS.NAME, BuiltinTypes.STRING, {
            name: WORKFLOWS_FIELDS.NAME,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: true,
          },
        ),
        [WORKFLOWS_FIELDS.SEGMENTCRITERIA]: new Field(
          workflowsElemID, WORKFLOWS_FIELDS.SEGMENTCRITERIA,
          new ListType(new ListType(Types.criteriaType)), {
            name: WORKFLOWS_FIELDS.SEGMENTCRITERIA,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [WORKFLOWS_FIELDS.GOALCRITERIA]: new Field(
          workflowsElemID, WORKFLOWS_FIELDS.GOALCRITERIA,
          new ListType(new ListType(Types.criteriaType)), {
            name: WORKFLOWS_FIELDS.GOALCRITERIA,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [WORKFLOWS_FIELDS.TYPE]: new Field(
          workflowsElemID, WORKFLOWS_FIELDS.TYPE, BuiltinTypes.STRING, {
            name: WORKFLOWS_FIELDS.TYPE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
              enforce_value: false,
              values: ['PROPERTY_ANCHOR', 'STATIC_ANCHOR', 'DRIP_DELAY'],
            }),
          },
        ),
        [WORKFLOWS_FIELDS.ENABLED]: new Field(
          workflowsElemID, WORKFLOWS_FIELDS.ENABLED, BuiltinTypes.BOOLEAN, {
            name: WORKFLOWS_FIELDS.ENABLED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [WORKFLOWS_FIELDS.INSERTEDAT]: new Field(
          workflowsElemID, WORKFLOWS_FIELDS.INSERTEDAT, BuiltinTypes.NUMBER, {
            name: WORKFLOWS_FIELDS.INSERTEDAT,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.HIDDEN]: true,
          },
        ),
        [WORKFLOWS_FIELDS.UPDATEDAT]: new Field(
          workflowsElemID, WORKFLOWS_FIELDS.UPDATEDAT, BuiltinTypes.NUMBER, {
            name: WORKFLOWS_FIELDS.UPDATEDAT,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.HIDDEN]: true,
          },
        ),
        [WORKFLOWS_FIELDS.CONTACTLISTIDS]: new Field(
          workflowsElemID, WORKFLOWS_FIELDS.CONTACTLISTIDS, Types.contactListIdsType, {
            name: WORKFLOWS_FIELDS.CONTACTLISTIDS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [WORKFLOWS_FIELDS.INTERNAL]: new Field(
          workflowsElemID, WORKFLOWS_FIELDS.INTERNAL, BuiltinTypes.BOOLEAN, {
            name: WORKFLOWS_FIELDS.INTERNAL,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [WORKFLOWS_FIELDS.ONLYEXECONBIZDAYS]: new Field(
          workflowsElemID, WORKFLOWS_FIELDS.ONLYEXECONBIZDAYS, BuiltinTypes.BOOLEAN, {
            name: WORKFLOWS_FIELDS.ONLYEXECONBIZDAYS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [WORKFLOWS_FIELDS.NURTURETIMERANGE]: new Field(
          workflowsElemID, WORKFLOWS_FIELDS.NURTURETIMERANGE, Types.nurtureTimeRangeType, {
            name: WORKFLOWS_FIELDS.NURTURETIMERANGE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [WORKFLOWS_FIELDS.ACTIONS]: new Field(
          workflowsElemID, WORKFLOWS_FIELDS.ACTIONS, new ListType(Types.actionType), {
            name: WORKFLOWS_FIELDS.ACTIONS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [WORKFLOWS_FIELDS.LISTENING]: new Field(
          workflowsElemID, WORKFLOWS_FIELDS.LISTENING, BuiltinTypes.BOOLEAN, {
            name: WORKFLOWS_FIELDS.LISTENING,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [WORKFLOWS_FIELDS.EVENTANCHOR]: new Field(
          workflowsElemID, WORKFLOWS_FIELDS.EVENTANCHOR, Types.eventAnchorType, {
            name: WORKFLOWS_FIELDS.EVENTANCHOR,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [WORKFLOWS_FIELDS.ALLOWCONTACTTOTRIGGERMULTIPLETIMES]: new Field(
          workflowsElemID, WORKFLOWS_FIELDS.ALLOWCONTACTTOTRIGGERMULTIPLETIMES,
          BuiltinTypes.BOOLEAN, {
            name: WORKFLOWS_FIELDS.ALLOWCONTACTTOTRIGGERMULTIPLETIMES,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [WORKFLOWS_FIELDS.ONLYENROLLMANUALLY]: new Field(
          workflowsElemID, WORKFLOWS_FIELDS.ONLYENROLLMANUALLY, BuiltinTypes.BOOLEAN, {
            name: WORKFLOWS_FIELDS.ONLYENROLLMANUALLY,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [WORKFLOWS_FIELDS.ENROLLONCRITERIAUPDATE]: new Field(
          workflowsElemID, WORKFLOWS_FIELDS.ENROLLONCRITERIAUPDATE, BuiltinTypes.BOOLEAN, {
            name: WORKFLOWS_FIELDS.ENROLLONCRITERIAUPDATE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [WORKFLOWS_FIELDS.SUPRESSIONLISTIDS]: new Field(
          workflowsElemID, WORKFLOWS_FIELDS.SUPRESSIONLISTIDS, new ListType(BuiltinTypes.NUMBER), {
            name: WORKFLOWS_FIELDS.SUPRESSIONLISTIDS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
      },
      path: [HUBSPOT, TYPES_PATH, workflowsElemID.name],
    }),
    [OBJECTS_NAMES.MARKETINGEMAIL]: new ObjectType({
      elemID: marketingEmailElemID,
      fields: {
        [MARKETING_EMAIL_FIELDS.AB]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.AB, BuiltinTypes.BOOLEAN, {
            name: MARKETING_EMAIL_FIELDS.AB,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.ABHOURSWAIT]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.ABHOURSWAIT, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.ABHOURSWAIT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.ABVARIATION]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.ABVARIATION, BuiltinTypes.BOOLEAN, {
            name: MARKETING_EMAIL_FIELDS.ABVARIATION,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.ABSAMPLESIZEDEFAULT]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.ABSAMPLESIZEDEFAULT, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.ABSAMPLESIZEDEFAULT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ values: ['master', 'variant'] }),
          }
        ),
        [MARKETING_EMAIL_FIELDS.ABSAMPLINGDEFAULT]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.ABSAMPLINGDEFAULT, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.ABSAMPLINGDEFAULT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ values: ['master', 'variant'] }),
          }
        ),
        [MARKETING_EMAIL_FIELDS.ABSTATUS]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.ABSTATUS, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.ABSTATUS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ values: ['master', 'variant'] }),
          }
        ),
        [MARKETING_EMAIL_FIELDS.ABSUCCESSMETRIC]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.ABSUCCESSMETRIC, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.ABSUCCESSMETRIC,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
              values: ['CLICKS_BY_OPENS', 'CLICKS_BY_DELIVERED', 'OPENS_BY_DELIVERED'],
            }),
          }
        ),
        [MARKETING_EMAIL_FIELDS.ABTESTID]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.ABTESTID, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.ABTESTID,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.ABTESTPERCENTAGE]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.ABTESTPERCENTAGE, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.ABTESTPERCENTAGE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.ABSOLUTEURL]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.ABSOLUTEURL, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.ABSOLUTEURL,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.ALLEMAILCAMPAIGNIDS]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.ALLEMAILCAMPAIGNIDS,
          new ListType(BuiltinTypes.NUMBER), {
            name: MARKETING_EMAIL_FIELDS.ALLEMAILCAMPAIGNIDS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [MARKETING_EMAIL_FIELDS.ANALYTICSPAGEID]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.ANALYTICSPAGEID, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.ANALYTICSPAGEID,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.ARCHIVED]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.ARCHIVED, BuiltinTypes.BOOLEAN, {
            name: MARKETING_EMAIL_FIELDS.ARCHIVED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.AUTHOR]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.AUTHOR, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.AUTHOR,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.AUTHORAT]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.AUTHORAT, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.AUTHORAT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.HIDDEN]: true,
          }
        ),
        [MARKETING_EMAIL_FIELDS.AUTHOREMAIL]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.AUTHOREMAIL, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.AUTHOREMAIL,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.HIDDEN]: true,
          }
        ),
        [MARKETING_EMAIL_FIELDS.AUTHORNAME]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.AUTHORNAME, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.AUTHORNAME,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.HIDDEN]: true,
          }
        ),
        [MARKETING_EMAIL_FIELDS.AUTHORUSERID]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.AUTHORUSERID, BuiltinTypes.Number, {
            name: MARKETING_EMAIL_FIELDS.AUTHORUSERID,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.HIDDEN]: true,
          }
        ),
        [MARKETING_EMAIL_FIELDS.BLOGEMAILTYPE]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.BLOGEMAILTYPE, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.BLOGEMAILTYPE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
              values: ['instant', 'daily', 'weekly', 'monthly'],
            }),
          }
        ),
        [MARKETING_EMAIL_FIELDS.BLOGRSSSETTINGS]: new Field(
          // TODO: Format this the right way
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.BLOGRSSSETTINGS, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.BLOGRSSSETTINGS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.CAMPAIGN]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.CAMPAIGN, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.CAMPAIGN,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.CAMPAIGNNAME]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.CAMPAIGNNAME, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.CAMPAIGNNAME,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.CANSPAMSETTINGSID]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.CANSPAMSETTINGSID, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.CANSPAMSETTINGSID,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.CLONEDFROM]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.CLONEDFROM, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.CLONEDFROM,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.CREATEPAGE]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.CREATEPAGE, BuiltinTypes.BOOLEAN, {
            name: MARKETING_EMAIL_FIELDS.CREATEPAGE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.CREATED]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.CREATED, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.CREATED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.HIDDEN]: true,
          }
        ),
        [MARKETING_EMAIL_FIELDS.CURRENTLYPUBLISHED]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.CURRENTLYPUBLISHED, BuiltinTypes.BOOLEAN, {
            name: MARKETING_EMAIL_FIELDS.CURRENTLYPUBLISHED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: true,
          }
        ),
        [MARKETING_EMAIL_FIELDS.DOMAIN]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.DOMAIN, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.DOMAIN,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.EMAILBODY]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.EMAILBODY, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.EMAILBODY,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: true,
          }
        ),
        [MARKETING_EMAIL_FIELDS.EMAILNOTE]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.EMAILNOTE, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.EMAILNOTE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.EMAILTYPE]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.EMAILTYPE, BuiltinTypes.STRING, {
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
          }
        ),
        [MARKETING_EMAIL_FIELDS.FEEDBACKEMAILCATEGORY]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.FEEDBACKEMAILCATEGORY, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.FEEDBACKEMAILCATEGORY,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
              enforce_value: false,
              values: ['NPS', 'CES', 'CUSTOM'],
            }),
          }
        ),
        [MARKETING_EMAIL_FIELDS.FEEDBACKSURVEYID]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.FEEDBACKSURVEYID, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.FEEDBACKSURVEYID,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.FLEXAREAS]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.FLEXAREAS, BuiltinTypes.JSON, {
            name: MARKETING_EMAIL_FIELDS.FLEXAREAS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.FOLDERID]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.FOLDERID, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.FOLDERID,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.FREEZEDATE]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.FREEZEDATE, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.FREEZEDATE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.HIDDEN]: true,
          }
        ),
        [MARKETING_EMAIL_FIELDS.FROMNAME]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.FROMNAME, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.FROMNAME,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.HTMLTITLE]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.HTMLTITLE, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.HTMLTITLE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.ID]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.ID, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.ID,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.HIDDEN]: true,
          }
        ),
        [MARKETING_EMAIL_FIELDS.ISGRAYMAILSUPPRESSIONENABLED]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.ISGRAYMAILSUPPRESSIONENABLED,
          BuiltinTypes.BOOLEAN, {
            name: MARKETING_EMAIL_FIELDS.ISGRAYMAILSUPPRESSIONENABLED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.ISLOCALTIMEZONESEND]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.ISLOCALTIMEZONESEND, BuiltinTypes.BOOLEAN, {
            name: MARKETING_EMAIL_FIELDS.ISLOCALTIMEZONESEND,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.ISPUBLISHED]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.ISPUBLISHED, BuiltinTypes.BOOLEAN, {
            name: MARKETING_EMAIL_FIELDS.ISPUBLISHED,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.ISRECIPIENTFATIGUESUPPRESSIONENABLED]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.ISRECIPIENTFATIGUESUPPRESSIONENABLED,
          BuiltinTypes.BOOLEAN, {
            name: MARKETING_EMAIL_FIELDS.ISRECIPIENTFATIGUESUPPRESSIONENABLED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.LEADFLOWID]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.LEADFLOWID, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.LEADFLOWID,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.LIVEDOMAIN]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.LIVEDOMAIN, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.LIVEDOMAIN,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.MAILINGLISTSEXCLUDED]: new Field(
          // TODO: Convert this to reference
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.MAILINGLISTSEXCLUDED,
          new ListType(BuiltinTypes.NUMBER), {
            name: MARKETING_EMAIL_FIELDS.MAILINGLISTSEXCLUDED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [MARKETING_EMAIL_FIELDS.MAILINGLISTSINCLUDED]: new Field(
          // TODO: Convert this to reference
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.MAILINGLISTSINCLUDED,
          new ListType(BuiltinTypes.NUMBER), {
            name: MARKETING_EMAIL_FIELDS.MAILINGLISTSINCLUDED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [MARKETING_EMAIL_FIELDS.MAXRSSENTRIES]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.MAXRSSENTRIES, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.MAXRSSENTRIES,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.METADESCRIPTION]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.METADESCRIPTION, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.METADESCRIPTION,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.NAME]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.NAME, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.NAME,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.PAGEEXPIRYDATE]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.PAGEEXPIRYDATE, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.PAGEEXPIRYDATE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.HIDDEN]: true,
          }
        ),
        [MARKETING_EMAIL_FIELDS.PAGEEXPIRYREDIRECTEID]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.PAGEEXPIRYREDIRECTEID, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.PAGEEXPIRYREDIRECTEID,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.HIDDEN]: true,
          }
        ),
        [MARKETING_EMAIL_FIELDS.PAGEREDIRECTED]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.PAGEREDIRECTED, BuiltinTypes.BOOLEAN, {
            name: MARKETING_EMAIL_FIELDS.PAGEREDIRECTED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.PREVIEWKEY]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.PREVIEWKEY, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.PREVIEWKEY,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.PROCESSINGSTATUS]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.PROCESSINGSTATUS, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.PROCESSINGSTATUS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
              enforce_value: false,
              values: ['UNDEFINED', 'PUBLISHED', 'PUBLISHED_OR_SCHEDULED', 'SCHEDULED', 'PROCESSING',
                'PRE_PROCESSING', 'ERROR', 'CANCELED_FORCIBLY', 'CANCELED_ABUSE'],
            }),
          }
        ),
        [MARKETING_EMAIL_FIELDS.PUBLISHDATE]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.PUBLISHDATE, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.PUBLISHDATE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.HIDDEN]: true,
          }
        ),
        [MARKETING_EMAIL_FIELDS.PUBLISHEDAT]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.PUBLISHEDAT, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.PUBLISHEDAT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.HIDDEN]: true,
          }
        ),
        [MARKETING_EMAIL_FIELDS.PUBLISHEDBYID]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.PUBLISHEDBYID, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.PUBLISHEDBYID,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.HIDDEN]: true,
          }
        ),
        [MARKETING_EMAIL_FIELDS.PUBLISHEDBYNAME]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.PUBLISHEDBYNAME, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.PUBLISHEDBYNAME,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.HIDDEN]: true,
          }
        ),
        [MARKETING_EMAIL_FIELDS.PUBLISHIMMEDIATELY]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.PUBLISHIMMEDIATELY, BuiltinTypes.BOOLEAN, {
            name: MARKETING_EMAIL_FIELDS.PUBLISHIMMEDIATELY,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.PUBLISHEDURL]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.PUBLISHEDURL, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.PUBLISHEDURL,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.REPLYTO]: new Field(
          // TODO: Decide if to enforce link to fromName?
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.REPLYTO, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.REPLYTO,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.RESOLVEDDOMAIN]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.RESOLVEDDOMAIN, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.RESOLVEDDOMAIN,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.RSSEMAILAUTHORLINETEMPLATE]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.RSSEMAILAUTHORLINETEMPLATE,
          BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.RSSEMAILAUTHORLINETEMPLATE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.RSSEMAILBLOGIMAGEMAXWIDTH]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.RSSEMAILBLOGIMAGEMAXWIDTH,
          BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.RSSEMAILBLOGIMAGEMAXWIDTH,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.RSSEMAILBYTEXT]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.RSSEMAILBYTEXT, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.RSSEMAILBYTEXT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.RSSEMAILCLICKTHROUGHTEXT]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.RSSEMAILCLICKTHROUGHTEXT,
          BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.RSSEMAILCLICKTHROUGHTEXT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.RSSEMAILCOMMENTTEXT]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.RSSEMAILCOMMENTTEXT, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.RSSEMAILCOMMENTTEXT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.RSSEMAILENTRYTEMPLATE]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.RSSEMAILENTRYTEMPLATE,
          BuiltinTypes.BOOLEAN, {
            name: MARKETING_EMAIL_FIELDS.RSSEMAILENTRYTEMPLATE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.RSSEMAILENTRYTEMPLATEENABLED]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.RSSEMAILENTRYTEMPLATEENABLED,
          BuiltinTypes.BOOLEAN, {
            name: MARKETING_EMAIL_FIELDS.RSSEMAILENTRYTEMPLATEENABLED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.RSSEMAILURL]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.RSSEMAILURL, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.RSSEMAILURL,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.RSSTOEMAILTIMING]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.RSSTOEMAILTIMING,
          Types.rssToEmailTimingType, {
            name: MARKETING_EMAIL_FIELDS.RSSTOEMAILTIMING,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.SLUG]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.SLUG, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.SLUG,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.SMARTEMAILFIELDS]: new Field(
        // TODO: Understand this and convert to a list of smart fields
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.SMARTEMAILFIELDS, BuiltinTypes.JSON, {
            name: MARKETING_EMAIL_FIELDS.SMARTEMAILFIELDS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.STYLESETTINGS]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.STYLESETTINGS, BuiltinTypes.JSON, {
            name: MARKETING_EMAIL_FIELDS.STYLESETTINGS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.SUBCATEGORY]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.SUBCATEGORY, BuiltinTypes.STRING, {
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
          }
        ),
        [MARKETING_EMAIL_FIELDS.SUBJECT]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.SUBJECT, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.SUBJECT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.SUBSCRIPTION]: new Field(
          // TODO: Check what email subscription type is
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.SUBSCRIPTION, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.SUBSCRIPTION,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.SUBSCRIPTIONBLOGID]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.SUBSCRIPTIONBLOGID, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.SUBSCRIPTIONBLOGID,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.SUBSCRIPTIONNAME]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.SUBSCRIPTIONNAME, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.SUBSCRIPTIONNAME,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.TEMPLATEPATH]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.TEMPLATEPATH, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.TEMPLATEPATH,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.TRANSACTIONAL]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.TRANSACTIONAL, BuiltinTypes.BOOLEAN, {
            name: MARKETING_EMAIL_FIELDS.TRANSACTIONAL,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.UNPUBLISHEDAT]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.UNPUBLISHEDAT, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.UNPUBLISHEDAT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.HIDDEN]: true,
          }
        ),
        [MARKETING_EMAIL_FIELDS.UPDATED]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.UPDATED, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.UPDATED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.HIDDEN]: true,
          }
        ),
        [MARKETING_EMAIL_FIELDS.UPDATEDBYID]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.UPDATEDBYID,
          Types.fieldTypes[FIELD_TYPES.USERIDENTIFIER], {
            name: MARKETING_EMAIL_FIELDS.UPDATEDBYID,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.HIDDEN]: true,
          }
        ),
        [MARKETING_EMAIL_FIELDS.URL]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.URL, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.URL,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.USERSSHEADLINEASSUBJECT]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.USERSSHEADLINEASSUBJECT,
          BuiltinTypes.BOOLEAN, {
            name: MARKETING_EMAIL_FIELDS.USERSSHEADLINEASSUBJECT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.VIDSEXCLUDED]: new Field(
          // TODO: No contact instances (maybe convert to email)
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.VIDSEXCLUDED,
          new ListType(BuiltinTypes.NUMBER), {
            name: MARKETING_EMAIL_FIELDS.VIDSEXCLUDED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [MARKETING_EMAIL_FIELDS.VIDSINCLUDED]: new Field(
          // TODO: No contact instances (maybe convert to email)
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.VIDSINCLUDED,
          new ListType(BuiltinTypes.NUMBER), {
            name: MARKETING_EMAIL_FIELDS.VIDSINCLUDED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [MARKETING_EMAIL_FIELDS.WIDGETS]: new Field(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.WIDGETS, BuiltinTypes.JSON, {
            name: MARKETING_EMAIL_FIELDS.WIDGETS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.WORKFLOWNAMES]: new Field( // TODO: Convert to reference
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.WORKFLOWNAMES,
          new ListType(BuiltinTypes.STRING), {
            name: MARKETING_EMAIL_FIELDS.WORKFLOWNAMES,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
      },
      path: [HUBSPOT, TYPES_PATH, marketingEmailElemID.name],
    }),
    [OBJECTS_NAMES.CONTACT_PROPERTY]: new ObjectType({
      elemID: contactPropertyElemID,
      fields: {
        [CONTACT_PROPERTY_FIELDS.NAME]: new Field(
          contactPropertyElemID, CONTACT_PROPERTY_FIELDS.NAME, BuiltinTypes.STRING, {
            name: CONTACT_PROPERTY_FIELDS.NAME,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: true,
          },
        ),
        [CONTACT_PROPERTY_FIELDS.LABEL]: new Field(
          contactPropertyElemID, CONTACT_PROPERTY_FIELDS.LABEL, BuiltinTypes.STRING, {
            name: CONTACT_PROPERTY_FIELDS.LABEL,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [CONTACT_PROPERTY_FIELDS.DESCRIPTION]: new Field(
          contactPropertyElemID, CONTACT_PROPERTY_FIELDS.DESCRIPTION, BuiltinTypes.STRING, {
            name: CONTACT_PROPERTY_FIELDS.DESCRIPTION,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [CONTACT_PROPERTY_FIELDS.GROUPNAME]: new Field(
          contactPropertyElemID, CONTACT_PROPERTY_FIELDS.GROUPNAME, BuiltinTypes.STRING, {
            name: CONTACT_PROPERTY_FIELDS.GROUPNAME,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: true,
          },
        ),
        [CONTACT_PROPERTY_FIELDS.TYPE]: new Field(
          contactPropertyElemID, CONTACT_PROPERTY_FIELDS.TYPE, BuiltinTypes.STRING, {
            name: CONTACT_PROPERTY_FIELDS.TYPE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: true,
            [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
              values: contactPropertyTypeValues,
            }),
          },
        ),
        [CONTACT_PROPERTY_FIELDS.FIELDTYPE]: new Field(
          contactPropertyElemID, CONTACT_PROPERTY_FIELDS.FIELDTYPE, BuiltinTypes.STRING, {
            name: CONTACT_PROPERTY_FIELDS.FIELDTYPE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: true,
            [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
              values: contactPropertyFieldTypeValues,
            }),
          },
        ),
        [CONTACT_PROPERTY_FIELDS.OPTIONS]: new Field(
          contactPropertyElemID, CONTACT_PROPERTY_FIELDS.OPTIONS, new ListType(Types.optionsType), {
            name: CONTACT_PROPERTY_FIELDS.OPTIONS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [CONTACT_PROPERTY_FIELDS.DELETED]: new Field(
          contactPropertyElemID, CONTACT_PROPERTY_FIELDS.DELETED, BuiltinTypes.BOOLEAN, {
            name: CONTACT_PROPERTY_FIELDS.DELETED,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [CONTACT_PROPERTY_FIELDS.FORMFIELD]: new Field(
          contactPropertyElemID, CONTACT_PROPERTY_FIELDS.FORMFIELD, BuiltinTypes.BOOLEAN, {
            name: CONTACT_PROPERTY_FIELDS.FORMFIELD,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: true,
          },
        ),
        [CONTACT_PROPERTY_FIELDS.DISPLAYORDER]: new Field(
          contactPropertyElemID, CONTACT_PROPERTY_FIELDS.DISPLAYORDER, BuiltinTypes.NUMBER, {
            name: CONTACT_PROPERTY_FIELDS.DISPLAYORDER,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.DEFAULT]: -1,
          },
        ),
        [CONTACT_PROPERTY_FIELDS.READONLYVALUE]: new Field(
          contactPropertyElemID, CONTACT_PROPERTY_FIELDS.READONLYVALUE, BuiltinTypes.BOOLEAN, {
            name: CONTACT_PROPERTY_FIELDS.READONLYVALUE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.DEFAULT]: false,
          },
        ),
        [CONTACT_PROPERTY_FIELDS.READONLYDEFINITION]: new Field(
          contactPropertyElemID, CONTACT_PROPERTY_FIELDS.READONLYDEFINITION, BuiltinTypes.BOOLEAN, {
            name: CONTACT_PROPERTY_FIELDS.READONLYDEFINITION,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.DEFAULT]: false,
          },
        ),
        [CONTACT_PROPERTY_FIELDS.HIDDEN]: new Field(
          contactPropertyElemID, CONTACT_PROPERTY_FIELDS.HIDDEN, BuiltinTypes.BOOLEAN, {
            name: CONTACT_PROPERTY_FIELDS.HIDDEN,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.DEFAULT]: false,
          },
        ),
        [CONTACT_PROPERTY_FIELDS.MUTABLEDEFINITIONNOTDELETABLE]: new Field(
          contactPropertyElemID, CONTACT_PROPERTY_FIELDS.MUTABLEDEFINITIONNOTDELETABLE,
          BuiltinTypes.BOOLEAN, {
            name: CONTACT_PROPERTY_FIELDS.MUTABLEDEFINITIONNOTDELETABLE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.DEFAULT]: false,
          },
        ),
        [CONTACT_PROPERTY_FIELDS.CALCULATED]: new Field(
          contactPropertyElemID, CONTACT_PROPERTY_FIELDS.CALCULATED, BuiltinTypes.BOOLEAN, {
            name: CONTACT_PROPERTY_FIELDS.CALCULATED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [CONTACT_PROPERTY_FIELDS.CREATEDAT]: new Field(
          contactPropertyElemID, CONTACT_PROPERTY_FIELDS.CREATEDAT, BuiltinTypes.NUMBER, {
            name: CONTACT_PROPERTY_FIELDS.CREATEDAT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.HIDDEN]: true,
          },
        ),
        [CONTACT_PROPERTY_FIELDS.EXTERNALOPTIONS]: new Field(
          contactPropertyElemID, CONTACT_PROPERTY_FIELDS.EXTERNALOPTIONS, BuiltinTypes.BOOLEAN, {
            name: CONTACT_PROPERTY_FIELDS.EXTERNALOPTIONS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.DEFAULT]: false,
          },
        ),
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

export const transformPrimitive: TransformFunc = ({ value, field }) => {
  const fieldType = field?.type
  if (!isPrimitiveType(fieldType) || !isPrimitiveValue(value)) {
    return value
  }
  // remove values that are just an empty string or null
  if (value === '' || value === null) {
    return undefined
  }
  if (fieldType.isEqual(BuiltinTypes.JSON)) {
    return JSON.stringify(value)
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

export const createHubspotMetadataFromInstanceElement = (element: Readonly<InstanceElement>):
  HubspotMetadata =>
  (_.mapValues(element.value, (val, key) => {
    const fieldType = element.type.fields[key]?.type
    if (isPrimitiveType(fieldType) && fieldType.isEqual(BuiltinTypes.JSON)) {
      return JSON.parse(val)
    }
    if (isFormInstance(element) && key === FORM_FIELDS.FORMFIELDGROUPS) {
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
    return val
  }) as HubspotMetadata)

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
