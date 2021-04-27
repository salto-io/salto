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
import { Element, PostFetchOptions } from '@salto-io/adapter-api'
import { types, promises } from '@salto-io/lowerdash'
import { Paginator } from './client'

export type Filter = Partial<{
  onFetch(elements: Element[]): Promise<void>
  onPostFetch(args: PostFetchOptions): Promise<boolean>
}>

export type FilterWith<M extends keyof Filter> = types.HasMember<Filter, M>

export type FilterCreator<TClient, TContext> = (
  opts: { client: TClient; paginator: Paginator; config: TContext }
) => Filter

export const filtersRunner = <TClient, TContext>(
  client: TClient,
  paginator: Paginator,
  config: TContext,
  filterCreators: ReadonlyArray<FilterCreator<TClient, TContext>>,
): Required<Filter> => {
  const allFilters = filterCreators.map(f => f({ client, config, paginator }))

  const filtersWith = <M extends keyof Filter>(m: M): FilterWith<M>[] =>
    types.filterHasMember<Filter, M>(m, allFilters)

  return {
    onFetch: async elements => {
      await promises.array.series(
        filtersWith('onFetch').map(filter => () => filter.onFetch(elements))
      )
    },
    onPostFetch: async args => {
      const results = await promises.array.series(
        filtersWith('onPostFetch').map(filter => () => filter.onPostFetch(args))
      )
      return results.some(res => res === true)
    },
  }
}
