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

import { isInstanceElement, isObjectType, Values } from '@salto-io/adapter-api'
import _ from 'lodash'
import { ungzip } from 'node-gzip'
import { xml2js, ElementCompact } from 'xml-js'
import { SAVED_SEARCH } from '../constants'
import { FilterCreator, FilterWith } from '../filter'
import { savedsearch, savedsearchInnerTypes } from '../types/custom_types/parsedSavedSearch'

type attributeValue = string | boolean | number | undefined
type attributeObject = { _attributes: { clazz:string; field:string }; _text:string }
type recordObject = { values: { Value:attributeObject[] }}
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

const getObjectFromValues = (values: attributeObject[]): Values =>
  Object.fromEntries(values.filter(i => i._text !== undefined)
    .map(i => [i._attributes.field, getAttributeValue(i)]))

const getRecordsForFilter = (filter: filterObject): Values[] => {
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
  return search.availableFilterFields.values.Record
    .map((record:recordObject) => getObjectFromValues(record.values.Value))
}

const getReturnFields = (search: ElementCompact): Values[] => {
  if (search.returnFields.values === undefined) {
    return []
  }
  return search.returnFields.values.Record
    .map((record:recordObject) => getObjectFromValues(record.values.Value))
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
  return search.alertRecipientFields.values.Record
}

const filterCreator: FilterCreator = (): FilterWith<'onFetch'> => ({
  onFetch: async elements => {
    _.remove(elements, e => isObjectType(e) && e.elemID.name === SAVED_SEARCH)
    elements.push(savedsearch)
    elements.push(...savedsearchInnerTypes)
    // elements.filter(e => isInstanceElement(e)
    // && e.elemID.typeName === SAVED_SEARCH).forEach((instance => {
    //   instance.value = { ...instance.value,
    // ...get_json(instance.value.definition)}
    // }))
    const values = await Promise.all(elements.filter(isInstanceElement)
      .filter(e => e.elemID.typeName === SAVED_SEARCH)
      .map(async e => getJson(e.value.definition)))
    values.map(i => getFlags(getSearchDefinition(i)))
    values.map(i => getFilters(getSearchDefinition(i)))
    values.map(i => getSummaryFilters(getSearchDefinition(i)))
    values.map(i => getAvailableFilters(getSearchDefinition(i)))
    values.map(i => getReturnFields(getSearchDefinition(i)))
    values.map(i => getSortColumns(getSearchDefinition(i)))
    values.map(i => getAlertRecipients(getSearchDefinition(i)))
    values.map(i => getAudience(getSearchDependency(i)))
  },
})

export default filterCreator
