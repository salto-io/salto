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
import { logger } from '@salto-io/logging'
import { collections, values as lowerdashValues } from '@salto-io/lowerdash'
import { ClientGetParams, HTTPClientInterface } from '../../client'
import { naclCase } from '../../nacl_case_utils'
import { generateType } from './type_elements'
import { toInstance } from './instance_elements'
import { RequestConfig, ElementTranslationConfig, EndpointConfig } from './endpoint_config'
import { FindNestedFieldFunc } from './field_finder'

const { makeArray } = collections.array
const { toArrayAsync } = collections.asynciterable
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
  request,
  translation,
  defaultNameField,
  defaultPathField,
  topLevelFieldsToOmit,
  contextElements,
}: {
  adapterName: string
  typeName: string
  client: HTTPClientInterface
  nestedFieldFinder: FindNestedFieldFunc
  computeGetArgs: ComputeGetArgsFunc
  request: RequestConfig
  translation: ElementTranslationConfig
  defaultNameField: string
  defaultPathField: string
  topLevelFieldsToOmit?: string[]
  contextElements?: Record<string, Element[]>
}): Promise<Element[]> => {
  const {
    fieldsToOmit, hasDynamicFields, nameField, pathField, keepOriginal,
  } = translation

  const getEntries = async (): Promise<Values[]> => {
    const getArgs = computeGetArgs(request, contextElements)
    return (await Promise.all(
      getArgs.map(async args => (await toArrayAsync(await client.get(args))).flat())
    )).flatMap(r => r.map(entry =>
      (fieldsToOmit !== undefined
        ? _.omit(entry, fieldsToOmit)
        : entry
      )))
  }

  const entries = await getEntries()

  // escape "field" names with '.'
  const naclEntries = entries.map(e => _.mapKeys(e, (_val, key) => naclCase(key)))

  // endpoints with dynamic fields will be associated with the dynamic_keys type

  const { type, nestedTypes } = generateType({
    adapterName,
    name: typeName,
    entries: naclEntries,
    hasDynamicFields: hasDynamicFields === true,
  })
  // find the field and type containing the actual instances
  const nestedFieldDetails = nestedFieldFinder(type, topLevelFieldsToOmit, keepOriginal)

  const instances = naclEntries.flatMap((entry, index) => {
    if (nestedFieldDetails !== undefined) {
      return makeArray(entry[nestedFieldDetails.field.name]).map(
        (nestedEntry, nesteIndex) => toInstance({
          adapterName,
          entry: nestedEntry,
          type: nestedFieldDetails.type,
          nameField: nameField ?? defaultNameField,
          pathField: pathField ?? defaultPathField,
          defaultName: `unnamed_${index}_${nesteIndex}`, // TODO improve
          fieldsToOmit,
          hasDynamicFields,
        })
      ).filter(isDefined)
    }

    log.info(`storing full entry for ${type.elemID.name}`)
    return toInstance({
      adapterName,
      entry,
      type,
      nameField: nameField ?? defaultNameField,
      pathField: pathField ?? defaultPathField,
      defaultName: `unnamed_${index}`, // TODO improve
      // we omit the pagination fields only from the top level and not from inner ones
      fieldsToOmit: [...(topLevelFieldsToOmit ?? []), ...(fieldsToOmit ?? [])],
      hasDynamicFields,
    })
  })
  return [type, ...nestedTypes, ...instances].filter(isDefined)
}

/**
 * Helper function for the adapter fetch implementation:
 * Given api definitions and a list of endpoints, make the relevant API calls and convert the
 * response data into a list of elements (for the type, nested types and instances).
 *
 * Supports one level of dependency between the endpoints, using the dependsOn field
 * (note that it will need to be extended in order to support longer dependency chains).
 */
export const getAllElements = async ({
  adapterName,
  includeEndpoints,
  endpoints,
  client,
  nestedFieldFinder,
  computeGetArgs,
  defaultExtractionFields,
}: {
  adapterName: string
  includeEndpoints: string[]
  endpoints: Record<string, EndpointConfig>
  client: HTTPClientInterface
  nestedFieldFinder: FindNestedFieldFunc
  computeGetArgs: ComputeGetArgsFunc
  defaultExtractionFields: {
    nameField: string
    pathField: string
    fieldsToOmit: string[]
    topLevelFieldsToOmit?: string[]
  }
}): Promise<Element[]> => {
  // for now assuming flat dependencies for simplicity.
  // will replace with a DAG (with support for concurrency) when needed
  const allEndpoints = includeEndpoints
    .map(endpointName => ({
      endpointName,
      ...endpoints[endpointName],
    }))
    .filter(({ request }) => isDefined(request))
    .map(({ endpointName, request, translation }) => ({
      endpointName,
      request,
      translation: {
        ...translation,
        fieldsToOmit: translation?.fieldsToOmit ?? defaultExtractionFields.fieldsToOmit,
      },
    }))
  const [independentEndpoints, dependentEndpoints] = _.partition(
    allEndpoints,
    r => _.isEmpty(r.request.dependsOn)
  )

  const elementGenerationParams = {
    adapterName,
    client,
    nestedFieldFinder,
    computeGetArgs,
    defaultNameField: defaultExtractionFields.nameField,
    defaultPathField: defaultExtractionFields.pathField,
    topLevelFieldsToOmit: defaultExtractionFields.topLevelFieldsToOmit,
  }
  const contextElements = Object.fromEntries(await Promise.all(independentEndpoints.map(
    async ({ endpointName, request, translation }): Promise<[string, Element[]]> => [
      endpointName,
      await getTypeAndInstances({
        ...elementGenerationParams,
        typeName: endpointName,
        request,
        translation,
      }),
    ]
  )))
  const dependentElements = await Promise.all(
    dependentEndpoints.map(({ endpointName, request, translation }) => getTypeAndInstances({
      ...elementGenerationParams,
      typeName: endpointName,
      request,
      translation,
      contextElements,
    }))
  )

  return [
    ...Object.values(contextElements).flat(),
    ...dependentElements.flat(),
  ]
}
