/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { Element, Change, PostFetchOptions, DeployResult } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { types, promises, values, collections, objects } from '@salto-io/lowerdash'

const { awu } = collections.asynciterable
const { concatObjects } = objects

const { isDefined } = values

const log = logger(module)

// Filters run in a specific order and get a mutable list as input which they may modify
// to affect the overall result as well as the input for subsequent filters.
// Each filter will be created once and so it may store context between preDeploy and onDeploy.
// Note that it cannot store context between onFetch and the other callbacks since these run in
// separate commands
export type FilterResult = Record<string, unknown[] | undefined>

export type FilterMetadata = {
  name: string
}

export type Filter<T extends FilterResult | void, DeployInfo=void> = Partial<{
  onFetch(elements: Element[]): Promise<T | void>
  preDeploy(changes: Change[]): Promise<void>
  deploy(changes: Change[]): Promise<{
    deployResult: DeployResult
    leftoverChanges: Change[]
  }>
  onDeploy(changes: Change[], deployInfo: DeployInfo): Promise<void>
  onPostFetch(args: PostFetchOptions): Promise<void>
}> & FilterMetadata

export type FilterWith<
  T extends FilterResult | void,
  // eslint-disable-next-line no-use-before-define
  M extends keyof Filter<T, DeployInfo>,
  DeployInfo = void,
> = types.HasMember<Filter<T, DeployInfo>, M>

export type FilterCreator<
  R extends FilterResult | void,
  T,
  DeployInfo=void,
> = (opts: T) => Filter<R, DeployInfo>

export const filtersRunner = <
  R extends FilterResult | void,
  T,
  DeployInfo=void,
>(
    opts: T,
    filterCreators: ReadonlyArray<FilterCreator<R, T, DeployInfo>>,
    onFetchAggregator: (results: R[]) => R | void = () => undefined,
  ): Required<Filter<R, DeployInfo>> => {
  // Create all filters in advance to allow them to hold context between calls
  const allFilters = filterCreators.map(f => f(opts))

  const filtersWith = <M extends keyof Filter<R, DeployInfo>>(m: M):
    FilterWith<R, M, DeployInfo>[] => (
      types.filterHasMember<Filter<R, DeployInfo>, M>(m, allFilters)
    )

  return {
    name: '',
    onFetch: async elements => {
      const filterResults = (await promises.array.series(
        filtersWith('onFetch').map(filter => () => log.time(() => filter.onFetch(elements), `(${filter.name}):onFetch`))
      )).filter(isDefined)
      return onFetchAggregator(filterResults)
    },
    /**
     * on preDeploy the filters are run in reverse order and are expected to "undo" any
     * relevant change they made in onFetch. because of this, each filter can expect
     * to get in preDeploy a similar value to what it created in onFetch.
     */
    preDeploy: async changes => {
      await promises.array.series(filtersWith('preDeploy').reverse().map(filter => () => log.time(() => filter.preDeploy(changes), `(${filter.name}):preDeploy`)))
    },
    /**
     * deploy method for implementing a deployment functionality.
     */
    deploy: async changes => (
      awu(filtersWith('deploy')).reduce(
        async (total, current) => {
          const { deployResult, leftoverChanges } = await log.time(() => current.deploy(total.leftoverChanges), `(${current.name}):deploy`)
          return {
            deployResult: concatObjects([total.deployResult, deployResult]),
            leftoverChanges,
          }
        },
        {
          deployResult: {
            appliedChanges: [] as ReadonlyArray<Change>,
            errors: [] as ReadonlyArray<Error>,
          },
          leftoverChanges: changes,
        }
      )
    ),
    /**
     * onDeploy is called in the same order as onFetch and is expected to do basically
     * the same thing that onFetch does but with a different context (on changes instead
     * of on elements)
     */
    onDeploy: async (changes, deployResult) => {
      await promises.array.series(filtersWith('onDeploy').map(filter => () => log.time(() => filter.onDeploy(changes, deployResult), `(${filter.name}):onDeploy`)))
    },
    /**
     * onPostFetch is run after fetch completed for all accounts, and receives
     * as context all the elements for the env. It should only be used to change
     * references, and should not make any changes that other accounts might rely on.
     * There is no guarantee on the order in which the onPostFetch operations from
     * different adapters are performed, only within each adapter.
     * The filters are run in the same order as onFetch.
     */
    onPostFetch: async args => {
      await promises.array.series(
        filtersWith('onPostFetch').map(filter => () => log.time(() => filter.onPostFetch(args), `(${filter.name}):onPostFetch`))
      )
    },
  }
}
