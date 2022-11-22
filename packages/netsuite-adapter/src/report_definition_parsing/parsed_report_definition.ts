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
/* eslint-disable max-len */
/* eslint-disable camelcase */
import {
  BuiltinTypes, CORE_ANNOTATIONS, ElemID, ObjectType, createRestriction, createRefToElmWithValue, ListType, MapType,
} from '@salto-io/adapter-api'
import { TypeAndInnerTypes } from '../types/object_types'
import * as constants from '../constants'

export const reportdefinitionType = (): TypeAndInnerTypes => {
  const innerTypes: Record<string, ObjectType> = {}

  const reportDefinitionElemID = new ElemID(constants.NETSUITE, 'reportdefinition')
  const reportDefinitionDependenciesElemID = new ElemID(constants.NETSUITE, 'reportdefinition_dependencies')
  const reportDefinitionComponentsElemID = new ElemID(constants.NETSUITE, 'reportdefinition_components')
  const reportDefinitionCriteriaElemID = new ElemID(constants.NETSUITE, 'reportdefintion_criteria')
  const reportDefinitionFieldsElemID = new ElemID(constants.NETSUITE, 'reportdefinition_fields')
  const reportDefinitionSortsElemID = new ElemID(constants.NETSUITE, 'reportdefinition_sorts')
  const reportDefinitionUiPrefElemID = new ElemID(constants.NETSUITE, 'reportdefinition_uipreferences')
  const reportDefinitionLayoutsElemID = new ElemID(constants.NETSUITE, 'reportdefinition_layouts')
  const reportDefinitionParamsElemID = new ElemID(constants.NETSUITE, 'reportdefinition_parameters')

  const reportDefinitionComponents = new ObjectType({
    elemID: reportDefinitionComponentsElemID,
    annotations: {
    },
    fields: {
      KEY_COMPONENT: { refType: BuiltinTypes.NUMBER },
      FLAG_SECONDERY_DIM: { refType: BuiltinTypes.BOOLEAN },
      FIELD_CLASS: { refType: BuiltinTypes.STRING },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, reportDefinitionElemID.name],
  })

  const reportDefinitionCriteria = new ObjectType({
    elemID: reportDefinitionCriteriaElemID,
    annotations: {
    },
    fields: {
      FIELD_DATE_FILTER_INDEX: { refType: BuiltinTypes.NUMBER },
      SEQ_NUMBER: { refType: BuiltinTypes.NUMBER },
      FILED_VALUE: { refType: BuiltinTypes.STRING },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, reportDefinitionElemID.name],
  })

  const reportDefinitionDependencies = new ObjectType({
    elemID: reportDefinitionDependenciesElemID,
    annotations: {
    },
    fields: {
      dependencies: {
        refType: createRefToElmWithValue(new ListType(BuiltinTypes.STRING)),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, reportDefinitionElemID.name],
  })

  const reportDefinitionSorts = new ObjectType({
    elemID: reportDefinitionSortsElemID,
    annotations: {
    },
    fields: {
      KEY_COMPONENT: { refType: BuiltinTypes.NUMBER },
      FIELD_TABLE: { refType: BuiltinTypes.STRING },
      FIELD_ALIAS: { refType: BuiltinTypes.STRING },
      FIELD_TARGET_TABLE: { refType: BuiltinTypes.STRING },
      FIELD_FOREIGN_KEY: { refType: BuiltinTypes.NUMBER },
      SEQ_NUMBER: { refType: BuiltinTypes.NUMBER },
      FLAG_DESCENDING: { refType: BuiltinTypes.BOOLEAN },
      FLAG_SUBTOTAL: { refType: BuiltinTypes.BOOLEAN },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, reportDefinitionElemID.name],
  })

  const reportDefinitionFields = new ObjectType({
    elemID: reportDefinitionFieldsElemID,
    annotations: {
    },
    fields: {
      KEY_COMPONENT: { refType: BuiltinTypes.NUMBER },
      FIELD_TABLE: { refType: BuiltinTypes.STRING },
      FIELD_ALIAS: { refType: BuiltinTypes.STRING },
      FIELD_TARGET_TABLE: { refType: BuiltinTypes.STRING },
      FIELD_FOREIGN_KEY: { refType: BuiltinTypes.NUMBER },
      KEY_CUSTOM_FIELD: { refType: BuiltinTypes.STRING },
      FLAG_DIMENSION: { refType: BuiltinTypes.BOOLEAN },
      FIELD_UNIT_TYPE: { refType: BuiltinTypes.NUMBER },
      FALG_ROLLUP: { refType: BuiltinTypes.BOOLEAN },
      FIELD_DATE_FILTER_INDEX: { refType: BuiltinTypes.NUMBER },
      FIELD_COMPARISON_TYPE: { refType: BuiltinTypes.STRING }, // VERFIY THIS!!
      FLAG_APPLY_FORWARDING: { refType: BuiltinTypes.BOOLEAN },
      FIELD_ALT_DATE_SEGMENT: { refType: BuiltinTypes.STRING },
      FLAG_MEASURE: { refType: BuiltinTypes.BOOLEAN },
      SEQ_NUMBER: { refType: BuiltinTypes.NUMBER },
      FIELD_LABEL: { refType: BuiltinTypes.STRING },
      FIELD_NEG_LABLE: { refType: BuiltinTypes.STRING }, // VERIFY THIS!!
      FIELD_URL: { refType: BuiltinTypes.STRING },
      FIELD_URL_TYPE: { refType: BuiltinTypes.STRING },
      FLAG_DUAL_COLUMN: { refType: BuiltinTypes.BOOLEAN },
      FLAG_PRECENT_TOTAL: { refType: BuiltinTypes.BOOLEAN },
      FLAG_PERCENT_EXPENSE: { refType: BuiltinTypes.BOOLEAN },
      FLAG_RUNNING_BAL: { refType: BuiltinTypes.BOOLEAN },
      FLAG_SHOW_OPENING_BAL: { refType: BuiltinTypes.BOOLEAN },
      FLAG_SHOW_ABS_DIFF: { refType: BuiltinTypes.BOOLEAN },
      FLAG_SHOW_PCT_DIFF: { refType: BuiltinTypes.BOOLEAN },
      FLAG_SUB_TOTAL: { refType: BuiltinTypes.BOOLEAN },
      FLAG_DISPLY: { refType: BuiltinTypes.BOOLEAN },
      FIELD_SUMMARY: { refType: BuiltinTypes.STRING },
      FLAG_DROP_DECIMAL: { refType: BuiltinTypes.BOOLEAN },
      FLAG_DIV_BY_THOUSAND: { refType: BuiltinTypes.BOOLEAN },
      FLAG_NEG_IN_RED: { refType: BuiltinTypes.BOOLEAN },
      FIELD_NEG_VAL_FORMAT: { refType: BuiltinTypes.STRING },
      FIELD_GROUP: { refType: BuiltinTypes.STRING }, // VERIFY THIS!!
      FIELD_PARENT_GROUP: { refType: BuiltinTypes.STRING }, // VERIFY THIS!
      FIELD_COLUMN_FILTER_GROUP: { refType: BuiltinTypes.STRING }, // VERIFY THIS!
      FIELD_FORMAT: { refType: BuiltinTypes.STRING },
      FIELD_FORMULA: { refType: BuiltinTypes.STRING }, // VERIFY THIS!!
      FIELD_FORMULA_BY_SEQ: { refType: BuiltinTypes.STRING }, // VERIFY THIS!!
      FLAG_TOTAL_FORMULA: { refType: BuiltinTypes.BOOLEAN },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, reportDefinitionElemID.name],
  })

  const reportDefinitionUiPref = new ObjectType({
    elemID: reportDefinitionUiPrefElemID,
    annotations: {
    },
    fields: {
      PARAMETER_CASH_BASIS: { refType: BuiltinTypes.BOOLEAN },
      PARAMETER_TAXCASH_BASIS: { refType: BuiltinTypes.STRING },
      PARAMETER_SHOW_ZEROS: { refType: BuiltinTypes.BOOLEAN },
      PARAMETER_SHOW_SINGLEROWLINES: { refType: BuiltinTypes.BOOLEAN },
      PARAMETER_DISPLAY_TYPE: { refType: BuiltinTypes.STRING },
      PARAMETER_INC_VS_EXP: { refType: BuiltinTypes.BOOLEAN },
      PARAMETER_GRAPH_TOP: { refType: BuiltinTypes.NUMBER },
      PARAMETER_WEB_STORE: { refType: BuiltinTypes.BOOLEAN },
      PARAMETER_ACTIVITY_ONLY: { refType: BuiltinTypes.BOOLEAN },
      PARAMETER_ALLOW_WEBQUERY: { refType: BuiltinTypes.BOOLEAN },
      PARAMETER_GRAPH_3D: { refType: BuiltinTypes.BOOLEAN },
      PARAMETERL_SHOW_CURRENCY_SYMBOL: { refType: BuiltinTypes.BOOLEAN },
      PARAMETER_EXPAND_LEVEL: { refType: BuiltinTypes.NUMBER },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, reportDefinitionElemID.name],
  })

  const reportDefinitionLayouts = new ObjectType({
    elemID: reportDefinitionLayoutsElemID,
    annotations: {
    },
    fields: {
      FIELD_STANDARD_LAYOUT: { refType: BuiltinTypes.BOOLEAN },
      KEY_SCRIPT_ID: { refType: BuiltinTypes.STRING },
    },
  })

  const reportDefinitionParameters = new ObjectType({
    elemID: reportDefinitionParamsElemID,
    annotations: {
    },
    fields: {
      Map: { refType: new MapType(BuiltinTypes.STRING) },
    },
  })

  innerTypes.reportDefinitionDependencies = reportDefinitionDependencies
  innerTypes.reportDefinitionCriteria = reportDefinitionCriteria
  innerTypes.reportDefinitionComponents = reportDefinitionComponents
  innerTypes.reportDefinitionSorts = reportDefinitionSorts
  innerTypes.reportDefinitionFields = reportDefinitionFields
  innerTypes.reportDefinitionUiPref = reportDefinitionUiPref
  innerTypes.reportDefinitionLayouts = reportDefinitionLayouts
  innerTypes.reportDefinitionParameters = reportDefinitionParameters


  const reportdefinition = new ObjectType({
    elemID: reportDefinitionElemID,
    annotations: {
    },
    fields: {
      KEY_REPORT_ID: { refType: BuiltinTypes.STRING },
      KEY_SCRIPT_ID: { refType: BuiltinTypes.STRING },
      KEY_PACKAGE: { refType: BuiltinTypes.STRING },
      FIELD_KEY: { refType: BuiltinTypes.NUMBER },
      FIELD_CODE: { refType: BuiltinTypes.STRING },
      FIELD_DESCRIPTION: { refType: BuiltinTypes.STRING }, // VERFIY THIS!
      FIELD_NAME: { refType: BuiltinTypes.STRING },
      FIELD_ORIGINAL_TITLE: { refType: BuiltinTypes.STRING },
      FIELD_PERM_TYPE: { refType: BuiltinTypes.STRING },
      KEY_FEATURE: { refType: BuiltinTypes.STRING },
      FLAG_PERIODS_ALLOWD: { refType: BuiltinTypes.BOOLEAN },
      FLAG_DISPLAY_TYPE: { refType: BuiltinTypes.STRING },
      FLAG_ONE_DATE: { refType: BuiltinTypes.BOOLEAN },
      FLAG_PRIMARY_OUTER_JOIN: { refType: BuiltinTypes.BOOLEAN },
      FLAG_CUSTOM_MODE: { refType: BuiltinTypes.BOOLEAN },
      FLAG_CASH_BASIS: { refType: BuiltinTypes.BOOLEAN },
      FLAG_SHOW_ZEROS: { refType: BuiltinTypes.BOOLEAN },
      FLAG_INACTIVE: { refType: BuiltinTypes.BOOLEAN },
      FIELD_VERSION: { refType: BuiltinTypes.NUMBER },
      FLAG_PERIODS_ON: { refType: BuiltinTypes.BOOLEAN },
      FLAG_USE_FISCAL_YEAR_RANGE: { refType: BuiltinTypes.BOOLEAN },
      FLAG_USE_TAX_PERIODS: { refType: BuiltinTypes.BOOLEAN },
      KEY_ENTITY: { refType: BuiltinTypes.STRING },
      FLAG_SHOW_LINK: { refType: BuiltinTypes.BOOLEAN },
      FLAG_SUPPORTS_CONSOL_SUBSIDIARY: { refType: BuiltinTypes.BOOLEAN },
      KEY_DEF_TOGGLE: { refType: BuiltinTypes.STRING }, // VERIFY THIS!!
      FIELD_TOGGLE_TYPE: { refType: BuiltinTypes.STRING },
      FIELD_TOGGLE_URL: { refType: BuiltinTypes.STRING }, // VERIFY THIS!
      FLAG_AFFECTED_BY_COGS: { refType: BuiltinTypes.BOOLEAN },
      FIELD_DEPRECATION_REASON: { refType: BuiltinTypes.STRING }, // VERIFY THIS!
      FLAG_ACTIVITY_ONLY: { refType: BuiltinTypes.BOOLEAN },
      KEY_AUDIENCE: { refType: BuiltinTypes.NUMBER },
      KEY_ACCESS_AUDIENCE: { refType: BuiltinTypes.STRING }, // VERIFY THIS!
      scriptid: {
        refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
          [constants.IS_ATTRIBUTE]: true,
          [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ regex: '^customreport[0-9a-z_]+' }),
        },
      },
      definition: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      },
      dependencies: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
        annotations: {
        },
      },
      components: {
        refType: createRefToElmWithValue(new ListType(reportDefinitionComponents)),
      },
      criteria: {
        refType: createRefToElmWithValue(new ListType(reportDefinitionCriteria)),
      },
      fields: {
        refType: createRefToElmWithValue(new ListType(reportDefinitionFields)),
      },
      layouts: {
        refType: createRefToElmWithValue(new ListType(reportDefinitionLayouts)),
      },
      parameters: {
        refType: createRefToElmWithValue(new MapType(reportDefinitionParameters)),
      },
      sorts: {
        refType: createRefToElmWithValue(new ListType(reportDefinitionSorts)),
      },
      uiPreferences: {
        refType: createRefToElmWithValue(new ListType(reportDefinitionUiPref)),
      },

    },
    path: [constants.NETSUITE, constants.TYPES_PATH, reportDefinitionElemID.name],
  })

  return { type: reportdefinition, innerTypes }
}
