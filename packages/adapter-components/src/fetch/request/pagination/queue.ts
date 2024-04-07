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
import objectHash from 'object-hash'
import { logger } from '@salto-io/logging'
import { Response, ResponseValue } from '../../../client'
import { ClientRequestArgsNoPath, PaginationFunction } from '../../../definitions/system'
import { HTTPEndpointIdentifier } from '../../../definitions'

const log = logger(module)

export type ClientRequest = (params: ClientRequestArgsNoPath) => Promise<Response<ResponseValue | ResponseValue[]>>

export class RequestQueue<ClientOptions extends string> {
  private seenArgs: Set<string>
  private queue: ClientRequestArgsNoPath[]
  private activePromises: { promise: Promise<void>; id: string }[]
  private maxConcurrentRequests: number
  private requestPage: ClientRequest
  private paginationFunc: PaginationFunction
  private endpointIdentifier: HTTPEndpointIdentifier<ClientOptions>

  // maxConcurrentRequests is set to an arbitrary large number - if needed, we should pass it in the definitions
  constructor({
    requestPage,
    paginationFunc,
    endpointIdentifier,
    maxConcurrentRequests = 1000,
  }: {
    requestPage: ClientRequest
    paginationFunc: PaginationFunction
    maxConcurrentRequests?: number
    endpointIdentifier: HTTPEndpointIdentifier<ClientOptions>
  }) {
    this.seenArgs = new Set<string>()
    this.queue = []
    this.activePromises = []
    this.paginationFunc = paginationFunc
    this.requestPage = requestPage
    this.maxConcurrentRequests = maxConcurrentRequests
    this.endpointIdentifier = endpointIdentifier
  }

  enqueue(args: ClientRequestArgsNoPath): void {
    const argsKey = objectHash(args)
    if (!this.seenArgs.has(argsKey)) {
      this.seenArgs.add(argsKey)
      this.queue.push(args)
      // try to process immediately if there's capacity
      this.processNext()
    }
  }

  processNext(): void {
    while (this.queue.length > 0 && this.activePromises.length < this.maxConcurrentRequests) {
      const args = this.queue.shift()
      log.trace(
        'processNext on queue %s.%s:%s - %d items left',
        this.endpointIdentifier.client,
        this.endpointIdentifier.path,
        this.endpointIdentifier.method ?? 'get',
        this.queue.length,
      )
      if (args === undefined) {
        throw new Error('unexpected undefined args')
      }
      const promise = this.waitForPromise(args)
      this.activePromises.push({ promise, id: objectHash(args) })
    }
  }

  private async waitForPromise(args: ClientRequestArgsNoPath): Promise<void> {
    let promiseID: string
    try {
      promiseID = objectHash(args)
      const pagePromise = this.requestPage(args)
      const page = await pagePromise
      const nextArgs = this.paginationFunc({
        responseData: page.data,
        responseHeaders: page.headers,
        currentParams: args,
        endpointIdentifier: this.endpointIdentifier,
      })
      nextArgs.forEach(arg => this.enqueue(arg))
    } catch (e) {
      log.error('Error processing args (%s): %s, stack: %s', args, e, e.stack)
      throw e
    } finally {
      this.activePromises = this.activePromises.filter(p => p.id !== promiseID)
      this.processNext()
    }
  }

  // Wait until all active promises are resolved
  async awaitCompletion(): Promise<void> {
    // using a loop since new promises may be added while we wait
    while (this.activePromises.length > 0) {
      // eslint-disable-next-line no-await-in-loop
      await Promise.all(this.activePromises.map(({ promise }) => promise))
    }
  }
}
