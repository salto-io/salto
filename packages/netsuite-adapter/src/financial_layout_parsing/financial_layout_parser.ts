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
/* eslint-disable no-underscore-dangle */
import { Value, Values } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { ElementCompact } from 'xml-js'
import {
  getSearchDependency,
  getJson,
  ElementParts,
  getFlags,
  safeAssignKeyValue,
  RecordObject,
  getObjectFromValues,
  AttributeObject,
} from '../saved_search_parsing/saved_search_parser'

const ROWS = 'rows'

type RowObject = { descriptor: { values: { Value: AttributeObject[] }}
details?: { values: { Record: RecordObject | RecordObject[] } }}

const getLayoutDefinition = (search: ElementCompact): ElementCompact =>
  search['nssoc:SerializedObjectContainer']['nssoc:definition'].FinancialLayout

const getLayoutParts = async (definition: string): Promise<ElementParts> => {
  const parsedXml = await getJson(definition)
  return { definition: getLayoutDefinition(parsedXml),
    dependency: getSearchDependency(parsedXml) }
}

const getRowRecords = (row: RowObject): Values[] =>
  collections.array.makeArray(row.details?.values?.Record)
    .map(record => getObjectFromValues(record.values.Value))


const getLayoutRows = (rows: RowObject[]): Values =>
  collections.array.makeArray(rows).map(row => {
    const parsedRow = getObjectFromValues(row.descriptor.values.Value)
    const records = getRowRecords(row)
    if (!_.isEmpty(records)) {
      Object.assign(parsedRow, { RECORDS: records })
    }
    return parsedRow
  })


export const parseDefinition = async (definition: string): Promise<Value> => {
  const layoutParts = await getLayoutParts(definition)
  const returnInstance = {}
  safeAssignKeyValue(returnInstance, ROWS, getLayoutRows(layoutParts.definition.rows.values.FinancialRowElement))
  Object.assign(returnInstance, getFlags(layoutParts.definition))
  return returnInstance
}
