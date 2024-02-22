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

import {
  BuiltinTypes,
  CORE_ANNOTATIONS,
  ElemID,
  ListType,
  ObjectType,
  createRefToElmWithValue,
  createRestriction,
} from '@salto-io/adapter-api'
import { createMatchingObjectType } from '@salto-io/adapter-utils'
import { types } from '@salto-io/lowerdash'
import { TypeAndInnerTypes } from '../../types/object_types'
import * as constants from '../../constants'
import { fieldTypes } from '../../types/field_types'
import {
  AnalyticOriginalFields,
  ApplicationId,
  Audience,
  BaseRecord,
  Condition,
  ConditionOrFilter,
  DEFAULT_VALUE,
  DEFAULT_XML_TYPE,
  DO_NOT_ADD,
  DefinitionId,
  Dependencies,
  Expression,
  ExpressionValue,
  FieldOrFormula,
  FieldReference,
  Filter,
  Formula,
  FormulaFormula,
  IGNORE_T_VALUE,
  Join,
  JoinTrail,
  Meta,
  Operator,
  TranslationType,
  XML_TYPE,
} from './analytics_constants'

const sortDirectionList = ['ASCENDING', 'DESCENDING'] as const

type sortDirection = (typeof sortDirectionList)[number]

type TargetFieldContext = {
  name?: string
}

type Sorting = {
  caseSensitive?: boolean
  direction?: sortDirection
  localeId?: string
  nullFirst?: boolean
  order?: number
}

type ConditionalFormatFilter = {
  expressions?: ExpressionValue
  operator?: Operator
}

type FormatRuleFilter = {
  conditionalFormatFilter?: ConditionalFormatFilter
}

type RgbColor = {
  blue?: number
  green?: number
  red?: number
}

type Color = {
  rgbColor?: RgbColor
}

type Icon = {
  color?: Color
  image?: string
}

type Style = {
  backgroundColor?: Color
  icon?: Icon
}

type ConditionalFormatRule = {
  filter?: FormatRuleFilter
  id?: string
  style?: Style
}

type FormatRule = {
  conditionalFormatRule?: ConditionalFormatRule
}

type CellConditionalFormat = {
  formatRules?: FormatRule[]
  id?: string
}

type ConditionalFormat = {
  cellConditionalFormat?: CellConditionalFormat
}

type Column = {
  conditionalFormat?: ConditionalFormat[]
  criterion?: Filter
  customLabel?: TranslationType
  dataSetColumnId?: number
  datasetScriptId?: string
  fieldStateName?: string
  sorting?: Sorting
  targetFieldContext?: TargetFieldContext
  width?: number
}

type VisualizationTypeBasics = {
  applicationId?: ApplicationId
  datasets?: string[]
  id?: DefinitionId
  name?: TranslationType
  scriptId?: string
  workbook?: string
  version?: string
}

type ChartOrPivot = VisualizationTypeBasics & {
  definition?: string
  format?: string
  datasetLink?: string
  order?: number
}

type PivotOuter = {
  pivot: ChartOrPivot
}

type ChartOuter = {
  chart: ChartOrPivot
}

type DsLink = VisualizationTypeBasics & {
  mapping?: string
}

type DsLinkOuter = {
  dsLink: DsLink
}

type DataView = VisualizationTypeBasics & {
  columns?: Column[]
  order?: number
}

type DataViewOuter = {
  dataView: DataView
}

type visualizationType = {
  chart?: ChartOrPivot
  dsLink?: DsLink
  dataView?: DataView
  pivot?: ChartOrPivot
}

type InnerWorkbook = {
  applicationId?: ApplicationId
  audience?: Audience
  chartIDs?: string[]
  dataViewIDs?: string[]
  description?: TranslationType
  id?: DefinitionId
  name?: TranslationType
  ownerId?: number
  pivotIDs?: string[]
  scriptId?: string
  version?: string
}

type WorkbookDefinitionType = {
  charts?: visualizationType[]
  datasetLinks?: visualizationType[]
  dataViews?: visualizationType[]
  pivots?: visualizationType[]
  Workbook?: InnerWorkbook
}

export const workbookDefinitionFields: types.TypeKeysEnum<WorkbookDefinitionType> = {
  charts: 'charts',
  datasetLinks: 'datasetLinks',
  dataViews: 'dataViews',
  pivots: 'pivots',
  Workbook: 'Workbook',
}

export type Workbook = AnalyticOriginalFields & WorkbookDefinitionType

export const parsedWorkbookType = (): TypeAndInnerTypes => {
  const innerTypes: Record<string, ObjectType> = {}

  const workbookTargetFieldContextElemID = new ElemID(constants.NETSUITE, 'workbook_target_field_context')
  const workbookTargetFieldContext = createMatchingObjectType<TargetFieldContext>({
    elemID: workbookTargetFieldContextElemID,
    annotations: {},
    fields: {
      name: {
        refType: BuiltinTypes.STRING,
        annotations: {
          [DEFAULT_VALUE]: 'DEFAULT',
        },
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, constants.WORKBOOK],
  })
  innerTypes.workbookTargetFieldContext = workbookTargetFieldContext

  const workbookSortingElemID = new ElemID(constants.NETSUITE, 'workbook_sorting')
  const workbookSorting = createMatchingObjectType<Sorting>({
    elemID: workbookSortingElemID,
    annotations: {},
    fields: {
      caseSensitive: { refType: BuiltinTypes.BOOLEAN },
      direction: {
        refType: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ values: sortDirectionList }),
        },
      },
      localeId: { refType: BuiltinTypes.STRING },
      nullFirst: { refType: BuiltinTypes.BOOLEAN },
      order: { refType: BuiltinTypes.NUMBER },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, constants.WORKBOOK],
  })
  innerTypes.workbookSorting = workbookSorting

  const workbookExpressionValueElemID = new ElemID(constants.NETSUITE, 'workbook_expression_value')
  const workbookExpressionValue = createMatchingObjectType<ExpressionValue>({
    elemID: workbookExpressionValueElemID,
    annotations: {},
    fields: {
      type: { refType: BuiltinTypes.STRING },
      value: { refType: BuiltinTypes.UNKNOWN },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, constants.WORKBOOK],
  })
  innerTypes.workbookExpressionValue = workbookExpressionValue

  const workbookExpressionElemID = new ElemID(constants.NETSUITE, 'workbook_expression')
  const workbookExpression = createMatchingObjectType<Expression>({
    elemID: workbookExpressionElemID,
    annotations: {},
    fields: {
      label: { refType: BuiltinTypes.STRING },
      subType: { refType: BuiltinTypes.UNKNOWN },
      uiData: { refType: new ListType(BuiltinTypes.STRING) },
      value: { refType: workbookExpressionValue },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, constants.WORKBOOK],
  })
  innerTypes.workbookExpression = workbookExpression

  const workbookOperatorElemID = new ElemID(constants.NETSUITE, 'workbook_operator')
  const workbookOperator = createMatchingObjectType<Operator>({
    elemID: workbookOperatorElemID,
    annotations: {},
    fields: {
      code: {
        refType: BuiltinTypes.STRING,
        annotations: {
          [DEFAULT_VALUE]: 'AND',
        },
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, constants.WORKBOOK],
  })
  innerTypes.workbookOperator = workbookOperator

  const workbookConditionalFormatFilterElemID = new ElemID(constants.NETSUITE, 'workbook_conditional_format_filter')
  const workbookConditionalFormatFilter = createMatchingObjectType<ConditionalFormatFilter>({
    elemID: workbookConditionalFormatFilterElemID,
    annotations: {},
    fields: {
      expressions: { refType: workbookExpressionValue },
      operator: { refType: workbookOperator },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, constants.WORKBOOK],
  })
  innerTypes.workbookConditionalFormatFilter = workbookConditionalFormatFilter

  const workbookFormatRuleFilterElemID = new ElemID(constants.NETSUITE, 'workbook_format_rule_filter')
  const workbookFormatRuleFilter = createMatchingObjectType<FormatRuleFilter>({
    elemID: workbookFormatRuleFilterElemID,
    annotations: {
      [XML_TYPE]: true,
    },
    fields: {
      conditionalFormatFilter: {
        refType: workbookConditionalFormatFilter,
        annotations: {
          [DO_NOT_ADD]: true,
        },
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, constants.WORKBOOK],
  })
  innerTypes.workbookFormatRuleFilter = workbookFormatRuleFilter

  const workbookRgbColorElemID = new ElemID(constants.NETSUITE, 'workbook_rgb_color')
  const workbookRgbColor = createMatchingObjectType<RgbColor>({
    elemID: workbookRgbColorElemID,
    annotations: {},
    fields: {
      blue: { refType: BuiltinTypes.NUMBER },
      green: { refType: BuiltinTypes.NUMBER },
      red: { refType: BuiltinTypes.NUMBER },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, constants.WORKBOOK],
  })
  innerTypes.workbookRgbColor = workbookRgbColor

  const workbookColorElemID = new ElemID(constants.NETSUITE, 'workbook_color')
  const workbookColor = createMatchingObjectType<Color>({
    elemID: workbookColorElemID,
    annotations: {
      [XML_TYPE]: true,
    },
    fields: {
      rgbColor: {
        refType: workbookRgbColor,
        annotations: {
          [DO_NOT_ADD]: true,
        },
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, constants.WORKBOOK],
  })
  innerTypes.workbookColor = workbookColor

  const workbookIconElemID = new ElemID(constants.NETSUITE, 'workbook_icon')
  const workbookIcon = createMatchingObjectType<Icon>({
    elemID: workbookIconElemID,
    annotations: {},
    fields: {
      color: { refType: workbookColor },
      image: { refType: BuiltinTypes.STRING },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, constants.WORKBOOK],
  })
  innerTypes.workbookIcon = workbookIcon

  const workbookStyleElemID = new ElemID(constants.NETSUITE, 'workbook_style')
  const workbookStyle = createMatchingObjectType<Style>({
    elemID: workbookStyleElemID,
    annotations: {},
    fields: {
      backgroundColor: { refType: workbookColor },
      icon: { refType: workbookIcon },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, constants.WORKBOOK],
  })
  innerTypes.workbookStyle = workbookStyle

  const workbookConditionalFormatRuleElemID = new ElemID(constants.NETSUITE, 'workbook_conditional_format_rule')
  const workbookConditionalFormatRule = createMatchingObjectType<ConditionalFormatRule>({
    elemID: workbookConditionalFormatRuleElemID,
    annotations: {},
    fields: {
      filter: { refType: workbookFormatRuleFilter },
      id: { refType: BuiltinTypes.STRING },
      style: { refType: workbookStyle },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, constants.WORKBOOK],
  })
  innerTypes.workbookConditionalFormatRule = workbookConditionalFormatRule

  const workbookFormatRuleElemID = new ElemID(constants.NETSUITE, 'workbook_format_rule')
  const workbookFormatRule = createMatchingObjectType<FormatRule>({
    elemID: workbookFormatRuleElemID,
    annotations: {
      [XML_TYPE]: true,
    },
    fields: {
      conditionalFormatRule: {
        refType: workbookConditionalFormatRule,
        annotations: {
          [DO_NOT_ADD]: true,
        },
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, constants.WORKBOOK],
  })
  innerTypes.workbookFormatRule = workbookFormatRule

  const workbookCellConditionalFormatElemID = new ElemID(constants.NETSUITE, 'workbook_cell_conditional_format')
  const workbookCellConditionalFormat = createMatchingObjectType<CellConditionalFormat>({
    elemID: workbookCellConditionalFormatElemID,
    annotations: {},
    fields: {
      formatRules: { refType: new ListType(workbookFormatRule) },
      id: { refType: BuiltinTypes.STRING },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, constants.WORKBOOK],
  })
  innerTypes.workbookCellConditionalFormat = workbookCellConditionalFormat

  const workbookConditionalFormatElemID = new ElemID(constants.NETSUITE, 'workbook_conditional_format')
  const workbookConditionalFormat = createMatchingObjectType<ConditionalFormat>({
    elemID: workbookConditionalFormatElemID,
    annotations: {
      [XML_TYPE]: true,
    },
    fields: {
      cellConditionalFormat: {
        refType: workbookCellConditionalFormat,
        annotations: {
          [DO_NOT_ADD]: true,
        },
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, constants.WORKBOOK],
  })
  innerTypes.workbookConditionalFormat = workbookConditionalFormat

  const workbookTranslationElemID = new ElemID(constants.NETSUITE, 'workbook_translation')
  const workbookTranslation = createMatchingObjectType<TranslationType>({
    elemID: workbookTranslationElemID,
    annotations: {},
    fields: {
      translationScriptId: { refType: BuiltinTypes.STRING },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, constants.WORKBOOK],
  })
  innerTypes.workbookTranslation = workbookTranslation

  const workbookBaseRecordElemID = new ElemID(constants.NETSUITE, 'workbook_base_record')
  const workbookBaseRecord = createMatchingObjectType<BaseRecord>({
    elemID: workbookBaseRecordElemID,
    annotations: {},
    fields: {
      id: { refType: BuiltinTypes.STRING },
      label: { refType: BuiltinTypes.STRING },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, constants.WORKBOOK],
  })
  innerTypes.workbookBaseRecord = workbookBaseRecord

  const workbookJoinElemID = new ElemID(constants.NETSUITE, 'workbook_join')
  const workbookJoin = createMatchingObjectType<Join>({
    elemID: workbookJoinElemID,
    annotations: {},
    fields: {
      id: { refType: BuiltinTypes.STRING },
      targetRecordType: { refType: BuiltinTypes.STRING },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, constants.WORKBOOK],
  })
  innerTypes.workbookJoin = workbookJoin

  const workbookJoinTrailElemID = new ElemID(constants.NETSUITE, 'workbook_join_trail')
  const workbookJoinTrail = createMatchingObjectType<JoinTrail>({
    elemID: workbookJoinTrailElemID,
    annotations: {},
    fields: {
      baseRecord: { refType: workbookBaseRecord },
      joins: { refType: new ListType(workbookJoin) },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, constants.WORKBOOK],
  })
  innerTypes.workbookJoinTrail = workbookJoinTrail

  const workbookFieldReferenceElemID = new ElemID(constants.NETSUITE, 'workbook_field_reference')
  const workbookFieldReference = createMatchingObjectType<FieldReference>({
    elemID: workbookFieldReferenceElemID,
    annotations: {},
    fields: {
      id: { refType: BuiltinTypes.STRING },
      joinTrail: { refType: workbookJoinTrail },
      label: { refType: BuiltinTypes.STRING },
      uniqueId: { refType: BuiltinTypes.STRING },
      fieldValidityState: {
        refType: BuiltinTypes.STRING,
        annotations: {
          [DO_NOT_ADD]: true,
        },
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, constants.WORKBOOK],
  })
  innerTypes.workbookFieldReference = workbookFieldReference

  const workbookFormulaFormulaElemID = new ElemID(constants.NETSUITE, 'workbook_formula_formula')
  const workbookFormulaFormula = createMatchingObjectType<FormulaFormula>({
    elemID: workbookFormulaFormulaElemID,
    annotations: {
      [XML_TYPE]: true,
      [DEFAULT_XML_TYPE]: 'formula',
      [IGNORE_T_VALUE]: true,
    },
    fields: {
      dataType: { refType: BuiltinTypes.STRING },
      formulaSQL: { refType: BuiltinTypes.STRING },
      id: { refType: BuiltinTypes.STRING },
      label: { refType: workbookTranslation },
      uniqueId: { refType: BuiltinTypes.STRING },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, constants.WORKBOOK],
  })
  innerTypes.workbookFormulaFormula = workbookFormulaFormula

  const workbookFormulaElemID = new ElemID(constants.NETSUITE, 'workbook_formula')
  const workbookFormula = createMatchingObjectType<Formula>({
    elemID: workbookFormulaElemID,
    annotations: {},
    fields: {
      fields: { refType: BuiltinTypes.UNKNOWN },
      formula: { refType: workbookFormulaFormula },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, constants.WORKBOOK],
  })
  innerTypes.workbookFormula = workbookFormula

  const workbookFieldOrFormulaElemID = new ElemID(constants.NETSUITE, 'workbook_field_or_formula')
  const workbookFieldOrFormula = createMatchingObjectType<FieldOrFormula>({
    elemID: workbookFieldOrFormulaElemID,
    annotations: {
      [XML_TYPE]: true,
    },
    fields: {
      fieldReference: {
        refType: workbookFieldReference,
        annotations: {
          [DO_NOT_ADD]: true,
        },
      },
      dataSetFormula: {
        refType: workbookFormula,
        annotations: {
          [DO_NOT_ADD]: true,
        },
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, constants.WORKBOOK],
  })
  workbookFormula.fields.fields.refType = createRefToElmWithValue(new ListType(workbookFieldOrFormula))
  innerTypes.workbookFieldOrFormula = workbookFieldOrFormula

  const workbookMetaElemID = new ElemID(constants.NETSUITE, 'workbook_meta')
  const workbookMeta = createMatchingObjectType<Meta>({
    elemID: workbookMetaElemID,
    annotations: {},
    fields: {
      selectorType: { refType: BuiltinTypes.STRING },
      subType: { refType: BuiltinTypes.STRING },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, constants.WORKBOOK],
  })
  innerTypes.workbookMeta = workbookMeta

  const workbookFilterElemID = new ElemID(constants.NETSUITE, 'workbook_filter')
  const workbookFilter = createMatchingObjectType<Filter>({
    elemID: workbookFilterElemID,
    annotations: {},
    fields: {
      caseSensitive: { refType: BuiltinTypes.BOOLEAN },
      expressions: { refType: new ListType(workbookExpression) },
      operator: {
        refType: workbookOperator,
      },
      targetFieldContext: { refType: workbookTargetFieldContext },
      field: { refType: workbookFieldOrFormula },
      fieldStateName: { refType: BuiltinTypes.STRING },
      meta: { refType: workbookMeta },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, constants.WORKBOOK],
  })
  innerTypes.workbookFilter = workbookFilter

  const workbookConditionElemID = new ElemID(constants.NETSUITE, 'workbook_condition')
  const workbookCondition = createMatchingObjectType<Condition>({
    elemID: workbookConditionElemID,
    annotations: {},
    fields: {
      children: { refType: BuiltinTypes.UNKNOWN },
      operator: { refType: workbookOperator },
      targetFieldContext: { refType: workbookTargetFieldContext },
      meta: { refType: workbookMeta },
      field: { refType: workbookFieldOrFormula },
      fieldStateName: { refType: BuiltinTypes.STRING },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, constants.WORKBOOK],
  })
  innerTypes.workbookCondition = workbookCondition

  const workbookCriterionElemID = new ElemID(constants.NETSUITE, 'workbook_criteria')
  const workbookCriterion = createMatchingObjectType<ConditionOrFilter>({
    elemID: workbookCriterionElemID,
    annotations: {
      [XML_TYPE]: true,
    },
    fields: {
      condition: {
        refType: workbookCondition,
        annotations: {
          [DO_NOT_ADD]: true,
        },
      },
      filter: {
        refType: workbookFilter,
        annotations: {
          [DO_NOT_ADD]: true,
        },
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, constants.WORKBOOK],
  })
  innerTypes.workbookCriterion = workbookCriterion

  workbookCondition.fields.children.refType = createRefToElmWithValue(new ListType(workbookCriterion))

  const workbookColumnElemID = new ElemID(constants.NETSUITE, 'workbook_column')
  const workbookColumn = createMatchingObjectType<Column>({
    elemID: workbookColumnElemID,
    annotations: {},
    fields: {
      conditionalFormat: { refType: new ListType(workbookConditionalFormat) },
      criterion: { refType: workbookCriterion },
      customLabel: { refType: workbookTranslation },
      dataSetColumnId: { refType: BuiltinTypes.NUMBER },
      datasetScriptId: { refType: BuiltinTypes.STRING },
      fieldStateName: { refType: BuiltinTypes.STRING },
      sorting: { refType: workbookSorting },
      targetFieldContext: { refType: workbookTargetFieldContext },
      width: { refType: BuiltinTypes.NUMBER },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, constants.WORKBOOK],
  })
  innerTypes.workbookColumn = workbookColumn

  const workbookChartOrPivotElemID = new ElemID(constants.NETSUITE, 'workbook_chart_or_pivot')
  const workbookChartOrPivot = createMatchingObjectType<ChartOrPivot>({
    elemID: workbookChartOrPivotElemID,
    annotations: {},
    fields: {
      id: { refType: BuiltinTypes.UNKNOWN },
      scriptId: { refType: BuiltinTypes.STRING },
      applicationId: { refType: BuiltinTypes.UNKNOWN },
      version: { refType: BuiltinTypes.STRING },
      name: { refType: workbookTranslation },
      workbook: { refType: BuiltinTypes.STRING },
      datasets: { refType: new ListType(BuiltinTypes.STRING) },
      format: { refType: BuiltinTypes.STRING },
      order: { refType: BuiltinTypes.NUMBER },
      definition: { refType: BuiltinTypes.STRING },
      datasetLink: {
        refType: BuiltinTypes.STRING,
        annotations: {
          [DO_NOT_ADD]: true,
        },
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, constants.WORKBOOK],
  })
  innerTypes.workbookChartOrPivot = workbookChartOrPivot

  const workbookPivotOuterElemID = new ElemID(constants.NETSUITE, 'workbook_pivot_outer')
  const workbookPivotOuter = createMatchingObjectType<PivotOuter>({
    elemID: workbookPivotOuterElemID,
    annotations: {
      [XML_TYPE]: true,
      [DEFAULT_XML_TYPE]: 'pivot',
    },
    fields: {
      pivot: {
        refType: workbookChartOrPivot,
        annotations: {
          _required: true,
        },
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, constants.WORKBOOK],
  })
  innerTypes.workbookPivotOuter = workbookPivotOuter

  const workbookChartOuterElemID = new ElemID(constants.NETSUITE, 'workbook_chart_outer')
  const workbookChartOuter = createMatchingObjectType<ChartOuter>({
    elemID: workbookChartOuterElemID,
    annotations: {
      [XML_TYPE]: true,
      [DEFAULT_XML_TYPE]: 'chart',
    },
    fields: {
      chart: {
        refType: workbookChartOrPivot,
        annotations: {
          _required: true,
        },
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, constants.WORKBOOK],
  })
  innerTypes.workbookChartOuter = workbookChartOuter

  const workbookDsLinkElemID = new ElemID(constants.NETSUITE, 'workbook_dsLink')
  const workbookDsLink = createMatchingObjectType<DsLink>({
    elemID: workbookDsLinkElemID,
    annotations: {},
    fields: {
      id: { refType: BuiltinTypes.UNKNOWN },
      scriptId: { refType: BuiltinTypes.STRING },
      applicationId: { refType: BuiltinTypes.UNKNOWN },
      version: { refType: BuiltinTypes.STRING },
      name: { refType: workbookTranslation },
      workbook: { refType: BuiltinTypes.STRING },
      datasets: { refType: new ListType(BuiltinTypes.STRING) },
      mapping: { refType: BuiltinTypes.STRING },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, constants.WORKBOOK],
  })
  innerTypes.workbookDsLink = workbookDsLink

  const workbookDsLinkOuterElemID = new ElemID(constants.NETSUITE, 'workbook_dsLink_outer')
  const workbookDsLinkOuter = createMatchingObjectType<DsLinkOuter>({
    elemID: workbookDsLinkOuterElemID,
    annotations: {
      [XML_TYPE]: true,
      [DEFAULT_XML_TYPE]: 'dsLink',
    },
    fields: {
      dsLink: {
        refType: workbookDsLink,
        annotations: {
          _required: true,
        },
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, constants.WORKBOOK],
  })
  innerTypes.workbookDsLinkOuter = workbookDsLinkOuter

  const workbookDataViewElemID = new ElemID(constants.NETSUITE, 'workbook_data_view')
  const workbookDataView = createMatchingObjectType<DataView>({
    elemID: workbookDataViewElemID,
    annotations: {},
    fields: {
      id: { refType: BuiltinTypes.UNKNOWN },
      scriptId: { refType: BuiltinTypes.STRING },
      applicationId: { refType: BuiltinTypes.UNKNOWN },
      version: { refType: BuiltinTypes.STRING },
      name: { refType: workbookTranslation },
      workbook: { refType: BuiltinTypes.STRING },
      datasets: { refType: new ListType(BuiltinTypes.STRING) },
      columns: { refType: new ListType(workbookColumn) },
      order: { refType: BuiltinTypes.NUMBER },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, constants.WORKBOOK],
  })
  innerTypes.workbookDataView = workbookDataView

  const workbookDataViewOuterElemID = new ElemID(constants.NETSUITE, 'workbook_data_view_outer')
  const workbookDataViewOuter = createMatchingObjectType<DataViewOuter>({
    elemID: workbookDataViewOuterElemID,
    annotations: {
      [XML_TYPE]: true,
      [DEFAULT_XML_TYPE]: 'dataView',
    },
    fields: {
      dataView: {
        refType: workbookDataView,
        annotations: {
          _required: true,
        },
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, constants.WORKBOOK],
  })
  innerTypes.workbookDataViewOuter = workbookDataViewOuter

  const workbookAudienceElemID = new ElemID(constants.NETSUITE, 'workbook_audience')
  const workbookAudience = createMatchingObjectType<Audience>({
    elemID: workbookAudienceElemID,
    annotations: {},
    fields: {
      AudienceItems: { refType: new ListType(BuiltinTypes.UNKNOWN) },
      isPublic: { refType: BuiltinTypes.BOOLEAN },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, constants.WORKBOOK],
  })
  innerTypes.workbookAudience = workbookAudience

  const workbookInnerWorkbookElemID = new ElemID(constants.NETSUITE, 'workbook_inner_workbook')
  const workbookInnerWorkbook = createMatchingObjectType<InnerWorkbook>({
    elemID: workbookInnerWorkbookElemID,
    annotations: {
      [XML_TYPE]: true,
      [DEFAULT_XML_TYPE]: 'workbook',
      [IGNORE_T_VALUE]: true,
    },
    fields: {
      id: { refType: BuiltinTypes.UNKNOWN },
      scriptId: { refType: BuiltinTypes.STRING },
      applicationId: { refType: BuiltinTypes.UNKNOWN },
      version: { refType: BuiltinTypes.STRING },
      name: { refType: workbookTranslation },
      audience: { refType: workbookAudience },
      ownerId: { refType: BuiltinTypes.NUMBER },
      description: { refType: workbookTranslation },
      dataViewIDs: { refType: new ListType(BuiltinTypes.STRING) },
      pivotIDs: { refType: new ListType(BuiltinTypes.STRING) },
      chartIDs: { refType: new ListType(BuiltinTypes.STRING) },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, constants.WORKBOOK],
  })
  innerTypes.workbookInnerWorkbook = workbookInnerWorkbook

  const workbookDependenciesElemID = new ElemID(constants.NETSUITE, 'workbook_dependencies')
  const workbookDependencies = createMatchingObjectType<Dependencies>({
    elemID: workbookDependenciesElemID,
    annotations: {},
    fields: {
      dependency: {
        refType: new ListType(BuiltinTypes.STRING),
        annotations: {
          _required: true,
        },
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, constants.WORKBOOK],
  })
  innerTypes.workbookDependencies = workbookDependencies

  const workbookElemID = new ElemID(constants.NETSUITE, 'workbook')
  const workbook = createMatchingObjectType<Workbook>({
    elemID: workbookElemID,
    annotations: {},
    fields: {
      scriptid: {
        refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
        annotations: {
          _required: true,
          [constants.IS_ATTRIBUTE]: true,
          [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ regex: '^custworkbook[0-9a-z_]+' }),
        },
      },
      name: {
        refType: BuiltinTypes.STRING,
        annotations: {
          _required: true,
        },
      },
      dependencies: {
        refType: workbookDependencies,
        annotations: {
          [DO_NOT_ADD]: true,
        },
      },
      definition: {
        refType: fieldTypes.cdata,
        annotations: {
          [DO_NOT_ADD]: true,
        },
      },
      charts: { refType: new ListType(workbookChartOuter) },
      datasetLinks: { refType: new ListType(workbookDsLinkOuter) },
      dataViews: { refType: new ListType(workbookDataViewOuter) },
      pivots: { refType: new ListType(workbookPivotOuter) },
      Workbook: { refType: workbookInnerWorkbook },
      application_id: {
        refType: BuiltinTypes.STRING,
        annotations: {
          [DO_NOT_ADD]: true,
        },
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, constants.WORKBOOK],
  })
  return { type: workbook, innerTypes }
}
