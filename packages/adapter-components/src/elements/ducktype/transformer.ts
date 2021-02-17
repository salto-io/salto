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
import { Element, Values } from '@salto-io/adapter-api'
import { naclCase } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { collections, values as lowerdashValues } from '@salto-io/lowerdash'
import { ClientGetParams, HTTPClientInterface } from '../../client'
import { generateType } from './type_elements'
import { toInstance } from './instance_elements'
import { RequestConfig, TypeConfig } from '../../config'
import { FindNestedFieldFunc } from '../field_finder'
import { TypeDuckTypeDefaultsConfig, TypeDuckTypeConfig } from '../../config/ducktype'

const { makeArray } = collections.array
const { toArrayAsync, awu } = collections.asynciterable
const { isDefined } = lowerdashValues
const log = logger(module)

type ComputeGetArgsFunc = (
  request: RequestConfig,
  contextElements?: Record<string, Element[]>,
) => ClientGetParams[]

/**
 * Convert an endpoint's request details into get argumets.
 * Supports recursive queries (subsequent queries to the same endpoint based on response data).
 */
export const simpleGetArgs: ComputeGetArgsFunc = (
  {
    url,
    queryParams,
    recursiveQueryByResponseField,
    paginationField,
  },
) => {
  const recursiveQueryParams = recursiveQueryByResponseField !== undefined
    ? _.mapValues(
      recursiveQueryByResponseField,
      val => ((entry: Values): string => entry[val])
    )
    : undefined
  return [{ url, queryParams, recursiveQueryParams, paginationField }]
}

/**
 * Given a type and the corresponding endpoint definition, make the relevant HTTP requests and
 * use the responses to create elements for the endpoint's type (and nested types) and instances.
 */
export const getTypeAndInstances = async ({
  adapterName,
  typeName,
  client,
  nestedFieldFinder,
  computeGetArgs,
  typesConfig,
  typeDefaultConfig,
  contextElements,
}: {
  adapterName: string
  typeName: string
  client: HTTPClientInterface
  nestedFieldFinder: FindNestedFieldFunc
  computeGetArgs: ComputeGetArgsFunc
  typesConfig: Record<string, TypeDuckTypeConfig>
  typeDefaultConfig: TypeDuckTypeDefaultsConfig
  contextElements?: Record<string, Element[]>
}): Promise<Element[]> => {
  const { request, transformation } = typesConfig[typeName]
  if (request === undefined) {
    // should never happen - we verify that in the caller
    throw new Error(`Invalid type config - type ${adapterName}.${typeName} has no request config`)
  }
  const {
    fieldsToOmit, hasDynamicFields, dataField,
  } = _.defaults({}, transformation, typeDefaultConfig.transformation)

  const transformationConfigByType = _.pickBy(
    _.mapValues(typesConfig, def => def.transformation),
    isDefined,
  )
  const transformationDefaultConfig = typeDefaultConfig.transformation

  const getEntries = async (): Promise<Values[]> => {
    const getArgs = computeGetArgs(request, contextElements)
    return (await Promise.all(
      getArgs.map(async args => (await toArrayAsync(await client.get(args))).flat())
    )).flat()
  }

  const entries = await getEntries()

  // escape "field" names with '.'
  const naclEntries = entries.map(e => _.mapKeys(e, (_val, key) => naclCase(key)))

  // types with dynamic fields will be associated with the dynamic_keys type

  const { type, nestedTypes } = generateType({
    adapterName,
    name: typeName,
    entries: naclEntries,
    hasDynamicFields: hasDynamicFields === true,
  })
  // find the field and type containing the actual instances
  const nestedFieldDetails = await nestedFieldFinder(type, topLevelFieldsToOmit, keepOriginal)

  const instances = await awu(naclEntries).flatMap(async (entry, index) => {
    if (nestedFieldDetails !== undefined) {
      return awu(makeArray(entry[nestedFieldDetails.field.name])).map(
        (nestedEntry, nesteIndex) => toInstance({
          entry: nestedEntry,
          type: nestedFieldDetails.type,
          transformationConfigByType,
          transformationDefaultConfig,
          defaultName: `unnamed_${index}_${nesteIndex}`, // TODO improve
          hasDynamicFields,
        })
      ).filter(isDefined).toArray()
    }

    log.info(`storing full entry for ${type.elemID.name}`)
    return [await toInstance({
      adapterName,
      entry,
      type,
      transformationConfigByType,
      transformationDefaultConfig,
      defaultName: `unnamed_${index}`, // TODO improve
      hasDynamicFields,
    })]
  }).toArray()
  return [type, ...nestedTypes, ...instances].filter(isDefined)
}

/**
 * Helper function for the adapter fetch implementation:
 * Given api definitions and a list of types, make the relevant API calls and convert the
 * response data into a list of elements (for the type, nested types and instances).
 *
 * Supports one level of dependency between the type's endpoints, using the dependsOn field
 * (note that it will need to be extended in order to support longer dependency chains).
 */
export const getAllElements = async ({
  adapterName,
  includeTypes,
  types,
  client,
  nestedFieldFinder,
  computeGetArgs,
  typeDefaults,
}: {
  adapterName: string
  includeTypes: string[]
  types: Record<string, TypeConfig>
  client: HTTPClientInterface
  nestedFieldFinder: FindNestedFieldFunc
  computeGetArgs: ComputeGetArgsFunc
  typeDefaults: TypeDuckTypeDefaultsConfig
}): Promise<Element[]> => {
  // for now assuming flat dependencies for simplicity.
  // will replace with a DAG (with support for concurrency) when needed
  const allTypesWithRequestEndpoints = includeTypes.filter(
    typeName => types[typeName].request?.url !== undefined
  )
  const [independentEndpoints, dependentEndpoints] = _.partition(
    allTypesWithRequestEndpoints,
    typeName => _.isEmpty(types[typeName].request?.dependsOn)
  )

  const elementGenerationParams = {
    adapterName,
    client,
    nestedFieldFinder,
    computeGetArgs,
    typesConfig: types,
    typeDefaultConfig: typeDefaults,
  }
  const contextElements = Object.fromEntries(await Promise.all(independentEndpoints.map(
    async (typeName): Promise<[string, Element[]]> => [
      typeName,
      await getTypeAndInstances({
        ...elementGenerationParams,
        typeName,
      }),
    ]
  )))
  const dependentElements = await Promise.all(
    dependentEndpoints.map(typeName => getTypeAndInstances({
      ...elementGenerationParams,
      typeName,
      contextElements,
    }))
  )

  return [
    ...Object.values(contextElements).flat(),
    ...dependentElements.flat(),
  ]
}
