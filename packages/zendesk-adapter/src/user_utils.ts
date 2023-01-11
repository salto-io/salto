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
import Joi from 'joi'
import { logger } from '@salto-io/logging'
import { client as clientUtils } from '@salto-io/adapter-components'
import { collections } from '@salto-io/lowerdash'

const log = logger(module)
const { toArrayAsync } = collections.asynciterable
const { makeArray } = collections.array

type User = {
  id: number
  email: string
  role: string
  // eslint-disable-next-line camelcase
  custom_role_id: number
}

const EXPECTED_USER_SCHEMA = Joi.array().items(Joi.object({
  id: Joi.number().required(),
  email: Joi.string().required(),
  role: Joi.string(),
  custom_role_id: Joi.number(),
}).unknown(true)).required()

const areUsers = (values: unknown): values is User[] => {
  const { error } = EXPECTED_USER_SCHEMA.validate(values)
  if (error !== undefined) {
    log.warn(`Received an invalid response for the users values: ${error.message}`)
    return false
  }
  return true
}

/*
* Fetch all users with admin and agent roles.
* Results are cached after the initial call to improve performance.
*
*/
const getUsersFunc = ():(paginator: clientUtils.Paginator) => Promise<User[]> => {
  let calculatedUsers: User[]

  const getUsers = async (paginator: clientUtils.Paginator): Promise<User[]> => {
    if (calculatedUsers !== undefined) {
      return calculatedUsers
    }
    const paginationArgs = {
      url: '/api/v2/users',
      paginationField: 'next_page',
      queryParams: {
        role: ['admin', 'agent'],
      },
    }
    const users = (await toArrayAsync(
      paginator(paginationArgs, page => makeArray(page) as clientUtils.ResponseValue[])
    )).flat().flatMap(response => response.users)
    if (!areUsers(users)) {
      calculatedUsers = []
      return []
    }
    calculatedUsers = users
    return users
  }

  return getUsers
}

export const getUsers = getUsersFunc()
