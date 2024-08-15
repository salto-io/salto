/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { client as clientUtils } from '@salto-io/adapter-components'

const { getWithPageOffsetAndLastPagination, getWithCursorPagination } = clientUtils

export const paginate: clientUtils.PaginationFuncCreator = ({ getParams }) => {
  if (getParams?.paginationField?.includes('next')) {
    // special handling for endpoints that use descending ids, like the recipes endpoint
    return getWithCursorPagination()
  }
  return getWithPageOffsetAndLastPagination(0)
}
