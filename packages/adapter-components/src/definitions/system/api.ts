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
import { ApiClientDefinition, PaginationDefinitions } from './requests'
import { OptionsWithDefault } from './shared'
import { OpenAPIDefinition } from './sources'
import { FetchApiDefinitions } from './fetch'
import { DeployApiDefinitions } from './deploy'
import { ReferenceDefinitions } from './references'

export type APIDefinitionsOptions = {
  clientOptions?: string
  paginationOptions?: string
  customNameMappingOptions?: string
  additionalAction?: string
  referenceContextStrategies?: string
  referenceSerializationStrategies?: string
  referenceIndexNames?: string
}

export type ResolveClientOptionsType<Options extends Pick<APIDefinitionsOptions, 'clientOptions'>> =
  Options['clientOptions'] extends string ? Options['clientOptions'] : 'main'

export type ResolvePaginationOptionsType<Options extends Pick<APIDefinitionsOptions, 'paginationOptions'>> =
  Options['paginationOptions'] extends string ? Options['paginationOptions'] : 'none'

export type ResolveCustomNameMappingOptionsType<
  Options extends Pick<APIDefinitionsOptions, 'customNameMappingOptions'>,
> = Options['customNameMappingOptions'] extends string ? Options['customNameMappingOptions'] : never

export type ResolveAdditionalActionType<Options extends Pick<APIDefinitionsOptions, 'additionalAction'>> =
  Options['additionalAction'] extends string ? Options['additionalAction'] : never

export type ResolveReferenceContextStrategiesType<
  Options extends Pick<APIDefinitionsOptions, 'referenceContextStrategies'>,
> = Options['referenceContextStrategies'] extends string ? Options['referenceContextStrategies'] : never

export type ResolveReferenceSerializationStrategyLookup<
  Options extends Pick<APIDefinitionsOptions, 'referenceSerializationStrategies'>,
> = Options['referenceSerializationStrategies'] extends string ? Options['referenceSerializationStrategies'] : never

export type ResolveReferenceIndexNames<Options extends Pick<APIDefinitionsOptions, 'referenceIndexNames'>> =
  Options['referenceIndexNames'] extends string ? Options['referenceIndexNames'] : never

export type ApiDefinitions<Options extends APIDefinitionsOptions = {}> = {
  // sources are processed and used to populate initial options for clients and components, in order of definition,
  // followed by the rest of the adjustments
  sources?: {
    openAPI?: OpenAPIDefinition<ResolveClientOptionsType<Options>>[]
  }

  // TODO add auth definitions
  // auth: AuthDefinitions

  // clients will be initialized as part of a big "client" in the adapter creator,
  // but need to be "registered" here in order to be used by the infra
  clients: OptionsWithDefault<
    ApiClientDefinition<ResolvePaginationOptionsType<Options>>,
    ResolveClientOptionsType<Options>
  >

  // supported pagination options. when missing, no pagination is used (TODO add warning)
  pagination: Record<ResolvePaginationOptionsType<Options>, PaginationDefinitions<ResolveClientOptionsType<Options>>>

  // rules for reference extraction (during fetch) and serialization (during deploy)
  references?: ReferenceDefinitions<
    ResolveReferenceContextStrategiesType<Options>,
    ResolveReferenceSerializationStrategyLookup<Options>,
    ResolveReferenceIndexNames<Options>
  >

  fetch?: FetchApiDefinitions<Options>
  deploy?: DeployApiDefinitions<ResolveAdditionalActionType<Options>, ResolveClientOptionsType<Options>>
}
