/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { collections, values as lowerdashValues } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { ResponseValue } from './http_connection'
import { ClientBaseParams, HTTPReadClientInterface } from './http_client'

const { isDefined } = lowerdashValues
const { makeArray } = collections.array
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
  const { url, queryParams, recursiveQueryParams } = getParams
  const requestQueryArgs: Record<string, string>[] = [{}]
  const usedParams = new Set<string>()
  let numResults = 0

  while (requestQueryArgs.length > 0) {
    const additionalArgs = requestQueryArgs.pop() as Record<string, string>
    const serializedArgs = safeJsonStringify(additionalArgs)
    if (usedParams.has(serializedArgs)) {
      // eslint-disable-next-line no-continue
      continue
    }
    usedParams.add(serializedArgs)
    const params = { ...queryParams, ...additionalArgs }
    // eslint-disable-next-line no-await-in-loop
    const response = await client.getSinglePage({
      url,
      queryParams: Object.keys(params).length > 0 ? params : undefined,
    })

    if (response.status !== 200) {
      log.warn(`error getting result for ${url}: %s %o %o`, response.status, response.statusText, response.data)
      break
    }

    const entries = (
      (!Array.isArray(response.data) && Array.isArray(response.data.items))
        ? response.data.items
        : makeArray(response.data)
    ).flatMap(extractPageEntries)
    const page = customEntryExtractor ? entries.flatMap(customEntryExtractor) : entries

    if (page.length === 0) {
      // eslint-disable-next-line no-continue
      continue
    }
    yield page
    numResults += page.length

    requestQueryArgs.unshift(...paginationFunc({
      responseData: response.data,
      page,
      getParams,
      pageSize,
      currentParams: additionalArgs,
      responseHeaders: response.headers,
    }))

    if (recursiveQueryParams !== undefined && Object.keys(recursiveQueryParams).length > 0) {
      requestQueryArgs.unshift(...computeRecursiveArgs(page, recursiveQueryParams))
    }
  }
  // the number of results may be lower than actual if the instances are under a nested field
  log.info('Received %d results for endpoint %s', numResults, url)
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

export const getWithOffsetAndLimit = (): PaginationFunc => {
  // Hard coded "isLast" and "values" in order to fit the configuration scheme which only allows
  // "paginationField" to be configured
  type PageResponse = {
    isLast: boolean
    values: unknown[]
    [k: string]: unknown
  }
  const isPageResponse = (
    responseData: unknown,
    paginationField: string
  ): responseData is PageResponse => (
    _.isObject(responseData)
    && _.isBoolean(_.get(responseData, 'isLast'))
    && Array.isArray(_.get(responseData, 'values'))
    && _.isNumber(_.get(responseData, paginationField))
  )

  const getNextPage: PaginationFunc = (
    { responseData, getParams, currentParams }
  ) => {
    const { paginationField } = getParams
    if (paginationField === undefined) {
      return []
    }
    if (!isPageResponse(responseData, paginationField)) {
      throw new Error(`Response from ${getParams.url} expected page with pagination field ${paginationField}, got ${safeJsonStringify(responseData)}`)
    }
    if (responseData.isLast) {
      return []
    }
    const currentPageStart = _.get(responseData, paginationField) as number
    const nextPageStart = currentPageStart + responseData.values.length
    const nextPage = { ...currentParams, [paginationField]: nextPageStart.toString() }
    return [nextPage]
  }

  return getNextPage
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
