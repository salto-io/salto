
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
import { getChangeData, isAdditionOrModificationChange, isInstanceChange, isInstanceElement } from '@salto-io/adapter-api'
import { walkOnElement } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { FilterCreator } from '../../filter'
import { walkOnUsers, WalkOnUsersCallback } from './account_id_filter'
import { IdMap } from '../../users_map'
import { PROJECT_TYPE } from '../../constants'

const { awu } = collections.asynciterable
const log = logger(module)

const addDisplayName = (idMap: IdMap): WalkOnUsersCallback => (
  { value, fieldName }
): void => {
  if (Object.prototype.hasOwnProperty.call(idMap, value[fieldName].id)) {
    value[fieldName].displayName = idMap[value[fieldName].id]
  }
}

const convertId = (idMap: IdMap): WalkOnUsersCallback => (
  { value, fieldName }
): void => {
  if (Object.prototype.hasOwnProperty.call(idMap, value[fieldName].id)) {
    value[fieldName].id = idMap[value[fieldName].id]
  }
}

/*
 * A filter to add display names beside account ids. The source is a JIRA query.
 * While using Jira DC the filter convert user id to user key
 */
const filter: FilterCreator = ({ client, config, getIdMapFunc }) => ({
  onFetch: async elements => log.time(async () => {
    if (!(config.fetch.convertUsersIds ?? true)) {
      return
    }
    const idMap = await getIdMapFunc()
    await awu(elements)
      .filter(isInstanceElement)
      .forEach(async element => {
        if (client.isDataCenter) {
          walkOnElement({ element, func: walkOnUsers(convertId(idMap)) })
        } else {
          walkOnElement({ element, func: walkOnUsers(addDisplayName(idMap)) })
        }
      })
  }, 'user_id_filter fetch'),
  preDeploy: async changes => {
    if (!(config.fetch.convertUsersIds ?? true)
        || !client.isDataCenter) {
      return
    }
    const idMap = await getIdMapFunc()
    const reversedIdMap: IdMap = Object.fromEntries(Object.entries(idMap).map(([key, mapValue]) => [mapValue, key]))
    changes
      .filter(isInstanceChange)
      .filter(isAdditionOrModificationChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName !== PROJECT_TYPE)
      .forEach(element =>
        walkOnElement({ element, func: walkOnUsers(convertId(reversedIdMap)) }))
  },
  onDeploy: async changes => log.time(async () => {
    if (!(config.fetch.convertUsersIds ?? true)
       || !client.isDataCenter) {
      return
    }
    const idMap = await getIdMapFunc()
    changes
      .filter(isInstanceChange)
      .filter(isAdditionOrModificationChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName !== PROJECT_TYPE)
      .forEach(element =>
        walkOnElement({ element, func: walkOnUsers(convertId(idMap)) }))
  }, 'user_id_filter deploy'),
})

export default filter
