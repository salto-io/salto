/*
*                      Copyright 2020 Salto Labs Ltd.
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
import _ from 'lodash'
import {
  Value, ObjectType, ElemID, InstanceElement, Values, TypeElement, Element, isObjectType,
} from '@salto-io/adapter-api'
import {
  findElement,
} from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { MetadataInfo } from 'jsforce'
import { filtersRunner } from '../src/filter'
import { SALESFORCE } from '../src/constants'
import SalesforceAdapter, { DEFAULT_FILTERS } from '../src/adapter'
import SalesforceClient from '../src/client/client'
import { createInstanceElement, metadataType, apiName, createMetadataTypeElements } from '../src/transformers/transformer'
import { ConfigChangeSuggestion, FilterContext } from '../src/types'

const { makeArray } = collections.array

export const getMetadata = async (client: SalesforceClient, type: string, fullName: string):
Promise<MetadataInfo | undefined> => {
  const instanceInfo = (await client.readMetadata(type, fullName)).result[0]
  if (instanceInfo && instanceInfo.fullName) {
    return instanceInfo
  }
  return undefined
}

export const objectExists = async (client: SalesforceClient, type: string, name: string,
  fields?: string[], missingFields?: string[], annotations?: Record<string, Value>):
  Promise<boolean> => {
  const readResult = await getMetadata(client, type, name)
  if (!readResult || !readResult.fullName) {
    return false
  }
  if (fields || missingFields) {
    const fieldNames = makeArray(_.get(readResult, 'fields')).map(rf => rf.fullName)
    if (fields && !fields.every(f => fieldNames.includes(f))) {
      return false
    }
    return (!missingFields || missingFields.every(f => !fieldNames.includes(f)))
  }
  if (annotations) {
    const valuesMatch = Object.entries(annotations)
      .every(([annotationName, expectedVal]) =>
        _.isEqual(_.get(readResult, annotationName), expectedVal))
    if (!valuesMatch) {
      return false
    }
  }
  return true
}

export const getMetadataFromElement = async (client: SalesforceClient,
  element: InstanceElement | ObjectType): Promise<MetadataInfo | undefined> => {
  const mdType = metadataType(element)
  const fullName = apiName(element)
  return getMetadata(client, mdType, fullName)
}

export const fetchTypes = async (client: SalesforceClient, types: string[]):
Promise<ObjectType[]> => {
  const baseTypeNames = new Set(types)
  const subTypes = new Map<string, TypeElement>()
  return _.flatten(await Promise.all(types.map(async type =>
    createMetadataTypeElements(type, await client.describeMetadataType(type), subTypes,
      baseTypeNames, client))))
}

export const createInstance = async (client: SalesforceClient, value: Values,
  type: string | ObjectType): Promise<InstanceElement> => {
  const objectType = isObjectType(type)
    ? type
    : findElement(await fetchTypes(client, [type]), new ElemID(SALESFORCE, type)) as ObjectType
  return createInstanceElement(value, objectType)
}

export const getInstance = async (client: SalesforceClient, type: string | ObjectType,
  fullName: string): Promise<InstanceElement | undefined> => {
  const md = await getMetadata(client, isObjectType(type) ? metadataType(type) : type, fullName)
  return _.isUndefined(md) ? undefined : createInstance(client, md, type)
}

export const removeIfAlreadyExists = async (client: SalesforceClient, type: string,
  fullName: string): Promise<void> => {
  if (await getMetadata(client, type, fullName)) {
    await client.delete(type, fullName)
  }
}

export const removeElementIfAlreadyExists = async (client: SalesforceClient,
  element: InstanceElement | ObjectType): Promise<void> => {
  const mdType = metadataType(element)
  const fullName = apiName(element)
  return removeIfAlreadyExists(client, mdType, fullName)
}

export const createElementAndVerify = async (adapter: SalesforceAdapter, client: SalesforceClient,
  element: InstanceElement | ObjectType): Promise<MetadataInfo> => {
  await adapter.add(element)
  const md = await getMetadataFromElement(client, element)
  expect(md).toBeDefined()
  return md as MetadataInfo
}

export const createAndVerify = async (adapter: SalesforceAdapter, client: SalesforceClient,
  type: string, md: MetadataInfo): Promise<InstanceElement> => {
  const instance = await createInstance(client, md, type)
  await createElementAndVerify(adapter, client, instance)
  return instance
}

export const removeElementAndVerify = async (adapter: SalesforceAdapter, client: SalesforceClient,
  element: InstanceElement | ObjectType): Promise<void> => {
  await adapter.remove(element)
  expect(await getMetadataFromElement(client, element)).toBeUndefined()
}

export const runFiltersOnFetch = async (
  client: SalesforceClient, config: FilterContext, fetchResult: Element[]
): Promise<void | ConfigChangeSuggestion[]> =>
  filtersRunner(client, config, DEFAULT_FILTERS).onFetch(fetchResult)
