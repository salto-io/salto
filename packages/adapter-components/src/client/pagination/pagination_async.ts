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
import Joi from 'joi'
import objectHash from 'object-hash'
import { createSchemeGuard, safeJsonStringify } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { ResponseValue, Response } from '../http_connection'
import { HTTPReadClientInterface } from '../http_client'
import {
  ClientGetWithPaginationParams,
  GetAllItemsFunc,
  PageEntriesExtractor,
  PaginationFunc,
  computeRecursiveArgs,
} from './common'

const { makeArray } = collections.array
const log = logger(module)

const allSettled = async <T>(promises: IterableIterator<Promise<T>>): Promise<void> => {
  await Promise.all(Array.from(promises).map(p => p.catch(() => undefined)))
}

type PaginationResult = {
  page: ResponseValue[]
  response: Response<ResponseValue | ResponseValue[]>
  additionalArgs: Record<string, string>
  yieldResult: boolean
}

type GetPageArgs = {
  // eslint-disable-next-line no-use-before-define
  promisesQueue: PromisesQueue
  paginationFunc: PaginationFunc
  client: HTTPReadClientInterface
  extractPageEntries: PageEntriesExtractor
  customEntryExtractor?: PageEntriesExtractor
  getParams: ClientGetWithPaginationParams
  pageSize: number
  usedParams: Set<string>
}

const singlePagePagination = async (
  pageArgs: GetPageArgs,
  additionalArgs: Record<string, string>,
): Promise<PaginationResult> => {
  const { client, extractPageEntries, customEntryExtractor, getParams } = pageArgs
  const { url, queryParams, headers } = getParams
  const params = { ...queryParams, ...additionalArgs }

  const response = await client.get({
    url,
    queryParams: Object.keys(params).length > 0 ? params : undefined,
    headers,
  })
  if (response.status !== 200) {
    log.warn(`error getting result for ${url}: %s %o %o`, response.status, response.statusText, response.data)
    return { response, page: [], additionalArgs, yieldResult: false }
  }
  const entries = (
    !Array.isArray(response.data) && Array.isArray(response.data.items) ? response.data.items : makeArray(response.data)
  ).flatMap(extractPageEntries)

  // checking original entries and not the ones that passed the custom extractor, because even if all entries are
  // filtered out we should still continue querying
  if (entries.length === 0) {
    return { response, page: [], additionalArgs, yieldResult: false }
  }
  const page = customEntryExtractor ? entries.flatMap(customEntryExtractor) : entries
  // eslint-disable-next-line no-use-before-define
  addNextPages({
    pageArgs,
    page,
    response,
    additionalArgs,
  })
  return { response, page, additionalArgs, yieldResult: true }
}

class PromisesQueue {
  private readonly promises: Promise<PaginationResult>[]
  private shouldContinue: boolean
  constructor() {
    this.promises = []
    this.shouldContinue = true
  }

  enqueue(pageArgs: GetPageArgs, additionalArgs: Record<string, string>): void {
    if (!this.shouldContinue) {
      return
    }
    const promise = singlePagePagination(pageArgs, additionalArgs)
    this.promises.push(promise)
    log.trace(`Added promise to pagination queue. Queue size: ${this.promises.length}`)
  }

  async dequeue(): Promise<PaginationResult> {
    const settledPromise = await this.promises.shift()
    if (settledPromise === undefined) {
      // this may occur if the queue is empty which we checked it before calling dequeue
      log.error('No promises to dequeue from pagination queue')
      throw new Error('No promises to dequeue from pagination queue')
    }
    log.trace(`Removed promise from pagination queue. Queue size: ${this.promises.length}`)
    return settledPromise
  }

  size(): number {
    return this.promises.length
  }

  async clear(): Promise<void> {
    this.shouldContinue = false
    await allSettled(this.promises.values())
  }
}

const pushPage = (pageArgs: GetPageArgs, additionalArgs: Record<string, string>): void => {
  const argsHash = objectHash(additionalArgs)
  if (pageArgs.usedParams.has(argsHash)) {
    return
  }
  pageArgs.usedParams.add(argsHash)
  pageArgs.promisesQueue.enqueue(pageArgs, additionalArgs)
}

const addNextPages = ({
  pageArgs,
  page,
  response,
  additionalArgs,
}: {
  pageArgs: GetPageArgs
  response: Response<ResponseValue | ResponseValue[]>
  page: ResponseValue[]
  additionalArgs: Record<string, string>
}): void => {
  const { getParams, paginationFunc, pageSize } = pageArgs
  const { recursiveQueryParams } = getParams
  paginationFunc({
    responseData: response.data,
    page,
    getParams,
    pageSize,
    currentParams: additionalArgs,
    responseHeaders: response.headers,
  }).forEach(args => pushPage(pageArgs, args))

  // add recursive calls to the queue
  if (recursiveQueryParams !== undefined && Object.keys(recursiveQueryParams).length > 0) {
    computeRecursiveArgs(page, recursiveQueryParams).forEach(args => pushPage(pageArgs, args))
  }
}
/**
 * The traverseRequests function is a generator that yields pages of results from a paginated
 * endpoint.
 * the function processes all existing pages simultaneously, and yields the pages as they arrive.
 * Its primary priority is to keep the number of concurrent requests to a maximum, and deal with results only
 * when there are no requests to send
 * @param paginationFunc a function that is responsible for extracting the next pages of results
 * from the response
 * @param extractPageEntries a function that is responsible for extracting the
 * entries from the page.
 */
export const traverseRequestsAsync: (
  paginationFunc: PaginationFunc,
  extractPageEntries: PageEntriesExtractor,
  customEntryExtractor?: PageEntriesExtractor,
) => GetAllItemsFunc = (paginationFunc, extractPageEntries, customEntryExtractor) =>
  async function* getPages({ client, pageSize, getParams }) {
    const usedParams = new Set<string>()
    const promisesQueue: PromisesQueue = new PromisesQueue()
    let numResults = 0
    const pageArgs = {
      promisesQueue,
      getParams,
      paginationFunc,
      client,
      extractPageEntries,
      customEntryExtractor,
      pageSize,
      usedParams,
    }
    pushPage(pageArgs, {})
    while (promisesQueue.size() > 0) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const result = await promisesQueue.dequeue()
        if (result.yieldResult) {
          yield result.page
          numResults += result.page.length
        }
      } catch (e) {
        // avoid leaking promises
        // eslint-disable-next-line no-await-in-loop
        await promisesQueue.clear()
        throw e
      }
    }
    // the number of results may be lower than actual if the instances are under a nested field
    log.info('Received %d results for endpoint %s', numResults, getParams.url)
  }

type PageResponse = {
  total: number
  values: unknown[]
}

const PAGE_RESPONSE_SCHEME = Joi.object({
  total: Joi.number().required(),
  values: Joi.array().required(),
}).unknown(true)

const isPageResponse = createSchemeGuard<PageResponse>(
  PAGE_RESPONSE_SCHEME,
  'Expected a response with a total and values',
)

// pagination for pages that have a total, and can be brought simultaneously
// after the first call all the rest of the pages will be returned. In the rest of the calls return nothing
export const getAllPagesWithOffsetAndTotal =
  (): PaginationFunc =>
  ({ responseData, getParams, currentParams }) => {
    const { paginationField } = getParams
    if (paginationField === undefined) {
      return []
    }
    if (!isPageResponse(responseData) || !_.isNumber(_.get(responseData, paginationField))) {
      throw new Error(
        `Response from ${getParams.url} expected page with pagination field ${paginationField}, got ${safeJsonStringify(responseData)}`,
      )
    }
    const currentPageStart = _.get(responseData, paginationField) as number
    if (currentPageStart !== 0 || responseData.total === responseData.values.length) {
      // bring only in the first call
      return []
    }
    return _.range(responseData.values.length, responseData.total, responseData.values.length).map(nextPageStart => ({
      ...currentParams,
      [paginationField]: nextPageStart.toString(),
    }))
  }
