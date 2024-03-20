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
import _ from 'lodash'
import { DAG } from '@salto-io/dag'
import { logger } from '@salto-io/logging'
import { values as lowerdashValues } from '@salto-io/lowerdash'
import { ElementGenerator } from '../element/element'
import { ElementQuery } from '../query'
import { Requester } from '../request/requester'
import { DefQuery } from '../../definitions'
import { createTypeResourceFetcher } from './type_fetcher'
import { FetchResourceDefinition } from '../../definitions/system/fetch/resource'
import { TypeFetcherCreator } from '../types'

const log = logger(module)

export type ResourceManager = {
  // orchestrate all requests and transformations needed to fetch all entries matching the specified query,
  // and pass them to the element generator that will turn them into elements
  fetch: (query: ElementQuery) => Promise<void>
}

/*
 * Create a graph with dependencies between resources based on the dependsOn definitions
 */
const createDependencyGraph = (defs: Record<string, FetchResourceDefinition>): DAG<undefined> => {
  const graph = new DAG<undefined>()
  Object.entries(_.pickBy(defs, def => def.directFetch)).forEach(([typeName, resource]) => {
    if (resource?.context?.dependsOn === undefined) {
      graph.addNode(typeName, [], undefined)
      return
    }
    const dependsOnTypes = _.uniq(Object.values(resource.context.dependsOn).map(arg => arg.parentTypeName))
    graph.addNode(typeName, dependsOnTypes, undefined)
  })

  return graph
}

export const createResourceManager = <ClientOptions extends string>({
  adapterName,
  resourceDefQuery,
  requester,
  elementGenerator,
  initialRequestContext,
}: {
  adapterName: string
  resourceDefQuery: DefQuery<FetchResourceDefinition>
  requester: Requester<ClientOptions>
  elementGenerator: ElementGenerator
  initialRequestContext?: Record<string, unknown>
}): ResourceManager => ({
  fetch: log.time(
    () => async query => {
      const createTypeFetcher: TypeFetcherCreator = ({ typeName, context }) =>
        createTypeResourceFetcher({
          adapterName,
          typeName,
          resourceDefQuery,
          query,
          requester,
          initialRequestContext: _.defaults({}, initialRequestContext, context),
        })
      const directFetchResourceDefs = _.pickBy(resourceDefQuery.getAll(), def => def.directFetch)
      const resourceFetchers = _.pickBy(
        _.mapValues(directFetchResourceDefs, (_def, typeName) => createTypeFetcher({ typeName })),
        lowerdashValues.isDefined,
      )
      const graph = createDependencyGraph(resourceDefQuery.getAll())
      await graph.walkAsync(async typeName => {
        const resourceFetcher = resourceFetchers[typeName]
        if (resourceFetcher === undefined) {
          log.debug('no resource fetcher defined for type %s:%s', adapterName, typeName)
          return
        }
        const availableResources = _.mapValues(
          _.pickBy(resourceFetchers, fetcher => fetcher.done()),
          fetcher => fetcher.getItems(),
        )

        // TODO wrap in try-catch and support turning into config suggestions or fetch warnings (SALTO-5427)

        const res = await resourceFetcher.fetch({
          contextResources: availableResources, // used to construct the possible context args for the request
          typeFetcherCreator: createTypeFetcher, // used for recurseInto calls
        })
        if (!res.success) {
          log.warn('failed to fetch type %s:%s:', adapterName, typeName)
          return
        }
        elementGenerator.pushEntries({
          typeName: String(typeName),
          entries: resourceFetcher.getItems()?.map(item => item.value) ?? [],
        })
      })
    },
    '[%s] fetching resources for account',
    adapterName,
  ),
})
