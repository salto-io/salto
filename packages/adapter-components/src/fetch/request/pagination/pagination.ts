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
import { collections } from '@salto-io/lowerdash'
import { HTTPReadClientInterface, HTTPWriteClientInterface, ResponseValue } from '../../../client'
import { HTTPEndpointIdentifier, ContextParams, PaginationDefinitions } from '../../../definitions'
import { RequestQueue, ClientRequest } from './queue'
import { RequestArgs } from '../../../definitions/system'
import { replaceAllArgs } from '../utils'

const log = logger(module)

type PagesWithContext = {
  context: ContextParams
  pages: ResponseValue[]
}
export const traversePages = async <ClientOptions extends string>({
  client,
  endpointIdentifier,
  paginationDef,
  contexts,
  callArgs,
  additionalValidStatuses = [],
}: {
  client: HTTPReadClientInterface & HTTPWriteClientInterface
  paginationDef: PaginationDefinitions<ClientOptions>
  endpointIdentifier: HTTPEndpointIdentifier<ClientOptions>
  contexts: ContextParams[]
  callArgs: RequestArgs
  additionalValidStatuses?: number[]
}): Promise<PagesWithContext[]> => {
  const initialArgs = (_.isEmpty(contexts) ? [{}] : contexts).map(context => ({
    callArgs: replaceAllArgs({
      value: _.merge({}, callArgs, paginationDef.clientArgs),
      context,
      throwOnUnresolvedArgs: true,
    }),
    context,
  }))

  const pagesWithContext: PagesWithContext[] = []
  await Promise.all(
    initialArgs.map(async callArgsWithContext => {
      const pages: ResponseValue[] = []
      const finalEndpointIdentifier = replaceAllArgs({
        value: endpointIdentifier,
        context: callArgsWithContext.context,
        throwOnUnresolvedArgs: true,
      })

      const processPage: ClientRequest = async args => {
        try {
          const page = await client[finalEndpointIdentifier.method ?? 'get']({
            url: finalEndpointIdentifier.path,
            ...args,
          })
          pages.push(...collections.array.makeArray(page.data).filter(item => !_.isEmpty(item)))
          return page
        } catch (e) {
          const status = e.response?.status
          if (additionalValidStatuses.includes(status)) {
            log.debug('Suppressing %d error %o', status, e)
            return { data: {}, status }
          }
          throw e
        }
      }

      const getNextPages = paginationDef.funcCreator({
        client,
        endpointIdentifier: finalEndpointIdentifier,
        params: callArgsWithContext.context,
      })
      const queue = new RequestQueue({
        paginationFunc: getNextPages,
        requestPage: processPage,
        endpointIdentifier: finalEndpointIdentifier,
      })

      // TODO update arg names when removing old config
      const alignedArgs = {
        queryParams: callArgsWithContext.callArgs.queryArgs,
        ..._.omit(callArgsWithContext.callArgs, 'queryArgs'),
      }
      queue.enqueue(alignedArgs)
      await queue.awaitCompletion()
      pagesWithContext.push({ context: callArgsWithContext.context, pages })
    }),
  )

  return pagesWithContext
}
