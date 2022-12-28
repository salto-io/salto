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
import { ungzip } from 'node-gzip'
import { xml2js, ElementCompact } from 'xml-js'
import { FINANCIAL_LAYOUT, REPORT_DEFINITION, SAVED_SEARCH } from './constants'

export type ElementParts = {
  definition: ElementCompact
  dependency: ElementCompact[]
}
export type AttributeValue = string | boolean | number
export type AttributeObject = {
  _attributes: {
    clazz:string
    field:string
  }
  _text:string
}
export type RecordValueObject = AttributeObject[] | AttributeObject
export type RecordObject = {
  values: {
    Value: RecordValueObject
  }
}
const tempMap: Record<string, string> = {
  [REPORT_DEFINITION]: 'ReportDefinition',
  [SAVED_SEARCH]: 'SearchDefinition',
  [FINANCIAL_LAYOUT]: 'FinancialLayout',
}

export const getDefinitionOrLayout = (definition: ElementCompact, reportType: string): ElementCompact => {
  const tempname = tempMap[reportType]
  return definition['nssoc:SerializedObjectContainer']['nssoc:definition'][tempname]
}

export const getJson = async (definition: string): Promise<ElementCompact> => {
  const gzip = Buffer.from(definition.split('@').slice(-1)[0], 'base64')
  const xmlValue = await ungzip(gzip)
  return xml2js(xmlValue.toString(), { compact: true })
}

export const getElementDependency = (element: ElementCompact): ElementCompact[] =>
  element['nssoc:SerializedObjectContainer']['nssoc:dependencies']['nssoc:dependency']

export const getAttributeValue = (attribute: AttributeObject): AttributeValue => {
  if (attribute._attributes.clazz === 'boolean') {
    return attribute._text === 'true'
  }
  if (['int', 'double'].includes(attribute._attributes.clazz)) {
    return Number(attribute._text)
  }
  return attribute._text
}

export const getObjectFromValues = (values: RecordValueObject): Record<string, AttributeValue> =>
  Object.fromEntries(collections.array.makeArray(values)
    .filter(i => i._text !== undefined)
    .map(i => [i._attributes.field, getAttributeValue(i)]))

export const getFlags = (element: ElementCompact): Values =>
  getObjectFromValues(element.descriptor.values.Value)

export const extractRecordsValues = (element: ElementCompact): Values[] =>
  collections.array.makeArray(element?.values?.Record)
    .map(record => getObjectFromValues(record.values.Value))

export const safeAssignKeyValue = (instance:Values, key: string, value: Values): void => {
  if (Array.isArray(value) && _.isEmpty(value)) {
    return
  }
  Object.assign(instance, { [key]: value })
}
