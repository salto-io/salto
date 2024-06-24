/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import { definitions, fetch as fetchUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { ClientOptions, PaginationOptions } from '../types'

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

export const PAGINATION: Record<PaginationOptions, definitions.PaginationDefinitions<ClientOptions>> = {
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
