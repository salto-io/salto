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
import { logger } from '@salto-io/logging'

const { getWithPageOffsetPagination, traverseRequests } = clientUtils
const log = logger(module)

/**
 * Pagination based on descending ids, used for workato recipes - set the pagination field
 * to the lowest number out of this page's ids.
 * The rest of the logic is the same as getWithPageOffsetPagination.
 */
export const getMinSinceIdPagination: clientUtils.GetAllItemsFunc = async function *getWithOffset(
  args
) {
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
      log.error('Received higher min page size than seen previously (%d >= %d) - aborting pagination', minValueInPage, overallMin)
      return []
    }
    overallMin = minValueInPage
    return [{
      ...currentParams,
      [paginationField]: String(minValueInPage),
    }]
  }
  yield* traverseRequests(nextPage)(args)
}

export const paginate: clientUtils.GetAllItemsFunc = async function *paginate({
  client,
  pageSize,
  getParams,
}) {
  if (getParams?.paginationField === 'since_id') {
    // special handling for endpoints that use descending ids, like the recipes endpoint
    yield* getMinSinceIdPagination({ client, pageSize, getParams })
  } else {
    yield* getWithPageOffsetPagination({ client, pageSize, getParams })
  }
}
