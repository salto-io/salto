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
import { client as clientUtils } from '@salto-io/adapter-components'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'

const { makeArray } = collections.array
const { computeRecursiveArgs } = clientUtils
const log = logger(module)

/**
 * Pagination based on descending ids, used for workato recipes - set the pagination field
 * to the lowest number out of this page's ids.
 * The rest of the logic is the same as getWithPageOffsetPagination.
 */
export const getMinSinceIdPagination: clientUtils.GetAllItemsFunc = async function *getWithOffset({
  conn,
  getParams,
}) {
  const { url, paginationField, queryParams, recursiveQueryParams } = getParams
  const requestQueryArgs: Record<string, string>[] = [{}]
  const usedParams = new Set<string>()
  let numResults = 0
  let overallMin = Infinity

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

    const page: clientUtils.ResponseValue[] = (
      (_.isObjectLike(response.data) && Array.isArray(response.data.items))
        ? response.data.items
        : makeArray(response.data)
    )

    yield page
    numResults += page.length

    if (paginationField !== undefined && page.length > 0) {
      const pageIds = page.map(item => item.id)
      if (!pageIds.every(_.isNumber)) {
        log.error('Not all ids are numbers (%s) - aborting pagination', pageIds)
        break
      }
      const minValueInPage = Math.min(...pageIds.filter(_.isNumber))
      if (minValueInPage >= overallMin) {
        log.error('Received higher min page size than seen previously (%d >= %d) - aborting pagination', minValueInPage, overallMin)
        break
      }
      requestQueryArgs.unshift({
        ...additionalArgs,
        [paginationField]: String(minValueInPage),
      })
      overallMin = minValueInPage
    }

    if (recursiveQueryParams !== undefined && Object.keys(recursiveQueryParams).length > 0) {
      requestQueryArgs.unshift(...computeRecursiveArgs(recursiveQueryParams, page))
    }
  }
  log.info('Received %d results for endpoint %s', numResults, url)
}
