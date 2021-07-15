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
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { ungzip } from 'node-gzip'
import { xml2js, ElementCompact } from 'xml-js'

type ElementParts = { definition: ElementCompact; dependency: ElementCompact[] }
type AttributeValue = string | boolean | number | undefined
type AttributeObject = { _attributes: { clazz:string; field:string }; _text:string }
type RecordObject = { values: { Value:AttributeObject[]}}
type FilterObject = { descriptor: { values: { Value: AttributeObject[] }}
 values: { values: {Record: RecordObject | RecordObject[]} }}

const getJson = async (definition: string): Promise<ElementCompact> => {
  const gzip = Buffer.from(definition.split('@').slice(-1)[0], 'base64')
  const xmlValue = await ungzip(gzip)
  return xml2js(xmlValue.toString(), { compact: true })
}

const getSearchDefinition = (search: ElementCompact): ElementCompact =>
  search['nssoc:SerializedObjectContainer']['nssoc:definition'].SearchDefinition

const getSearchDependency = (search: ElementCompact): ElementCompact[] =>
  search['nssoc:SerializedObjectContainer']['nssoc:dependencies']['nssoc:dependency']

const getAttributeValue = (attribute: AttributeObject): AttributeValue => {
  if (attribute._attributes.clazz === 'boolean') {
    return attribute._text === 'true'
  }
  if (attribute._attributes.clazz === 'int') {
    return Number(attribute._text)
  }
  return attribute._text
}

const getObjectFromValues = (values: AttributeObject[]): Values => {
  if (values === undefined) {
    return []
  }
  return Object.fromEntries(values.filter(i => i._text !== undefined)
    .map(i => [i._attributes.field, getAttributeValue(i)]))
}

const getRecords = (filter: FilterObject): Values[] =>
  collections.array.makeArray(filter.values.values?.Record)
    .map(record => getObjectFromValues(record.values.Value))

const getFilter = (filter: FilterObject): Values =>
  Object.assign(getObjectFromValues(filter.descriptor.values.Value),
    { RECORDS: getRecords(filter) })

const extractSearchDefinitionValues = (search: ElementCompact): Values[] =>
  collections.array.makeArray(search.values?.SearchFilter).map(getFilter)

const getFlags = (search: ElementCompact): Values =>
  getObjectFromValues(search.descriptor.values.Value)

const extractSearchRecordsValues = (search: ElementCompact): Values[] =>
  collections.array.makeArray(search.values?.Record)
    .map(record => getObjectFromValues(record.values.Value))

const getAudience = (search: ElementCompact[]): Values => {
  if (!Array.isArray(search)) {
    return []
  }
  const record = search.filter(i => Object.keys(i).includes('Record'))[0]
  if (record === undefined) {
    return []
  }
  return getObjectFromValues(record.Record.values.Value)
}

const getSortColumns = (search: ElementCompact): Values => {
  if (search.sortColumns.values === undefined) {
    return []
  }
  return getObjectFromValues(search.sortColumns.values.Record.values.Value)
}

const getAlertRecipients = (search: ElementCompact): Values[] => {
  if (search.alertRecipientFields === undefined
    || search.alertRecipientFields.values === undefined) {
    return []
  }
  return getRecords(search.alertRecipientFields)
  // if (Array.isArray(search.alertRecipientFields.values.Record)) {
  //   return search.alertRecipientFields.values.Record
  //     .map((record:RecordObject) => record.values.Value)
  //     .map((attribute:AttributeObject) => Object
  //       .fromEntries([[attribute._attributes.field, attribute._text]]))
  // }
  // const singleRecordattribute:AttributeObject = search
  //   .alertRecipientFields.values.Record.values.Value
  // return [Object.fromEntries([[singleRecordattribute._attributes.field,
  //   singleRecordattribute._text]])]
}

const safeAssignKeyValue = (instance:Values, key: string, value: Values):void => {
  if (Array.isArray(value) && _.isEmpty(value)) {
    return
  }
  Object.assign(instance, { [key]: value })
}

const getSearchPartsFromDefinition = async (definition:string):Promise<ElementParts> => {
  const parsedXml = await getJson(definition)
  return { definition: getSearchDefinition(parsedXml),
    dependency: getSearchDependency(parsedXml) }
}

export const parseDefinition = async (definition:string):Promise<Values> => {
  const searchparts = await getSearchPartsFromDefinition(definition)
  const returnInstance = {}
  safeAssignKeyValue(returnInstance, 'search_filter', extractSearchDefinitionValues(searchparts.definition.filters))
  safeAssignKeyValue(returnInstance, 'search_summary_filters', extractSearchDefinitionValues(searchparts.definition.summaryFilters))
  safeAssignKeyValue(returnInstance, 'available_filters', extractSearchRecordsValues(searchparts.definition.availableFilterFields))
  safeAssignKeyValue(returnInstance, 'return_fields', extractSearchRecordsValues(searchparts.definition.returnFields))
  safeAssignKeyValue(returnInstance, 'detail_fields', extractSearchRecordsValues(searchparts.definition.detailFields))
  safeAssignKeyValue(returnInstance, 'sort_columns', getSortColumns(searchparts.definition))
  safeAssignKeyValue(returnInstance, 'audience:', getAudience(searchparts.dependency))
  safeAssignKeyValue(returnInstance, 'alert_recipients', getAlertRecipients(searchparts.definition))
  Object.assign(returnInstance, getFlags(searchparts.definition))
  return returnInstance
}
