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
import { logger } from '@salto-io/logging'
import { collections, values as lowerdashValues } from '@salto-io/lowerdash'
import { ResponseValue } from '../../client'
import { ContextParams, GeneratedItem } from '../../definitions/system/shared'
import { ApiDefinitions, DefQuery, queryWithDefault } from '../../definitions'
import { ResourceIdentifier, ValueGeneratedItem } from '../types'
import { findAllUnresolvedArgs } from './utils'
import { createValueTransformer } from '../utils'
import { traversePages } from './pagination/pagination'
import { noPagination } from './pagination'
import { computeArgCombinations } from '../resource/request_parameters'
import {
  APIDefinitionsOptions,
  HTTPEndpointDetails,
  ResolveClientOptionsType,
  ResolvePaginationOptionsType,
} from '../../definitions/system'
import { FetchRequestDefinition } from '../../definitions/system/fetch'

const log = logger(module)

export type Requester<ClientOptions extends string> = {
  request: (args: {
    requestDef: FetchRequestDefinition<ClientOptions>
    contexts: ContextParams[]
    typeName: string
  }) => Promise<ValueGeneratedItem[]>

  requestAllForResource: (args: {
    contextPossibleArgs: Record<string, unknown[]>
    callerIdentifier: ResourceIdentifier
  }) => Promise<ValueGeneratedItem[]>
}

type ItemExtractor = (pages: ResponseValue[]) => GeneratedItem[]

const createExtractor = <ClientOptions extends string>(
  extractorDef: FetchRequestDefinition<ClientOptions>,
  typeName: string,
): ItemExtractor => {
  const transform = createValueTransformer(extractorDef.transformation)
  return pages =>
    pages.flatMap(page =>
      collections.array.makeArray(
        transform({
          value: page,
          typeName,
          context: extractorDef.context ?? {},
        }),
      ),
    )
}

export const getRequester = <Options extends APIDefinitionsOptions>({
  adapterName,
  clients,
  pagination,
  requestDefQuery,
}: {
  adapterName: string
  clients: ApiDefinitions<Options>['clients']
  pagination: ApiDefinitions<Options>['pagination']
  requestDefQuery: DefQuery<FetchRequestDefinition<ResolveClientOptionsType<Options>>[]>
}): Requester<ResolveClientOptionsType<Options>> => {
  const clientDefs = _.mapValues(clients.options, ({ endpoints, ...def }) => ({
    endpoints: queryWithDefault(endpoints),
    ...def,
  }))

  const getMergedRequestDefinition = (
    requestDef: FetchRequestDefinition<ResolveClientOptionsType<Options>>,
  ): {
    merged: FetchRequestDefinition<ResolveClientOptionsType<Options>> & {
      endpoint: HTTPEndpointDetails<ResolvePaginationOptionsType<Options>>
    }
    clientName: ResolveClientOptionsType<Options>
  } => {
    const { endpoint: requestEndpoint } = requestDef
    const clientName = requestEndpoint.client ?? clients.default
    const clientDef = clientDefs[clientName]
    const endpointDef = clientDef.endpoints.query(requestEndpoint.path)?.[requestEndpoint.method ?? 'get']
    if (!endpointDef?.readonly) {
      log.error(
        `Endpoint [${clientName}]${requestEndpoint.path}:${requestEndpoint.method} is not marked as readonly, cannot use in fetch`,
      )
      throw new Error(
        `Endpoint [${clientName}]${requestEndpoint.path}:${requestEndpoint.method} is not marked as readonly, cannot use in fetch`,
      )
    }
    return {
      merged: {
        ...requestDef,
        endpoint: _.merge({}, endpointDef, requestDef.endpoint),
      },
      clientName,
    }
  }

  const request: Requester<ResolveClientOptionsType<Options>>['request'] = async ({
    contexts,
    requestDef,
    typeName,
  }) => {
    // TODO optimizations for requests made from multiple "flows":
    // * cache only the "unconsumed" extracted items by request hash, and keep them available until consumed
    // * add promises for in-flight requests, to avoid making the same request multiple times in parallel
    const { merged: mergedRequestDef, clientName } = getMergedRequestDefinition(requestDef)

    const paginationOption = mergedRequestDef.endpoint.pagination
    const paginationDef =
      paginationOption !== undefined
        ? pagination[paginationOption]
        : { funcCreator: noPagination, clientArgs: undefined }

    const { clientArgs } = paginationDef
    // order of precedence in case of overlaps: pagination defaults < endpoint < resource-specific request
    const mergedEndpointDef = _.merge({}, clientArgs, mergedRequestDef.endpoint)

    const extractorCreator = (context: ContextParams): ItemExtractor =>
      createExtractor(
        {
          ...requestDef,
          context: { ...requestDef.context, ...context },
        },
        typeName,
      )

    const callArgs = mergedEndpointDef.omitBody
      ? _.pick(mergedEndpointDef, ['queryArgs', 'headers'])
      : _.pick(mergedEndpointDef, ['queryArgs', 'headers', 'body'])

    log.trace(
      'traversing pages for adapter %s client %s endpoint %s.%s',
      adapterName,
      clientName,
      mergedRequestDef.endpoint.path,
      mergedRequestDef.endpoint.method ?? 'get',
    )
    const pagesWithContext = await traversePages({
      client: clientDefs[clientName].httpClient,
      paginationDef,
      endpointIdentifier: mergedRequestDef.endpoint,
      contexts,
      callArgs,
      additionalValidStatuses: mergedEndpointDef.additionalValidStatuses,
      polling: mergedEndpointDef.polling,
    })

    const itemsWithContext = pagesWithContext
      .map(({ context, pages }) => ({ items: extractorCreator(context)(pages), context }))
      .flatMap(({ items, context }) => items.flatMap(item => ({ ...item, context })))
    return itemsWithContext.filter(item => {
      if (!lowerdashValues.isPlainRecord(item.value)) {
        log.warn(
          'extracted invalid item for endpoint %s.%s:%s %s',
          clientName,
          mergedRequestDef.endpoint.path,
          mergedRequestDef.endpoint.method ?? 'get',
          typeName,
        )
        return false
      }
      return true
    }) as ValueGeneratedItem[]
  }

  const requestAllForResource: Requester<ResolveClientOptionsType<Options>>['requestAllForResource'] = async ({
    callerIdentifier,
    contextPossibleArgs,
  }) =>
    (
      await Promise.all(
        (requestDefQuery.query(callerIdentifier.typeName) ?? []).map(requestDef => {
          const mergedDef = getMergedRequestDefinition(requestDef).merged
          const allArgs = findAllUnresolvedArgs(mergedDef)
          const relevantArgRoots = _.uniq(allArgs.map(arg => arg.split('.')[0]).filter(arg => arg.length > 0))
          const contextFunc =
            mergedDef.context?.custom !== undefined
              ? mergedDef.context.custom(mergedDef.context)
              : (v: ContextParams) => v
          const contexts = computeArgCombinations(contextPossibleArgs, relevantArgRoots).map(contextFunc)
          return request({
            contexts,
            requestDef,
            typeName: callerIdentifier.typeName,
          })
        }),
      )
    ).flat()

  return { request, requestAllForResource }
}
