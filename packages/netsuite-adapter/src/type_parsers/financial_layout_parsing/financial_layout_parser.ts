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
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { ElementCompact } from 'xml-js'
import { FINANCIAL_LAYOUT } from '../../constants'
import {
  getJson,
  getFlags,
  getObjectFromValues,
  AttributeObject,
  RecordObject,
  getDefinitionOrLayout,
} from '../report_types_parser_utils'
import { LayoutRowType, ParsedFinancialLayout, RowRecordType } from './parsed_financial_layout'

type RowObject = {
  descriptor?: {
    values?: {
      Value?: AttributeObject[]
    }
  }
  details?: {
    values?: {
      Record?: RecordObject | RecordObject[]
    }
  }
}

const getLayoutParts = async (definition: string): Promise<ElementCompact | undefined> => {
  const parsedXml = await getJson(definition)
  return getDefinitionOrLayout(parsedXml, FINANCIAL_LAYOUT)
}

const getRowRecords = (row: RowObject | undefined): RowRecordType[] =>
  collections.array.makeArray(row?.details?.values?.Record).map(record => getObjectFromValues(record?.values?.Value))

const getLayoutRows = (rows: RowObject[] | undefined): LayoutRowType[] =>
  collections.array.makeArray(rows).map(row => {
    const parsedRow = getObjectFromValues(row.descriptor?.values?.Value)
    const records = getRowRecords(row)
    return {
      ...parsedRow,
      ...(!_.isEmpty(records) ? { RECORDS: records } : {}),
    }
  })

export const parseDefinition = async (layout: string): Promise<ParsedFinancialLayout> => {
  const financialLayout = await getLayoutParts(layout)
  return _.omitBy(
    {
      rows: getLayoutRows(financialLayout?.rows?.values?.FinancialRowElement),
      flags: getFlags(financialLayout),
    },
    _.isEmpty,
  )
}
