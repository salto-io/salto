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
/* eslint-disable no-underscore-dangle */
import { collections, values as lowerDashValues } from '@salto-io/lowerdash'
import { ungzip } from 'node-gzip'
import { xml2js, ElementCompact } from 'xml-js'
import { FINANCIAL_LAYOUT, REPORT_DEFINITION, SAVED_SEARCH } from '../constants'

export type ElementParts = {
  definition?: ElementCompact
  dependency: ElementCompact[]
}

export type AttributeObject = {
  _attributes?: {
    clazz?: string
    field?: string
  }
  _text?: string
}

type RecordValueObject = AttributeObject[] | AttributeObject
export type RecordObject = {
  values?: {
    Value?: RecordValueObject
  }
}

type AttributeValue = string | boolean | number

const tempMap: Record<string, string> = {
  [REPORT_DEFINITION]: 'ReportDefinition',
  [SAVED_SEARCH]: 'SearchDefinition',
  [FINANCIAL_LAYOUT]: 'FinancialLayout',
}

export const getDefinitionOrLayout = (definition: ElementCompact, reportType: string): ElementCompact | undefined => {
  const tempname = tempMap[reportType]
  return definition['nssoc:SerializedObjectContainer']?.['nssoc:definition']?.[tempname]
}

export const getJson = async (definition: string): Promise<ElementCompact> => {
  const gzip = Buffer.from(definition.split('@').slice(-1)[0], 'base64')
  const xmlValue = await ungzip(gzip)
  return xml2js(xmlValue.toString(), { compact: true })
}

export const getElementDependency = (element: ElementCompact): ElementCompact[] =>
  collections.array.makeArray(element['nssoc:SerializedObjectContainer']?.['nssoc:dependencies']?.['nssoc:dependency'])

const getAttributeValue = (attribute: AttributeObject): AttributeValue | undefined => {
  if (attribute._attributes?.clazz === 'boolean') {
    return attribute._text === 'true'
  }
  if (attribute._attributes?.clazz && ['int', 'double'].includes(attribute._attributes.clazz)) {
    return Number(attribute._text)
  }
  return attribute._text
}

export const getObjectFromValues = (values: RecordValueObject | undefined): Record<string, AttributeValue> =>
  Object.fromEntries(
    collections.array
      .makeArray(values)
      .map(i => {
        if (i._attributes?.field === undefined) {
          return undefined
        }
        const attributeValue = getAttributeValue(i)
        return attributeValue !== undefined ? [i._attributes.field, attributeValue] : undefined
      })
      .filter(lowerDashValues.isDefined),
  )

export const getFlags = (element: ElementCompact | undefined): Record<string, AttributeValue> =>
  getObjectFromValues(element?.descriptor?.values?.Value)

export const extractRecordsValues = (element: ElementCompact | undefined): Record<string, AttributeValue>[] =>
  collections.array.makeArray(element?.values?.Record).map(record => getObjectFromValues(record?.values?.Value))
