/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { client as clientUtils } from '@salto-io/adapter-components'

const { getWithPageOffsetAndLastPagination, getWithCursorPagination } = clientUtils

// TODO
export const paginate: clientUtils.PaginationFuncCreator = ({ getParams }) => {
  if (getParams?.paginationField?.includes('next')) {
    // special handling for endpoints that use descending ids, like the recipes endpoint
    return getWithCursorPagination()
  }
  return getWithPageOffsetAndLastPagination(0)
}
