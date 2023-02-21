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
import { client as clientUtils } from '@salto-io/adapter-components'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { collections, decorators } from '@salto-io/lowerdash'
import Joi from 'joi'
import _ from 'lodash'
import JiraClient from './client/client'

const { makeArray } = collections.array
const { toArrayAsync } = collections.asynciterable
const log = logger(module)

export type UserInfo = {
  locale?: string
  userId: string
  displayName: string
  email?: string
  username?: string
}
export type UserMap = Record<string, UserInfo>
export type GetUserMapFunc = () => Promise<UserMap>

export class JiraClientError extends Error {
  constructor(message: string) {
    super(message)
  }
}

export const ignoreJiraClientError = (): decorators.InstanceMethodDecorator => (
  decorators.wrapMethodWith(
    async (
      originalMethod: decorators.OriginalCall,
    ): Promise<unknown | undefined> => {
      try {
        const result = await originalMethod.call()
        return result
      } catch (err) {
        if (!(err instanceof JiraClientError)) {
          throw err
        }
      }
      return undefined
    }
  )
)

const paginateUsers = async (paginator: clientUtils.Paginator, isDataCenter: boolean)
  : Promise<clientUtils.ResponseValue[][]> => {
  const paginationArgs: clientUtils.ClientGetWithPaginationParams = isDataCenter
    ? {
      url: '/rest/api/2/user/search',
      paginationField: 'startAt',
      queryParams: {
        maxResults: '1000',
        username: '.',
      },
      pageSizeArgName: 'maxResults',
    }
    : {
      url: '/rest/api/3/users/search',
      paginationField: 'startAt',
      queryParams: {
        maxResults: '1000',
      },
      pageSizeArgName: 'maxResults',
    }

  const usersCallPromise = toArrayAsync(paginator(
    paginationArgs,
    page => makeArray(page) as clientUtils.ResponseValue[]
  ))
  return usersCallPromise
}

type CloudUserResponse = {
  locale?: string
  emailAddress?: string
  accountId: string
  displayName: string
}

const CLOUD_USER_RESPONSE_SCHEME = Joi.object({
  locale: Joi.string(),
  accountId: Joi.string().required(),
  emailAddress: Joi.string(),
  displayName: Joi.string().required().allow(''),
}).unknown(true)

type DataCenterUserResponse = {
  locale?: string
  key: string
  name: string
  emailAddress?: string
  displayName: string
}

const DATA_CENTER_USER_RESPONSE_SCHEME = Joi.object({
  locale: Joi.string(),
  key: Joi.string().required(),
  name: Joi.string().required().allow(''),
  emailAddress: Joi.string(),
  displayName: Joi.string().required().allow(''),
}).unknown(true)

type UserResponse = DataCenterUserResponse | CloudUserResponse

const USER_RESPONSE_SCHEME = Joi.alternatives(CLOUD_USER_RESPONSE_SCHEME, DATA_CENTER_USER_RESPONSE_SCHEME)

const isUserResponse = createSchemeGuard<UserResponse>(USER_RESPONSE_SCHEME, 'Failed to get current user info')

const parseUserResponse = (response: UserResponse): UserInfo => ({
  locale: response.locale,
  userId: 'accountId' in response
    ? response.accountId
    : response.key,
  username: 'name' in response ? response.name : undefined,
  email: response.emailAddress,
  displayName: response.displayName,
})

export const getUserMapFuncCreator = (paginator: clientUtils.Paginator, isDataCenter: boolean)
    : GetUserMapFunc => {
  let idMap: UserMap
  let usersCallPromise: Promise<clientUtils.ResponseValue[][]>
  return async (): Promise<UserMap> => {
    if (idMap === undefined) {
      if (usersCallPromise === undefined) {
        usersCallPromise = log.time(async () => paginateUsers(paginator, isDataCenter), 'users pagination')
      }
      try {
        idMap = Object.fromEntries((await usersCallPromise)
          .flat()
          .filter(isUserResponse)
          .map(parseUserResponse)
          .map(userInfo => [userInfo.userId, userInfo]))
      } catch (e) {
        throw new JiraClientError(e)
      }
    }
    return idMap
  }
}

export const getCurrentUserInfo = async (client: JiraClient): Promise<UserInfo | undefined> => {
  const response = await client.getSinglePage({
    url: '/rest/api/3/myself',
  })

  if (!isUserResponse(response.data)) {
    return undefined
  }

  return parseUserResponse(response.data)
}

export const getUserIdFromEmail = (email: string, userMap: UserMap): string | undefined =>
  Object.values(userMap).find(userInfo => userInfo.email === email)?.userId

export const getUsersMapByVisibleId = (userMap: UserMap, isDataCenter: boolean): UserMap => (
  isDataCenter
    ? _.keyBy(
      Object.values(userMap).filter(userInfo => _.isString(userInfo.username)),
      userInfo => userInfo.username as string
    )
    : userMap
)
