/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { collections } from '@salto-io/lowerdash'
import { client as clientUtils } from '@salto-io/adapter-components'

const { makeArray } = collections.array

const ITEM_INDEX_PAGINATION_URLS = [
  '/rest/api/3/users/search',
  '/rest/api/2/user/search',
  '/rest/api/2/priorityschemes',
]

const removeScopedObjectsImpl = <T extends clientUtils.ResponseValue>(
  response: T | T[],
): T | T[] => {
  if (Array.isArray(response)) {
    return response
      .filter(item =>
        // filters out entries of specific project scope as we don't support it,
        // but leaves entries of global scope
        !(_.isPlainObject(item) && 'scope' in item && !_.isEqual(item.scope, { type: 'GLOBAL' })))
      .flatMap(removeScopedObjectsImpl) as T[]
  }
  if (_.isObject(response)) {
    return _.mapValues(response, removeScopedObjectsImpl) as T
  }
  return response
}

export const removeScopedObjects: clientUtils.PageEntriesExtractor = (
  entry: clientUtils.ResponseValue,
): clientUtils.ResponseValue[] => (
  makeArray(removeScopedObjectsImpl([entry]))
)

export const paginate: clientUtils.PaginationFuncCreator = args => {
  if (ITEM_INDEX_PAGINATION_URLS.includes(args.getParams?.url)) {
    // special handling for endpoints that use pagination without meta-data
    // if more cases encountered should be moved to an object with url and items per page
    return clientUtils.getWithItemIndexPagination(
      {
        firstIndex: 0,
        pageSizeArgName: args.getParams.pageSizeArgName,
      }
    )
  }
  return clientUtils.getWithOffsetAndLimit()
}
