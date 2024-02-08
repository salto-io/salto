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
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { HTTPReadClientInterface } from '../http_client'
import { traverseRequestsAsync } from './pagination_async'
import { GetAllItemsFunc, PageEntriesExtractor, PaginationFunc, PaginationFuncCreator, Paginator, computeRecursiveArgs } from './common'
import { defaultPathChecker } from '../../fetch/request/pagination'

const { makeArray } = collections.array
const log = logger(module)

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
  const { url, queryParams, recursiveQueryParams, headers } = getParams
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
    const response = await client.get({
      url,
      queryParams: Object.keys(params).length > 0 ? params : undefined,
      headers,
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

    // checking original entries and not the ones that passed the custom extractor, because even if all entries are
    // filtered out we should still continue querying
    if (entries.length === 0) {
      // eslint-disable-next-line no-continue
      continue
    }
    const page = customEntryExtractor ? entries.flatMap(customEntryExtractor) : entries

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
  pageSizeArgName,
}: {
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

/**
 * Wrap a pagination function for use by the adapter
 */
export const createPaginator = ({ paginationFuncCreator, customEntryExtractor, client, asyncRun = false }: {
  paginationFuncCreator: PaginationFuncCreator
  customEntryExtractor?: PageEntriesExtractor
  client: HTTPReadClientInterface
  asyncRun?: boolean
}): Paginator => {
  const traverseRequestsFunc = asyncRun ? traverseRequestsAsync : traverseRequests
  return (getParams, extractPageEntries) => traverseRequestsFunc(
    paginationFuncCreator({ client, pageSize: client.getPageSize(), getParams }),
    extractPageEntries,
    customEntryExtractor,
  )({ client, pageSize: client.getPageSize(), getParams })
}
