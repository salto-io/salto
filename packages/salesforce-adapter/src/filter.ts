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
import { Element, Change, ReadOnlyElementsSource } from '@salto-io/adapter-api'
import { SaveResult, UpsertResult } from 'jsforce-types'
import { types, promises, objects, values } from '@salto-io/lowerdash'
import SalesforceClient from './client/client'
import { FilterResult } from './types'
import { FetchProfile } from './fetch_profile/fetch_profile'

const { concatObjects } = objects
const { isDefined } = values

// Filters run in a specific order and get a mutable list as input which they may modify
// to affect the overall result as well as the input for subsequent filters.
// on preDeploy the filters are run in reverse order and are expected to "undo" any relevant change
// they made in onFetch. because of this, each filter can expect to get in preDeploy a similar
// value to what it created in onFetch.
// onDeploy is called in the same order as onFetch and is expected to do basically the same thing
// that onFetch does but with a different context (on changes instead of on elements)
// Each filter will be created once and so it may store context between preDeploy and onDeploy.
// Note that it cannot store context between onFetch and the other callbacks since these run in
// separate commands
export type Filter = Partial<{
  onFetch(elements: Element[]): Promise<FilterResult | void>
  preDeploy(changes: Change[]): Promise<void>
  onDeploy(changes: Change[]): Promise<(SaveResult | UpsertResult)[]>
}>

export type FilterWith<M extends keyof Filter> = types.HasMember<Filter, M>

export type FilterContext = {
  unsupportedSystemFields?: string[]
  systemFields?: string[]
  useOldProfiles?: boolean
  fetchProfile: FetchProfile
  elementsSource: ReadOnlyElementsSource
}

export type FilterCreator = (
  opts: { client: SalesforceClient; config: FilterContext }
) => Filter

export const filtersRunner = (client: SalesforceClient,
  config: FilterContext,
  filterCreators: ReadonlyArray<FilterCreator>): Required<Filter> => {
  // Create all filters in advance to allow them to hold context between calls
  const allFilters = filterCreators.map(f => f({ client, config }))

  const filtersWith = <M extends keyof Filter>(m: M): FilterWith<M>[] =>
    types.filterHasMember<Filter, M>(m, allFilters)

  return {
    onFetch: async elements => {
      const filterResults = (await promises.array.series(
        filtersWith('onFetch').map(filter => () => filter.onFetch(elements))
      )).filter(isDefined)
      return concatObjects(filterResults)
    },
    preDeploy: async changes => {
      await promises.array.series(filtersWith('preDeploy').reverse().map(filter => () => filter.preDeploy(changes)))
    },
    onDeploy: async changes =>
      ((await promises.array.series(filtersWith('onDeploy').map(filter => () => filter.onDeploy(changes)))).flat()),
  }
}
