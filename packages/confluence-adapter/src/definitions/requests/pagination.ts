/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { definitions, fetch as fetchUtils } from '@salto-io/adapter-components'
import { Options } from '../types'

const { cursorPagination, itemOffsetPagination } = fetchUtils.request.pagination

export const USERS_PAGE_SIZE = '1000'

export const PAGINATION: definitions.ApiDefinitions<Options>['pagination'] = {
  cursor: {
    funcCreator: () =>
      cursorPagination({
        pathChecker: (endpointPath, nextPath) => endpointPath === nextPath || endpointPath === `/wiki${nextPath}`,
        paginationField: '_links.next',
      }),
  },
  usersPagination: {
    funcCreator: () =>
      itemOffsetPagination({
        pageSize: Number(USERS_PAGE_SIZE),
        dataField: '.*',
        firstIndex: 0,
        paginationField: 'startAt',
        pageSizeArgName: 'maxResults',
      }),
  },
}
