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
import {
  ClientBaseParams,
  executeWithPolling,
  HTTPReadClientInterface,
  HTTPWriteClientInterface,
  Response,
  ResponseValue,
} from '../../../client'
import { HTTPEndpointIdentifier, ContextParams, PaginationDefinitions } from '../../../definitions'
import { RequestQueue, ClientRequest } from './queue'
import { RequestArgs, PollingArgs } from '../../../definitions/system'
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
  polling,
}: {
  client: HTTPReadClientInterface & HTTPWriteClientInterface
  paginationDef: PaginationDefinitions<ClientOptions>
  endpointIdentifier: HTTPEndpointIdentifier<ClientOptions>
  contexts: ContextParams[]
  callArgs: RequestArgs
  additionalValidStatuses?: number[]
  polling?: PollingArgs
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

      const singleClientCall = async (args: ClientBaseParams): Promise<Response<ResponseValue | ResponseValue[]>> => {
        try {
          return await client[finalEndpointIdentifier.method ?? 'get'](args)
        } catch (e) {
          const status = e.response?.status
          if (additionalValidStatuses.includes(status)) {
            log.debug(
              'Suppressing %d error %o, for path %s in method %s',
              status,
              e,
              finalEndpointIdentifier.path,
              finalEndpointIdentifier.method,
            )
            return { data: {}, status }
          }
          throw e
        }
      }

      const processPage: ClientRequest = async args => {
        //  TODO SALTO-5575 consider splitting the polling from the pagination
        const updatedArgs: ClientBaseParams = {
          url: finalEndpointIdentifier.path,
          ...args,
        }
        const page = polling
          ? await executeWithPolling<ClientBaseParams>(updatedArgs, polling, singleClientCall)
          : await singleClientCall(updatedArgs)
        pages.push(...collections.array.makeArray(page.data).filter(item => !_.isEmpty(item)))
        return page
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
