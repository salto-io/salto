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
import { EndpointConfig, ElementTranslationConfig, ResourceConfig } from './resource_config'
import { FindNestedFieldFunc } from './field_finder'

const { makeArray } = collections.array
const { isDefined } = lowerdashValues
const log = logger(module)

type ComputeGetArgsFunc = (
  endpoint: EndpointConfig,
  contextElements?: Record<string, Element[]>,
) => ClientGetParams[]

export const simpleGetArgs: ComputeGetArgsFunc = (
  {
    url,
    queryParams,
    recursiveQueryByResponseField,
    paginationField,
  },
) => {
  const recursiveQueryArgs = recursiveQueryByResponseField !== undefined
    ? _.mapValues(
      recursiveQueryByResponseField,
      val => ((entry: Values): string => entry[val])
    )
    : undefined
  return [{ endpointName: url, queryArgs: queryParams, recursiveQueryArgs, paginationField }]
}

export const getTypeAndInstances = async ({
  adapterName,
  typeName,
  client,
  nestedFieldFinder,
  computeGetArgs,
  endpoint,
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
  endpoint: EndpointConfig
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
    const getArgs = computeGetArgs(endpoint, contextElements)
    // TODO add error handling
    return (await Promise.all(
      getArgs.map(args => client.get(args))
    )).flatMap(r => r.result.map(entry =>
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
  const nestedFieldDetails = nestedFieldFinder(type, topLevelFieldsToOmit)

  const instances = naclEntries.flatMap((entry, index) => {
    if (nestedFieldDetails !== undefined && !keepOriginal) {
      return makeArray(entry[nestedFieldDetails.field.name]).flatMap(
        (nestedEntry, nesteIndex) => toInstance({
          adapterName,
          entry: nestedEntry,
          type: nestedFieldDetails.type,
          nameField: nameField ?? defaultNameField,
          pathField: pathField ?? defaultPathField,
          defaultName: `unindexed_${index}_${nesteIndex}`, // TODO improve, get as input from adapter?
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
      defaultName: `unindexed_${index}`, // TODO improve
      // we only omit the pagination fields at the top level
      fieldsToOmit: [...(topLevelFieldsToOmit ?? []), ...(fieldsToOmit ?? [])],
      hasDynamicFields,
    })
  })
  return [type, ...nestedTypes, ...instances].filter(isDefined)
}

export const getAllElements = async ({
  adapterName,
  includeResources,
  resources,
  client,
  nestedFieldFinder,
  computeGetArgs,
  defaultExtractionFields,
}: {
  adapterName: string
  includeResources: string[]
  resources: Record<string, ResourceConfig>
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
  const allResources = includeResources
    .map(resourceName => ({
      resourceName,
      ...resources[resourceName],
    }))
    .filter(({ endpoint }) => isDefined(endpoint))
    .map(({ resourceName, endpoint, translation }) => ({
      resourceName,
      endpoint,
      translation: {
        ...translation,
        fieldsToOmit: translation?.fieldsToOmit ?? defaultExtractionFields.fieldsToOmit,
      },
    }))
  const [independentEndpoints, dependentEndpoints] = _.partition(
    allResources,
    r => _.isEmpty(r.endpoint.dependsOn)
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
  const contextElements: Record<string, Element[]> = Object.fromEntries(await Promise.all(
    independentEndpoints.map(async ({ resourceName, endpoint, translation }) => [
      endpoint.url,
      await getTypeAndInstances({
        ...elementGenerationParams,
        typeName: resourceName,
        endpoint,
        translation,
      }),
    ])
  ))
  const dependentElements = await Promise.all(
    dependentEndpoints.map(({ resourceName, endpoint, translation }) => getTypeAndInstances({
      ...elementGenerationParams,
      typeName: resourceName,
      endpoint,
      translation,
    }))
  )

  return [
    ...Object.values(contextElements).flat(),
    ...dependentElements.flat(),
  ]
}
