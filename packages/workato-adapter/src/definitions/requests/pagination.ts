/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { definitions, fetch as fetchUtils } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { WorkatoOptions } from '../types'
import { DEFAULT_PAGE_SIZE } from './clients'

const log = logger(module)
const { pageOffsetPagination } = fetchUtils.request.pagination

/**
 * Pagination based on descending ids, used for workato recipes - set the pagination field
 * to the lowest number out of this page's ids.
 * The rest of the logic is the same as pageOffsetPagination.
 */
export const getMinSinceIdPagination = (): definitions.PaginationFunction => {
  let overallMin = Infinity

  const nextPage: definitions.PaginationFunction = ({ responseData, currentParams }) => {
    // recipes are nested under 'items' field
    const page = !Array.isArray(responseData) ? responseData?.items : responseData
    if (!Array.isArray(page) || page.length === 0) {
      return []
    }
    const pageIds = page.map(item => item.id)
    if (!pageIds.every(_.isNumber)) {
      log.error('Not all ids are numbers (%s) - aborting pagination', pageIds)
      return []
    }
    const minValueInPage = Math.min(...pageIds.filter(_.isNumber))
    if (minValueInPage >= overallMin) {
      log.error(
        'Received higher min page size than seen previously (%d >= %d) - aborting pagination',
        minValueInPage,
        overallMin,
      )
      return []
    }
    overallMin = minValueInPage

    return [
      _.merge({}, currentParams, {
        queryParams: {
          ...currentParams.queryParams,
          since_id: String(minValueInPage),
        },
      }),
    ]
  }
  return nextPage
}

export const PAGINATION: definitions.ApiDefinitions<WorkatoOptions>['pagination'] = {
  pageOffset: {
    funcCreator: () =>
      pageOffsetPagination({ firstPage: 1, paginationField: 'page', pageSize: Number(DEFAULT_PAGE_SIZE) }),
  },
  minSinceId: {
    funcCreator: () => getMinSinceIdPagination(),
  },
}
