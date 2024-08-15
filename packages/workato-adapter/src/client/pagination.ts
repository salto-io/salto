/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import _ from 'lodash'
import { client as clientUtils } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'

const { getWithPageOffsetPagination } = clientUtils
const log = logger(module)

/**
 * Pagination based on descending ids, used for workato recipes - set the pagination field
 * to the lowest number out of this page's ids.
 * The rest of the logic is the same as getWithPageOffsetPagination.
 */
export const getMinSinceIdPagination: clientUtils.PaginationFuncCreator = () => {
  let overallMin = Infinity

  const nextPage: clientUtils.PaginationFunc = ({ page, getParams, currentParams }) => {
    const { paginationField } = getParams
    if (paginationField === undefined || page.length === 0) {
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
    return [{ ...currentParams, [paginationField]: String(minValueInPage) }]
  }
  return nextPage
}

export const paginate: clientUtils.PaginationFuncCreator = args => {
  if (args.getParams?.paginationField === 'since_id') {
    // special handling for endpoints that use descending ids, like the recipes endpoint
    return getMinSinceIdPagination(args)
  }
  return getWithPageOffsetPagination(1)
}
