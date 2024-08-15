/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { definitions, fetch as fetchUtils } from '@salto-io/adapter-components'
import { OktaOptions } from '../types'

const { cursorPagination, defaultPathChecker, cursorHeaderPagination } = fetchUtils.request.pagination

export const PAGINATION: definitions.ApiDefinitions<OktaOptions>['pagination'] = {
  cursorHeader: {
    funcCreator: () => cursorHeaderPagination({ pathChecker: defaultPathChecker }),
  },
  cursor: {
    funcCreator: () => cursorPagination({ paginationField: 'nextMappingsPageUrl', pathChecker: defaultPathChecker }),
  },
}
