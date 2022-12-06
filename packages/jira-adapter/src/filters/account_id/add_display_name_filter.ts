
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
import { getChangeData, isAdditionOrModificationChange, isInstanceElement, isInstanceChange } from '@salto-io/adapter-api'
import { walkOnElement } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { FilterCreator } from '../../filter'
import { walkOnUsers, WalkOnUsersCallback } from './account_id_filter'
import { IdMap } from '../../users_map'

const { awu } = collections.asynciterable
const log = logger(module)

const addDisplayName = (idMap: IdMap): WalkOnUsersCallback => (
  { value, fieldName }
): void => {
  if (Object.prototype.hasOwnProperty.call(idMap, value[fieldName].id)) {
    value[fieldName].displayName = idMap[value[fieldName].id]
  }
}

const convertKeyToId = (idMap: IdMap): WalkOnUsersCallback => (
  { value, fieldName }
): void => {
  if (Object.prototype.hasOwnProperty.call(idMap, value[fieldName].id)) {
    value[fieldName].id = idMap[value[fieldName].id]
  }
}

/*
 * A filter to add display names beside account ids. The source is a JIRA query.
 */
const filter: FilterCreator = ({ client, config, getIdMapFunc }) => ({
  onFetch: async elements => log.time(async () => {
    if (!(config.fetch.showUserDisplayNames ?? true)) {
      return
    }
    const idMap = await getIdMapFunc()
    await awu(elements)
      .filter(isInstanceElement)
      .forEach(async element => {
        if (client.isDataCenter) {
          walkOnElement({ element, func: walkOnUsers(convertKeyToId(idMap)) })
        } else {
          walkOnElement({ element, func: walkOnUsers(addDisplayName(idMap)) })
        }
      })
  }, 'add_display_name_filter fetch'),
  preDeploy: async changes => {
    if (!client.isDataCenter) {
      return
    }
    const idMap = await getIdMapFunc()
    changes
      .filter(isInstanceChange)
      .filter(isAdditionOrModificationChange)
      .map(getChangeData)
      .forEach(element =>
        walkOnElement({ element, func: walkOnUsers(convertKeyToId(idMap)) }))
  },
  onDeploy: async changes => log.time(async () => {
    const idMap = await getIdMapFunc()
    changes
      .filter(isInstanceChange)
      .filter(isAdditionOrModificationChange)
      .map(getChangeData)
      .forEach(element =>
        walkOnElement({ element, func: walkOnUsers(convertKeyToId(idMap)) }))
  }, 'filterName'),
})

export default filter
