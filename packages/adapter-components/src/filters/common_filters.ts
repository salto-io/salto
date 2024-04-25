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
import { APIDefinitionsOptions, ApiDefinitions, ResolveCustomNameMappingOptionsType, UserConfig } from '../definitions'
import { AdapterFilterCreator, FilterResult } from '../filter_utils'
import { FieldReferenceDefinition } from '../references'
import { hideTypesFilterCreator } from './hide_types'
import { defaultDeployFilterCreator } from './default_deploy'
import { FieldReferenceResolverCreator, fieldReferencesFilterCreator } from './field_references'
import { queryFilterCreator } from './query'
import { sortListsFilterCreator } from './sort_lists'
import {
  ResolveReferenceSerializationStrategyLookup,
  ResolveReferenceContextStrategiesType,
} from '../definitions/system/api'
import { referencedInstanceNamesFilterCreator } from './referenced_instance_names'
import { serviceUrlFilterCreator } from './service_url'
import { addAliasFilterCreator } from './add_alias'
import { ConvertError, defaultConvertError } from '../deployment'

export type FilterCreationArgs<
  Options extends APIDefinitionsOptions,
  Co extends UserConfig<ResolveCustomNameMappingOptionsType<Options>>,
> = {
  config: Co
  definitions: ApiDefinitions<Options>
  referenceRules?: FieldReferenceDefinition<
    ResolveReferenceContextStrategiesType<Options>,
    ResolveReferenceSerializationStrategyLookup<Options>
  >[]
  fieldReferenceResolverCreator?: FieldReferenceResolverCreator<Options>
  convertError?: ConvertError
}

/**
 * Filter creators of all the common filters
 */
export const createCommonFilters = <
  Options extends APIDefinitionsOptions,
  Co extends UserConfig<ResolveCustomNameMappingOptionsType<Options>>,
>({
  referenceRules,
  fieldReferenceResolverCreator,
  convertError = defaultConvertError,
}: FilterCreationArgs<Options, Co>): Record<string, AdapterFilterCreator<Co, FilterResult, {}, Options>> => ({
  // TODO SALTO-5421 finish upgrading filters to new def structure and add remaining shared filters
  hideTypes: hideTypesFilterCreator(),
  // referencedInstanceNames and fieldReferencesFilter should run after all elements were created
  fieldReferencesFilter: fieldReferencesFilterCreator(referenceRules, fieldReferenceResolverCreator),
  // referencedInstanceNames should run after fieldReferencesFilter
  referencedInstanceNames: referencedInstanceNamesFilterCreator(),
  // sortListsFilter should run after fieldReferencesFilter as it might sort list fields by reference properties
  sortListsFilter: sortListsFilterCreator(),
  serviceUrl: serviceUrlFilterCreator(),
  addAlias: addAliasFilterCreator(),

  query: queryFilterCreator({}),
  // defaultDeploy should run after other deploy filters
  defaultDeploy: defaultDeployFilterCreator({
    convertError,
    fieldReferenceResolverCreator,
  }),
})
