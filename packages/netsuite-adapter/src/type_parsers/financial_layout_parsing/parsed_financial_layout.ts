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

type InnerFields = {
  FIELD_KEY?: number
  KEY_SCRIPT_ID?: string
  KEY_PACKAGE?: string
  FIELD_NAME?: string
  FIELD_FINANCIAL_TYPE?: string
  FIELD_EXPAND_LEVEL?: string
  FIELD_OVERALL_INDENT?: string
  KEY_DEFAULT_HEADER_STYLE?: number
  KEY_DEFAULT_SECTION_STYLE?: number
  KEY_DEFAULT_FORMULA_STYLE?: number
  KEY_DEFAULT_TEXT_STYLE?: number
}

type LayoutDependencies = {
  dependency: string
}

export type RowRecordType = {
  FIELD_GROUP_BY?: string
  FIELD_GROUP_BY_FULL?: boolean
  FIELD_ORDER_GROUP?: number
  FIELD_ORDER_TYPE?: string
  FLAG_ORDER_DESC?: boolean
}

export type LayoutRowType = {
  FIELD_KEY?: number
  FIELD_NAME?: string
  KEY_SCRIPT_ID?: string
  FIELD_TYPE?: string
  FIELD_PRIORITY?: number
  SEQ_NUMBER?: number
  KEY_PARENT?: number
  FIELD_DEFAULT_TOTAL_NAME?: string
  FLAG_SHOW_NAME?: boolean
  FLAG_SHOW_TOTAL_NAME?: boolean
  FIELD_COLLAPSED_SECTION?: string
  FIELD_FINANCIAL_MARKER?: string
  KEY_STYLE?: number
  FLAG_SECTION_USE_EXPRESSIONS?: boolean
  KEY_SECTION?: number
  KEY_SECTION_COMP_ID?: string
  KEY_TOTAL_STYLE?: number
  KEY_BODY_STYLE?: number
  FLAG_TOP_ROW?: boolean
  RECORDS?: RowRecordType[]
}

export type ParsedFinancialLayout = {
  rows?: LayoutRowType[]
  flags?: InnerFields
}

export type FinancialLayoutType = {
  scriptid: string
  layout: string
  name: string
  dependencies?: LayoutDependencies
}

type FullFinancialLayoutType = ParsedFinancialLayout & FinancialLayoutType

export const financiallayoutType = (): TypeAndInnerTypes => {
  const innerTypes: Record<string, ObjectType> = {}

  const financialLayoutElemID = new ElemID(constants.NETSUITE, 'financiallayout')
  const financialLayoutDependenciesElemID = new ElemID(constants.NETSUITE, 'financiallayout_dependencies')
  const financialLayoutRowsElemID = new ElemID(constants.NETSUITE, 'financiallayout_rows')
  const financialLayoutRowsRecordElemID = new ElemID(constants.NETSUITE, 'financiallayout_rowRecord')
  const financialLayoutInnerFieldsElemID = new ElemID(constants.NETSUITE, 'financiallayout_fields')

  const financialLayoutRowsRecord = createMatchingObjectType<RowRecordType>({
    elemID: financialLayoutRowsRecordElemID,
    annotations: {},
    fields: {
      FIELD_GROUP_BY: { refType: BuiltinTypes.STRING },
      FIELD_GROUP_BY_FULL: { refType: BuiltinTypes.BOOLEAN },
      FIELD_ORDER_GROUP: { refType: BuiltinTypes.NUMBER },
      FIELD_ORDER_TYPE: { refType: BuiltinTypes.STRING },
      FLAG_ORDER_DESC: { refType: BuiltinTypes.BOOLEAN },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, financialLayoutElemID.name],
  })

  const financialLayoutRows = createMatchingObjectType<LayoutRowType>({
    elemID: financialLayoutRowsElemID,
    annotations: {},
    fields: {
      FIELD_KEY: { refType: BuiltinTypes.NUMBER },
      FIELD_NAME: { refType: BuiltinTypes.STRING },
      KEY_SCRIPT_ID: { refType: BuiltinTypes.STRING },
      FIELD_TYPE: { refType: BuiltinTypes.STRING },
      FIELD_PRIORITY: { refType: BuiltinTypes.NUMBER },
      SEQ_NUMBER: { refType: BuiltinTypes.NUMBER },
      KEY_PARENT: { refType: BuiltinTypes.NUMBER },
      FIELD_DEFAULT_TOTAL_NAME: { refType: BuiltinTypes.STRING },
      FLAG_SHOW_NAME: { refType: BuiltinTypes.BOOLEAN },
      FLAG_SHOW_TOTAL_NAME: { refType: BuiltinTypes.BOOLEAN },
      FIELD_COLLAPSED_SECTION: { refType: BuiltinTypes.STRING },
      FIELD_FINANCIAL_MARKER: { refType: BuiltinTypes.STRING },
      KEY_STYLE: { refType: BuiltinTypes.NUMBER },
      FLAG_SECTION_USE_EXPRESSIONS: { refType: BuiltinTypes.BOOLEAN },
      KEY_SECTION: { refType: BuiltinTypes.NUMBER },
      KEY_SECTION_COMP_ID: { refType: BuiltinTypes.STRING },
      KEY_TOTAL_STYLE: { refType: BuiltinTypes.NUMBER },
      KEY_BODY_STYLE: { refType: BuiltinTypes.NUMBER },
      FLAG_TOP_ROW: { refType: BuiltinTypes.BOOLEAN },
      RECORDS: { refType: new ListType(financialLayoutRowsRecord) },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, financialLayoutElemID.name],
  })

  const financialLayoutDependencies = createMatchingObjectType<LayoutDependencies>({
    elemID: financialLayoutDependenciesElemID,
    annotations: {},
    fields: {
      dependency: {
        refType: BuiltinTypes.STRING,
        annotations: {
          _required: true,
        },
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, financialLayoutElemID.name],
  })

  const financialLayoutInnerFields = createMatchingObjectType<InnerFields>({
    elemID: financialLayoutInnerFieldsElemID,
    fields: {
      FIELD_KEY: { refType: BuiltinTypes.NUMBER },
      KEY_SCRIPT_ID: { refType: BuiltinTypes.STRING },
      KEY_PACKAGE: { refType: BuiltinTypes.STRING },
      FIELD_NAME: { refType: BuiltinTypes.STRING },
      FIELD_FINANCIAL_TYPE: { refType: BuiltinTypes.STRING },
      FIELD_EXPAND_LEVEL: { refType: BuiltinTypes.STRING },
      FIELD_OVERALL_INDENT: { refType: BuiltinTypes.STRING },
      KEY_DEFAULT_HEADER_STYLE: { refType: BuiltinTypes.NUMBER },
      KEY_DEFAULT_SECTION_STYLE: { refType: BuiltinTypes.NUMBER },
      KEY_DEFAULT_FORMULA_STYLE: { refType: BuiltinTypes.NUMBER },
      KEY_DEFAULT_TEXT_STYLE: { refType: BuiltinTypes.NUMBER },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, financialLayoutElemID.name],
  })

  innerTypes.financialLayoutRows = financialLayoutRows
  innerTypes.financiallayout_dependencies = financialLayoutDependencies
  innerTypes.innerfields = financialLayoutInnerFields
  innerTypes.financialLayoutRowsRecord = financialLayoutRowsRecord

  const financiallayout = createMatchingObjectType<FullFinancialLayoutType>({
    elemID: financialLayoutElemID,
    annotations: {},
    fields: {
      scriptid: {
        refType: BuiltinTypes.SERVICE_ID,
        annotations: {
          _required: true,
          [constants.IS_ATTRIBUTE]: true,
          [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ regex: '^customlayout[0-9a-z_]+' }),
        },
      },
      layout: {
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
        refType: financialLayoutDependencies,
        annotations: {},
      },
      rows: {
        refType: new ListType(financialLayoutRows),
      },
      flags: {
        refType: financialLayoutInnerFields,
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, financialLayoutElemID.name],
  })

  return { type: financiallayout, innerTypes }
}
