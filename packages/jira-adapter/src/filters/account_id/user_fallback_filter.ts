/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import {
  ElemID,
  getChangeData,
  isAdditionOrModificationChange,
  isInstanceChange,
  isInstanceElement,
} from '@salto-io/adapter-api'
import { setPath, walkOnElement } from '@salto-io/adapter-utils'
import { definitions } from '@salto-io/adapter-components'
import { FilterCreator } from '../../filter'
import { walkOnUsers } from './account_id_filter'
import { getCurrentUserInfo, getUserIdFromEmail, getUsersMap, getUsersMapByVisibleId, UserMap } from '../../users'
import JiraClient from '../../client/client'

const getFallbackUser = async (
  client: JiraClient,
  defaultUser: string,
  userMap: UserMap,
): Promise<string | undefined> => {
  if (defaultUser !== definitions.DEPLOYER_FALLBACK_VALUE) {
    if (!client.isDataCenter && defaultUser !== undefined) {
      return getUserIdFromEmail(defaultUser, userMap)
    }

    if (!Object.prototype.hasOwnProperty.call(userMap, defaultUser)) {
      return undefined
    }

    return defaultUser
  }

  const currentUserInfo = await getCurrentUserInfo(client)
  return client.isDataCenter ? currentUserInfo?.username : currentUserInfo?.userId
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
          }),
        )
    },
    onDeploy: async changes => {
      if (_.isEmpty(fallbackPathToUser)) {
        return
      }

      const idToInstance = _(changes)
        .filter(isAdditionOrModificationChange)
        .map(getChangeData)
        .filter(isInstanceElement)
        .keyBy(element => element.elemID.getFullName())
        .value()

      Object.entries(fallbackPathToUser).forEach(([path, userId]) => {
        const idPath = ElemID.fromFullName(path)
        const baseId = idPath.createBaseID().parent.getFullName()
        if (!Object.prototype.hasOwnProperty.call(idToInstance, baseId)) {
          return
        }

        setPath(idToInstance[baseId], idPath.createNestedID('id'), userId)
      })
    },
  }
}

export default filter
