/*
*                      Copyright 2020 Salto Labs Ltd.
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
import { Element, Change } from '@salto-io/adapter-api'
import { SaveResult, UpsertResult } from 'jsforce-types'
import { types } from '@salto-io/lowerdash'
import _ from 'lodash'
import SalesforceClient from './client/client'
import { FetchError } from './types'

// Filter interface, filters will be activated upon adapter fetch, add, update and remove
// operations. The filter will be responsible for specific business logic.
export type Filter = Partial<{
  onFetch(elements: Element[]): Promise<FetchError[] | void>
  onAdd(after: Element): Promise<(SaveResult| UpsertResult)[]>
  onUpdate(before: Element, after: Element, changes: Iterable<Change>):
    Promise<(SaveResult| UpsertResult)[]>
  onRemove(before: Element): Promise<SaveResult[]>
}>

export type FilterWith<M extends keyof Filter> = types.HasMember<Filter, M>

export type FilterCreator = (opts: { client: SalesforceClient }) => Filter

export const filtersRunner = (client: SalesforceClient,
  filterCreators: ReadonlyArray<FilterCreator>): Required<Filter> => {
  const filtersWith = <M extends keyof Filter>(m: M): FilterWith<M>[] =>
    types.filterHasMember<Filter, M>(m, filterCreators.map(f => f({ client })))

  const runFiltersInParallel = async <M extends keyof Filter>(m: M,
    run: (f: FilterWith<M>) => Promise<SaveResult[]>): Promise<SaveResult[]> =>
    _.flatten(await Promise.all(filtersWith(m).map(run)))

  return {
    // TODO - Should return void or list of FetchError
    onFetch: async (elements: Element[]): Promise<FetchError[]> =>
      filtersWith('onFetch').reduce(
        async (prevRes, filter) => {
          await prevRes
          return (await prevRes).concat(((await filter.onFetch(elements)) ?? []) as FetchError[])
        }, Promise.resolve([] as FetchError[]),
      ),

    onAdd: async (after: Element): Promise<(SaveResult| UpsertResult)[]> =>
      runFiltersInParallel('onAdd', filter => filter.onAdd(after)),

    onUpdate: async (before: Element, after: Element, changes: Iterable<Change>):
      Promise<(SaveResult| UpsertResult)[]> =>
      runFiltersInParallel('onUpdate', filter => filter.onUpdate(before, after, changes)),

    onRemove: async (before: Element): Promise<SaveResult[]> =>
      runFiltersInParallel('onRemove', filter => filter.onRemove(before)),
  }
}
