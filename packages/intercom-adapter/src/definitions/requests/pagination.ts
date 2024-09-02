/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { definitions, fetch as fetchUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { Options } from '../types'

type PaginationFunction = definitions.PaginationFunction
const { cursorPagination } = fetchUtils.request.pagination

export const scrollingPagination = ({
  scrollingParam,
  stopCondition,
}: {
  scrollingParam: string
  stopCondition?: (data: unknown) => boolean
}): PaginationFunction => {
  const nextPageScrollingPages: PaginationFunction = ({ currentParams, responseData }) => {
    const scrollParam = _.get(responseData, scrollingParam)
    if (typeof scrollParam !== 'string' || stopCondition?.(responseData)) {
      return []
    }
    return [
      _.merge({}, currentParams, {
        queryParams: {
          [scrollingParam]: scrollParam,
          // This is a workaround to to handle our pagination mechanism which expects each pagination request to have a unique query param.
          // It is not the case for the scrolling param - which is the same for all requests (until the stop condition is met).
          timestamp: new Date().toISOString(),
        },
      }),
    ]
  }
  return nextPageScrollingPages
}

export const PAGINATION: definitions.ApiDefinitions<Options>['pagination'] = {
  cursor: {
    funcCreator: () =>
      cursorPagination({
        pathChecker: fetchUtils.request.pagination.defaultPathChecker,
        paginationField: 'pages.next',
      }),
  },
  scroll: {
    funcCreator: () =>
      scrollingPagination({
        scrollingParam: 'scroll_param',
        stopCondition: response => _.isEmpty(_.get(response, 'data')),
      }),
  },
}
