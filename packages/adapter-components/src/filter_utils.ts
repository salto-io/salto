/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { filter } from '@salto-io/adapter-utils'
import { Paginator } from './client'

export type Filter<TResult extends void | filter.FilterResult = void> = filter.Filter<TResult>

export type FilterWith<
  M extends keyof Filter, TResult extends void | filter.FilterResult = void
> = filter.FilterWith<TResult, M>

export type FilterOpts<TClient, TContext> = {
  client: TClient
  paginator: Paginator
  config: TContext
}

export type FilterCreator<
  TClient, TContext, TResult extends void | filter.FilterResult = void
> = filter.FilterCreator<
  TResult,
  FilterOpts<TClient, TContext>
>

export const filtersRunner = <TClient, TContext, TResult extends void | filter.FilterResult = void>(
  opts: FilterOpts<TClient, TContext>,
  filterCreators: ReadonlyArray<FilterCreator<TClient, TContext, TResult>>,
  onFetchAggregator: (results: TResult[]) => TResult | void = () => undefined,
): Required<Filter<TResult>> => filter.filtersRunner(opts, filterCreators, onFetchAggregator)
