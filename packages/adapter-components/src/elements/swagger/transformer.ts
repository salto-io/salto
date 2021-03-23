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
import _ from 'lodash'
import { InstanceElement, ObjectType, isListType, isMapType, isObjectType, Values } from '@salto-io/adapter-api'
import { collections, values as lowerdashValues } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { HTTPClientInterface, UnauthorizedError } from '../../client'
import { UserFetchConfig, AdapterSwaggerApiConfig, TypeSwaggerConfig, TypeSwaggerDefaultConfig } from '../../config'
import { generateInstancesForType } from './instance_elements'
import { ADDITIONAL_PROPERTIES_FIELD } from './type_elements/swagger_parser'
import { findDataField, FindNestedFieldFunc } from '../field_finder'
import { computeGetArgs as defaultComputeGetArgs, ComputeGetArgsFunc } from '../request_parameters'

const { makeArray } = collections.array
const { toArrayAsync } = collections.asynciterable
const { isDefined } = lowerdashValues
const log = logger(module)

const normalizeType = (type: ObjectType | undefined): ObjectType | undefined => {
  if (type !== undefined && _.isEqual(Object.keys(type.fields), ['items'])) {
    const itemsType = type.fields.items.type
    if (isListType(itemsType) && isObjectType(itemsType.innerType)) {
      return itemsType.innerType
    }
  }
  return type
}

/**
 * Fetch all instances for the specified type, generating the needed API requests
 * based on the endpoint configuration. For endpoints that depend on other endpoints,
 * use the already-fetched elements as context in order to determine the right requests.
 */
const getInstancesForType = async ({
  typeName,
  client,
  typesConfig,
  typeDefaultConfig,
  objectTypes,
  contextElements,
  nestedFieldFinder,
  computeGetArgs,
}: {
  typeName: string
  client: HTTPClientInterface
  objectTypes: Record<string, ObjectType>
  typesConfig: Record<string, TypeSwaggerConfig>
  typeDefaultConfig: TypeSwaggerDefaultConfig
  contextElements?: Record<string, InstanceElement[]>
  nestedFieldFinder: FindNestedFieldFunc
  computeGetArgs: ComputeGetArgsFunc
}): Promise<InstanceElement[]> => {
  const type = normalizeType(objectTypes[typeName])
  if (type === undefined) {
    // should never happen
    throw new Error(`could not find type ${typeName}`)
  }
  const adapterName = type.elemID.adapter

  const { request, transformation } = typesConfig[typeName]
  if (request === undefined) {
    // should never happen - we verify that in the caller
    throw new Error(`Invalid type config - type ${adapterName}.${typeName} has no request config`)
  }

  const {
    fieldsToOmit, dataField,
  } = _.defaults({}, transformation, typeDefaultConfig.transformation)

  try {
    const nestedFieldDetails = nestedFieldFinder(type, fieldsToOmit, dataField)

    // TODO align with ducktype
    const getType = (): { objType: ObjectType; extractValues?: boolean } => {
      if (nestedFieldDetails === undefined) {
        return {
          objType: type,
        }
      }

      const dataFieldType = nestedFieldDetails.field.type

      if (
        isObjectType(dataFieldType)
        && Object.keys(dataFieldType.fields).length === 1
        && dataFieldType.fields[ADDITIONAL_PROPERTIES_FIELD] !== undefined
      ) {
        const propsType = dataFieldType.fields[ADDITIONAL_PROPERTIES_FIELD].type
        if (isMapType(propsType) && isObjectType(propsType.innerType)) {
          return {
            objType: propsType.innerType,
            extractValues: true,
          }
        }
      }
      return {
        // guaranteed to be an ObjectType by the way we choose the data fields
        objType: (isListType(dataFieldType)
          ? dataFieldType.innerType
          : dataFieldType) as ObjectType,
      }
    }

    const { objType, extractValues } = getType()

    const getEntries = async (): Promise<Values[]> => {
      const args = computeGetArgs(request, contextElements)

      const results = (await Promise.all(
        args.map(async getArgs => ((await toArrayAsync(await client.get(getArgs))).flat()))
      )).flatMap(makeArray)

      const entries = (results
        .flatMap(result => (nestedFieldDetails !== undefined
          ? makeArray(result[nestedFieldDetails.field.name] ?? []) as Values[]
          : makeArray(result)))
        .flatMap(result => (extractValues
          ? Object.values(result as Values)
          : makeArray(result ?? []))))
      return entries
    }

    const transformationConfigByType = _.pickBy(
      _.mapValues(typesConfig, def => def.transformation),
      isDefined,
    )
    const transformationDefaultConfig = typeDefaultConfig.transformation

    const entries = await getEntries()
    return generateInstancesForType({
      entries,
      objType,
      transformationConfigByType,
      transformationDefaultConfig,
    })
  } catch (e) {
    log.error(`Could not fetch ${type.elemID.name}: ${e}. %s`, e.stack)
    if (e instanceof UnauthorizedError) {
      throw e
    }
    return []
  }
}

/**
 * Get all instances from all types included in the fetch configuration.
 */
export const getAllInstances = async ({
  client,
  apiConfig,
  fetchConfig,
  objectTypes,
  nestedFieldFinder = findDataField,
  computeGetArgs = defaultComputeGetArgs,
}: {
  client: HTTPClientInterface
  apiConfig: AdapterSwaggerApiConfig
  fetchConfig: UserFetchConfig
  objectTypes: Record<string, ObjectType>
  nestedFieldFinder?: FindNestedFieldFunc
  computeGetArgs?: ComputeGetArgsFunc
}): Promise<InstanceElement[]> => {
  const { types, typeDefaults } = apiConfig

  // for now assuming flat dependencies for simplicity.
  // will replace with a DAG (with support for concurrency) when needed
  const [independentResources, dependentResources] = _.partition(
    fetchConfig.includeTypes,
    typeName => _.isEmpty(apiConfig.types[typeName]?.request?.dependsOn)
  ).map(list => new Set(list))

  // some type requests need to extract context and parameters from other types -
  // if these types are not listed in the includeTypes, they will be fetched but not persisted
  const additionalContextTypes: string[] = [...dependentResources]
    .flatMap(typeName => apiConfig.types[typeName].request?.dependsOn?.map(({ from }) => from.type))
    .filter(isDefined)
    .filter(typeName => !independentResources.has(typeName))

  const elementGenerationParams = {
    client,
    typesConfig: types,
    objectTypes,
    typeDefaultConfig: typeDefaults,
    nestedFieldFinder,
    computeGetArgs,
  }
  const contextElements: Record<string, {
    instances: InstanceElement[]
    // if the type is only fetched as context for another type, do not persist it
    doNotPersist?: boolean
  }> = Object.fromEntries(
    await Promise.all(
      [...independentResources, ...additionalContextTypes].map(async typeName =>
        [
          typeName,
          {
            instances: await getInstancesForType({
              ...elementGenerationParams,
              typeName,
            }),
            doNotPersist: !independentResources.has(typeName),
          },
        ])
    )
  )
  const dependentElements = await Promise.all(
    [...dependentResources].map(async typeName => getInstancesForType({
      ...elementGenerationParams,
      typeName,
      contextElements: _.mapValues(contextElements, val => val.instances),
    }))
  )

  return [
    ...Object.values(contextElements)
      .flatMap(({ doNotPersist, instances }) => (doNotPersist ? [] : instances)),
    ...dependentElements.flat(),
  ]
}
