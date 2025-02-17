/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { definitions, fetch as fetchUtils } from '@salto-io/adapter-components'
import { Options } from '../types'
import { CURSOR_BASED_PAGINATION_FIELD, PAGE_SIZE } from '../../config'

const { cursorPagination } = fetchUtils.request.pagination

const pathChecker: fetchUtils.request.pagination.PathCheckerFunc = (current, next) =>
  next === `${current}.json` || next === `${current}`

export const PAGINATION: definitions.ApiDefinitions<Options>['pagination'] = {
  basic_cursor: {
    funcCreator: () => cursorPagination({ pathChecker, paginationField: 'next_page' }),
  },
  basic_cursor_with_args: {
    funcCreator: () => cursorPagination({ pathChecker, paginationField: 'next_page' }),
    clientArgs: {
      queryArgs: {
        per_page: String(PAGE_SIZE),
      },
    },
  },
  links: {
    funcCreator: () => cursorPagination({ pathChecker, paginationField: CURSOR_BASED_PAGINATION_FIELD }),
    clientArgs: {
      queryArgs: {
        'page[size]': String(PAGE_SIZE),
      },
    },
  },
  settings: {
    funcCreator: () => cursorPagination({ pathChecker, paginationField: 'settings' }),
  },
}
