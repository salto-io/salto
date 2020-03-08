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

// Filter interface, filters will be activated upon adapter fetch, add, update and remove
// operations. The filter will be responsible for specific business logic.
export type Filter = Partial<{
  onFetch(elements: Element[]): Promise<void>
  onAdd(after: Element): Promise<(SaveResult| UpsertResult)[]>
  onUpdate(before: Element, after: Element, changes: Iterable<Change>):
    Promise<(SaveResult| UpsertResult)[]>
  onRemove(before: Element): Promise<SaveResult[]>
}>

export type FilterWith<M extends keyof Filter> = types.HasMember<Filter, M>

export type FilterCreator = (opts: { client: SalesforceClient }) => Filter

export const filtersRunner = (client: SalesforceClient,
  filterCreators: ReadonlyArray<FilterCreator>): Required<Filter> => {
  const filtersWith = <M extends keyof Filter>(m: M): FilterWith<M>[] => {
    const allFilters = filterCreators.map(f => f({ client }))
    return types.filterHasMember<Filter, M>(m, allFilters)
  }

  const runFiltersInParallel = async <M extends keyof Filter>(m: M,
    run: (f: FilterWith<M>) => Promise<SaveResult[]>): Promise<SaveResult[]> =>
    _.flatten(await Promise.all(filtersWith(m).map(run)))

  return {
    onFetch: async (elements: Element[]): Promise<void> =>
      filtersWith('onFetch').reduce(
        (prevRes, filter) => prevRes.then(() => filter.onFetch(elements)),
        Promise.resolve(),
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
