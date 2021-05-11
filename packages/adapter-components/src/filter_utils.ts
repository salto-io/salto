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
import { Element, ObjectType, PostFetchOptions } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { types, promises, values } from '@salto-io/lowerdash'
import _ from 'lodash'
import { Paginator } from './client'
import { SUBTYPES_PATH, TYPES_PATH } from './elements'
import { getSubtypes } from './elements/subtypes'

const log = logger(module)

export type Filter = Partial<{
  onFetch(elements: Element[]): Promise<void>
  onPostFetch(args: PostFetchOptions): Promise<void>
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
      await promises.array.series(
        filtersWith('onPostFetch').map(filter => () => filter.onPostFetch(args))
      )
    },
  }
}

export const filterTypes = (
  adapterName: string,
  allTypes: ObjectType[],
  typesToFilter: string[]
): ObjectType[] => {
  const nameToType = _.keyBy(allTypes, type => type.elemID.name)

  const relevantTypes = typesToFilter.map(name => {
    const type = nameToType[name]
    if (type === undefined) {
      log.warn(`Data type '${name}' of adapter ${adapterName} does not exists`)
    }
    return type
  }).filter(values.isDefined)

  relevantTypes.forEach(t => { t.path = [adapterName, TYPES_PATH, t.elemID.name] })
  const subtypes = getSubtypes(relevantTypes)
  subtypes.forEach(t => { t.path = [adapterName, TYPES_PATH, SUBTYPES_PATH, t.elemID.name] })

  return [...relevantTypes, ...subtypes]
}
