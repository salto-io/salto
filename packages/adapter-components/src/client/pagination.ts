/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { collections, values as lowerfashValues, types } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { ResponseValue } from './http_connection'
import { ClientGetParams, HTTPClientInterface } from './http_client'

const { isDefined } = lowerfashValues
const { makeArray } = collections.array
const log = logger(module)

type RecursiveQueryArgFunc = Record<string, (entry: ResponseValue) => string>

export type ClientGetWithPaginationParams = ClientGetParams & {
  recursiveQueryParams?: RecursiveQueryArgFunc
  paginationField?: string
}

export type GetAllItemsFunc = (args: {
  client: HTTPClientInterface
  pageSize: number
  getParams: ClientGetWithPaginationParams
}) => AsyncIterable<ResponseValue[]>


export type PaginationFunc = ({
  responseData,
  page,
  pageSize,
  getParams,
  currentParams,
}: {
  responseData: unknown
  page: ResponseValue[]
  pageSize: number
  getParams: types.PickyRequired<ClientGetWithPaginationParams, 'paginationField'>
  currentParams: Record<string, string>
}) => Record<string, string>[]

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
  paginationFunc: PaginationFunc
) => GetAllItemsFunc = paginationFunc => async function *getWithOffset({
  client,
  pageSize,
  getParams,
}) {
  const { url, paginationField, queryParams, recursiveQueryParams } = getParams
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
      log.error(`error getting result for ${url}: %s %o %o`, response.status, response.statusText, response.data)
      break
    }

    const page: ResponseValue[] = (
      (!Array.isArray(response.data) && Array.isArray(response.data.items))
        ? response.data.items
        : makeArray(response.data)
    )

    yield page
    numResults += page.length

    if (paginationField !== undefined) {
      requestQueryArgs.unshift(...paginationFunc({
        responseData: response.data,
        page,
        getParams: { ...getParams, paginationField },
        pageSize,
        currentParams: additionalArgs,
      }))
    }

    if (recursiveQueryParams !== undefined && Object.keys(recursiveQueryParams).length > 0) {
      requestQueryArgs.unshift(...computeRecursiveArgs(page, recursiveQueryParams))
    }
  }
  // the number of results may be lower than actual if the instances are under a nested field
  log.info('Received %d results for endpoint %s', numResults, url)
}

/**
 * Make paginated requests using the specified pagination field, assuming the
 * next page is prev+1 and first page is as specified.
 * Also supports recursive queries (see example under computeRecursiveArgs).
 */
export const getWithPageOffsetPagination: ((firstPage: number) => GetAllItemsFunc) = (
  firstPage => async function *getWithOffset(args) {
    const nextPageFullPages: PaginationFunc = ({ page, getParams, currentParams, pageSize }) => {
      const { paginationField } = getParams
      if (page.length >= pageSize) {
        return [{
          ...currentParams,
          [paginationField]: (currentParams[paginationField] ?? firstPage) + 1,
        }]
      }
      return []
    }
    yield* traverseRequests(nextPageFullPages)(args)
  }
)

/**
 * Make paginated requests using the specified pagination field, assuming the
 * next page is prev+1 and first page is as specified.
 * Also supports recursive queries (see example under computeRecursiveArgs).
 */
export const getWithPageOffsetAndLastPagination: ((firstPage: number) => GetAllItemsFunc) = (
  firstPage => async function *getWithOffset(args) {
    const nextPageFullPages: PaginationFunc = ({ responseData, getParams, currentParams }) => {
      const { paginationField } = getParams
      // hard-coding the "last" flag for now - if we see more variants we can move it to config
      if (_.get(responseData, 'last') === false) {
        return [{
          ...currentParams,
          [paginationField]: (currentParams[paginationField] ?? firstPage) + 1,
        }]
      }
      return []
    }
    yield* traverseRequests(nextPageFullPages)(args)
  }
)

/**
 * Path checker for ensuring the next url's path is under the same endpoint as the one configured.
 * Can be customized when the next url returned has different formatting, e.g. has a longer prefix
 * (such as /api/v1/product vs /product).
 * @return true if the configured endpoint can be used to get the next path, false otherwise.
 */
export type PathCheckerFunc = (endpointPath: string, nextPath: string) => boolean
const defaultPathChecker: PathCheckerFunc = (endpointPath, nextPath) => (endpointPath === nextPath)

/**
 * Make paginated requests using the specified paginationField, assuming the next page is specified
 * as either a full URL or just the path and query prameters.
 * Only supports next pages under the same endpoint (and uses the same host).
 */
export const getWithCursorPagination: ((pathChecker?: PathCheckerFunc) => GetAllItemsFunc) = (
  (pathChecker = defaultPathChecker) => async function *getWithCursor(args) {
    const nextPageCursorPages: PaginationFunc = ({
      responseData, getParams, currentParams,
    }) => {
      const { paginationField, url } = getParams
      const nextPagePath = _.get(responseData, paginationField)
      if (_.isString(nextPagePath)) {
        const nextPage = new URL(nextPagePath, 'http://localhost')
        if (!pathChecker(url, nextPage.pathname)) {
          log.error('unexpected next page received for endpoint %s params %o: %s', url, currentParams, nextPage.pathname)
          throw new Error(`unexpected next page received for endpoint ${url}: ${nextPage.pathname}`)
        }
        return [{ ...currentParams, ...Object.fromEntries(nextPage.searchParams.entries()) }]
      }
      return []
    }
    yield* traverseRequests(nextPageCursorPages)(args)
  }
)

export const getWithOffsetAndLimit: GetAllItemsFunc = args => {
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
    if (!isPageResponse(responseData, paginationField)) {
      throw new Error(`Response from ${getParams.url} expected page with pagination field ${paginationField}, got ${responseData}`)
    }
    if (responseData.isLast) {
      return []
    }
    const currentPageStart = _.get(responseData, paginationField) as number
    const nextPageStart = currentPageStart + responseData.values.length
    const nextPage = { ...currentParams, [paginationField]: nextPageStart.toString() }
    return [nextPage]
  }

  return traverseRequests(getNextPage)(args)
}

export type Paginator = (params: ClientGetWithPaginationParams) => AsyncIterable<ResponseValue[]>

/**
 * Wrap a pagination function for use by the adapter
 */
export const createPaginator = ({ paginationFunc, client }: {
  paginationFunc: GetAllItemsFunc
  client: HTTPClientInterface
}): Paginator => (
  params => paginationFunc({ client, pageSize: client.getPageSize(), getParams: params })
)
