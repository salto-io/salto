/*
*                      Copyright 2021 Salto Labs Ltd.
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
import _ from 'lodash'
import { ungzip } from 'node-gzip'
import { xml2js, ElementCompact } from 'xml-js'

type attributeValue = string | boolean | number | undefined
type attributeObject = { _attributes: { clazz:string; field:string }; _text:string }
type recordObject = { values: { Value:attributeObject[]}}
type filterObject = { descriptor: { values: { Value: attributeObject[] }}
 values: { values: {Record: recordObject | recordObject[]} }}

const getJson = async (defenition: string): Promise<ElementCompact> => {
  const gzip = Buffer.from(defenition.split('@').slice(-1)[0], 'base64')
  const xmlValue = await ungzip(gzip)
  return xml2js(xmlValue.toString(), { compact: true })
}

const getSearchDefinition = (search: ElementCompact): ElementCompact =>
  search['nssoc:SerializedObjectContainer']['nssoc:definition'].SearchDefinition

const getSearchDependency = (search: ElementCompact): ElementCompact[] =>
  search['nssoc:SerializedObjectContainer']['nssoc:dependencies']['nssoc:dependency']

const getAttributeValue = (attribute: attributeObject): attributeValue => {
  if (attribute._attributes.clazz === 'boolean') {
    return attribute._text === 'true'
  }
  if (attribute._attributes.clazz === 'int') {
    return Number(attribute._text)
  }
  return attribute._text
}

const getObjectFromValues = (values: attributeObject[]): Values => {
  if (values === undefined) {
    return []
  }
  return Object.fromEntries(values.filter(i => i._text !== undefined)
    .map(i => [i._attributes.field, getAttributeValue(i)]))
}

const getRecordsForFilter = (filter: filterObject): Values[] => {
  if (filter.values.values === undefined) {
    return []
  }
  if (Array.isArray(filter.values.values.Record)) {
    return filter.values.values.Record.map(record => getObjectFromValues(record.values.Value))
  }
  return [getObjectFromValues(filter.values.values.Record.values.Value)]
}

const getFilter = (filter: filterObject): Values =>
  Object.assign(getObjectFromValues(filter.descriptor.values.Value),
    { RECORDS: getRecordsForFilter(filter) })

const getFilters = (search: ElementCompact): Values[] => {
  if (search.filters.values === undefined) {
    return []
  }
  const searchFilter = search.filters.values.SearchFilter
  if (Array.isArray(searchFilter)) {
    return searchFilter.map(getFilter)
  }
  return [getFilter(searchFilter)]
}

const getFlags = (search: ElementCompact): Values =>
  getObjectFromValues(search.descriptor.values.Value)

const getSummaryFilters = (search: ElementCompact): Values => {
  if (search.summaryFilters.values === undefined) {
    return []
  }
  const searchFilter = search.summaryFilters.values.SearchFilter
  if (Array.isArray(searchFilter)) {
    return searchFilter.map(getFilter)
  }
  return [getFilter(searchFilter)]
}

const getAudience = (search: ElementCompact[]): Values => {
  const record = search.filter(i => Object.keys(i).includes('Record'))[0]
  if (record === undefined) {
    return []
  }
  return getObjectFromValues(record.Record.values.Value)
}

const getAvailableFilters = (search: ElementCompact): Values[] => {
  if (search.availableFilterFields.values === undefined) {
    return []
  }
  if (Array.isArray(search.availableFilterFields.values.Record)) {
    return search.availableFilterFields.values.Record
      .map((record:recordObject) => getObjectFromValues(record.values.Value))
  }
  return [getObjectFromValues((search.availableFilterFields.values.Record.values.Value))]
}

const getReturnFields = (search: ElementCompact): Values[] => {
  if (search.returnFields.values === undefined) {
    return []
  }
  if (Array.isArray(search.returnFields.values.Record)) {
    return search.returnFields.values.Record
      .map((record:recordObject) => getObjectFromValues(record.values.Value))
  }
  return [getObjectFromValues(search.returnFields.values.Record.values.Value)]
}

const getDetailFields = (search: ElementCompact): Values[] => {
  if (search.detailFields.values === undefined) {
    return []
  }
  if (Array.isArray(search.detailFields.values.Record)) {
    return search.detailFields.values.Record
      .map((record:recordObject) => getObjectFromValues(record.values.Value))
  }
  return [getObjectFromValues(search.detailFields.values.Record.values.Value)]
}

const getSortColumns = (search: ElementCompact): Values => {
  if (search.sortColumns.values === undefined) {
    return []
  }
  return getObjectFromValues(search.sortColumns.values.Record.values.Value)
}

const getAlertRecipients = (search: ElementCompact): Values[] => {
  if (search.alertRecipientFields.values === undefined) {
    return []
  }
  if (Array.isArray(search.alertRecipientFields.values.Record)) {
    return search.alertRecipientFields.values.Record
      .map((record:recordObject) => record.values.Value)
      .map((attribute:attributeObject) => Object
        .fromEntries([[attribute._attributes.field, attribute._text]]))
  }
  const singleRecordattribute:attributeObject = search
    .alertRecipientFields.values.Record.values.Value
  return [Object.fromEntries([[singleRecordattribute._attributes.field,
    singleRecordattribute._text]])]
}

const safeAssignKeyValue = (instance:Values, key: string, value: Values):void => {
  if (Array.isArray(value) && _.isEmpty(value)) {
    return
  }
  Object.assign(instance, { [key]: value })
}

export const parseDefinition = async (definition:string):Promise<Values> => {
  const parsedXml = await getJson(definition)
  const searchDefinition = getSearchDefinition(parsedXml)
  const searchDependency = getSearchDependency(parsedXml)
  const returnInstance = Object()
  safeAssignKeyValue(returnInstance, 'search_filter', getFilters(searchDefinition))
  safeAssignKeyValue(returnInstance, 'search_summary_filters', getSummaryFilters(searchDefinition))
  safeAssignKeyValue(returnInstance, 'available_filters', getAvailableFilters(searchDefinition))
  safeAssignKeyValue(returnInstance, 'return_fields', getReturnFields(searchDefinition))
  safeAssignKeyValue(returnInstance, 'detail_fields', getDetailFields(searchDefinition))
  safeAssignKeyValue(returnInstance, 'sort_columns', getSortColumns(searchDefinition))
  safeAssignKeyValue(returnInstance, 'audience:', getAudience(searchDependency))
  safeAssignKeyValue(returnInstance, 'alert_recipients', getAlertRecipients(searchDefinition))
  Object.assign(returnInstance, getFlags(searchDefinition))
  return returnInstance
}
