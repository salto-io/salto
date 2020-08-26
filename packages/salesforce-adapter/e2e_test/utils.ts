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
import { Value, ObjectType, ElemID, InstanceElement, Element, isObjectType, ChangeGroup, getChangeElement } from '@salto-io/adapter-api'
import {
  findElement,
} from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { MetadataInfo } from 'jsforce'
import { SalesforceRecord } from '../src/client/types'
import { filtersRunner } from '../src/filter'
import { SALESFORCE } from '../src/constants'
import SalesforceAdapter, { DEFAULT_FILTERS } from '../src/adapter'
import SalesforceClient from '../src/client/client'
import { createInstanceElement, metadataType, apiName, MetadataValues, isInstanceOfCustomObject } from '../src/transformers/transformer'
import { ConfigChangeSuggestion, FilterContext } from '../src/types'
import { fetchMetadataType } from '../src/fetch'

const { makeArray } = collections.array
const { toArrayAsync } = collections.asynciterable

export const getMetadata = async (client: SalesforceClient, type: string, fullName: string):
Promise<MetadataInfo | undefined> => {
  const instanceInfo = (await client.readMetadata(type, fullName)).result[0]
  if (instanceInfo && instanceInfo.fullName) {
    return instanceInfo
  }
  return undefined
}

export const getRecordOfInstance = async (
  client: SalesforceClient,
  instance: InstanceElement,
  additionalFields = [] as string[],
): Promise<SalesforceRecord | undefined> => {
  const selectFieldsString = _.uniq(['Id'].concat(additionalFields)).join(',')
  const queryString = `SELECT ${selectFieldsString} FROM ${apiName(instance.type)} WHERE Id = '${instance.value.Id}'`
  const queryResult = await client.queryAll(queryString)
  const records = (await toArrayAsync(queryResult)).flat()
  return records[0]
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

export const fetchTypes = async (
  client: SalesforceClient, types: string[]
): Promise<ObjectType[]> => {
  const typeInfos = await client.listMetadataTypes()
  const topLevelTypes = typeInfos.filter(info => types.includes(info.xmlName))
  const baseTypeNames = new Set(topLevelTypes.map(info => info.xmlName))
  const childTypeNames = new Set(topLevelTypes.flatMap(info => info.childXmlNames))
  const additionalTypeInfos = types
    .filter(typeName => !baseTypeNames.has(typeName))
    .map(typeName => ({
      xmlName: typeName,
      childXmlNames: [],
      directoryName: '',
      inFolder: false,
      metaFile: false,
      suffix: '',
    }))
  const knownTypes = new Map()
  const res = await Promise.all(
    topLevelTypes
      .concat(additionalTypeInfos)
      .map(info => fetchMetadataType(client, info, knownTypes, baseTypeNames, childTypeNames))
  )
  return res.flat().filter(isObjectType)
}

type CreateInstanceParams = {
  value: MetadataValues
  typeElements?: Iterable<Element>
  type: string | ObjectType
}
export function createInstance(params: { value: MetadataValues; type: ObjectType }): InstanceElement
export function createInstance(
  params: { value: MetadataValues; type: string; typeElements: Iterable<Element> }
): InstanceElement
export function createInstance(
  { value, typeElements, type }: CreateInstanceParams
): InstanceElement {
  const objectType = isObjectType(type)
    ? type
    : findElement(typeElements as Iterable<Element>, new ElemID(SALESFORCE, type)) as ObjectType
  return createInstanceElement(value, objectType)
}

export const getMetadataInstance = async (client: SalesforceClient, type: ObjectType,
  fullName: string): Promise<InstanceElement | undefined> => {
  const md = await getMetadata(client, isObjectType(type) ? metadataType(type) : type, fullName)
  return md === undefined ? undefined : createInstance({ value: md, type })
}

export const removeMetadataIfAlreadyExists = async (
  client: SalesforceClient,
  type: string,
  fullName: string
): Promise<void> => {
  if (await getMetadata(client, type, fullName)) {
    await client.delete(type, fullName)
  }
}

const removeRecordIfAlreadyExists = async (
  client: SalesforceClient,
  instance: InstanceElement
): Promise<void> => {
  if (await getRecordOfInstance(client, instance) !== undefined) {
    await client.bulkLoadOperation(apiName(instance.type), 'delete', [{ Id: instance.value.Id }])
  }
}

export const removeElementIfAlreadyExists = async (
  client: SalesforceClient,
  element: InstanceElement | ObjectType
): Promise<void> => {
  if (isInstanceOfCustomObject(element)) {
    await removeRecordIfAlreadyExists(client, element)
  } else {
    const mdType = metadataType(element)
    const fullName = apiName(element)
    await removeMetadataIfAlreadyExists(client, mdType, fullName)
  }
}

export const createElement = async <T extends InstanceElement | ObjectType>(
  adapter: SalesforceAdapter, element: T
): Promise<T> => {
  const changeGroup: ChangeGroup = {
    groupID: 'add test elements',
    changes: [{ action: 'add', data: { after: element } }],
  }
  const result = await adapter.deploy(changeGroup)
  if (result.errors.length > 0) {
    if (result.errors.length === 1) throw result.errors[0]
    throw new Error(`Failed adding element ${element.elemID.getFullName()} with errors: ${result.errors}`)
  }
  return getChangeElement(result.appliedChanges[0]) as T
}

export const createElementAndVerify = async <T extends InstanceElement | ObjectType> (
  adapter: SalesforceAdapter, client: SalesforceClient, element: T,
): Promise<T> => {
  const result = await createElement(adapter, element)
  if (isInstanceOfCustomObject(element)) {
    expect(await getRecordOfInstance(client, element)).toBeDefined()
  } else {
    expect(await getMetadataFromElement(client, element)).toBeDefined()
  }
  return result
}

export const createAndVerify = async (adapter: SalesforceAdapter, client: SalesforceClient,
  type: string, md: MetadataInfo, typeElements: Iterable<Element>): Promise<InstanceElement> => {
  const instance = await createInstance({ value: md, type, typeElements })
  await createElementAndVerify(adapter, client, instance)
  return instance
}

export const removeElement = async <T extends InstanceElement | ObjectType>(
  adapter: SalesforceAdapter, element: T
): Promise<void> => {
  const changeGroup: ChangeGroup = {
    groupID: 'remove test elements',
    changes: [{ action: 'remove', data: { before: element } }],
  }
  const result = await adapter.deploy(changeGroup)
  if (result.errors.length > 0) {
    if (result.errors.length === 1) throw result.errors[0]
    throw new Error(`Failed adding element ${element.elemID.getFullName()} with errors: ${result.errors}`)
  }
}

export const removeElementAndVerify = async (adapter: SalesforceAdapter, client: SalesforceClient,
  element: InstanceElement | ObjectType): Promise<void> => {
  await removeElement(adapter, element)
  if (isInstanceOfCustomObject(element)) {
    expect(await getRecordOfInstance(client, element)).toBeUndefined()
  } else {
    expect(await getMetadataFromElement(client, element)).toBeUndefined()
  }
}

export const runFiltersOnFetch = async (
  client: SalesforceClient,
  context: FilterContext,
  elements: Element[],
  filterCreators = DEFAULT_FILTERS
): Promise<void | ConfigChangeSuggestion[]> =>
  filtersRunner(client, context, filterCreators).onFetch(elements)
