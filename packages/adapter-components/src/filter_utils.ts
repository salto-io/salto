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
import { ElemIdGetter, ReadOnlyElementsSource, SaltoError } from '@salto-io/adapter-api'
import { filter } from '@salto-io/adapter-utils'
import { Paginator } from './client'
import { ElementQuery } from './fetch/query'
import { UserConfig, ApiDefinitions, APIDefinitionsOptions, ResolveCustomNameMappingOptionsType } from './definitions'

export type Filter<TResult extends void | filter.FilterResult = void> = filter.Filter<TResult>

export type FilterWith<M extends keyof Filter, TResult extends void | filter.FilterResult = void> = filter.FilterWith<
  TResult,
  M
>

export type FilterOptions<
  TOptions extends APIDefinitionsOptions = {},
  TContext = UserConfig<ResolveCustomNameMappingOptionsType<TOptions>>,
  TAdditional = {},
> = {
  definitions: ApiDefinitions<TOptions>
  config: TContext
  getElemIdFunc?: ElemIdGetter
  fetchQuery: ElementQuery
  elementSource: ReadOnlyElementsSource
  // Extra context shared throughout operation (including between change groups during deploy),
  // and can be used for passing information between changes or change groups.
  // Note that deployment steps can be executed in parallel, so use this with caution.
  sharedContext: Record<string, unknown>
} & TAdditional

export type AdapterFilterCreator<
  TContext,
  TResult extends void | filter.FilterResult = void,
  TAdditional = {},
  TOptions extends APIDefinitionsOptions = {},
> = filter.FilterCreator<TResult, FilterOptions<TOptions, TContext, TAdditional>>

export type NoOptionsFilterCreator<TResult extends void | filter.FilterResult = void> = filter.FilterCreator<
  TResult,
  {}
>

export type UserConfigAdapterFilterCreator<
  TContext,
  TResult extends void | filter.FilterResult = void,
> = filter.FilterCreator<
  TResult,
  {
    config: TContext
    getElemIdFunc?: ElemIdGetter
    fetchQuery: ElementQuery
  }
>

export type FilterResult = {
  errors?: SaltoError[]
}

export const filterRunner = <
  TContext,
  TResult extends void | filter.FilterResult = void,
  TAdditional = {},
  TOptions extends APIDefinitionsOptions = {},
>(
  opts: FilterOptions<TOptions, TContext, TAdditional>,
  filterCreators: ReadonlyArray<AdapterFilterCreator<TContext, TResult, TAdditional, TOptions>>,
  onFetchAggregator: (results: TResult[]) => TResult | void = () => undefined,
): Required<Filter<TResult>> => filter.filtersRunner(opts, filterCreators, onFetchAggregator)

// TODO deprecate when upgrading to new definitions SALTO-5538

export type FilterOpts<TClient, TContext, TAdditional = {}> = {
  client: TClient
  paginator: Paginator
  config: TContext
  getElemIdFunc?: ElemIdGetter
  fetchQuery: ElementQuery
} & TAdditional

export type FilterCreator<
  TClient,
  TContext,
  TResult extends void | filter.FilterResult = void,
  TAdditional = {},
> = filter.FilterCreator<TResult, FilterOpts<TClient, TContext, TAdditional>>

export const filtersRunner = <TClient, TContext, TResult extends void | filter.FilterResult = void, TAdditional = {}>(
  opts: FilterOpts<TClient, TContext, TAdditional>,
  filterCreators: ReadonlyArray<FilterCreator<TClient, TContext, TResult, TAdditional>>,
  onFetchAggregator: (results: TResult[]) => TResult | void = () => undefined,
): Required<Filter<TResult>> => filter.filtersRunner(opts, filterCreators, onFetchAggregator)
