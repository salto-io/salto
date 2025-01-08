/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { client as clientUtils, fetch as fetchUtils } from '@salto-io/adapter-components'
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

// TODO remove this as part of SALTO-5608 (new name is cursorHeaderPagination)
/**
 * Make paginated requests using the link response header.
 * Only supports next pages under the same endpoint (and uses the same host).
 */
export const getWithCursorHeaderPagination = (): clientUtils.PaginationFunc => {
  const nextPageCursorPagesByHeader: clientUtils.PaginationFunc = ({ responseHeaders, getParams, currentParams }) => {
    const { url, headers } = getParams
    if (responseHeaders !== undefined) {
      const linkHeader = _.get(responseHeaders, LINK_HEADER_NAME)
      if (_.isString(linkHeader)) {
        const nextPage = getNextPage(linkHeader)
        if (nextPage !== undefined) {
          if (!fetchUtils.request.pagination.defaultPathChecker(url, nextPage.pathname)) {
            log.error(
              'unexpected next page received for endpoint %s params %o: %s',
              url,
              currentParams,
              nextPage.pathname,
            )
            throw new Error(`unexpected next page received for endpoint ${url}: ${nextPage.pathname}`)
          }
          return [
            {
              ...currentParams,
              ...Object.fromEntries(nextPage.searchParams.entries()),
              ...headers,
            },
          ]
        }
      }
    }
    return []
  }
  return nextPageCursorPagesByHeader
}

export const paginate: clientUtils.PaginationFuncCreator = () => getWithCursorHeaderPagination()
