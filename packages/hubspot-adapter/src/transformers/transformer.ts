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
import _ from 'lodash'
import {
  ElemID, ObjectType, PrimitiveType, PrimitiveTypes, Field as TypeField,
  BuiltinTypes, InstanceElement, TypeElement, CORE_ANNOTATIONS, transform,
  TypeMap, Values, TransformValueFunc, isPrimitiveType, bpCase, Value,
} from '@salto-io/adapter-api'
import { isFormInstance } from '../filters/form_field'
import {
  FIELD_TYPES, FORM_FIELDS, HUBSPOT, OBJECTS_NAMES, FORM_PROPERTY_FIELDS,
  NURTURETIMERANGE_FIELDS, CONDITIONACTION_FIELDS, ANCHOR_SETTING_FIELDS,
  EVENTANCHOR_FIELDS, ACTION_FIELDS, FORM_PROPERTY_GROUP_FIELDS, OPTIONS_FIELDS,
  CONTACT_PROPERTY_FIELDS, CONTACTLISTIDS_FIELDS, RSSTOEMAILTIMING_FIELDS,
  DEPENDENT_FIELD_FILTER_FIELDS, FIELD_FILTER_FIELDS, WORKFLOWS_FIELDS,
  MARKETING_EMAIL_FIELDS, RICHTEXT_FIELDS, formElemID, workflowsElemID,
  propertyGroupElemID, propertyElemID, dependeeFormPropertyElemID, optionsElemID,
  contactListIdsElemID, marketingEmailElemID, rssToEmailTimingElemID,
  nurtureTimeRangeElemID, anchorSettingElemID, actionElemID, eventAnchorElemID,
  conditionActionElemID, contactPropertyElemID, dependentFormFieldFiltersElemID,
  fieldFilterElemID, richTextElemID, contactPropertyTypeValues, contactPropertyFieldTypeValues,
  CONTACT_PROPERTY_OVERRIDES_FIELDS, contactPropertyOverridesElemID, FORM_PROPERTY_INNER_FIELDS,
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
  }

  private static optionsType: ObjectType =
    new ObjectType({
      elemID: optionsElemID,
      fields: {
        [OPTIONS_FIELDS.LABEL]: new TypeField(
          optionsElemID, OPTIONS_FIELDS.LABEL, BuiltinTypes.STRING, {
            name: OPTIONS_FIELDS.LABEL,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [OPTIONS_FIELDS.VALUE]: new TypeField(
          optionsElemID, OPTIONS_FIELDS.VALUE, BuiltinTypes.STRING, {
            name: OPTIONS_FIELDS.VALUE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [OPTIONS_FIELDS.READONLY]: new TypeField(
          optionsElemID, OPTIONS_FIELDS.READONLY, BuiltinTypes.BOOLEAN, {
            name: OPTIONS_FIELDS.READONLY,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [OPTIONS_FIELDS.DISPLAYORDER]: new TypeField(
          optionsElemID, OPTIONS_FIELDS.DISPLAYORDER, BuiltinTypes.NUMBER, {
            name: OPTIONS_FIELDS.DISPLAYORDER,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [OPTIONS_FIELDS.HIDDEN]: new TypeField(
          optionsElemID, OPTIONS_FIELDS.HIDDEN, BuiltinTypes.BOOLEAN, {
            name: OPTIONS_FIELDS.HIDDEN,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [OPTIONS_FIELDS.DESCRIPTION]: new TypeField(
          optionsElemID, OPTIONS_FIELDS.DESCRIPTION, BuiltinTypes.STRING, {
            name: OPTIONS_FIELDS.DESCRIPTION,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
      },
      path: [HUBSPOT, 'types', 'subtypes', optionsElemID.name],
    })

  private static fieldFilterType: ObjectType =
    new ObjectType({
      elemID: fieldFilterElemID,
      fields: {
        [FIELD_FILTER_FIELDS.OPERATOR]: new TypeField(
          fieldFilterElemID, FIELD_FILTER_FIELDS.OPERATOR, BuiltinTypes.STRING, {
            name: FIELD_FILTER_FIELDS.OPERATOR,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: true,
            // TODO: Find the values
          },
        ),
        [FIELD_FILTER_FIELDS.STRVALUE]: new TypeField(
          fieldFilterElemID, FIELD_FILTER_FIELDS.STRVALUE, BuiltinTypes.STRING, {
            name: FIELD_FILTER_FIELDS.STRVALUE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [FIELD_FILTER_FIELDS.STRVALUES]: new TypeField(
          fieldFilterElemID, FIELD_FILTER_FIELDS.STRVALUES, BuiltinTypes.STRING, {
            name: FIELD_FILTER_FIELDS.STRVALUES,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
          true,
        ),
        [FIELD_FILTER_FIELDS.BOOLVALUE]: new TypeField(
          fieldFilterElemID, FIELD_FILTER_FIELDS.BOOLVALUE, BuiltinTypes.BOOLEAN, {
            name: FIELD_FILTER_FIELDS.BOOLVALUE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [FIELD_FILTER_FIELDS.NUMBERVALUE]: new TypeField(
          fieldFilterElemID, FIELD_FILTER_FIELDS.NUMBERVALUE, BuiltinTypes.NUMBER, {
            name: FIELD_FILTER_FIELDS.NUMBERVALUE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [FIELD_FILTER_FIELDS.NUMVALUES]: new TypeField(
          fieldFilterElemID, FIELD_FILTER_FIELDS.NUMVALUES, BuiltinTypes.NUMBER, {
            name: FIELD_FILTER_FIELDS.NUMVALUES,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
          true,
        ),
      },
      path: [HUBSPOT, 'types', 'subtypes', fieldFilterElemID.name],
    })

    private static contactPropertyOverridesType: ObjectType =
      new ObjectType({
        elemID: contactPropertyOverridesElemID,
        fields: {
          [CONTACT_PROPERTY_OVERRIDES_FIELDS.LABEL]: new TypeField(
            contactPropertyOverridesElemID, CONTACT_PROPERTY_OVERRIDES_FIELDS.LABEL,
            BuiltinTypes.STRING, {
              name: CONTACT_PROPERTY_OVERRIDES_FIELDS.LABEL,
              _readOnly: false,
              [CORE_ANNOTATIONS.REQUIRED]: false,
            },
          ),
          [CONTACT_PROPERTY_OVERRIDES_FIELDS.DISPLAYORDER]: new TypeField(
            contactPropertyOverridesElemID, CONTACT_PROPERTY_OVERRIDES_FIELDS.DISPLAYORDER,
            BuiltinTypes.NUMBER,
            {
              name: CONTACT_PROPERTY_OVERRIDES_FIELDS.DISPLAYORDER,
              _readOnly: false,
              [CORE_ANNOTATIONS.REQUIRED]: false,
            },
          ),
          [CONTACT_PROPERTY_OVERRIDES_FIELDS.DESCRIPTION]: new TypeField(
            contactPropertyOverridesElemID, CONTACT_PROPERTY_OVERRIDES_FIELDS.DESCRIPTION,
            BuiltinTypes.STRING, {
              name: CONTACT_PROPERTY_OVERRIDES_FIELDS.DESCRIPTION,
              _readOnly: false,
              [CORE_ANNOTATIONS.REQUIRED]: false,
            }
          ),
          [CONTACT_PROPERTY_OVERRIDES_FIELDS.OPTIONS]: new TypeField(
            contactPropertyOverridesElemID, CONTACT_PROPERTY_OVERRIDES_FIELDS.OPTIONS,
            Types.optionsType, {
              name: CONTACT_PROPERTY_OVERRIDES_FIELDS.OPTIONS,
              _readOnly: false,
              [CORE_ANNOTATIONS.REQUIRED]: false,
            },
            true,
          ),
        },
        path: [HUBSPOT, 'types', 'subtypes', contactPropertyOverridesElemID.name],
      })

    static createFormFieldType = (
      elemID: ElemID,
      isFatherProperty: boolean
    ): ObjectType => {
      const formPropertyType = new ObjectType({
        elemID,
        fields: {
          [FORM_PROPERTY_INNER_FIELDS.CONTACT_PROPERTY]: new TypeField(
            // TODO: This is not really a string
            elemID, FORM_PROPERTY_INNER_FIELDS.CONTACT_PROPERTY, BuiltinTypes.STRING, {
              name: FORM_PROPERTY_INNER_FIELDS.CONTACT_PROPERTY,
              _readOnly: false,
              [CORE_ANNOTATIONS.REQUIRED]: true,
            }
          ),
          [FORM_PROPERTY_INNER_FIELDS.CONTACT_PROPERTY_OVERRIDES]: new TypeField(
            elemID, FORM_PROPERTY_INNER_FIELDS.CONTACT_PROPERTY_OVERRIDES,
            Types.contactPropertyOverridesType, {
              name: FORM_PROPERTY_INNER_FIELDS.CONTACT_PROPERTY_OVERRIDES,
              _readOnly: false,
              [CORE_ANNOTATIONS.REQUIRED]: false,
            },
          ),
          [FORM_PROPERTY_FIELDS.DEFAULTVALUE]: new TypeField(
            elemID, FORM_PROPERTY_FIELDS.DEFAULTVALUE, BuiltinTypes.STRING, {
              name: FORM_PROPERTY_FIELDS.DEFAULTVALUE,
              _readOnly: false,
              [CORE_ANNOTATIONS.REQUIRED]: false,
            },
          ),
          [FORM_PROPERTY_FIELDS.PLACEHOLDER]: new TypeField(
            elemID, FORM_PROPERTY_FIELDS.PLACEHOLDER, BuiltinTypes.STRING, {
              name: FORM_PROPERTY_FIELDS.PLACEHOLDER,
              _readOnly: false,
              [CORE_ANNOTATIONS.REQUIRED]: false,
            },
          ),
          [FORM_PROPERTY_FIELDS.REQUIRED]: new TypeField(
            elemID, FORM_PROPERTY_FIELDS.REQUIRED, BuiltinTypes.BOOLEAN, {
              name: FORM_PROPERTY_FIELDS.REQUIRED,
              _readOnly: false,
              [CORE_ANNOTATIONS.REQUIRED]: false,
            }
          ),
          [FORM_PROPERTY_FIELDS.SELECTEDOPTIONS]: new TypeField(
            elemID, FORM_PROPERTY_FIELDS.SELECTEDOPTIONS, BuiltinTypes.STRING, {
              name: FORM_PROPERTY_FIELDS.SELECTEDOPTIONS,
              _readOnly: false,
              [CORE_ANNOTATIONS.REQUIRED]: false,
            },
            true,
          ),
          [FORM_PROPERTY_FIELDS.ISSMARTFIELD]: new TypeField(
            elemID, FORM_PROPERTY_FIELDS.ISSMARTFIELD, BuiltinTypes.BOOLEAN, {
              name: FORM_PROPERTY_FIELDS.ISSMARTFIELD,
              _readOnly: false,
              [CORE_ANNOTATIONS.REQUIRED]: false,
            },
          ),
        },
        path: [HUBSPOT, 'types', 'subtypes', elemID.name],
      })
      if (isFatherProperty) {
        Object.assign(formPropertyType.fields, {
          [FORM_PROPERTY_FIELDS.DEPENDENTFIELDFILTERS]: new TypeField(
            elemID, FORM_PROPERTY_FIELDS.DEPENDENTFIELDFILTERS,
            Types.dependentFormFieldFiltersType, {
              name: FORM_PROPERTY_FIELDS.DEPENDENTFIELDFILTERS,
              _readOnly: false,
              [CORE_ANNOTATIONS.REQUIRED]: false,
            },
            true,
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
        [DEPENDENT_FIELD_FILTER_FIELDS.FORMFIELDACTION]: new TypeField(
          dependentFormFieldFiltersElemID, DEPENDENT_FIELD_FILTER_FIELDS.FORMFIELDACTION,
          BuiltinTypes.STRING, {
            name: DEPENDENT_FIELD_FILTER_FIELDS.FORMFIELDACTION,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: true,
            // TODO: See if this can be anything else other than DISPLAY
          },
        ),
        [DEPENDENT_FIELD_FILTER_FIELDS.FILTERS]: new TypeField(
          dependentFormFieldFiltersElemID, DEPENDENT_FIELD_FILTER_FIELDS.FILTERS,
          Types.fieldFilterType, {
            name: DEPENDENT_FIELD_FILTER_FIELDS.FILTERS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: true,
          },
          true,
        ),
        [DEPENDENT_FIELD_FILTER_FIELDS.DEPEDENTFORMFIELD]: new TypeField(
          dependentFormFieldFiltersElemID, DEPENDENT_FIELD_FILTER_FIELDS.DEPEDENTFORMFIELD,
          Types.dependeeFormFieldType, {
            name: DEPENDENT_FIELD_FILTER_FIELDS.DEPEDENTFORMFIELD,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: true,
          }
        ),
      },
      path: [HUBSPOT, 'types', 'subtypes', dependentFormFieldFiltersElemID.name],
    })

  private static dependentFormFieldType = Types.createFormFieldType(
    propertyElemID,
    true
  )

  private static richTextType: ObjectType =
    new ObjectType({
      elemID: richTextElemID,
      fields: {
        [RICHTEXT_FIELDS.CONTENT]: new TypeField(
          richTextElemID, RICHTEXT_FIELDS.CONTENT, BuiltinTypes.STRING, {
            name: RICHTEXT_FIELDS.CONTENT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
      },
      path: [HUBSPOT, 'types', 'subtypes', richTextElemID.name],
    })

  private static propertyGroupType: ObjectType =
    new ObjectType({
      elemID: propertyGroupElemID,
      fields: {
        [FORM_PROPERTY_GROUP_FIELDS.DEFAULT]: new TypeField(
          propertyGroupElemID, FORM_PROPERTY_GROUP_FIELDS.DEFAULT, BuiltinTypes.BOOLEAN, {
            name: FORM_PROPERTY_GROUP_FIELDS.DEFAULT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [FORM_PROPERTY_GROUP_FIELDS.FIELDS]: new TypeField(
          propertyGroupElemID, FORM_PROPERTY_GROUP_FIELDS.FIELDS, Types.dependentFormFieldType, {
            name: FORM_PROPERTY_GROUP_FIELDS.FIELDS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
          true,
        ),
        [FORM_PROPERTY_GROUP_FIELDS.ISSMARTGROUP]: new TypeField(
          propertyGroupElemID, FORM_PROPERTY_GROUP_FIELDS.ISSMARTGROUP, BuiltinTypes.BOOLEAN, {
            name: FORM_PROPERTY_GROUP_FIELDS.ISSMARTGROUP,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [FORM_PROPERTY_GROUP_FIELDS.RICHTEXT]: new TypeField(
          propertyGroupElemID, FORM_PROPERTY_GROUP_FIELDS.RICHTEXT, Types.richTextType, {
            name: FORM_PROPERTY_GROUP_FIELDS.RICHTEXT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
      },
      path: [HUBSPOT, 'types', 'subtypes', propertyGroupElemID.name],
    })

  private static eventAnchorType: ObjectType =
    new ObjectType({
      elemID: eventAnchorElemID,
      fields: {
        [EVENTANCHOR_FIELDS.CONTACTPROPERTYANCHOR]: new TypeField(
          eventAnchorElemID, EVENTANCHOR_FIELDS.CONTACTPROPERTYANCHOR, BuiltinTypes.STRING, {
            name: EVENTANCHOR_FIELDS.CONTACTPROPERTYANCHOR,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [EVENTANCHOR_FIELDS.STATICDATEANCHOR]: new TypeField(
          eventAnchorElemID, EVENTANCHOR_FIELDS.STATICDATEANCHOR,
          BuiltinTypes.STRING, {
            name: EVENTANCHOR_FIELDS.STATICDATEANCHOR,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
      },
      path: [HUBSPOT, 'types', 'subtypes', eventAnchorElemID.name],
    })

  private static anchorSettingType: ObjectType =
    new ObjectType({
      elemID: anchorSettingElemID,
      fields: {
        [ANCHOR_SETTING_FIELDS.EXECTIMEOFDAY]: new TypeField(
          anchorSettingElemID, ANCHOR_SETTING_FIELDS.EXECTIMEOFDAY, BuiltinTypes.STRING, {
            name: ANCHOR_SETTING_FIELDS.EXECTIMEOFDAY,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [ANCHOR_SETTING_FIELDS.EXECTIMEINMINUTES]: new TypeField(
          anchorSettingElemID, ANCHOR_SETTING_FIELDS.EXECTIMEINMINUTES, BuiltinTypes.NUMBER, {
            name: ANCHOR_SETTING_FIELDS.EXECTIMEINMINUTES,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [ANCHOR_SETTING_FIELDS.BOUNDARY]: new TypeField(
          anchorSettingElemID, ANCHOR_SETTING_FIELDS.BOUNDARY, BuiltinTypes.STRING, {
            name: ANCHOR_SETTING_FIELDS.BOUNDARY,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
      },
      path: [HUBSPOT, 'types', 'subtypes', anchorSettingElemID.name],
    })

  private static conditionActionType: ObjectType =
    new ObjectType({
      elemID: conditionActionElemID,
      fields: {
        [CONDITIONACTION_FIELDS.TYPE]: new TypeField(
          conditionActionElemID, CONDITIONACTION_FIELDS.TYPE, BuiltinTypes.STRING, {
            name: CONDITIONACTION_FIELDS.TYPE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [CONDITIONACTION_FIELDS.BODY]: new TypeField(
          conditionActionElemID, CONDITIONACTION_FIELDS.BODY, BuiltinTypes.STRING, {
            name: CONDITIONACTION_FIELDS.BODY,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [CONDITIONACTION_FIELDS.STATICTO]: new TypeField(
          conditionActionElemID, CONDITIONACTION_FIELDS.STATICTO, BuiltinTypes.STRING, {
            name: CONDITIONACTION_FIELDS.STATICTO,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [CONDITIONACTION_FIELDS.ACTIONID]: new TypeField(
          conditionActionElemID, CONDITIONACTION_FIELDS.ACTIONID, BuiltinTypes.NUMBER, {
            name: CONDITIONACTION_FIELDS.ACTIONID,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [CONDITIONACTION_FIELDS.STEPID]: new TypeField(
          conditionActionElemID, CONDITIONACTION_FIELDS.STEPID, BuiltinTypes.NUMBER, {
            name: CONDITIONACTION_FIELDS.STEPID,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
      },
      path: [HUBSPOT, 'types', 'subtypes', conditionActionElemID.name],
    })

  private static actionType: ObjectType =
    new ObjectType({
      elemID: actionElemID,
      fields: {
        [ACTION_FIELDS.TYPE]: new TypeField(
          actionElemID, ACTION_FIELDS.TYPE, BuiltinTypes.STRING, {
            name: ACTION_FIELDS.TYPE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [ACTION_FIELDS.ACTIONID]: new TypeField(
          actionElemID, ACTION_FIELDS.ACTIONID, BuiltinTypes.NUMBER, {
            name: ACTION_FIELDS.ACTIONID,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [ACTION_FIELDS.DELAYMILLS]: new TypeField(
          actionElemID, ACTION_FIELDS.DELAYMILLS, BuiltinTypes.NUMBER, {
            name: ACTION_FIELDS.DELAYMILLS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [ACTION_FIELDS.STEPID]: new TypeField(
          actionElemID, ACTION_FIELDS.STEPID, BuiltinTypes.NUMBER, {
            name: ACTION_FIELDS.STEPID,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [ACTION_FIELDS.ANCHORSETTING]: new TypeField(
          actionElemID, ACTION_FIELDS.ANCHORSETTING, Types.anchorSettingType, {
            name: ACTION_FIELDS.ANCHORSETTING,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [ACTION_FIELDS.FILTERSLISTID]: new TypeField(
          actionElemID, ACTION_FIELDS.FILTERSLISTID, BuiltinTypes.NUMBER, {
            name: ACTION_FIELDS.FILTERSLISTID,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [ACTION_FIELDS.NEWVALUE]: new TypeField(
          actionElemID, ACTION_FIELDS.NEWVALUE, BuiltinTypes.STRING, {
            name: ACTION_FIELDS.NEWVALUE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [ACTION_FIELDS.ACCEPTACTIONS]: new TypeField(
          actionElemID, ACTION_FIELDS.ACCEPTACTIONS, Types.conditionActionType, {
            name: ACTION_FIELDS.ACCEPTACTIONS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
          true,
        ),
        [ACTION_FIELDS.PROPERTYNAME]: new TypeField(
          actionElemID, ACTION_FIELDS.PROPERTYNAME, BuiltinTypes.STRING, {
            name: ACTION_FIELDS.PROPERTYNAME,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [ACTION_FIELDS.REJECTACTIONS]: new TypeField(
          actionElemID, ACTION_FIELDS.REJECTACTIONS, Types.conditionActionType, {
            name: ACTION_FIELDS.REJECTACTIONS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
          true,
        ),
      },
      path: [HUBSPOT, 'types', 'subtypes', actionElemID.name],
    })

  private static nurtureTimeRangeType: ObjectType =
    new ObjectType({
      elemID: nurtureTimeRangeElemID,
      fields: {
        [NURTURETIMERANGE_FIELDS.ENABLED]: new TypeField(
          nurtureTimeRangeElemID, NURTURETIMERANGE_FIELDS.ENABLED, BuiltinTypes.BOOLEAN, {
            name: NURTURETIMERANGE_FIELDS.ENABLED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [NURTURETIMERANGE_FIELDS.STARTHOUR]: new TypeField(
          nurtureTimeRangeElemID, NURTURETIMERANGE_FIELDS.STARTHOUR, BuiltinTypes.NUMBER, {
            name: NURTURETIMERANGE_FIELDS.STARTHOUR,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [NURTURETIMERANGE_FIELDS.STOPHOUR]: new TypeField(
          nurtureTimeRangeElemID, NURTURETIMERANGE_FIELDS.STOPHOUR, BuiltinTypes.NUMBER, {
            name: NURTURETIMERANGE_FIELDS.STOPHOUR,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
      },
      path: [HUBSPOT, 'types', 'subtypes', nurtureTimeRangeElemID.name],
    })

  private static contactListIdsType: ObjectType =
    new ObjectType({
      elemID: contactListIdsElemID,
      fields: {
        [CONTACTLISTIDS_FIELDS.ENROLLED]: new TypeField(
          contactListIdsElemID, CONTACTLISTIDS_FIELDS.ENROLLED, BuiltinTypes.NUMBER, {
            name: CONTACTLISTIDS_FIELDS.ENROLLED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [CONTACTLISTIDS_FIELDS.ACTIVE]: new TypeField(
          contactListIdsElemID, CONTACTLISTIDS_FIELDS.ACTIVE, BuiltinTypes.NUMBER, {
            name: CONTACTLISTIDS_FIELDS.ACTIVE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [CONTACTLISTIDS_FIELDS.SUCCEEDED]: new TypeField(
          contactListIdsElemID, CONTACTLISTIDS_FIELDS.SUCCEEDED, BuiltinTypes.NUMBER, {
            name: CONTACTLISTIDS_FIELDS.SUCCEEDED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [CONTACTLISTIDS_FIELDS.COMPLETED]: new TypeField(
          contactListIdsElemID, CONTACTLISTIDS_FIELDS.COMPLETED, BuiltinTypes.NUMBER, {
            name: CONTACTLISTIDS_FIELDS.COMPLETED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
      },
      path: [HUBSPOT, 'types', 'subtypes', contactListIdsElemID.name],
    })

  private static rssToEmailTimingType: ObjectType =
    new ObjectType({
      elemID: rssToEmailTimingElemID,
      fields: {
        [RSSTOEMAILTIMING_FIELDS.REPEATS]: new TypeField(
          rssToEmailTimingElemID, RSSTOEMAILTIMING_FIELDS.REPEATS, BuiltinTypes.STRING, {
            name: RSSTOEMAILTIMING_FIELDS.REPEATS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.VALUES]: ['instant', 'daily', 'weekly', 'monthly'],
          },
        ),
        [RSSTOEMAILTIMING_FIELDS.REPEATS_ON_MONTHLY]: new TypeField(
          rssToEmailTimingElemID, RSSTOEMAILTIMING_FIELDS.REPEATS_ON_MONTHLY, BuiltinTypes.NUMBER, {
            name: RSSTOEMAILTIMING_FIELDS.REPEATS_ON_MONTHLY,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [RSSTOEMAILTIMING_FIELDS.REPEATS_ON_WEEKLY]: new TypeField(
          rssToEmailTimingElemID, RSSTOEMAILTIMING_FIELDS.REPEATS_ON_WEEKLY, BuiltinTypes.NUMBER, {
            name: RSSTOEMAILTIMING_FIELDS.REPEATS_ON_WEEKLY,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [RSSTOEMAILTIMING_FIELDS.TIME]: new TypeField(
          rssToEmailTimingElemID, RSSTOEMAILTIMING_FIELDS.TIME, BuiltinTypes.STRING, {
            name: RSSTOEMAILTIMING_FIELDS.TIME,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
      },
      path: [HUBSPOT, 'types', 'subtypes', rssToEmailTimingElemID.name],
    })

  /**
   * This method create array of all supported Hubspot objects.
   * This is static creation cause hubspot API support only instances.
   */
  public static hubspotObjects: Record<string, ObjectType> = {
    [OBJECTS_NAMES.FORM]: new ObjectType({
      elemID: formElemID,
      fields: {
        [FORM_FIELDS.GUID]: new TypeField(
          formElemID, FORM_FIELDS.GUID, BuiltinTypes.STRING, {
            name: FORM_FIELDS.GUID,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [FORM_FIELDS.NAME]: new TypeField(
          formElemID, FORM_FIELDS.NAME, BuiltinTypes.STRING, {
            name: FORM_FIELDS.NAME,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: true,
          },
        ),
        [FORM_FIELDS.CSSCLASS]: new TypeField(
          formElemID, FORM_FIELDS.CSSCLASS, BuiltinTypes.STRING, {
            name: FORM_FIELDS.CSSCLASS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [FORM_FIELDS.REDIRECT]: new TypeField(
          formElemID, FORM_FIELDS.REDIRECT, BuiltinTypes.STRING, {
            name: FORM_FIELDS.REDIRECT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [FORM_FIELDS.SUBMITTEXT]: new TypeField(
          formElemID, FORM_FIELDS.SUBMITTEXT, BuiltinTypes.STRING, {
            name: FORM_FIELDS.SUBMITTEXT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [FORM_FIELDS.NOTIFYRECIPIENTS]: new TypeField(
          formElemID, FORM_FIELDS.NOTIFYRECIPIENTS, BuiltinTypes.STRING, {
            name: FORM_FIELDS.NOTIFYRECIPIENTS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [FORM_FIELDS.IGNORECURRENTVALUES]: new TypeField(
          formElemID, FORM_FIELDS.IGNORECURRENTVALUES, BuiltinTypes.BOOLEAN, {
            name: FORM_FIELDS.IGNORECURRENTVALUES,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [FORM_FIELDS.DELETABLE]: new TypeField(
          formElemID, FORM_FIELDS.DELETABLE, BuiltinTypes.BOOLEAN, {
            name: FORM_FIELDS.DELETABLE,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [FORM_FIELDS.INLINEMESSAGE]: new TypeField(
          formElemID, FORM_FIELDS.INLINEMESSAGE, BuiltinTypes.STRING, {
            name: FORM_FIELDS.INLINEMESSAGE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [FORM_FIELDS.FORMFIELDGROUPS]: new TypeField(
          formElemID, FORM_FIELDS.FORMFIELDGROUPS, Types.propertyGroupType, {
            name: FORM_FIELDS.FORMFIELDGROUPS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
          true,
        ),
        [FORM_FIELDS.CAPTCHAENABLED]: new TypeField(
          formElemID, FORM_FIELDS.CAPTCHAENABLED, BuiltinTypes.BOOLEAN, {
            name: FORM_FIELDS.CAPTCHAENABLED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [FORM_FIELDS.CREATEDAT]: new TypeField( // TODO: format milli -> readable date
          formElemID, FORM_FIELDS.CREATEDAT, BuiltinTypes.NUMBER, {
            name: FORM_FIELDS.CREATEDAT,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [FORM_FIELDS.CLONEABLE]: new TypeField(
          formElemID, FORM_FIELDS.CLONEABLE, BuiltinTypes.BOOLEAN, {
            name: FORM_FIELDS.CLONEABLE,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [FORM_FIELDS.STYLE]: new TypeField(
          formElemID, FORM_FIELDS.STYLE, BuiltinTypes.STRING, {
            name: FORM_FIELDS.STYLE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [FORM_FIELDS.EDITABLE]: new TypeField(
          formElemID, FORM_FIELDS.EDITABLE, BuiltinTypes.BOOLEAN, {
            name: FORM_FIELDS.EDITABLE,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [FORM_FIELDS.THEMENAME]: new TypeField(
          formElemID, FORM_FIELDS.THEMENAME, BuiltinTypes.STRING, {
            name: FORM_FIELDS.THEMENAME,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
      },
      path: [HUBSPOT, 'objects', formElemID.name],
    }),
    [OBJECTS_NAMES.WORKFLOWS]: new ObjectType({
      elemID: workflowsElemID,
      fields: {
        [WORKFLOWS_FIELDS.ID]: new TypeField(
          workflowsElemID, WORKFLOWS_FIELDS.ID, BuiltinTypes.NUMBER, {
            name: WORKFLOWS_FIELDS.ID,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: true,
          },
        ),
        [WORKFLOWS_FIELDS.NAME]: new TypeField(
          workflowsElemID, WORKFLOWS_FIELDS.NAME, BuiltinTypes.STRING, {
            name: WORKFLOWS_FIELDS.NAME,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: true,
          },
        ),
        [WORKFLOWS_FIELDS.TYPE]: new TypeField(
          workflowsElemID, WORKFLOWS_FIELDS.TYPE, BuiltinTypes.STRING, {
            name: WORKFLOWS_FIELDS.TYPE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.VALUES]: ['PROPERTY_ANCHOR', 'STATIC_ANCHOR', 'DRIP_DELAY'],
          },
        ),
        [WORKFLOWS_FIELDS.ENABLED]: new TypeField(
          workflowsElemID, WORKFLOWS_FIELDS.ENABLED, BuiltinTypes.BOOLEAN, {
            name: WORKFLOWS_FIELDS.ENABLED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [WORKFLOWS_FIELDS.INSERTEDAT]: new TypeField(
          workflowsElemID, WORKFLOWS_FIELDS.INSERTEDAT, BuiltinTypes.NUMBER, {
            name: WORKFLOWS_FIELDS.INSERTEDAT,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [WORKFLOWS_FIELDS.UPDATEDAT]: new TypeField(
          workflowsElemID, WORKFLOWS_FIELDS.UPDATEDAT, BuiltinTypes.NUMBER, {
            name: WORKFLOWS_FIELDS.UPDATEDAT,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [WORKFLOWS_FIELDS.CONTACTLISTIDS]: new TypeField(
          workflowsElemID, WORKFLOWS_FIELDS.CONTACTLISTIDS, Types.contactListIdsType, {
            name: WORKFLOWS_FIELDS.CONTACTLISTIDS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [WORKFLOWS_FIELDS.INTERNAL]: new TypeField(
          workflowsElemID, WORKFLOWS_FIELDS.INTERNAL, BuiltinTypes.BOOLEAN, {
            name: WORKFLOWS_FIELDS.INTERNAL,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [WORKFLOWS_FIELDS.ONLYEXECONBIZDAYS]: new TypeField(
          workflowsElemID, WORKFLOWS_FIELDS.ONLYEXECONBIZDAYS, BuiltinTypes.BOOLEAN, {
            name: WORKFLOWS_FIELDS.ONLYEXECONBIZDAYS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [WORKFLOWS_FIELDS.NURTURETIMERANGE]: new TypeField(
          workflowsElemID, WORKFLOWS_FIELDS.NURTURETIMERANGE, Types.nurtureTimeRangeType, {
            name: WORKFLOWS_FIELDS.NURTURETIMERANGE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [WORKFLOWS_FIELDS.ACTIONS]: new TypeField(
          workflowsElemID, WORKFLOWS_FIELDS.ACTIONS, Types.actionType, {
            name: WORKFLOWS_FIELDS.ACTIONS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
          true,
        ),
        [WORKFLOWS_FIELDS.LISTENING]: new TypeField(
          workflowsElemID, WORKFLOWS_FIELDS.LISTENING, BuiltinTypes.BOOLEAN, {
            name: WORKFLOWS_FIELDS.LISTENING,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [WORKFLOWS_FIELDS.EVENTANCHOR]: new TypeField(
          workflowsElemID, WORKFLOWS_FIELDS.EVENTANCHOR, Types.eventAnchorType, {
            name: WORKFLOWS_FIELDS.EVENTANCHOR,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [WORKFLOWS_FIELDS.ALLOWCONTACTTOTRIGGERMULTIPLETIMES]: new TypeField(
          workflowsElemID, WORKFLOWS_FIELDS.ALLOWCONTACTTOTRIGGERMULTIPLETIMES,
          BuiltinTypes.BOOLEAN, {
            name: WORKFLOWS_FIELDS.ALLOWCONTACTTOTRIGGERMULTIPLETIMES,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [WORKFLOWS_FIELDS.ONLYENROLLMANUALLY]: new TypeField(
          workflowsElemID, WORKFLOWS_FIELDS.ONLYENROLLMANUALLY, BuiltinTypes.BOOLEAN, {
            name: WORKFLOWS_FIELDS.ONLYENROLLMANUALLY,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [WORKFLOWS_FIELDS.ENROLLONCRITERIAUPDATE]: new TypeField(
          workflowsElemID, WORKFLOWS_FIELDS.ENROLLONCRITERIAUPDATE, BuiltinTypes.BOOLEAN, {
            name: WORKFLOWS_FIELDS.ENROLLONCRITERIAUPDATE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [WORKFLOWS_FIELDS.SUPRESSIONLISTIDS]: new TypeField(
          workflowsElemID, WORKFLOWS_FIELDS.SUPRESSIONLISTIDS, BuiltinTypes.NUMBER, {
            name: WORKFLOWS_FIELDS.SUPRESSIONLISTIDS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
          true,
        ),
      },
      path: [HUBSPOT, 'objects', workflowsElemID.name],
    }),
    [OBJECTS_NAMES.MARKETINGEMAIL]: new ObjectType({
      elemID: marketingEmailElemID,
      fields: {
        [MARKETING_EMAIL_FIELDS.AB]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.AB, BuiltinTypes.BOOLEAN, {
            name: MARKETING_EMAIL_FIELDS.AB,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.ABHOURSWAIT]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.ABHOURSWAIT, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.ABHOURSWAIT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.ABVARIATION]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.ABVARIATION, BuiltinTypes.BOOLEAN, {
            name: MARKETING_EMAIL_FIELDS.ABVARIATION,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.ABSAMPLESIZEDEFAULT]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.ABSAMPLESIZEDEFAULT, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.ABSAMPLESIZEDEFAULT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.VALUES]: ['master', 'variant'],
          }
        ),
        [MARKETING_EMAIL_FIELDS.ABSAMPLINGDEFAULT]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.ABSAMPLINGDEFAULT, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.ABSAMPLINGDEFAULT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.VALUES]: ['master', 'variant'],
          }
        ),
        [MARKETING_EMAIL_FIELDS.ABSTATUS]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.ABSTATUS, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.ABSTATUS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.VALUES]: ['master', 'variant'],
          }
        ),
        [MARKETING_EMAIL_FIELDS.ABSUCCESSMETRIC]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.ABSUCCESSMETRIC, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.ABSUCCESSMETRIC,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.VALUES]: ['CLICKS_BY_OPENS', 'CLICKS_BY_DELIVERED', 'OPENS_BY_DELIVERED'],
          }
        ),
        [MARKETING_EMAIL_FIELDS.ABTESTID]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.ABTESTID, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.ABTESTID,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.ABTESTPERCENTAGE]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.ABTESTPERCENTAGE, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.ABTESTPERCENTAGE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.ABSOLUTEURL]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.ABSOLUTEURL, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.ABSOLUTEURL,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.ALLEMAILCAMPAIGNIDS]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.ALLEMAILCAMPAIGNIDS, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.ALLEMAILCAMPAIGNIDS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
          true,
        ),
        [MARKETING_EMAIL_FIELDS.ANALYTICSPAGEID]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.ANALYTICSPAGEID, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.ANALYTICSPAGEID,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.ARCHIVED]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.ARCHIVED, BuiltinTypes.BOOLEAN, {
            name: MARKETING_EMAIL_FIELDS.ARCHIVED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.AUTHOR]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.AUTHOR, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.AUTHOR,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.AUTHORAT]: new TypeField( // TODO: Move to state only
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.AUTHORAT, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.AUTHORAT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.AUTHOREMAIL]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.AUTHOREMAIL, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.AUTHOREMAIL,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.AUTHORNAME]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.AUTHORNAME, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.AUTHORNAME,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.AUTHORUSERID]: new TypeField( // TODO: Replace with user's email
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.AUTHORUSERID, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.AUTHORUSERID,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.BLOGEMAILTYPE]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.BLOGEMAILTYPE, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.BLOGEMAILTYPE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.VALUES]: ['instant', 'daily', 'weekly', 'monthly'],
          }
        ),
        [MARKETING_EMAIL_FIELDS.BLOGRSSSETTINGS]: new TypeField(
          // TODO: Format this the right way
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.BLOGRSSSETTINGS, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.BLOGRSSSETTINGS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.CAMPAIGN]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.CAMPAIGN, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.CAMPAIGN,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.CAMPAIGNNAME]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.CAMPAIGNNAME, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.CAMPAIGNNAME,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.CANSPAMSETTINGSID]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.CANSPAMSETTINGSID, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.CANSPAMSETTINGSID,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.CLONEDFROM]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.CLONEDFROM, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.CLONEDFROM,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.CREATEPAGE]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.CREATEPAGE, BuiltinTypes.BOOLEAN, {
            name: MARKETING_EMAIL_FIELDS.CREATEPAGE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.CREATED]: new TypeField(
          // TODO: Move to state only
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.CREATED, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.CREATED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.CURRENTLYPUBLISHED]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.CURRENTLYPUBLISHED, BuiltinTypes.BOOLEAN, {
            name: MARKETING_EMAIL_FIELDS.CURRENTLYPUBLISHED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: true,
          }
        ),
        [MARKETING_EMAIL_FIELDS.DOMAIN]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.DOMAIN, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.DOMAIN,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.EMAILBODY]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.EMAILBODY, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.EMAILBODY,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: true,
          }
        ),
        [MARKETING_EMAIL_FIELDS.EMAILNOTE]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.EMAILNOTE, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.EMAILNOTE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.EMAILTYPE]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.EMAILTYPE, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.EMAILTYPE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.VALUES]: ['BATCH_EMAIL', 'AB_EMAIL', 'AUTOMATED_EMAIL', 'BLOG_EMAIL', 'BLOG_EMAIL_CHILD', 'FOLLOWUP_EMAIL',
              'LOCALTIME_EMAIL', 'OPTIN_EMAIL', 'OPTIN_FOLLOWUP_EMAIL', 'RESUBSCRIBE_EMAIL', 'RSS_EMAIL', 'RSS_EMAIL_CHILD', 'SINGLE_SEND_API',
              'SMTP_TOKEN', 'LEADFLOW_EMAIL', 'FEEDBACK_CES_EMAIL', 'FEEDBACK_NPS_EMAIL', 'FEEDBACK_CUSTOM_EMAIL', 'TICKET_EMAIL',
            ],
          }
        ),
        [MARKETING_EMAIL_FIELDS.FEEDBACKEMAILCATEGORY]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.FEEDBACKEMAILCATEGORY, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.FEEDBACKEMAILCATEGORY,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.VALUES]: ['NPS', 'CES', 'CUSTOM'],
          }
        ),
        [MARKETING_EMAIL_FIELDS.FEEDBACKSURVEYID]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.FEEDBACKSURVEYID, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.FEEDBACKSURVEYID,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.FLEXAREAS]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.FLEXAREAS, BuiltinTypes.JSON, {
            name: MARKETING_EMAIL_FIELDS.FLEXAREAS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.FOLDERID]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.FOLDERID, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.FOLDERID,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.FREEZEDATE]: new TypeField( // TODO: Move to state only
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.FREEZEDATE, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.FREEZEDATE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.FROMNAME]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.FROMNAME, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.FROMNAME,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.HTMLTITLE]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.HTMLTITLE, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.HTMLTITLE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.ID]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.ID, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.ID,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.ISGRAYMAILSUPPRESSIONENABLED]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.ISGRAYMAILSUPPRESSIONENABLED,
          BuiltinTypes.BOOLEAN, {
            name: MARKETING_EMAIL_FIELDS.ISGRAYMAILSUPPRESSIONENABLED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.ISLOCALTIMEZONESEND]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.ISLOCALTIMEZONESEND, BuiltinTypes.BOOLEAN, {
            name: MARKETING_EMAIL_FIELDS.ISLOCALTIMEZONESEND,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.ISPUBLISHED]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.ISPUBLISHED, BuiltinTypes.BOOLEAN, {
            name: MARKETING_EMAIL_FIELDS.ISPUBLISHED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.ISRECIPIENTFATIGUESUPPRESSIONENABLED]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.ISRECIPIENTFATIGUESUPPRESSIONENABLED,
          BuiltinTypes.BOOLEAN, {
            name: MARKETING_EMAIL_FIELDS.ISRECIPIENTFATIGUESUPPRESSIONENABLED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.LEADFLOWID]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.LEADFLOWID, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.LEADFLOWID,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.LIVEDOMAIN]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.LIVEDOMAIN, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.LIVEDOMAIN,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.MAILINGLISTSEXCLUDED]: new TypeField(
          // TODO: Convert this to reference
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.MAILINGLISTSEXCLUDED, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.MAILINGLISTSEXCLUDED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
          true,
        ),
        [MARKETING_EMAIL_FIELDS.MAILINGLISTSINCLUDED]: new TypeField(
          // TODO: Convert this to reference
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.MAILINGLISTSINCLUDED, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.MAILINGLISTSINCLUDED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
          true,
        ),
        [MARKETING_EMAIL_FIELDS.MAXRSSENTRIES]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.MAXRSSENTRIES, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.MAXRSSENTRIES,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.METADESCRIPTION]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.METADESCRIPTION, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.METADESCRIPTION,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.NAME]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.NAME, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.NAME,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.PAGEEXPIRYDATE]: new TypeField( // TODO: Decide if state or not
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.PAGEEXPIRYDATE, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.PAGEEXPIRYDATE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.PAGEEXPIRYREDIRECTEID]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.PAGEEXPIRYREDIRECTEID, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.PAGEEXPIRYREDIRECTEID,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.PAGEREDIRECTED]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.PAGEREDIRECTED, BuiltinTypes.BOOLEAN, {
            name: MARKETING_EMAIL_FIELDS.PAGEREDIRECTED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.PREVIEWKEY]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.PREVIEWKEY, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.PREVIEWKEY,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.PROCESSINGSTATUS]: new TypeField( // TODO: Move to state only
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.PROCESSINGSTATUS, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.PROCESSINGSTATUS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.VALUES]: ['UNDEFINED', 'PUBLISHED', 'PUBLISHED_OR_SCHEDULED', 'SCHEDULED', 'PROCESSING',
              'PRE_PROCESSING', 'ERROR', 'CANCELED_FORCIBLY', 'CANCELED_ABUSE'],
          }
        ),
        [MARKETING_EMAIL_FIELDS.PUBLISHDATE]: new TypeField(
          // TODO: Human readable + decide if state
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.PUBLISHDATE, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.PUBLISHDATE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.PUBLISHEDAT]: new TypeField( // TODO: Move to state only
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.PUBLISHEDAT, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.PUBLISHEDAT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.PUBLISHEDBYID]: new TypeField( // TODO: Move to state only
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.PUBLISHEDBYID, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.PUBLISHEDBYID,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.PUBLISHEDBYNAME]: new TypeField( // TODO: Move to state only
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.PUBLISHEDBYNAME, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.PUBLISHEDBYNAME,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.PUBLISHIMMEDIATELY]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.PUBLISHIMMEDIATELY, BuiltinTypes.BOOLEAN, {
            name: MARKETING_EMAIL_FIELDS.PUBLISHIMMEDIATELY,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.PUBLISHEDURL]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.PUBLISHEDURL, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.PUBLISHEDURL,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.REPLYTO]: new TypeField(
          // TODO: Decide if to enforce link to fromName?
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.REPLYTO, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.REPLYTO,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.RESOLVEDDOMAIN]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.RESOLVEDDOMAIN, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.RESOLVEDDOMAIN,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.RSSEMAILAUTHORLINETEMPLATE]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.RSSEMAILAUTHORLINETEMPLATE,
          BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.RSSEMAILAUTHORLINETEMPLATE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.RSSEMAILBLOGIMAGEMAXWIDTH]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.RSSEMAILBLOGIMAGEMAXWIDTH,
          BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.RSSEMAILBLOGIMAGEMAXWIDTH,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.RSSEMAILBYTEXT]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.RSSEMAILBYTEXT, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.RSSEMAILBYTEXT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.RSSEMAILCLICKTHROUGHTEXT]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.RSSEMAILCLICKTHROUGHTEXT,
          BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.RSSEMAILCLICKTHROUGHTEXT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.RSSEMAILCOMMENTTEXT]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.RSSEMAILCOMMENTTEXT, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.RSSEMAILCOMMENTTEXT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.RSSEMAILENTRYTEMPLATE]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.RSSEMAILENTRYTEMPLATE,
          BuiltinTypes.BOOLEAN, {
            name: MARKETING_EMAIL_FIELDS.RSSEMAILENTRYTEMPLATE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.RSSEMAILENTRYTEMPLATEENABLED]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.RSSEMAILENTRYTEMPLATEENABLED,
          BuiltinTypes.BOOLEAN, {
            name: MARKETING_EMAIL_FIELDS.RSSEMAILENTRYTEMPLATEENABLED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.RSSEMAILURL]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.RSSEMAILURL, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.RSSEMAILURL,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.RSSTOEMAILTIMING]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.RSSTOEMAILTIMING,
          Types.rssToEmailTimingType, {
            name: MARKETING_EMAIL_FIELDS.RSSTOEMAILTIMING,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.SLUG]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.SLUG, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.SLUG,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.SMARTEMAILFIELDS]: new TypeField(
        // TODO: Understand this and convert to a list of smart fields
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.SMARTEMAILFIELDS, BuiltinTypes.JSON, {
            name: MARKETING_EMAIL_FIELDS.SMARTEMAILFIELDS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.STYLESETTINGS]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.STYLESETTINGS, BuiltinTypes.JSON, {
            name: MARKETING_EMAIL_FIELDS.STYLESETTINGS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.SUBCATEGORY]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.SUBCATEGORY, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.SUBCATEGORY,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.VALUES]: ['ab_master', 'ab_variant', 'automated', 'automated_for_deal', 'automated_for_form',
              'automated_for_form_legacy', 'automated_for_form_buffer', 'automated_for_form_draft',
              'rss_to_email', 'rss_to_email_child', 'blog_email', 'blog_email_child', 'optin_email', 'optin_followup_email',
              'batch', 'resubscribe_email', 'single_send_api', 'smtp_token', 'localtime', 'automated_for_ticket', 'automated_for_leadflow',
              'automated_for_feedback_ces', 'automated_for_feedback_nps', 'automated_for_feedback_custom',
            ],
          }
        ),
        [MARKETING_EMAIL_FIELDS.SUBJECT]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.SUBJECT, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.SUBJECT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.SUBSCRIPTION]: new TypeField(
          // TODO: Check what email subscription type is
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.SUBSCRIPTION, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.SUBSCRIPTION,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.SUBSCRIPTIONBLOGID]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.SUBSCRIPTIONBLOGID, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.SUBSCRIPTIONBLOGID,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.SUBSCRIPTIONNAME]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.SUBSCRIPTIONNAME, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.SUBSCRIPTIONNAME,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.TEMPLATEPATH]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.TEMPLATEPATH, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.TEMPLATEPATH,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.TRANSACTIONAL]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.TRANSACTIONAL, BuiltinTypes.BOOLEAN, {
            name: MARKETING_EMAIL_FIELDS.TRANSACTIONAL,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.UNPUBLISHEDAT]: new TypeField( // TODO: Move to state only
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.UNPUBLISHEDAT, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.UNPUBLISHEDAT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.UPDATED]: new TypeField( // TODO: Move to state only
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.UPDATED, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.UPDATED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.UPDATEDBYID]: new TypeField( // TODO: Move to state only
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.UPDATEDBYID, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.UPDATEDBYID,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.URL]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.URL, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.URL,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.USERSSHEADLINEASSUBJECT]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.USERSSHEADLINEASSUBJECT,
          BuiltinTypes.BOOLEAN, {
            name: MARKETING_EMAIL_FIELDS.USERSSHEADLINEASSUBJECT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.VIDSEXCLUDED]: new TypeField(
          // TODO: No contact instances (maybe convert to email)
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.VIDSEXCLUDED, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.VIDSEXCLUDED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
          true
        ),
        [MARKETING_EMAIL_FIELDS.VIDSINCLUDED]: new TypeField(
          // TODO: No contact instances (maybe convert to email)
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.VIDSINCLUDED, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.VIDSINCLUDED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
          true
        ),
        [MARKETING_EMAIL_FIELDS.WIDGETS]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.WIDGETS, BuiltinTypes.JSON, {
            name: MARKETING_EMAIL_FIELDS.WIDGETS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.WORKFLOWNAMES]: new TypeField( // TODO: Convert to reference
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.WORKFLOWNAMES, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.WORKFLOWNAMES,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
          true,
        ),
      },
      path: [HUBSPOT, 'objects', marketingEmailElemID.name],
    }),
    [OBJECTS_NAMES.CONTACT_PROPERTY]: new ObjectType({
      elemID: contactPropertyElemID,
      fields: {
        [CONTACT_PROPERTY_FIELDS.NAME]: new TypeField(
          contactPropertyElemID, CONTACT_PROPERTY_FIELDS.NAME, BuiltinTypes.STRING, {
            name: CONTACT_PROPERTY_FIELDS.NAME,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: true,
          },
        ),
        [CONTACT_PROPERTY_FIELDS.LABEL]: new TypeField(
          contactPropertyElemID, CONTACT_PROPERTY_FIELDS.LABEL, BuiltinTypes.STRING, {
            name: CONTACT_PROPERTY_FIELDS.LABEL,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [CONTACT_PROPERTY_FIELDS.DESCRIPTION]: new TypeField(
          contactPropertyElemID, CONTACT_PROPERTY_FIELDS.DESCRIPTION, BuiltinTypes.STRING, {
            name: CONTACT_PROPERTY_FIELDS.DESCRIPTION,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [CONTACT_PROPERTY_FIELDS.GROUPNAME]: new TypeField(
          contactPropertyElemID, CONTACT_PROPERTY_FIELDS.GROUPNAME, BuiltinTypes.STRING, {
            name: CONTACT_PROPERTY_FIELDS.GROUPNAME,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: true,
          },
        ),
        [CONTACT_PROPERTY_FIELDS.TYPE]: new TypeField(
          contactPropertyElemID, CONTACT_PROPERTY_FIELDS.TYPE, BuiltinTypes.STRING, {
            name: CONTACT_PROPERTY_FIELDS.TYPE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: true,
            [CORE_ANNOTATIONS.VALUES]: contactPropertyTypeValues,
          },
        ),
        [CONTACT_PROPERTY_FIELDS.FIELDTYPE]: new TypeField(
          contactPropertyElemID, CONTACT_PROPERTY_FIELDS.FIELDTYPE, BuiltinTypes.STRING, {
            name: CONTACT_PROPERTY_FIELDS.FIELDTYPE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: true,
            [CORE_ANNOTATIONS.VALUES]: contactPropertyFieldTypeValues,
          },
        ),
        [CONTACT_PROPERTY_FIELDS.OPTIONS]: new TypeField(
          contactPropertyElemID, CONTACT_PROPERTY_FIELDS.OPTIONS, Types.optionsType, {
            name: CONTACT_PROPERTY_FIELDS.OPTIONS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
          true
        ),
        [CONTACT_PROPERTY_FIELDS.DELETED]: new TypeField(
          contactPropertyElemID, CONTACT_PROPERTY_FIELDS.DELETED, BuiltinTypes.BOOLEAN, {
            name: CONTACT_PROPERTY_FIELDS.DELETED,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [CONTACT_PROPERTY_FIELDS.FORMFIELD]: new TypeField(
          contactPropertyElemID, CONTACT_PROPERTY_FIELDS.FORMFIELD, BuiltinTypes.BOOLEAN, {
            name: CONTACT_PROPERTY_FIELDS.FORMFIELD,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: true,
          },
        ),
        [CONTACT_PROPERTY_FIELDS.DISPLAYORDER]: new TypeField(
          contactPropertyElemID, CONTACT_PROPERTY_FIELDS.DISPLAYORDER, BuiltinTypes.NUMBER, {
            name: CONTACT_PROPERTY_FIELDS.DISPLAYORDER,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.DEFAULT]: -1,
          },
        ),
        [CONTACT_PROPERTY_FIELDS.READONLYVALUE]: new TypeField(
          contactPropertyElemID, CONTACT_PROPERTY_FIELDS.READONLYVALUE, BuiltinTypes.BOOLEAN, {
            name: CONTACT_PROPERTY_FIELDS.READONLYVALUE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.DEFAULT]: false,
          },
        ),
        [CONTACT_PROPERTY_FIELDS.READONLYDEFINITION]: new TypeField(
          contactPropertyElemID, CONTACT_PROPERTY_FIELDS.READONLYDEFINITION, BuiltinTypes.BOOLEAN, {
            name: CONTACT_PROPERTY_FIELDS.READONLYDEFINITION,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.DEFAULT]: false,
          },
        ),
        [CONTACT_PROPERTY_FIELDS.HIDDEN]: new TypeField(
          contactPropertyElemID, CONTACT_PROPERTY_FIELDS.HIDDEN, BuiltinTypes.BOOLEAN, {
            name: CONTACT_PROPERTY_FIELDS.HIDDEN,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.DEFAULT]: false,
          },
        ),
        [CONTACT_PROPERTY_FIELDS.MUTABLEDEFINITIONNOTDELETABLE]: new TypeField(
          contactPropertyElemID, CONTACT_PROPERTY_FIELDS.MUTABLEDEFINITIONNOTDELETABLE,
          BuiltinTypes.BOOLEAN, {
            name: CONTACT_PROPERTY_FIELDS.MUTABLEDEFINITIONNOTDELETABLE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.DEFAULT]: false,
          },
        ),
        [CONTACT_PROPERTY_FIELDS.CALCULATED]: new TypeField(
          contactPropertyElemID, CONTACT_PROPERTY_FIELDS.CALCULATED, BuiltinTypes.BOOLEAN, {
            name: CONTACT_PROPERTY_FIELDS.CALCULATED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [CONTACT_PROPERTY_FIELDS.CREATEDAT]: new TypeField(
          // TODO: Move to state only
          contactPropertyElemID, CONTACT_PROPERTY_FIELDS.CREATEDAT, BuiltinTypes.NUMBER, {
            name: CONTACT_PROPERTY_FIELDS.CREATEDAT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [CONTACT_PROPERTY_FIELDS.EXTERNALOPTIONS]: new TypeField(
          contactPropertyElemID, CONTACT_PROPERTY_FIELDS.EXTERNALOPTIONS, BuiltinTypes.BOOLEAN, {
            name: CONTACT_PROPERTY_FIELDS.EXTERNALOPTIONS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.DEFAULT]: false,
          },
        ),
      },
      path: [HUBSPOT, 'objects', contactPropertyElemID.name],
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
  ]

  /**
   * This method create all the (basic) field types
   */
  static getAllFieldTypes(): TypeElement[] {
    return _.concat(
      Object.values(Types.fieldTypes),
    ).map(type => {
      const fieldType = type.clone()
      fieldType.path = [HUBSPOT, 'types', 'field_types']
      return fieldType
    })
  }
}

export const createInstanceName = (
  name: string
): string => bpCase(name.trim())

export const transformPrimitive: TransformValueFunc = (val, field) => {
  // remove values that are just an empty string or null
  if (val === '' || val === null) {
    return undefined
  }
  const fieldType = field?.type
  if (isPrimitiveType(fieldType) && fieldType.isEqual(BuiltinTypes.JSON)) {
    return JSON.stringify(val)
  }
  return val
}

export const transformAfterUpdateOrAdd = async (
  instance: InstanceElement,
  updateResult: HubspotMetadata,
): Promise<InstanceElement> => {
  const mergeCustomizer = (resultVal: Value, instanceVal: Value): Value | undefined => {
    if (_.isArray(resultVal) && _.isArray(instanceVal)) {
      return _.zip(resultVal, instanceVal).map((zipped: Value[]) =>
        _.mergeWith(zipped[0], zipped[1], mergeCustomizer))
    }
    return undefined
  }
  // Add auto-generated fields to the before element
  // If transform/filter moves auto-generated fields from being at the same
  // "location" as it comes from the api then we need transform^-1 here before this merge
  const mergedValues = _.mergeWith(updateResult as Values, instance.value, mergeCustomizer)
  instance.value = transform(mergedValues, instance.type as ObjectType, transformPrimitive) || {}
  return instance
}

const mergeFormFieldAndContactProperty = (field: Value): Value => {
  if (!field[FORM_PROPERTY_INNER_FIELDS.CONTACT_PROPERTY]) {
    return field
  }
  const newField = _.clone(field)
  const contactPropertyValues = _.clone(field[FORM_PROPERTY_INNER_FIELDS.CONTACT_PROPERTY]
    .resValue.value)
  const merged = _.pick(_.merge(
    contactPropertyValues,
    _.merge(newField, field[FORM_PROPERTY_INNER_FIELDS.CONTACT_PROPERTY_OVERRIDES])
  ), Object.values(FORM_PROPERTY_FIELDS))

  // Only available at top level so there's no endless recursion
  if (merged.dependentFieldFilters) {
    merged.dependentFieldFilters = merged.dependentFieldFilters.map(
      (dependentFieldFilter: Value) => {
        dependentFieldFilter.dependentFormField = mergeFormFieldAndContactProperty(
          dependentFieldFilter.dependentFormField
        )
        return dependentFieldFilter
      }
    )
  }
  return merged
}

export const createHubspotMetadataFromInstanceElement = (element: Readonly<InstanceElement>):
  HubspotMetadata =>
  (_.mapValues(element.value, (val, key) => {
    const fieldType = element.type.fields[key]?.type
    if (isPrimitiveType(fieldType) && fieldType.isEqual(BuiltinTypes.JSON)) {
      return JSON.parse(val)
    }
    if (isFormInstance(element) && key === FORM_FIELDS.FORMFIELDGROUPS) {
      const newVal = val.map((formFieldGroup: Value) => (_.mapValues(formFieldGroup,
        (formFieldGroupVal, formFieldGroupKey) => {
          if (!(formFieldGroupKey === FORM_PROPERTY_GROUP_FIELDS.FIELDS)) {
            return formFieldGroupVal
          }
          return formFieldGroupVal.map((innerField: Value) => {
            const mergedVal = mergeFormFieldAndContactProperty(innerField)
            return mergedVal
          })
        })
      ))
      return newVal
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
    [HUBSPOT, 'records', typeName, instanceName],
  )
}
