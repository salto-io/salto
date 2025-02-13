/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { FetchResourceDefinition } from './resource'
import { ElementFetchDefinition, ElementFetchDefinitionOptions } from './element'
import { DefaultWithCustomizations } from '../shared/types'
import { FetchRequestDefinition } from './request'
import { APIDefinitionsOptions, ResolveClientOptionsType, ResolveCustomNameMappingOptionsType } from '../api'
import { NameMappingFunctionMap } from '../shared'

export type FetchApiDefinitionsOptions = Pick<APIDefinitionsOptions, 'clientOptions' | 'customNameMappingOptions'> &
  Pick<ElementFetchDefinitionOptions, 'valueType'>

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
export type InstanceFetchApiDefinitions<Options extends FetchApiDefinitionsOptions = {}> = {
  // "edges" specifying how to generate resources from endpoint calls.
  requests?: FetchRequestDefinition<ResolveClientOptionsType<Options>>[]

  // a resource aggregates fragments associated with the same logical entity from various requests by a service id,
  // and transforms the value that will become the instance(s). it is mainly used for orchestrating the structure and
  // requests for complex types
  resource?: FetchResourceDefinition

  element?: ElementFetchDefinition<Options>
}

export type FetchApiDefinitions<Options extends FetchApiDefinitionsOptions = {}> = {
  instances: DefaultWithCustomizations<InstanceFetchApiDefinitions<Options>>
  customNameMappingFunctions?: NameMappingFunctionMap<ResolveCustomNameMappingOptionsType<Options>>
}
