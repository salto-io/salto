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
import { ClientOptions, PaginationOptions } from '../types'
import { CURSOR_BASED_PAGINATION_FIELD, PAGE_SIZE } from '../../config'

const { cursorPagination } = fetchUtils.request.pagination

// TODO adjust - replace with the correct pagination function(s), remove unneeded ones

export const pathChecker: fetchUtils.request.pagination.PathCheckerFunc = (current, next) =>
  next === `${current}.json` || next === `${current}`

export const PAGINATION: Record<PaginationOptions, definitions.PaginationDefinitions<ClientOptions>> = {
  basic_cursor: {
    // TODON see if can simplify and use the function directly
    funcCreator: () => cursorPagination({ pathChecker, paginationField: 'next_page' }),
  },
  basic_cursor_with_args: {
    // TODON see if can simplify and use the function directly
    funcCreator: () => cursorPagination({ pathChecker, paginationField: 'next_page' }),
    clientArgs: {
      queryArgs: {
        per_page: String(PAGE_SIZE),
      },
    },
  },
  links: {
    // TODON look under meta.has_more and do not continue if false!
    funcCreator: () => cursorPagination({ pathChecker, paginationField: CURSOR_BASED_PAGINATION_FIELD }),
    clientArgs: {
      queryArgs: {
        'page[size]': String(PAGE_SIZE),
      },
    },
  },
  settings: {
    // TODON look under meta.has_more and do not continue if false!
    funcCreator: () => cursorPagination({ pathChecker, paginationField: 'settings' }),
  },
}
