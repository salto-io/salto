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
import _ from 'lodash'
import Joi from 'joi'
import objectHash from 'object-hash'
import { createSchemeGuard, safeJsonStringify } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { ResponseValue, Response } from '../http_connection'
import { HTTPReadClientInterface } from '../http_client'
import { ClientGetWithPaginationParams, GetAllItemsFunc, PageEntriesExtractor, PaginationFunc, computeRecursiveArgs } from './common'

const { makeArray } = collections.array
const log = logger(module)


const allSettled = async <T>(promises: IterableIterator<Promise<T>>): Promise<void> => {
  await Promise.all(Array.from(promises).map(p => p.catch(() => undefined)))
}

type KeyFromPromiseResult<T> = (result: T) => string
class PromisesQueue<T> {
  private readonly promises: Map<string, Promise<T>>
  private readonly hashFunc: KeyFromPromiseResult<T>
  constructor(hashFunc: KeyFromPromiseResult<T>) {
    this.promises = new Map()
    this.hashFunc = hashFunc
  }

  enqueue(key: string, promise: Promise<T>): void {
    this.promises.set(key, promise)
    log.debug(`Added promise to pagination queue. Queue size: ${this.promises.size}`)
  }

  async dequeue(): Promise<T> {
    const settledPromise = await Promise.race(this.promises.values())
    this.promises.delete(this.hashFunc(settledPromise))
    log.debug(`Removed promise from pagination queue. Queue size: ${this.promises.size}`)
    return settledPromise
  }

  size(): number {
    return this.promises.size
  }

  async clear(): Promise<void> {
    await allSettled(this.promises.values())
  }
}

type PaginationResult = {
  page: ResponseValue[]
  response: Response<ResponseValue| ResponseValue[]>
  additionalArgs: Record<string, string>
  yieldResult: boolean
}

type GetPageArgs = {
  promisesQueue: PromisesQueue<PaginationResult>
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
  additionalArgs: Record<string, string>
):Promise<PaginationResult> => {
  const { client, extractPageEntries, customEntryExtractor, getParams } = pageArgs
  const { url, queryParams, headers } = getParams
  const params = { ...queryParams, ...additionalArgs }

  const response = await client.getSinglePage({
    url,
    queryParams: Object.keys(params).length > 0 ? params : undefined,
    headers,
  })
  if (response.status !== 200) {
    log.warn(`error getting result for ${url}: %s %o %o`, response.status, response.statusText, response.data)
    return { response, page: [], additionalArgs, yieldResult: false }
  }
  const entries = (
    (!Array.isArray(response.data) && Array.isArray(response.data.items))
      ? response.data.items
      : makeArray(response.data)
  ).flatMap(extractPageEntries)

  // checking original entries and not the ones that passed the custom extractor, because even if all entries are
  // filtered out we should still continue querying
  if (entries.length === 0) {
    return { response, page: [], additionalArgs, yieldResult: false }
  }
  const page = customEntryExtractor ? entries.flatMap(customEntryExtractor) : entries

  return { response, page, additionalArgs, yieldResult: true }
}

const pushPage = (pageArgs: GetPageArgs, additionalArgs: Record<string, string>):void => {
  const argsHash = objectHash(additionalArgs)
  if (pageArgs.usedParams.has(argsHash)) {
    return
  }
  pageArgs.usedParams.add(argsHash)
  const result = singlePagePagination(pageArgs, additionalArgs)
  pageArgs.promisesQueue.enqueue(argsHash, result)
}

const addNextPages = ({ pageArgs, page, response, additionalArgs } :{
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
) => GetAllItemsFunc = (
  paginationFunc, extractPageEntries, customEntryExtractor,
) => async function *getPages({
  client,
  pageSize,
  getParams,
}) {
  const usedParams = new Set<string>()
  const promisesQueue: PromisesQueue<PaginationResult> = new PromisesQueue<PaginationResult>(
    (result: PaginationResult): string => objectHash(result.additionalArgs)
  )
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
        addNextPages({
          pageArgs,
          page: result.page,
          response: result.response,
          additionalArgs: result.additionalArgs,
        })
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

const isPageResponse = createSchemeGuard<PageResponse>(PAGE_RESPONSE_SCHEME, 'Expected a response with a total and values')

// pagination for pages that have a total, and can be brought simultaneously
// after the first call all the rest of the pages will be returned. In the rest of the calls return nothing
export const getAllPagesWithOffsetAndTotal = (): PaginationFunc =>
  ({ responseData, getParams, currentParams }) => {
    const { paginationField } = getParams
    if (paginationField === undefined) {
      return []
    }
    if (!isPageResponse(responseData) || !_.isNumber(_.get(responseData, paginationField))) {
      throw new Error(`Response from ${getParams.url} expected page with pagination field ${paginationField}, got ${safeJsonStringify(responseData)}`)
    }
    const currentPageStart = _.get(responseData, paginationField) as number
    if (currentPageStart !== 0 || responseData.total === responseData.values.length) {
      // bring only in the first call
      return []
    }
    return _.range(responseData.values.length, responseData.total, responseData.values.length)
      .map(nextPageStart => ({ ...currentParams, [paginationField]: nextPageStart.toString() }))
  }
