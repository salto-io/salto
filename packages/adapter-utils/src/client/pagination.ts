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
import { collections, values as lowerfashValues } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { APIConnection, ResponseValue } from './http_connection'
import { safeJsonStringify } from '../utils'

const { isDefined } = lowerfashValues
const { makeArray } = collections.array
const log = logger(module)

type RecursiveQueryArgFunc = Record<string, (entry: ResponseValue) => string>

export type ClientGetParams = {
  url: string
  queryParams?: Record<string, string>
  recursiveQueryParams?: RecursiveQueryArgFunc
  paginationField?: string
}

export type GetAllItemsFunc = ({
  conn,
  pageSize,
  getParams,
}: {
  conn: APIConnection
  pageSize: number
  getParams: ClientGetParams
}) => AsyncIterable<ResponseValue[]>

/**
 * Helper function for generating individual recursive queries based on past responses.
 *
 * For example, the endpoint /folder may have an optional parent_id parameter that is called
 * to list the folders under parent_id. So for each item returned from /folder, we should make
 * a subsequent call to /folder?parent_id=<id>
 */
const computeRecursiveArgs = (
  recursiveQueryParams: RecursiveQueryArgFunc,
  responses: ResponseValue[],
): Record<string, string>[] => (
  responses
    .map(res => _.pickBy(
      _.mapValues(
        recursiveQueryParams,
        mapper => mapper(res),
      ),
      isDefined,
    ))
    .filter(args => Object.keys(args).length > 0)
)

/**
 * Make paginated requests using the specified pagination field, assuming the
 * next page is prev+1 and first page is 1.
 * Also supports recursive queries (see example under computeRecursiveArgs).
 */
export const getWithPageOffsetPagination: GetAllItemsFunc = async function *getWithOffset({
  conn,
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
    const response = await conn.get(
      url,
      Object.keys(params).length > 0 ? { params } : undefined
    )

    log.debug('Full HTTP response for %s: %s', url, safeJsonStringify({
      url, params, response: response.data,
    }))

    if (response.status !== 200) {
      log.error(`error getting result for ${url}: %s %o %o`, response.status, response.statusText, response.data)
      break
    }

    const page: ResponseValue[] = (
      (_.isObjectLike(response.data) && Array.isArray(response.data.items))
        ? response.data.items
        : makeArray(response.data)
    )

    yield page
    numResults += page.length

    if (paginationField !== undefined && page.length >= pageSize) {
      requestQueryArgs.unshift({
        ...additionalArgs,
        [paginationField]: (additionalArgs[paginationField] ?? 1) + 1,
      })
    }

    if (recursiveQueryParams !== undefined && Object.keys(recursiveQueryParams).length > 0) {
      requestQueryArgs.unshift(...computeRecursiveArgs(recursiveQueryParams, page))
    }
  }
  log.info('Received %d results for endpoint %s', numResults, url)
}

/**
 * Make paginated requests using the specified paginationField, assuming the next page is specified
 * as either a full URL or just the path and query prameters.
 * Only supports next pages under the same endpoint (and uses the same host).
 */
export const getWithCursorPagination: GetAllItemsFunc = async function *getWithCursor({
  conn,
  getParams,
}) {
  const { url, queryParams, paginationField } = getParams

  let nextPageArgs: Record<string, string> = {}
  let numResults = 0

  const computeNextPageArgs = (
    nextPagePath: string,
    params: Record<string, string>,
  ): Record<string, string> => {
    const nextPage = new URL(nextPagePath, 'http://localhost')
    if (nextPage.pathname !== url) {
      log.error('unexpected next page received for endpoint %s params %o: %s', url, params, nextPage.pathname)
      throw new Error(`unexpected next page received for endpoint ${url}: ${nextPage.pathname}`)
    }
    return Object.fromEntries(nextPage.searchParams.entries())
  }

  while (true) {
    const params = {
      ...queryParams,
      ...nextPageArgs,
    }
    // eslint-disable-next-line no-await-in-loop
    const response = await conn.get(
      url,
      Object.keys(params).length > 0 ? { params } : undefined
    )

    log.debug('Full HTTP response for %s: %s', url, safeJsonStringify({
      url, params, response: response.data,
    }))

    if (response.status !== 200 || response.data.success === false) {
      log.error(`error getting result for ${url}: %s %o %o`, response.status, response.statusText, response.data)
      break
    }

    const page = makeArray(response.data)
    yield page
    numResults += page.length

    if (
      paginationField === undefined
      || response.data[paginationField] === undefined
      || !_.isString(response.data[paginationField])
    ) {
      break
    }
    nextPageArgs = computeNextPageArgs(response.data[paginationField] as string, params)
  }
  // the number of results may be lower than actual if the instances are under a nested field
  log.info('Received %d results for endpoint %s', numResults, url)
}
