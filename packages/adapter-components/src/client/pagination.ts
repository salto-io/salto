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
import { collections, values as lowerdashValues } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { ResponseValue } from './http_connection'
import { ClientBaseParams, HTTPReadClientInterface } from './http_client'

const { isDefined } = lowerdashValues
const { makeArray } = collections.array
const { awu } = collections.asynciterable
const log = logger(module)

type RecursiveQueryArgFunc = Record<string, (entry: ResponseValue) => string>

export type ClientGetWithPaginationParams = ClientBaseParams & {
  recursiveQueryParams?: RecursiveQueryArgFunc
  paginationField?: string
  pageSizeArgName?: string
}

export type PageEntriesExtractor = (page: ResponseValue) => ResponseValue[]
export type GetAllItemsFunc = (args: {
  client: HTTPReadClientInterface
  pageSize: number
  getParams: ClientGetWithPaginationParams
}) => AsyncIterable<ResponseValue[]>

export type PaginationFunc = ({
  responseData,
  page,
  pageSize,
  getParams,
  currentParams,
  responseHeaders,
}: {
  responseData: unknown
  page: ResponseValue[]
  pageSize: number
  getParams: ClientGetWithPaginationParams
  currentParams: Record<string, string>
  responseHeaders?: unknown
}) => Record<string, string>[]

export type PaginationFuncCreator<T = {}> = (args: {
  client: HTTPReadClientInterface
  pageSize: number
  getParams: ClientGetWithPaginationParams
} & T) => PaginationFunc

/**
 * Helper function for generating individual recursive queries based on past responses.
 *
 * For example, the endpoint /folder may have an optional parent_id parameter that is called
 * to list the folders under parent_id. So for each item returned from /folder, we should make
 * a subsequent call to /folder?parent_id=<id>
 */
const computeRecursiveArgs = (
  responses: ResponseValue[],
  recursiveQueryParams?: RecursiveQueryArgFunc,
): Record<string, string>[] => (
  (recursiveQueryParams !== undefined && Object.keys(recursiveQueryParams).length > 0)
    ? responses
      .map(res => _.pickBy(
        _.mapValues(
          recursiveQueryParams,
          mapper => mapper(res),
        ),
        isDefined,
      ))
      .filter(args => Object.keys(args).length > 0)
    : []
)

const allSettled = async <T>(promises: IterableIterator<Promise<T>>): Promise<void> => {
  await awu(promises)
    .forEach(async promise => promise.catch(_e => undefined))
}


type PaginationResult = {
  page: ResponseValue[]
  additionalArgs: Record<string, string>
  yieldResult: boolean
}

type GetPageArgs = {
  promisesQueue: Map<string, Promise<PaginationResult>>
  // recursiveQueryParams: RecursiveQueryArgFunc | undefined
  paginationFunc: PaginationFunc
  // queryParams: Record<string, string | string[]> | undefined
  client: HTTPReadClientInterface
  // url: string
  // headers: Record<string, string> | undefined
  extractPageEntries: PageEntriesExtractor
  customEntryExtractor?: PageEntriesExtractor
  getParams: ClientGetWithPaginationParams
  pageSize: number
  usedParams: Set<string>
}

const pushPage = (pageArgs: GetPageArgs, additionalArgs: Record<string, string>):void => {
  const argsHash = objectHash(additionalArgs)
  if (pageArgs.usedParams.has(argsHash)) {
    return
  }
  pageArgs.usedParams.add(argsHash)
  // eslint-disable-next-line no-use-before-define
  const result = singlePagePagination(pageArgs, additionalArgs)
  pageArgs.promisesQueue.set(argsHash, result)
}

const singlePagePagination = async (
  pageArgs: GetPageArgs,
  additionalArgs: Record<string, string>
):Promise<PaginationResult> => {
  const { client, extractPageEntries, customEntryExtractor, getParams, paginationFunc, pageSize } = pageArgs
  const { url, queryParams, recursiveQueryParams, headers } = getParams
  const params = { ...queryParams, ...additionalArgs }

  const response = await client.getSinglePage({
    url,
    queryParams: Object.keys(params).length > 0 ? params : undefined,
    headers,
  })
  if (response.status !== 200) {
    log.warn(`error getting result for ${url}: %s %o %o`, response.status, response.statusText, response.data)
    return { page: [], additionalArgs, yieldResult: false }
  }
  const entries = (
    (!Array.isArray(response.data) && Array.isArray(response.data.items))
      ? response.data.items
      : makeArray(response.data)
  ).flatMap(extractPageEntries)

  // checking original entries and not the ones that passed the custom extractor, because even if all entries are
  // filtered out we should still continue querying
  if (entries.length === 0) {
    return { page: [], additionalArgs, yieldResult: false }
  }
  const page = customEntryExtractor ? entries.flatMap(customEntryExtractor) : entries

  // add next calls to the queue
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

  return { page, additionalArgs, yieldResult: true }
}

// The traverseRequests function is a generator that yields pages of results from a paginated
// endpoint. It takes a paginationFunc that is responsible for extracting the next pages of results
// from the response, and an extractPageEntries function that is responsible for extracting the
// entries from the page.
// the function processes all existing pages simultaneously, and yields the pages as they arrive.
// Its primary priority is to keep the number of concurrent requests to a maximum, and deal with results only
// when there are no requests to send
export const traverseRequests: (
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
  const promisesQueue: Map<string, Promise<PaginationResult>> = new Map()
  let numResults = 0
  pushPage({
    promisesQueue,
    getParams,
    paginationFunc,
    client,
    extractPageEntries,
    customEntryExtractor,
    pageSize,
    usedParams,
  }, {})
  while (promisesQueue.size > 0) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const result = await Promise.race(promisesQueue.values())
      promisesQueue.delete(objectHash(result.additionalArgs))
      if (result.yieldResult) {
        yield result.page
        numResults += result.page.length
      }
    } catch (e) {
      // avoid leaking promises
      // eslint-disable-next-line no-await-in-loop
      await allSettled(promisesQueue.values())
      throw e
    }
  }
  // the number of results may be lower than actual if the instances are under a nested field
  log.info('Received %d results for endpoint %s', numResults, getParams.url)
}

/**
 * Make paginated requests using the specified pagination field
 * Response is expected to contain a list of values without metadata
 * Going to next page is done manually by advancing the pagination field by the relevant amount
 */
export const getWithItemOffsetPagination = ({
  firstIndex,
  pageSizeArgName
  ,
} : {
  firstIndex: number
  pageSizeArgName: string | undefined
}): PaginationFunc => {
  const nextPage: PaginationFunc = ({ page, getParams, currentParams, pageSize }) => {
    const { paginationField, queryParams } = getParams

    const itemsPerPage = (pageSizeArgName !== undefined && queryParams !== undefined
      && !Number.isNaN(Number(queryParams?.[pageSizeArgName])))
      ? Number(queryParams[pageSizeArgName])
      : pageSize

    if (paginationField === undefined || page.length < itemsPerPage || page.length === 0) {
      return []
    }
    return [{
      ...currentParams,
      [paginationField]: (Number(currentParams[paginationField] ?? firstIndex) + itemsPerPage)
        .toString(),
    }]
  }
  return nextPage
}

/**
 * Make paginated requests using the specified pagination field, assuming the
 * next page is prev+1 and first page is as specified.
 * Also supports recursive queries (see example under computeRecursiveArgs).
 */
export const getWithPageOffsetPagination = (firstPage: number): PaginationFunc => {
  const nextPageFullPages: PaginationFunc = ({ page, getParams, currentParams, pageSize }) => {
    const { paginationField } = getParams
    if (paginationField === undefined || page.length < pageSize) {
      return []
    }
    return [{
      ...currentParams,
      [paginationField]: (Number(currentParams[paginationField] ?? firstPage) + 1).toString(),
    }]
  }
  return nextPageFullPages
}

/**
 * Make paginated requests using the specified pagination field, assuming the
 * next page is prev+1 and first page is as specified.
 * Also supports recursive queries (see example under computeRecursiveArgs).
 */
export const getWithPageOffsetAndLastPagination = (firstPage: number): PaginationFunc => {
  const nextPageFullPages: PaginationFunc = ({ responseData, getParams, currentParams }) => {
    const { paginationField } = getParams
    // hard-coding the "last" flag for now - if we see more variants we can move it to config
    if (paginationField === undefined || _.get(responseData, 'last') !== false) {
      return []
    }
    return [{
      ...currentParams,
      [paginationField]: (Number(currentParams[paginationField] ?? firstPage) + 1).toString(),
    }]
  }
  return nextPageFullPages
}

/**
 * Path checker for ensuring the next url's path is under the same endpoint as the one configured.
 * Can be customized when the next url returned has different formatting, e.g. has a longer prefix
 * (such as /api/v1/product vs /product).
 * @return true if the configured endpoint can be used to get the next path, false otherwise.
 */
export type PathCheckerFunc = (endpointPath: string, nextPath: string) => boolean
export const defaultPathChecker: PathCheckerFunc = (
  endpointPath,
  nextPath
) => (endpointPath === nextPath)

/**
 * Make paginated requests using the specified paginationField, assuming the next page is specified
 * as either a full URL or just the path and query prameters.
 * Only supports next pages under the same endpoint (and uses the same host).
 */
export const getWithCursorPagination = (pathChecker = defaultPathChecker): PaginationFunc => {
  const nextPageCursorPages: PaginationFunc = ({
    responseData, getParams, currentParams,
  }) => {
    const { paginationField, url } = getParams
    if (paginationField !== undefined) {
      const nextPagePath = _.get(responseData, paginationField)
      if (_.isString(nextPagePath)) {
        const nextPage = new URL(nextPagePath, 'http://localhost')
        if (!pathChecker(url, nextPage.pathname)) {
          log.error('unexpected next page received for endpoint %s params %o: %s', url, currentParams, nextPage.pathname)
          throw new Error(`unexpected next page received for endpoint ${url}: ${nextPage.pathname}`)
        }
        return [{
          ...currentParams,
          ...Object.fromEntries(nextPage.searchParams.entries()),
        }]
      }
    }
    return []
  }
  return nextPageCursorPages
}

// pagination for pages that have a total, and can be brought simultaneously
// after the first call all the rest of the pages will be returned. In the rest of the calls return nothing
export const getAllPagesWithOffsetAndTotal = (): PaginationFunc => {
  type PageResponse = {
    total: number
    values: unknown[]
  }

  const PAGE_RESPONSE_SCHEME = Joi.object({
    total: Joi.number().required(),
    values: Joi.array().required(),
  }).unknown(true)

  const isPageResponse = createSchemeGuard<PageResponse>(PAGE_RESPONSE_SCHEME, 'Expected a response with a total and values')

  const getNextPages: PaginationFunc = (
    { responseData, getParams, currentParams }
  ) => {
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

  return getNextPages
}

export type Paginator = (
  params: ClientGetWithPaginationParams,
  extractPageEntries: PageEntriesExtractor,
) => AsyncIterable<ResponseValue[]>

/**
 * Wrap a pagination function for use by the adapter
 */
export const createPaginator = ({ paginationFuncCreator, customEntryExtractor, client }: {
  paginationFuncCreator: PaginationFuncCreator
  customEntryExtractor?: PageEntriesExtractor
  client: HTTPReadClientInterface
}): Paginator => (
  (getParams, extractPageEntries) => traverseRequests(
    paginationFuncCreator({ client, pageSize: client.getPageSize(), getParams }),
    extractPageEntries,
    customEntryExtractor,
  )({ client, pageSize: client.getPageSize(), getParams })
)
