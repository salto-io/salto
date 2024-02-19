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
import _ from 'lodash'
import {
  Value,
  ObjectType,
  ElemID,
  InstanceElement,
  Element,
  isObjectType,
  ChangeGroup,
  getChangeData,
  DeployResult,
  ProgressReporter,
} from '@salto-io/adapter-api'
import { filter, findElement, safeJsonStringify } from '@salto-io/adapter-utils'
import { collections, values } from '@salto-io/lowerdash'
import { MetadataInfo } from '@salto-io/jsforce'
import { SalesforceRecord } from '../src/client/types'
import { FilterContext, FilterResult } from '../src/filter'
import { SALESFORCE } from '../src/constants'
import SalesforceAdapter, { allFilters } from '../src/adapter'
import SalesforceClient from '../src/client/client'
import {
  createInstanceElement,
  metadataType,
  apiName,
  MetadataValues,
  isInstanceOfCustomObject,
} from '../src/transformers/transformer'
import { fetchMetadataType } from '../src/fetch'
import { defaultFilterContext } from '../test/utils'

const { makeArray } = collections.array
const { toArrayAsync } = collections.asynciterable

export const getMetadata = async (
  client: SalesforceClient,
  type: string,
  fullName: string,
): Promise<MetadataInfo | undefined> => {
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
  uniqueField = 'Id',
): Promise<SalesforceRecord | undefined> => {
  const selectFieldsString = _.uniq(
    [uniqueField].concat(additionalFields),
  ).join(',')
  const queryString = `SELECT ${selectFieldsString} FROM ${await apiName(await instance.getType())} WHERE ${uniqueField} = '${instance.value[uniqueField]}'`
  const queryResult = await client.queryAll(queryString)
  const records = (await toArrayAsync(queryResult)).flat()
  return records[0]
}

export const objectExists = async (
  client: SalesforceClient,
  type: string,
  name: string,
  fields?: string[],
  missingFields?: string[],
  annotations?: Record<string, Value>,
): Promise<boolean> => {
  const readResult = await getMetadata(client, type, name)
  if (!readResult || !readResult.fullName) {
    return false
  }
  if (fields || missingFields) {
    const fieldNames = makeArray(_.get(readResult, 'fields')).map(
      (rf) => rf.fullName,
    )
    if (fields && !fields.every((f) => fieldNames.includes(f))) {
      return false
    }
    return !missingFields || missingFields.every((f) => !fieldNames.includes(f))
  }
  if (annotations) {
    const valuesMatch = Object.entries(annotations).every(
      ([annotationName, expectedVal]) =>
        _.isEqual(_.get(readResult, annotationName), expectedVal),
    )
    if (!valuesMatch) {
      return false
    }
  }
  return true
}

export const getMetadataFromElement = async (
  client: SalesforceClient,
  element: InstanceElement | ObjectType,
): Promise<MetadataInfo | undefined> => {
  const mdType = await metadataType(element)
  const fullName = await apiName(element)
  return getMetadata(client, mdType, fullName)
}

export const fetchTypes = async (
  client: SalesforceClient,
  types: string[],
): Promise<ObjectType[]> => {
  const typeInfos = await client.listMetadataTypes()
  const topLevelTypes = typeInfos.filter((info) => types.includes(info.xmlName))
  const baseTypeNames = new Set(topLevelTypes.map((info) => info.xmlName))
  const childTypeNames = new Set(
    topLevelTypes
      .flatMap((info) => info.childXmlNames)
      .filter(values.isDefined),
  )
  const additionalTypeInfos = types
    .filter((typeName) => !baseTypeNames.has(typeName))
    .map((typeName) => ({
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
      .map((info) =>
        fetchMetadataType(
          client,
          info,
          knownTypes,
          baseTypeNames,
          childTypeNames,
        ),
      ),
  )
  return res.flat().filter(isObjectType)
}

type CreateInstanceParams = {
  value: MetadataValues
  typeElements?: Iterable<Element>
  type: string | ObjectType
}
export function createInstance(params: {
  value: MetadataValues
  type: ObjectType
}): InstanceElement
export function createInstance(params: {
  value: MetadataValues
  type: string
  typeElements: Iterable<Element>
}): InstanceElement
export function createInstance({
  value,
  typeElements,
  type,
}: CreateInstanceParams): InstanceElement {
  const objectType = isObjectType(type)
    ? type
    : (findElement(
        typeElements as Iterable<Element>,
        new ElemID(SALESFORCE, type),
      ) as ObjectType)
  return createInstanceElement(value, objectType)
}

export const getMetadataInstance = async (
  client: SalesforceClient,
  type: ObjectType,
  fullName: string,
): Promise<InstanceElement | undefined> => {
  const md = await getMetadata(
    client,
    isObjectType(type) ? await metadataType(type) : type,
    fullName,
  )
  return md === undefined ? undefined : createInstance({ value: md, type })
}

export const removeMetadataIfAlreadyExists = async (
  client: SalesforceClient,
  type: string,
  fullName: string,
): Promise<void> => {
  if (await getMetadata(client, type, fullName)) {
    await client.delete(type, fullName)
  }
}

const removeRecordIfAlreadyExists = async (
  client: SalesforceClient,
  instance: InstanceElement,
): Promise<void> => {
  if ((await getRecordOfInstance(client, instance)) !== undefined) {
    await client.bulkLoadOperation(
      await apiName(await instance.getType()),
      'delete',
      [{ Id: instance.value.Id }],
    )
  }
}

export const removeElementIfAlreadyExists = async (
  client: SalesforceClient,
  element: InstanceElement | ObjectType,
): Promise<void> => {
  if (await isInstanceOfCustomObject(element)) {
    await removeRecordIfAlreadyExists(client, element as InstanceElement)
  } else {
    const mdType = await metadataType(element)
    const fullName = await apiName(element)
    await removeMetadataIfAlreadyExists(client, mdType, fullName)
  }
}

export const nullProgressReporter: ProgressReporter = {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  reportProgress: () => {},
}

export const createElement = async <T extends InstanceElement | ObjectType>(
  adapter: SalesforceAdapter,
  element: T,
  verify = true,
): Promise<T> => {
  const changeGroup: ChangeGroup = {
    groupID: 'add test elements',
    changes: [{ action: 'add', data: { after: element } }],
  }
  const result = await adapter.deploy({
    changeGroup,
    progressReporter: nullProgressReporter,
  })
  const errors = result.errors.filter((error) => error.severity === 'Error')
  if (verify && errors.length > 0) {
    if (errors.length === 1) throw result.errors[0]
    throw new Error(
      `Failed adding element ${element.elemID.getFullName()} with errors: ${errors.map((error) => safeJsonStringify(error))}`,
    )
  }
  if (verify && result.appliedChanges.length === 0) {
    throw new Error(
      `Failed adding element ${element.elemID.getFullName()}: no applied changes`,
    )
  }
  return getChangeData(result.appliedChanges[0]) as T
}

export const createElementAndVerify = async <
  T extends InstanceElement | ObjectType,
>(
  adapter: SalesforceAdapter,
  client: SalesforceClient,
  element: T,
): Promise<T> => {
  const result = await createElement(adapter, element)
  if (await isInstanceOfCustomObject(element)) {
    expect(
      await getRecordOfInstance(client, element as InstanceElement),
    ).toBeDefined()
  } else {
    expect(await getMetadataFromElement(client, element)).toBeDefined()
  }
  return result
}

export const createAndVerify = async (
  adapter: SalesforceAdapter,
  client: SalesforceClient,
  type: string,
  md: MetadataInfo,
  typeElements: Iterable<Element>,
): Promise<InstanceElement> => {
  const instance = createInstance({ value: md, type, typeElements })
  await createElementAndVerify(adapter, client, instance)
  return instance
}

export const removeElement = async <T extends InstanceElement | ObjectType>(
  adapter: SalesforceAdapter,
  element: T,
  verify = true,
): Promise<DeployResult> => {
  const changeGroup: ChangeGroup = {
    groupID: 'remove test elements',
    changes: [{ action: 'remove', data: { before: element } }],
  }
  const result = await adapter.deploy({
    changeGroup,
    progressReporter: nullProgressReporter,
  })
  if (verify && result.errors.length > 0) {
    if (result.errors.length === 1) throw result.errors[0]
    throw new Error(
      `Failed adding element ${element.elemID.getFullName()} with errors: ${result.errors}`,
    )
  }
  return result
}

export const removeElementAndVerify = async (
  adapter: SalesforceAdapter,
  client: SalesforceClient,
  element: InstanceElement | ObjectType,
): Promise<void> => {
  await removeElement(adapter, element)
  if (await isInstanceOfCustomObject(element)) {
    expect(
      await getRecordOfInstance(client, element as InstanceElement),
    ).toBeUndefined()
  } else {
    expect(await getMetadataFromElement(client, element)).toBeUndefined()
  }
}

export const runFiltersOnFetch = async (
  client: SalesforceClient,
  context: Partial<FilterContext>,
  elements: Element[],
  filterCreators = allFilters.map(({ creator }) => creator),
): Promise<void | FilterResult> =>
  filter
    .filtersRunner(
      { client, config: { ...defaultFilterContext, ...context } },
      filterCreators,
    )
    .onFetch(elements)
