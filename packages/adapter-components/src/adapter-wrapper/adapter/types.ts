/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  AdapterOperations,
  ChangeValidator,
  DependencyChanger,
  ElemIdGetter,
  FixElementsFunc,
  InstanceElement,
  ReadOnlyElementsSource,
} from '@salto-io/adapter-api'
import { Client } from '../../client/client_creator'
import {
  APIDefinitionsOptions,
  ResolveClientOptionsType,
  ResolveCustomNameMappingOptionsType,
  ResolveReferenceContextStrategiesType,
  UserConfig,
} from '../../definitions'
import { AdapterFilterCreator, FilterResult } from '../../filter_utils'
import { RequiredDefinitions } from '../../definitions/system/types'
import { ResolveReferenceSerializationStrategyLookup, ResolveReferenceIndexNames } from '../../definitions/system/api'
import { FieldReferenceDefinition, FieldReferenceResolver } from '../../references'
import { QueryCriterion } from '../../fetch/query'

export interface AdapterParams<
  Credentials,
  Options extends APIDefinitionsOptions = {},
  Co extends UserConfig<ResolveCustomNameMappingOptionsType<Options>> = UserConfig<
    ResolveCustomNameMappingOptionsType<Options>
  >,
> {
  filterCreators: AdapterFilterCreator<Co, FilterResult, {}, Options>[]
  clients: Record<ResolveClientOptionsType<Options>, Client<Credentials>>
  definitions: RequiredDefinitions<Options>
  config: Co
  configInstance?: InstanceElement
  getElemIdFunc?: ElemIdGetter
  additionalChangeValidators?: Record<string, ChangeValidator>
  dependencyChangers?: DependencyChanger[]
  referenceResolver: (
    def: FieldReferenceDefinition<
      ResolveReferenceContextStrategiesType<Options>,
      ResolveReferenceSerializationStrategyLookup<Options>
    >,
  ) => FieldReferenceResolver<
    ResolveReferenceContextStrategiesType<Options>,
    ResolveReferenceSerializationStrategyLookup<Options>,
    ResolveReferenceIndexNames<Options>
  >
  elementSource: ReadOnlyElementsSource
  adapterName: string
  fixElements: FixElementsFunc | undefined
  allCriteria: Record<string, QueryCriterion>
  // TODO SALTO-5578 pass in account name as well
}

export interface AdapterImplConstructor<
  Credentials,
  Options extends APIDefinitionsOptions = {},
  Co extends UserConfig<ResolveCustomNameMappingOptionsType<Options>> = UserConfig<
    ResolveCustomNameMappingOptionsType<Options>
  >,
> {
  new (args: AdapterParams<Credentials, Options, Co>): AdapterOperations
}
