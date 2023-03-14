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
import { client as clientUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import * as parse from 'parse-link-header'
import { logger } from '@salto-io/logging'

const log = logger(module)
export const LINK_HEADER_NAME = 'link'

const getNextPage = (link: string): URL | undefined => {
  const parsedLinkHeader = parse.default(link)
  if (parsedLinkHeader && parsedLinkHeader.next !== undefined) {
    return new URL(parsedLinkHeader.next.url, 'http://localhost')
  }
  return undefined
}

/**
 * Make paginated requests using the link response header.
 * Only supports next pages under the same endpoint (and uses the same host).
 */
export const getWithCursorHeaderPagination = (): clientUtils.PaginationFunc => {
  const nextPageCursorPagesByHeader: clientUtils.PaginationFunc = ({
    responseHeaders, getParams, currentParams,
  }) => {
    const { url } = getParams
    if (responseHeaders !== undefined) {
      const linkHeader = _.get(responseHeaders, LINK_HEADER_NAME)
      if (_.isString(linkHeader)) {
        const nextPage = getNextPage(linkHeader)
        if (nextPage !== undefined) {
          if (!clientUtils.defaultPathChecker(url, nextPage.pathname)) {
            log.error('unexpected next page received for endpoint %s params %o: %s', url, currentParams, nextPage.pathname)
            throw new Error(`unexpected next page received for endpoint ${url}: ${nextPage.pathname}`)
          }
          return [{
            ...currentParams,
            ...Object.fromEntries(nextPage.searchParams.entries()),
          }]
        }
      }
    }
    return []
  }
  return nextPageCursorPagesByHeader
}

export const paginate: clientUtils.PaginationFuncCreator = () =>
  getWithCursorHeaderPagination()
