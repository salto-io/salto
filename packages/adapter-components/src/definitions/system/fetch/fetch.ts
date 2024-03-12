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
import { FetchResourceDefinition } from './resource'
// eslint-disable-next-line import/no-cycle
import { ElementFetchDefinition } from './element'
import { DefaultWithCustomizations } from '../shared/types'
import { FetchRequestDefinition } from './request'

/**
 * Fetch flow:
 * - Resource types to fetch are determined by the fetch query
 * - Client endpoints producing the relevant resources are called, starting from those with no "dynamic" dependencies
 *   (i.e., for which context.dependsOn is empty) - then once these resources are fetched,
 *   the dependent resources are also fetched recursively
 * - Endpoint responses produce resource fragments using the responseExtractor definitions
 * - Resource fragments are aggregated by the type + service ids
 * - Sub-resources specified via recurseInto are called once their relevant context is available
 * - Once all fragments of a resource have been fetched, the resource is created using the mergeAndTransform definition
 * - Once all resources have been generated, elements are produced
 */
export type InstanceFetchApiDefinitions<ClientOptions extends string = 'main'> = {
  // "edges" specifying how to generate resources from endpoint calls.
  requests?: FetchRequestDefinition<ClientOptions>[]

  // a resource aggregates fragments associated with the same logical entity from various requests by a service id,
  // and transforms the value that will become the instance(s). it is mainly used for orchestrating the structure and
  // requests for complex types
  resource?: FetchResourceDefinition

  element?: ElementFetchDefinition
}

export type FetchApiDefinitions<ClientOptions extends string = 'main'> = {
  instances: DefaultWithCustomizations<InstanceFetchApiDefinitions<ClientOptions>>
}
