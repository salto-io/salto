
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
import { ElemID, getChangeData, isAdditionOrModificationChange, isInstanceChange, isInstanceElement } from '@salto-io/adapter-api'
import { setPath, walkOnElement } from '@salto-io/adapter-utils'
import { config as configUtils } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { FilterCreator } from '../../filter'
import { walkOnUsers } from './account_id_filter'
import { getCurrentUserInfo, getUserIdFromEmail, getUsersMap, getUsersMapByVisibleId, UserMap } from '../../users'
import JiraClient from '../../client/client'

const log = logger(module)

const getFallbackUser = async (
  client: JiraClient,
  defaultUser: string,
  userMap: UserMap
): Promise<string | undefined> => {
  if (defaultUser !== configUtils.DEPLOYER_FALLBACK_VALUE) {
    if (!client.isDataCenter && defaultUser !== undefined) {
      return getUserIdFromEmail(defaultUser, userMap)
    }

    if (!Object.prototype.hasOwnProperty.call(userMap, defaultUser)) {
      return undefined
    }

    return defaultUser
  }

  const currentUserInfo = await getCurrentUserInfo(client)
  return client.isDataCenter
    ? currentUserInfo?.username
    : currentUserInfo?.userId
}

const filter: FilterCreator = ({ client, config, elementsSource }) => {
  const fallbackPathToUser: Record<string, string> = {}

  return {
    name: 'userFallbackFilter',
    preDeploy: async changes => {
      if (config.deploy.defaultMissingUserFallback === undefined) {
        return
      }
      const rawUserMap = await getUsersMap(elementsSource)
      if (rawUserMap === undefined) {
        return
      }
      const userMap = getUsersMapByVisibleId(rawUserMap, client.isDataCenter)

      const fallbackUser = await getFallbackUser(client, config.deploy.defaultMissingUserFallback, userMap)
      if (fallbackUser === undefined) {
        return
      }

      changes
        .filter(isInstanceChange)
        .filter(isAdditionOrModificationChange)
        .map(getChangeData)
        .forEach(element =>
          walkOnElement({
            element,
            func: walkOnUsers(({ value, fieldName, path }) => {
              if (!Object.prototype.hasOwnProperty.call(userMap, value[fieldName].id)) {
                fallbackPathToUser[path.createNestedID(fieldName).getFullName()] = value[fieldName].id
                value[fieldName].id = fallbackUser
              }
            }, config),
          }))
    },
    onDeploy: async changes => log.time(async () => {
      if (_.isEmpty(fallbackPathToUser)) {
        return
      }

      const idToInstance = _(changes)
        .filter(isAdditionOrModificationChange)
        .map(getChangeData)
        .filter(isInstanceElement)
        .keyBy(element => element.elemID.getFullName())
        .value()

      Object.entries(fallbackPathToUser)
        .forEach(([path, userId]) => {
          const idPath = ElemID.fromFullName(path)
          const baseId = idPath.createBaseID().parent.getFullName()
          if (!Object.prototype.hasOwnProperty.call(idToInstance, baseId)) {
            return
          }

          setPath(idToInstance[baseId], idPath.createNestedID('id'), userId)
        })
    }, 'user_id_filter deploy'),
  }
}

export default filter
