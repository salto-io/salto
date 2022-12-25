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
import { Values } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { ElementCompact } from 'xml-js'
import { ElementParts,
  AttributeObject,
  RecordObject,
  getJson, getElementDependency,
  getObjectFromValues,
  getFlags,
  extractRecordsValues,
  safeAssignKeyValue } from '../report_types_parser_utils'

type FilterObject = { descriptor: { values: { Value: AttributeObject[] }}
 values: { values: {Record: RecordObject | RecordObject[]} }}

export type SavedSearchType = {
  searchFilter?: Values[]
  searchSummaryFilters?: Values[]
  availableFilters?: Values[]
  returnFields?: Values[]
  detailFields?: Values[]
  sortColumns?: Values[]
  audience?: Values
  alertRecipients?: Values[]
}

const getSearchDefinition = (search: ElementCompact): ElementCompact =>
  search['nssoc:SerializedObjectContainer']['nssoc:definition'].SearchDefinition

const getFilterRecords = (filter: FilterObject): Values[] =>
  collections.array.makeArray(filter.values.values?.Record)
    .map(record => getObjectFromValues(record.values.Value))

const getFilter = (filter: FilterObject): Values => {
  const parsedFilter = getObjectFromValues(filter.descriptor.values.Value)
  const records = getFilterRecords(filter)
  if (!_.isEmpty(records)) {
    Object.assign(parsedFilter, { RECORDS: records })
  }
  return parsedFilter
}

const extractSearchDefinitionValues = (search: ElementCompact): Values[] =>
  collections.array.makeArray(search.values?.SearchFilter).map(getFilter)

const getAudience = (search: ElementCompact[]): Values => {
  const record = collections.array.makeArray(search).filter(i => Object.keys(i).includes('Record'))[0]
  return record === undefined ? [] : getObjectFromValues(record.Record.values.Value)
}

const getAlertRecipients = (search: ElementCompact): Values[] => {
  if (search.alertRecipientFields === undefined
    || search.alertRecipientFields.values === undefined) {
    return []
  }
  return collections.array.makeArray(search.alertRecipientFields.values.Record)
    .map((record:RecordObject) => getObjectFromValues(record.values.Value))
}

const getSearchPartsFromDefinition = async (definition:string): Promise<ElementParts> => {
  const parsedXml = await getJson(definition)
  return { definition: getSearchDefinition(parsedXml),
    dependency: getElementDependency(parsedXml) }
}

export const parseDefinition = async (definition:string): Promise<SavedSearchType> => {
  const searchParts = await getSearchPartsFromDefinition(definition)
  const returnInstance = {}
  safeAssignKeyValue(returnInstance, 'search_filter', extractSearchDefinitionValues(searchParts.definition.filters))
  safeAssignKeyValue(returnInstance, 'search_summary_filters', extractSearchDefinitionValues(searchParts.definition.summaryFilters))
  safeAssignKeyValue(returnInstance, 'available_filters', extractRecordsValues(searchParts.definition.availableFilterFields))
  safeAssignKeyValue(returnInstance, 'return_fields', extractRecordsValues(searchParts.definition.returnFields))
  safeAssignKeyValue(returnInstance, 'detail_fields', extractRecordsValues(searchParts.definition.detailFields))
  safeAssignKeyValue(returnInstance, 'sort_columns', extractRecordsValues(searchParts.definition.sortColumns))
  safeAssignKeyValue(returnInstance, 'audience', getAudience(searchParts.dependency))
  safeAssignKeyValue(returnInstance, 'alert_recipients', getAlertRecipients(searchParts.definition))
  Object.assign(returnInstance, getFlags(searchParts.definition))
  return returnInstance
}
