
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
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { FilterCreator } from '../../filter'
import { walkOnUsers, WalkOnUsersCallback } from './account_id_filter'
import { UserMap, getUsersMap } from '../../users'
import { PROJECT_TYPE } from '../../constants'

const { awu } = collections.asynciterable

const addDisplayName = (userMap: UserMap): WalkOnUsersCallback => (
  { value, fieldName }
): void => {
  if (Object.prototype.hasOwnProperty.call(userMap, value[fieldName].id)) {
    value[fieldName].displayName = userMap[value[fieldName].id].displayName
  }
}

const convertIdToUsername = (userMap: UserMap): WalkOnUsersCallback => (
  { value, fieldName }
): void => {
  if (Object.prototype.hasOwnProperty.call(userMap, value[fieldName].id)) {
    value[fieldName].id = userMap[value[fieldName].id].username ?? value[fieldName].id
  }
}

const convertUserNameToId = (userMap: UserMap): WalkOnUsersCallback => (
  { value, fieldName }
): void => {
  if (Object.prototype.hasOwnProperty.call(userMap, value[fieldName].id)) {
    value[fieldName].id = userMap[value[fieldName].id].userId ?? value[fieldName].id
  }
}

/*
 * A filter to add display names beside account ids. The source is a JIRA query.
 * While using Jira DC the filter convert user id to user key
 */
const filter: FilterCreator = ({ client, config, getUserMapFunc, elementsSource }) => ({
  name: 'userIdFilter',
  onFetch: async elements => {
    if (!(config.fetch.convertUsersIds ?? true)) {
      return
    }
    const userMap = await getUserMapFunc()
    if (userMap === undefined) {
      return
    }
    await awu(elements)
      .filter(isInstanceElement)
      .forEach(async element => {
        if (client.isDataCenter) {
          walkOnElement({ element, func: walkOnUsers(convertIdToUsername(userMap), config) })
        } else {
          walkOnElement({ element, func: walkOnUsers(addDisplayName(userMap), config) })
        }
      })
  },
  preDeploy: async changes => {
    if (!(config.fetch.convertUsersIds ?? true) || !client.isDataCenter) {
      return
    }

    const userMap = await getUsersMap(elementsSource)
    if (userMap === undefined) {
      return
    }
    const preDeployUserMap = _.keyBy(
      Object.values(userMap).filter(userInfo => _.isString(userInfo.username)),
      userInfo => userInfo.username as string
    )

    changes
      .filter(isInstanceChange)
      .filter(isAdditionOrModificationChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName !== PROJECT_TYPE)
      .forEach(element =>
        walkOnElement({ element, func: walkOnUsers(convertUserNameToId(preDeployUserMap), config) }))
  },
  onDeploy: async changes => {
    if (!(config.fetch.convertUsersIds ?? true)
       || !client.isDataCenter) {
      return
    }
    const userMap = await getUsersMap(elementsSource)
    if (userMap === undefined) {
      return
    }
    changes
      .filter(isInstanceChange)
      .filter(isAdditionOrModificationChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName !== PROJECT_TYPE)
      .forEach(element =>
        walkOnElement({ element, func: walkOnUsers(convertIdToUsername(userMap), config) }))
  },
})

export default filter
