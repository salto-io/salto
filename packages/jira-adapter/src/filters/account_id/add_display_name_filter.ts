
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
import { isInstanceElement } from '@salto-io/adapter-api'
import { client as clientUtils } from '@salto-io/adapter-components'
import { walkOnElement } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../../filter'
import { walkOnUsers, WalkOnUsersCallback } from './account_id_filter'

const { makeArray } = collections.array
const { toArrayAsync } = collections.asynciterable
const log = logger(module)

export type IdMap = Record<string, string>

export const createIdToUserMap = async (paginator: clientUtils.Paginator)
: Promise<IdMap> => {
  const paginationArgs = {
    url: '/rest/api/3/users/search',
    paginationField: 'startAt',
  }
  return Object.fromEntries((await toArrayAsync(paginator(
    paginationArgs,
    page => makeArray(page) as clientUtils.ResponseValue[]
  ))).flat().map(
    user => [user.accountId, user.displayName]
  ))
}

const addDisplayName = (idMap: IdMap): WalkOnUsersCallback => (
  { value, fieldName }
): void => {
  if (Object.prototype.hasOwnProperty.call(idMap, value[fieldName].id)) {
    value[fieldName].displayName = idMap[value[fieldName].id]
  }
}

/*
 * A filter to add display names beside account ids. The source is a JIRA query.
 */
const filter: FilterCreator = ({ paginator, config }) => ({
  onFetch: async elements => log.time(async () => {
    if (!(config.fetch.showUserDisplayNames ?? true)) {
      return
    }
    const idMap = await createIdToUserMap(paginator)
    elements
      .filter(isInstanceElement)
      .forEach(element => {
        walkOnElement({ element, func: walkOnUsers(addDisplayName(idMap)) })
      })
  }, 'add_display_name_filter fetch'),
})

export default filter
