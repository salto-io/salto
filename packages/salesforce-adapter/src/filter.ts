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
import { types, promises, values } from '@salto-io/lowerdash'
import SalesforceClient from './client/client'
import { ConfigChangeSuggestion, FilterContext } from './types'

// Filter interface, filters will be activated upon adapter fetch, add, update and remove
// operations. The filter will be responsible for specific business logic.
export type Filter = Partial<{
  onFetch(elements: Element[]): Promise<ConfigChangeSuggestion[] | void>
  preDeploy(changes: ReadonlyArray<Change>): Promise<void>
  onDeploy(changes: ReadonlyArray<Change>): Promise<(SaveResult | UpsertResult)[]>
}>

export type FilterWith<M extends keyof Filter> = types.HasMember<Filter, M>

export type FilterCreator = (
  opts: { client: SalesforceClient; config: FilterContext }
) => Filter

export const filtersRunner = (client: SalesforceClient,
  config: FilterContext,
  filterCreators: ReadonlyArray<FilterCreator>): Required<Filter> => {
  const filtersWith = <M extends keyof Filter>(m: M): FilterWith<M>[] =>
    types.filterHasMember<Filter, M>(m, filterCreators.map(f => f({ client, config })))

  return {
    onFetch: async elements => {
      const configChanges = await promises.array.series(
        filtersWith('onFetch').map(filter => () => filter.onFetch(elements))
      )
      return configChanges.filter(values.isDefined).flat()
    },
    preDeploy: async changes => {
      await promises.array.series(filtersWith('preDeploy').map(filter => () => filter.preDeploy(changes)))
      Promise.resolve()
    },
    onDeploy: async changes =>
      ((await promises.array.series(filtersWith('onDeploy').map(filter => () => filter.onDeploy(changes)))).flat()),
  }
}
