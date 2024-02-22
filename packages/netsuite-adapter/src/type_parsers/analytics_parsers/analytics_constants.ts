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

import { APPLICATION_ID, REAL_VALUE_KEY, SCRIPT_ID } from '../../constants'

// annotations
export const DEFAULT_VALUE = 'default_value'
export const XML_TYPE = 'xml_type'
export const DEFAULT_XML_TYPE = 'default_xml_type'
export const DO_NOT_ADD = 'do_not_add'
export const IGNORE_T_VALUE = 'ignore_t_value'

// xml fields
export const FIELD_DEFINITION = '_T_'
export const TYPE = '@_type'
export const FIELD_TYPE = 'fieldType'

// const strings
export const ROOT = 'root'
export const DEFINITION = 'definition'
export const MAPPING = 'mapping'
export const ITEM = '_ITEM_'
export const TRUE = 'true'
export const FALSE = 'false'
export const DEPENDENCIES = 'dependencies'
export const DEPENDENCY = 'dependency'
export const NAME = 'name'
export const TRANSLATION_SCRIPT_ID = 'translationScriptId'
export const CHARTS = 'charts'
export const PIVOTS = 'pivots'
export const TABLES = 'tables'
export const DATASET_LINKS = 'datasetLinks'
export const DATASET_LINK = 'dsLink'
export const DATA_VIEWS = 'dataViews'
export const CHART_IDS = 'chartIDs'
export const PIVOT_IDS = 'pivotIDs'
export const DATA_VIEW_IDS = 'dataViewIDs'
export const DATASETS = 'datasets'
export const EXPRESSION_VALUE_VALUE_REGEX = /expressions\.\d+\.value\.value$/

// types

type AudienceItem = unknown
type ExpressionSubType = unknown
type ExpressionUiData = unknown
export type ApplicationId = unknown
export type DefinitionId = unknown

export const enum xmlType {
  array = 'array',
  boolean = 'boolean',
  string = 'string',
  null = 'null',
}
export type FieldWithType = {
  [TYPE]: xmlType
  [ITEM]?: unknown[]
  [REAL_VALUE_KEY]?: string
}
export type Dependencies = {
  dependency: string[]
}

export type Audience = {
  AudienceItems?: AudienceItem[]
  isPublic?: boolean
}

export type BaseRecord = {
  id?: string
  label?: string
}

export type TranslationType = {
  translationScriptId?: string
}

export type Join = {
  id?: string
  targetRecordType?: string
}

export type JoinTrail = {
  baseRecord?: BaseRecord
  joins?: Join[]
}

export type FieldReference = {
  id?: string
  joinTrail?: JoinTrail
  label?: string
  uniqueId?: string
  fieldValidityState?: string
}

export type FormulaFormula = {
  dataType?: string
  formulaSQL?: string
  id?: string
  label?: TranslationType
  uniqueId?: string
}

export type Formula = {
  // eslint-disable-next-line no-use-before-define
  fields?: FieldOrFormula[]
  formula?: FormulaFormula
}

export type FieldOrFormula = {
  fieldReference?: FieldReference
  dataSetFormula?: Formula
}

export type ExpressionValue = {
  type?: string
  value?: unknown
}

export type Expression = {
  label?: string
  subType?: ExpressionSubType
  uiData?: ExpressionUiData[]
  value?: ExpressionValue
}

export type Operator = {
  code?: string
}

export type Meta = {
  selectorType?: string
  subType?: string
}

export type TargetFieldContext = {
  name?: string
}

export type Filter = {
  caseSensitive?: boolean
  expressions?: Expression[]
  field?: FieldOrFormula
  fieldStateName?: string
  meta?: Meta
  operator?: Operator
  targetFieldContext?: TargetFieldContext
}

export type Condition = {
  operator?: Operator
  // eslint-disable-next-line no-use-before-define
  children?: ConditionOrFilter[]
  targetFieldContext?: TargetFieldContext
  meta?: Meta
  field?: FieldOrFormula
  fieldStateName?: string
}

export type ConditionOrFilter = {
  condition?: Condition
  filter?: Filter
}
export type workbookListsElement = {
  [SCRIPT_ID]: string
}

export type AnalyticOriginalFields = {
  [SCRIPT_ID]: string
  [NAME]: string
  [DEPENDENCIES]?: {
    dependency?: string[]
  }
  [DEFINITION]?: string
  [APPLICATION_ID]?: string
}

export type StringToStringRecord = { [SCRIPT_ID]: string }
export type OriginalWorkbookArrays = Record<string, Record<string, StringToStringRecord[]>>
export type EmptyObject = {
  [TYPE]: xmlType.array | xmlType.null
}

// containers of special fields
export const TValuesToIgnore = new Set(['workbook', 'dataSet', 'formula'])
export const fieldsToOmitFromDefinition = [NAME]
export const fieldsToOmitFromOriginal = [DEFINITION, TABLES, CHARTS, PIVOTS]
