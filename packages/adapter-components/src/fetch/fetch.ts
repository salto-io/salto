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
import { ElemIdGetter, ObjectType, isObjectType } from '@salto-io/adapter-api'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { ElementQuery } from './query'
import {
  APIDefinitionsOptions,
  ConfigChangeSuggestion,
  getNestedWithDefault,
  mergeWithDefault,
  queryWithDefault,
} from '../definitions'
import { getRequester } from './request/requester'
import { createResourceManager } from './resource/resource_manager'
import { getElementGenerator } from './element/element'
import { FetchElements, ValueGeneratedItem } from './types'
import { RequiredDefinitions } from '../definitions/system/types'

const log = logger(module)

export const getUniqueConfigSuggestions = (configSuggestions: ConfigChangeSuggestion[]): ConfigChangeSuggestion[] =>
  _.uniqBy(configSuggestions, suggestion => `${suggestion.type}-${suggestion.value}-${suggestion.reason}`)

/**
 * Helper function for the adapter fetch implementation:
 * Given api definitions and a fetch query, make the relevant API calls and convert the
 * response data into a list of instances and types.
 *
 * Flow:
 * - resource fetchers use requesters to generate resource fragments
 * - resources are aggregated by service id, and when ready sent to the element generator
 * - once all resources have been produced, the element generator generates all instances and types
 */
export const getElements = async <Options extends APIDefinitionsOptions>({
  adapterName,
  fetchQuery,
  definitions,
  predefinedTypes,
  getElemIdFunc,
  additionalRequestContext,
  customItemFilter,
}: {
  adapterName: string
  fetchQuery: ElementQuery
  definitions: RequiredDefinitions<Options>
  predefinedTypes?: Record<string, ObjectType>
  getElemIdFunc?: ElemIdGetter
  additionalRequestContext?: Record<string, unknown>
  customItemFilter?: (item: ValueGeneratedItem) => boolean
}): Promise<FetchElements> => {
  const { clients, fetch, pagination } = definitions

  log.trace(
    'original defs: %s',
    safeJsonStringify({
      fetch: definitions.fetch,
      clients: {
        default: definitions.clients.default,
        options: _.mapValues(definitions.clients.options, val => _.omit(val, 'httpClient')),
      },
    }),
  )
  log.trace('merged fetch defs: %s', safeJsonStringify(mergeWithDefault(definitions.fetch.instances)))

  // the requester is responsible for making all "direct" client requests for a given resource including pagination,
  // i.e., the requests listed under the `requests` definition,
  // and returning the extracted items based on the transformation definition
  const requester = getRequester<Options>({
    adapterName,
    clients,
    pagination,
    requestDefQuery: queryWithDefault(getNestedWithDefault(fetch.instances, 'requests')),
  })

  // the element generator receives "prepared" resources, and once all resources have been received,
  // it can be called to generate elements (instances + types) based on these resources
  const elementGenerator = getElementGenerator({
    adapterName,
    defQuery: queryWithDefault(fetch.instances),
    predefinedTypes: _.pickBy(predefinedTypes, isObjectType),
    getElemIdFunc,
    customNameMappingFunctions: fetch.customNameMappingFunctions,
  })

  // the resource manager is responsible for orchestrating the generation of elements,
  // after filtering relevant types based on the user's fetch query -
  // it uses the requester to make the client calls,
  // adds fields to resources based on `recurseInto` definitions if available,
  // and aggregates resource "fragments" based on the resource's type and service id.
  // once all resources of a given type are ready, it sends them to the element generator.
  // it also manages the dependencies between resources that depend on other resources
  // (based on the `context.dependsOn` definition)
  const resourceManager = createResourceManager({
    adapterName,
    resourceDefQuery: queryWithDefault(getNestedWithDefault(fetch.instances, 'resource')),
    requester,
    elementGenerator,
    initialRequestContext: additionalRequestContext,
    customItemFilter,
  })

  await resourceManager.fetch(fetchQuery)

  // only after all queries have completed and all events have been processed we should generate the instances and types
  const { elements, errors, configChanges } = elementGenerator.generate()

  // note: instance filtering based on the fetch query will be done in the query common filter

  return {
    elements,
    configChanges: getUniqueConfigSuggestions(configChanges ?? []),
    errors,
  }
}
