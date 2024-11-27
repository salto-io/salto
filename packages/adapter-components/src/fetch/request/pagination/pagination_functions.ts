/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import * as parse from 'parse-link-header'
import { logger } from '@salto-io/logging'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { PaginationFunction } from '../../../definitions/system/requests/pagination'
import { DATA_FIELD_ENTIRE_OBJECT } from '../../../definitions'
import { ResponseValue } from '../../../client'
import { MaxResultsExceeded } from '../../errors'

const log = logger(module)

export const getItems = (value: ResponseValue | ResponseValue[], dataField: string): unknown[] =>
  collections.array
    .makeArray(value)
    .flatMap(item => (dataField === DATA_FIELD_ENTIRE_OBJECT ? item : _.get(item, dataField)))

const defaultGetItems = (value: ResponseValue | ResponseValue[]): unknown[] => getItems(value, DATA_FIELD_ENTIRE_OBJECT)

/**
 * Make paginated requests using the specified pagination field
 * Response is expected to contain a list of values without metadata
 * Going to next page is done manually by advancing the pagination field by the relevant amount
 */
export const itemOffsetPagination = ({
  firstIndex,
  pageSizeArgName,
  paginationField,
  pageSize,
  dataField,
}: {
  firstIndex: number
  pageSizeArgName: string | undefined
  paginationField: string
  pageSize: number
  dataField: string
}): PaginationFunction => {
  const nextPage: PaginationFunction = ({ currentParams, responseData }) => {
    const { queryParams } = currentParams

    const itemsPerPage =
      pageSizeArgName !== undefined &&
      queryParams !== undefined &&
      !Number.isNaN(Number(queryParams?.[pageSizeArgName]))
        ? Number(queryParams[pageSizeArgName])
        : pageSize

    const items = getItems(responseData, dataField)
    if (paginationField === undefined || items.length < itemsPerPage || items.length === 0) {
      return []
    }
    return [
      _.merge({}, currentParams, {
        queryParams: {
          [paginationField]: (
            Number(currentParams.queryParams?.[paginationField] ?? firstIndex) + itemsPerPage
          ).toString(),
        },
      }),
    ]
  }
  return nextPage
}

/**
 * Make paginated requests using the specified pagination field, assuming the
 * next page is prev+1 and first page is as specified.
 * Also supports recursive queries (see example under computeRecursiveArgs).
 */
export const pageOffsetPagination = ({
  firstPage,
  paginationField,
  pageSize,
  dataField = DATA_FIELD_ENTIRE_OBJECT,
}: {
  firstPage: number
  paginationField: string
  pageSize: number
  dataField?: string
}): PaginationFunction => {
  const nextPageFullPages: PaginationFunction = ({ currentParams, responseData }) => {
    const items = getItems(responseData, dataField)
    if (items.length < pageSize) {
      return []
    }
    return [
      _.merge({}, currentParams, {
        queryParams: {
          [paginationField]: (Number(currentParams.queryParams?.[paginationField] ?? firstPage) + 1).toString(),
        },
      }),
    ]
  }
  return nextPageFullPages
}

/**
 * Make paginated requests using the specified pagination field, assuming the
 * next page is prev+1 and first page is as specified.
 * Also supports recursive queries (see example under computeRecursiveArgs).
 */
export const pageOffsetAndLastPagination = ({
  firstPage,
  paginationField,
}: {
  firstPage: number
  paginationField: string
}): PaginationFunction => {
  const nextPageFullPages: PaginationFunction = ({ currentParams, responseData }) => {
    // hard-coding the "last" flag for now - if we see more variants we can move it to config
    if (_.get(responseData, 'last') !== false) {
      return []
    }
    return [
      _.merge({}, currentParams, {
        queryParams: {
          [paginationField]: (Number(currentParams.queryParams?.[paginationField] ?? firstPage) + 1).toString(),
        },
      }),
    ]
  }
  return nextPageFullPages
}

export const offsetAndValuesPagination = ({ paginationField }: { paginationField: string }): PaginationFunction => {
  // TODO allow customizing the field values (`isLastValues`)
  type PageResponse = {
    isLast: boolean
    values: unknown[]
    [k: string]: unknown
  }
  const isPageResponse = (responseData: ResponseValue | ResponseValue[]): responseData is PageResponse =>
    _.isObject(responseData) &&
    _.isBoolean(_.get(responseData, 'isLast')) &&
    Array.isArray(_.get(responseData, 'values')) &&
    _.isNumber(_.get(responseData, paginationField))

  const getNextPage: PaginationFunction = ({ responseData, currentParams }) => {
    if (!isPageResponse(responseData)) {
      throw new Error(`Expected page with pagination field ${paginationField}, got ${safeJsonStringify(responseData)}`)
    }
    if (responseData.isLast) {
      return []
    }
    const currentPageStart = Number(_.get(responseData, paginationField))
    const nextPageStart = currentPageStart + responseData.values.length
    return [
      _.merge({}, currentParams, {
        queryParams: {
          [paginationField]: nextPageStart.toString(),
        },
      }),
    ]
  }

  return getNextPage
}

export const offsetAndLimitPagination = (): PaginationFunction => {
  const getNextPage: PaginationFunction = ({ responseData, currentParams }) => {
    if (_.get(responseData, 'more') !== true) {
      return []
    }
    const currentPageStart = Number(_.get(responseData, 'offset'))
    const currentLimit = Number(_.get(responseData, 'limit'))
    const nextPageStart = currentPageStart + currentLimit
    return [
      _.merge({}, currentParams, {
        queryParams: {
          offset: nextPageStart.toString(),
        },
      }),
    ]
  }

  return getNextPage
}

/**
 * Path checker for ensuring the next url's path is under the same endpoint as the one configured.
 * Can be customized when the next url returned has different formatting, e.g. has a longer prefix
 * (such as /api/v1/product vs /product).
 * @return true if the configured endpoint can be used to get the next path, false otherwise.
 */
export type PathCheckerFunc = (endpointPath: string, nextPath: string) => boolean
export const defaultPathChecker: PathCheckerFunc = (endpointPath, nextPath) => endpointPath === nextPath

/**
 * Make paginated requests using the specified paginationField, assuming the next page is specified
 * as either a full URL or just the path and query parameters.
 * Only supports next pages under the same endpoint (and uses the same host).
 */
export const cursorPagination = ({
  paginationField,
  pathChecker = defaultPathChecker,
}: {
  pathChecker?: PathCheckerFunc
  paginationField: string
}): PaginationFunction => {
  const nextPageCursorPages: PaginationFunction = ({ responseData, currentParams, endpointIdentifier }) => {
    const { path } = endpointIdentifier
    const nextPagePath = _.get(responseData, paginationField)
    if (!_.isString(nextPagePath)) {
      return []
    }
    const nextPage = new URL(nextPagePath, 'http://localhost')
    if (!pathChecker(path, nextPage.pathname)) {
      throw new Error(`unexpected next page received for endpoint ${path}: ${nextPage.pathname}`)
    }
    return [
      _.merge({}, currentParams, {
        queryParams: Object.fromEntries(nextPage.searchParams.entries()),
      }),
    ]
  }
  return nextPageCursorPages
}

/**
 * Make paginated requests using the link response header.
 * Only supports next pages under the same endpoint (and uses the same host).
 */
export const cursorHeaderPagination = ({
  pathChecker = defaultPathChecker,
}: {
  pathChecker?: PathCheckerFunc
}): PaginationFunction => {
  const getNextPage = (link: string): URL | undefined => {
    const parsedLinkHeader = parse.default(link)
    if (parsedLinkHeader && parsedLinkHeader.next !== undefined) {
      return new URL(parsedLinkHeader.next.url, 'http://localhost')
    }
    return undefined
  }

  const nextPageCursorPagesByHeader: PaginationFunction = ({ responseHeaders, endpointIdentifier, currentParams }) => {
    const { headers } = currentParams
    const { path } = endpointIdentifier
    if (responseHeaders !== undefined) {
      const linkHeader = _.get(responseHeaders, 'link')
      if (_.isString(linkHeader)) {
        const nextPage = getNextPage(linkHeader)
        if (nextPage !== undefined) {
          if (!pathChecker(path, nextPage.pathname)) {
            log.error(
              'unexpected next page received for endpoint %s params %o: %s',
              path,
              currentParams,
              nextPage.pathname,
            )
            throw new Error(`unexpected next page received for endpoint ${path}: ${nextPage.pathname}`)
          }
          return [
            {
              ..._.merge({}, currentParams, { queryParams: Object.fromEntries(nextPage.searchParams.entries()) }),
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

export const noPagination = (): PaginationFunction => () => []

/**
 * Make paginated requests using the paginationToken from a specific field in the response,
 * and puts it in another paginationField in the query params.
 * Only supports next pages under the same endpoint (and uses the same host).
 */
export const tokenPagination = ({
  paginationField,
  tokenField,
}: {
  tokenField: string
  paginationField: string
}): PaginationFunction => {
  const nextPageTokenPages: PaginationFunction = ({ responseData, currentParams }) => {
    const token = _.get(responseData, tokenField)
    if (!_.isString(token)) {
      return []
    }
    return [
      _.merge({}, currentParams, {
        queryParams: {
          ...currentParams.queryParams,
          [paginationField]: token,
        },
      }),
    ]
  }
  return nextPageTokenPages
}

export const getPaginationWithLimitedResults = ({
  maxResultsNumber,
  paginationFunc,
  getItemsFunc = defaultGetItems,
}: {
  maxResultsNumber: number
  paginationFunc: PaginationFunction
  getItemsFunc?: (value: ResponseValue | ResponseValue[]) => unknown[]
}): PaginationFunction => {
  const UNLIMITED_RESULTS = -1
  let totalResults = 0
  log.debug('creating pagination function with max results: %d', maxResultsNumber)
  const paginationWithLimitedResults: PaginationFunction = args => {
    if (maxResultsNumber !== UNLIMITED_RESULTS) {
      const currentPageResults = getItemsFunc(args.responseData).length
      totalResults += currentPageResults
      if (totalResults > maxResultsNumber) {
        log.error('reached max results for endpoint %s, stopping pagination', args.endpointIdentifier.path)
        throw new MaxResultsExceeded({ endpoint: args.endpointIdentifier.path, maxResults: maxResultsNumber })
      }
    }
    return paginationFunc(args)
  }
  return paginationWithLimitedResults
}
