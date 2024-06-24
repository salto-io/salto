/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import { BuiltinTypes, CORE_ANNOTATIONS, ElemID, ObjectType, createRestriction, ListType } from '@salto-io/adapter-api'
import { createMatchingObjectType } from '@salto-io/adapter-utils'
import { TypeAndInnerTypes } from '../../types/object_types'
import * as constants from '../../constants'

type ReportLayout = {
  FIELD_STANDARD_LAYOUT?: boolean
  KEY_SCRIPT_ID?: string
}

type ReportComponent = {
  KEY_COMPONENT?: number
  FLAG_SECONDERY_DIM?: boolean
  FIELD_CLASS?: string
}

type ReportSortType = {
  KEY_COMPONENT?: string
  FIELD_TABLE?: string
  FIELD_ALIAS?: string
  FIELD_TARGET_TABLE?: string
  FIELD_FOREIGN_KEY?: string
  SEQ_NUMBER?: number
  FLAG_DESCENDING?: boolean
  FLAG_SUBTOTAL?: boolean
}

type ReportDependencies = {
  dependency: string
}

export type ReportUiPrefType = {
  PARAMETER_CASH_BASIS?: boolean
  PARAMETER_TAXCASH_BASIS?: string
  PARAMETER_SHOW_ZEROS?: boolean
  PARAMETER_SHOW_SINGLEROWLINES?: boolean
  PARAMETER_DISPLAY_TYPE?: string
  PARAMETER_INC_VS_EXP?: boolean
  PARAMETER_GRAPH_TOP?: number
  PARAMETER_WEB_STORE?: boolean
  PARAMETER_ACTIVITY_ONLY?: boolean
  PARAMETER_ALLOW_WEBQUERY?: boolean
  PARAMETER_GRAPH_3D?: boolean
  PARAMETERL_SHOW_CURRENCY_SYMBOL?: boolean
  PARAMETER_EXPAND_LEVEL?: number
}

type ReportFieldsType = {
  KEY_COMPONENT?: number
  FIELD_TABLE?: string
  FIELD_ALIAS?: string
  FIELD_TARGET_TABLE?: string
  FIELD_FOREIGN_KEY?: string
  KEY_CUSTOM_FIELD?: string
  FLAG_DIMENSION?: boolean
  FIELD_UNIT_TYPE?: number
  FLAG_ROLLUP?: boolean
  FIELD_DATE_FILTER_INDEX?: number
  FIELD_COMPARISON_TYPE?: string
  FLAG_APPLY_FORWARDING?: boolean
  FIELD_ALT_DATE_SEGMENT?: string
  FLAG_MEASURE?: boolean
  SEQ_NUMBER?: number
  FIELD_LABEL?: string
  FIELD_NEG_LABLE?: string
  FIELD_URL?: string
  FIELD_URL_TYPE?: string
  FLAG_DUAL_COLUMN?: boolean
  FLAG_PRECENT_TOTAL?: boolean
  FLAG_PERCENT_EXPENSE?: boolean
  FLAG_RUNNING_BAL?: boolean
  FLAG_SHOW_OPENING_BAL?: boolean
  FLAG_SHOW_ABS_DIFF?: boolean
  FLAG_SHOW_PCT_DIFF?: boolean
  FLAG_SUB_TOTAL?: boolean
  FLAG_DISPLY?: boolean
  FIELD_SUMMARY?: string
  FLAG_DROP_DECIMAL?: boolean
  FLAG_DIV_BY_THOUSAND?: boolean
  FLAG_NEG_IN_RED?: boolean
  FIELD_NEG_VAL_FORMAT?: string
  FIELD_GROUP?: unknown
  FIELD_PARENT_GROUP?: unknown
  FIELD_COLUMN_FILTER_GROUP?: string
  FIELD_FORMAT?: string
  FIELD_FORMULA?: string
  FIELD_FORMULA_BY_SEQ?: string
  FLAG_TOTAL_FORMULA?: boolean
}

type ReportDefinitionInnerFields = {
  KEY_REPORT_ID?: number
  KEY_SCRIPT_ID?: string
  KEY_PACKAGE?: string
  FIELD_KEY?: number
  FIELD_CODE?: string
  FIELD_DESCRIPTION?: string
  FIELD_NAME?: string
  FIELD_ORIGINAL_TITLE?: string
  FIELD_PERM_TYPE?: string
  KEY_FEATURE?: string
  FLAG_PERIODS_ALLOWD?: boolean
  FLAG_DISPLAY_TYPE?: string
  FLAG_ONE_DATE?: boolean
  FLAG_PRIMARY_OUTER_JOIN?: boolean
  FLAG_CUSTOM_MODE?: boolean
  FLAG_CASH_BASIS?: boolean
  FLAG_SHOW_ZEROS?: boolean
  FLAG_INACTIVE?: boolean
  FIELD_VERSION?: number
  FLAG_PERIODS_ON?: boolean
  FLAG_USE_FISCAL_YEAR_RANGE?: boolean
  FLAG_USE_TAX_PERIODS?: boolean
  KEY_ENTITY?: string
  FLAG_SHOW_LINK?: boolean
  FLAG_SUPPORTS_CONSOL_SUBSIDIARY?: boolean
  KEY_DEF_TOGGLE?: number
  FIELD_TOGGLE_TYPE?: string
  FIELD_TOGGLE_URL?: string
  FLAG_AFFECTED_BY_COGS?: boolean
  FIELD_DEPRECATION_REASON?: string
  FLAG_ACTIVITY_ONLY?: boolean
  KEY_AUDIENCE?: number
  KEY_ACCESS_AUDIENCE?: string
}

type ReportCriteriaValuesType = {
  FIELD_DATE_FILTER_INDEX?: number
  SEQ_NUMBER?: number
  FIELD_VALUE?: unknown
}

type ReportCriteriaDescriptor = {
  FIELD_ALIAS?: string
  FIELD_OP_CLASS?: string
  FILED_TYPE?: string
  SEQ_NUMBER?: number
  FIELD_UNIT_TYPE?: number
  FLAG_IN_FOOTER?: boolean
  FLAG_CUSTOM_FOOTER?: boolean
  FLAG_VIRTUAL_FIELD?: boolean
  FIELD_DESCRIPTOR?: string
  FLAG_IS_HIDDEN?: boolean
}

export type ReportCriteriaType = {
  descriptor?: ReportCriteriaDescriptor
  values?: ReportCriteriaValuesType[]
}

export type ReportParameters = {
  ACCOUNTING_BOOK_CURRENT_ID?: string
  ACCOUNTING_BOOK_ID?: string
}

type ReportDefinitionAccessAudience = {
  allcustomers?: boolean
  allemployees?: boolean
  allpartners?: boolean
  allroles?: boolean
  allvendors?: boolean
  audslctrole?: string
}

export type ParsedReportDefinition = {
  layouts?: ReportLayout[]
  parameters?: ReportParameters
  components?: ReportComponent[]
  sorts?: ReportSortType[]
  fields?: ReportFieldsType[]
  uiPreferences?: ReportUiPrefType
  criteria?: ReportCriteriaType[]
  flags?: ReportDefinitionInnerFields
}

export type ReportDefinitionType = {
  scriptid: string
  definition: string
  audience?: ReportDefinitionAccessAudience
  accessaudience?: ReportDefinitionAccessAudience
  name: string
  dependencies?: ReportDependencies
}

type FullReportType = ReportDefinitionType & ParsedReportDefinition

export const reportdefinitionType = (): TypeAndInnerTypes => {
  const innerTypes: Record<string, ObjectType> = {}

  const reportDefinitionElemID = new ElemID(constants.NETSUITE, 'reportdefinition')
  const reportDefinitionDependenciesElemID = new ElemID(constants.NETSUITE, 'reportdefinition_dependencies')
  const reportDefinitionComponentsElemID = new ElemID(constants.NETSUITE, 'reportdefinition_components')
  const reportDefinitionCriteriaElemID = new ElemID(constants.NETSUITE, 'reportdefinition_criteria')
  const reportCriteriaDescriptorElemID = new ElemID(constants.NETSUITE, 'reportdefinition_criteria_descriptor')
  const reportCriteriaValuesElemID = new ElemID(constants.NETSUITE, 'reportdefinition_criteria_values')
  const reportDefinitionFieldsElemID = new ElemID(constants.NETSUITE, 'reportdefinition_fields')
  const reportDefinitionSortsElemID = new ElemID(constants.NETSUITE, 'reportdefinition_sorts')
  const reportDefinitionUiPrefElemID = new ElemID(constants.NETSUITE, 'reportdefinition_uipreferences')
  const reportDefinitionLayoutsElemID = new ElemID(constants.NETSUITE, 'reportdefinition_layouts')
  const reportDefinitionParamsElemID = new ElemID(constants.NETSUITE, 'reportdefinition_parameters')
  const reportDefinitionFlagsElemID = new ElemID(constants.NETSUITE, 'reportdefinition_flags')
  const reportDefinitionAudienceElemID = new ElemID(constants.NETSUITE, 'reportdefinition_audience')
  const reportdefinitionAccessAudienceElemID = new ElemID(constants.NETSUITE, 'reportdefinition_accessaudience')

  const reportDefinitionAudience = createMatchingObjectType<ReportDefinitionAccessAudience>({
    elemID: reportDefinitionAudienceElemID,
    annotations: {},
    fields: {
      allcustomers: { refType: BuiltinTypes.BOOLEAN },
      allemployees: { refType: BuiltinTypes.BOOLEAN },
      allpartners: { refType: BuiltinTypes.BOOLEAN },
      allroles: { refType: BuiltinTypes.BOOLEAN },
      allvendors: { refType: BuiltinTypes.BOOLEAN },
      audslctrole: { refType: BuiltinTypes.STRING },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, reportDefinitionElemID.name],
  })

  const reportDefinitionAccessAudience = createMatchingObjectType<ReportDefinitionAccessAudience>({
    elemID: reportdefinitionAccessAudienceElemID,
    annotations: {},
    fields: {
      allcustomers: { refType: BuiltinTypes.BOOLEAN },
      allemployees: { refType: BuiltinTypes.BOOLEAN },
      allpartners: { refType: BuiltinTypes.BOOLEAN },
      allroles: { refType: BuiltinTypes.BOOLEAN },
      allvendors: { refType: BuiltinTypes.BOOLEAN },
      audslctrole: { refType: BuiltinTypes.STRING },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, reportDefinitionElemID.name],
  })

  const reportDefinitionComponents = createMatchingObjectType<ReportComponent>({
    elemID: reportDefinitionComponentsElemID,
    annotations: {},
    fields: {
      KEY_COMPONENT: { refType: BuiltinTypes.NUMBER },
      FLAG_SECONDERY_DIM: { refType: BuiltinTypes.BOOLEAN },
      FIELD_CLASS: { refType: BuiltinTypes.STRING },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, reportDefinitionElemID.name],
  })

  const reportCriteriaDescriptor = createMatchingObjectType<ReportCriteriaDescriptor>({
    elemID: reportCriteriaDescriptorElemID,
    annotations: {},
    fields: {
      FIELD_ALIAS: { refType: BuiltinTypes.STRING },
      FIELD_OP_CLASS: { refType: BuiltinTypes.STRING },
      FILED_TYPE: { refType: BuiltinTypes.STRING },
      SEQ_NUMBER: { refType: BuiltinTypes.NUMBER },
      FIELD_UNIT_TYPE: { refType: BuiltinTypes.NUMBER },
      FLAG_IN_FOOTER: { refType: BuiltinTypes.BOOLEAN },
      FLAG_CUSTOM_FOOTER: { refType: BuiltinTypes.BOOLEAN },
      FLAG_VIRTUAL_FIELD: { refType: BuiltinTypes.BOOLEAN },
      FIELD_DESCRIPTOR: { refType: BuiltinTypes.STRING },
      FLAG_IS_HIDDEN: { refType: BuiltinTypes.BOOLEAN },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, reportDefinitionElemID.name],
  })

  const reportCriteriaValues = createMatchingObjectType<ReportCriteriaValuesType>({
    elemID: reportCriteriaValuesElemID,
    annotations: {},
    fields: {
      FIELD_DATE_FILTER_INDEX: { refType: BuiltinTypes.NUMBER },
      SEQ_NUMBER: { refType: BuiltinTypes.NUMBER },
      FIELD_VALUE: { refType: BuiltinTypes.UNKNOWN },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, reportDefinitionElemID.name],
  })

  const reportDefinitionCriteria = createMatchingObjectType<ReportCriteriaType>({
    elemID: reportDefinitionCriteriaElemID,
    annotations: {},
    fields: {
      descriptor: { refType: reportCriteriaDescriptor },
      values: { refType: new ListType(reportCriteriaValues) },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, reportDefinitionElemID.name],
  })

  const reportDefinitionDependencies = createMatchingObjectType<ReportDependencies>({
    elemID: reportDefinitionDependenciesElemID,
    annotations: {},
    fields: {
      dependency: {
        refType: BuiltinTypes.STRING,
        annotations: {
          _required: true,
        },
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, reportDefinitionElemID.name],
  })

  const reportDefinitionSorts = createMatchingObjectType<ReportSortType>({
    elemID: reportDefinitionSortsElemID,
    annotations: {},
    fields: {
      KEY_COMPONENT: { refType: BuiltinTypes.STRING },
      FIELD_TABLE: { refType: BuiltinTypes.STRING },
      FIELD_ALIAS: { refType: BuiltinTypes.STRING },
      FIELD_TARGET_TABLE: { refType: BuiltinTypes.STRING },
      FIELD_FOREIGN_KEY: { refType: BuiltinTypes.STRING },
      SEQ_NUMBER: { refType: BuiltinTypes.NUMBER },
      FLAG_DESCENDING: { refType: BuiltinTypes.BOOLEAN },
      FLAG_SUBTOTAL: { refType: BuiltinTypes.BOOLEAN },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, reportDefinitionElemID.name],
  })

  const reportDefinitionFields = createMatchingObjectType<ReportFieldsType>({
    elemID: reportDefinitionFieldsElemID,
    annotations: {},
    fields: {
      KEY_COMPONENT: { refType: BuiltinTypes.NUMBER },
      FIELD_TABLE: { refType: BuiltinTypes.STRING },
      FIELD_ALIAS: { refType: BuiltinTypes.STRING },
      FIELD_TARGET_TABLE: { refType: BuiltinTypes.STRING },
      FIELD_FOREIGN_KEY: { refType: BuiltinTypes.STRING },
      KEY_CUSTOM_FIELD: { refType: BuiltinTypes.STRING },
      FLAG_DIMENSION: { refType: BuiltinTypes.BOOLEAN },
      FIELD_UNIT_TYPE: { refType: BuiltinTypes.NUMBER },
      FLAG_ROLLUP: { refType: BuiltinTypes.BOOLEAN },
      FIELD_DATE_FILTER_INDEX: { refType: BuiltinTypes.NUMBER },
      FIELD_COMPARISON_TYPE: { refType: BuiltinTypes.STRING },
      FLAG_APPLY_FORWARDING: { refType: BuiltinTypes.BOOLEAN },
      FIELD_ALT_DATE_SEGMENT: { refType: BuiltinTypes.STRING },
      FLAG_MEASURE: { refType: BuiltinTypes.BOOLEAN },
      SEQ_NUMBER: { refType: BuiltinTypes.NUMBER },
      FIELD_LABEL: { refType: BuiltinTypes.STRING },
      FIELD_NEG_LABLE: { refType: BuiltinTypes.STRING },
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
      FIELD_GROUP: { refType: BuiltinTypes.UNKNOWN },
      FIELD_PARENT_GROUP: { refType: BuiltinTypes.UNKNOWN },
      FIELD_COLUMN_FILTER_GROUP: { refType: BuiltinTypes.STRING },
      FIELD_FORMAT: { refType: BuiltinTypes.STRING },
      FIELD_FORMULA: { refType: BuiltinTypes.STRING },
      FIELD_FORMULA_BY_SEQ: { refType: BuiltinTypes.STRING },
      FLAG_TOTAL_FORMULA: { refType: BuiltinTypes.BOOLEAN },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, reportDefinitionElemID.name],
  })

  const reportDefinitionUiPref = createMatchingObjectType<ReportUiPrefType>({
    elemID: reportDefinitionUiPrefElemID,
    annotations: {},
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

  const reportDefinitionLayouts = createMatchingObjectType<ReportLayout>({
    elemID: reportDefinitionLayoutsElemID,
    annotations: {},
    fields: {
      FIELD_STANDARD_LAYOUT: { refType: BuiltinTypes.BOOLEAN },
      KEY_SCRIPT_ID: { refType: BuiltinTypes.STRING },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, reportDefinitionElemID.name],
  })

  const reportDefinitionParameters = createMatchingObjectType<ReportParameters>({
    elemID: reportDefinitionParamsElemID,
    annotations: {},
    fields: {
      ACCOUNTING_BOOK_CURRENT_ID: { refType: BuiltinTypes.STRING },
      ACCOUNTING_BOOK_ID: { refType: BuiltinTypes.STRING },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, reportDefinitionElemID.name],
  })

  const reportDefinitionFlags = createMatchingObjectType<ReportDefinitionInnerFields>({
    elemID: reportDefinitionFlagsElemID,
    annotations: {},
    fields: {
      KEY_REPORT_ID: { refType: BuiltinTypes.NUMBER },
      KEY_SCRIPT_ID: { refType: BuiltinTypes.STRING },
      KEY_PACKAGE: { refType: BuiltinTypes.STRING },
      FIELD_KEY: { refType: BuiltinTypes.NUMBER },
      FIELD_CODE: { refType: BuiltinTypes.STRING },
      FIELD_DESCRIPTION: { refType: BuiltinTypes.STRING },
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
      KEY_DEF_TOGGLE: { refType: BuiltinTypes.NUMBER },
      FIELD_TOGGLE_TYPE: { refType: BuiltinTypes.STRING },
      FIELD_TOGGLE_URL: { refType: BuiltinTypes.STRING },
      FLAG_AFFECTED_BY_COGS: { refType: BuiltinTypes.BOOLEAN },
      FIELD_DEPRECATION_REASON: { refType: BuiltinTypes.STRING },
      FLAG_ACTIVITY_ONLY: { refType: BuiltinTypes.BOOLEAN },
      KEY_AUDIENCE: { refType: BuiltinTypes.NUMBER },
      KEY_ACCESS_AUDIENCE: { refType: BuiltinTypes.STRING },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, reportDefinitionElemID.name],
  })

  innerTypes.reportDefinitionComponents = reportDefinitionComponents
  innerTypes.reportDefinitionCriteria = reportDefinitionCriteria
  innerTypes.reportDefinitionCriteriaDescriptor = reportCriteriaDescriptor
  innerTypes.reportDefinitionCriteriaValues = reportCriteriaValues
  innerTypes.reportDefinitionFlags = reportDefinitionFlags
  innerTypes.reportdefinition_dependencies = reportDefinitionDependencies
  innerTypes.reportDefinitionFields = reportDefinitionFields
  innerTypes.reportDefinitionLayouts = reportDefinitionLayouts
  innerTypes.reportDefinitionParameters = reportDefinitionParameters
  innerTypes.reportDefinitionSorts = reportDefinitionSorts
  innerTypes.reportDefinitionUiPref = reportDefinitionUiPref
  innerTypes.reportdefinition_audience = reportDefinitionAudience
  innerTypes.reportdefinition_accessaudience = reportDefinitionAccessAudience

  const reportdefinition = createMatchingObjectType<FullReportType>({
    elemID: reportDefinitionElemID,
    fields: {
      scriptid: {
        refType: BuiltinTypes.SERVICE_ID,
        annotations: {
          _required: true,
          [constants.IS_ATTRIBUTE]: true,
          [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ regex: '^customreport[0-9a-z_]+' }),
        },
      },
      definition: {
        refType: BuiltinTypes.STRING,
        annotations: {
          _required: true,
        },
      },
      name: {
        refType: BuiltinTypes.STRING,
        annotations: {
          _required: true,
        },
      },
      dependencies: {
        refType: reportDefinitionDependencies,
      },
      audience: {
        refType: reportDefinitionAudience,
      },
      accessaudience: {
        refType: reportDefinitionAccessAudience,
      },
      layouts: {
        refType: new ListType(reportDefinitionLayouts),
      },
      parameters: {
        refType: reportDefinitionParameters,
      },
      components: {
        refType: new ListType(reportDefinitionComponents),
      },
      criteria: {
        refType: new ListType(reportDefinitionCriteria),
      },
      fields: {
        refType: new ListType(reportDefinitionFields),
      },
      sorts: {
        refType: new ListType(reportDefinitionSorts),
      },
      uiPreferences: {
        refType: reportDefinitionUiPref,
      },
      flags: {
        refType: reportDefinitionFlags,
      },
    },
    annotations: {},
    path: [constants.NETSUITE, constants.TYPES_PATH, reportDefinitionElemID.name],
  })

  return { type: reportdefinition, innerTypes }
}
