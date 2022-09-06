
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
import { isInstanceElement, Value, ElemID } from '@salto-io/adapter-api'
import { client as clientUtils } from '@salto-io/adapter-components'
import { walkOnElement, WalkOnFunc, WALK_NEXT_STEP } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../../filter'
import { ACCOUNT_IDS_FIELDS_NAMES, ACCOUNT_ID_STRING } from '../../constants'
import { isAccountIdType, isPermissionHolderCase } from './account_id_filter'

const { makeArray } = collections.array
const { awu, toArrayAsync } = collections.asynciterable
const log = logger(module)

type IdMap = Record<string, string>

const createIdToUserMap = async (paginator: clientUtils.Paginator)
: Promise<IdMap> => {
  // const newIdMap: IdMap = {}
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

const addDisplayNameToValue = (idMap: IdMap, item: Value): void => {
  if (Object.prototype.hasOwnProperty.call(idMap, item.id)) {
    item.displayName = idMap[item.id]
  }
}

const addDisplayName = (value: Value, path: ElemID, idMap : IdMap):void => {
  // main scenario, field is within the ACCOUNT_IDS_FIELDS_NAMES
  ACCOUNT_IDS_FIELDS_NAMES.forEach(fieldName => {
    if (Object.prototype.hasOwnProperty.call(value, fieldName)) {
      addDisplayNameToValue(idMap, value[fieldName])
    }
  })
  // second scenario: the type has ACCOUNT_ID_STRING and the value holds the actual account id
  if (value.type === ACCOUNT_ID_STRING) {
    addDisplayNameToValue(idMap, value.value)
  }
  // third scenario the type is permissionHolder and the type is user
  // the id is in the parameter field. We cannot check type with walk on elements, so we
  // just check the two and verify it is within the known types
  if (isPermissionHolderCase(value, path)) {
    addDisplayNameToValue(idMap, value.parameter)
  }
}

const addDisplayNameWalk = (idMap : IdMap): WalkOnFunc =>
  ({ value, path }):WALK_NEXT_STEP => {
    if (isInstanceElement(value)) {
      addDisplayName(value.value, path, idMap)
    } else {
      addDisplayName(value, path, idMap)
    }
    return WALK_NEXT_STEP.RECURSE
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
    await awu(elements)
      .filter(isInstanceElement)
      .filter(isAccountIdType)
      .forEach(async element => {
        walkOnElement({ element, func: addDisplayNameWalk(idMap) })
      })
  }, 'add_display_name_filter fetch'),
})

export default filter
