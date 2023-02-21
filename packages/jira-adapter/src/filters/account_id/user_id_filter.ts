
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
import { MissingUsersPermissionError, UserMap } from '../../users'
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
const filter: FilterCreator = ({ client, config, getUserMapFunc }) => ({
  name: 'userIdFilter',
  onFetch: async elements => {
    let fetchUserMap: UserMap
    if (!(config.fetch.convertUsersIds ?? true)) {
      return
    }
    try {
      fetchUserMap = await getUserMapFunc()
    } catch (e) {
      if (e instanceof MissingUsersPermissionError) {
        return
      }
      throw e
    }
    await awu(elements)
      .filter(isInstanceElement)
      .forEach(async element => {
        if (client.isDataCenter) {
          walkOnElement({ element, func: walkOnUsers(convertIdToUsername(fetchUserMap)) })
        } else {
          walkOnElement({ element, func: walkOnUsers(addDisplayName(fetchUserMap,)) })
        }
      })
  },
  preDeploy: async changes => {
    let preDeployUserMap: UserMap
    if (!(config.fetch.convertUsersIds ?? true) || !client.isDataCenter) {
      return
    }

    try {
      preDeployUserMap = _.keyBy(
        Object.values(await getUserMapFunc()).filter(userInfo => _.isString(userInfo.username)),
        userInfo => userInfo.username as string
      )
    } catch (e) {
      if (e instanceof MissingUsersPermissionError) {
        return
      }
      throw e
    }


    changes
      .filter(isInstanceChange)
      .filter(isAdditionOrModificationChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName !== PROJECT_TYPE)
      .forEach(element =>
        walkOnElement({ element, func: walkOnUsers(convertUserNameToId(preDeployUserMap)) }))
  },
  onDeploy: async changes => {
    let deployUserMap: UserMap
    if (!(config.fetch.convertUsersIds ?? true)
       || !client.isDataCenter) {
      return
    }
    try {
      deployUserMap = await getUserMapFunc()
    } catch (e) {
      if (e instanceof MissingUsersPermissionError) {
        return
      }
      throw e
    }
    changes
      .filter(isInstanceChange)
      .filter(isAdditionOrModificationChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName !== PROJECT_TYPE)
      .forEach(element =>
        walkOnElement({ element, func: walkOnUsers(convertIdToUsername(deployUserMap)) }))
  },
})

export default filter
