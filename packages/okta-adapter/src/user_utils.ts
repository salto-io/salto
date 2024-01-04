/*
*                      Copyright 2024 Salto Labs Ltd.
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
import { createSchemeGuard } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { client as clientUtils } from '@salto-io/adapter-components'

const log = logger(module)
const { toArrayAsync } = collections.asynciterable
const { makeArray } = collections.array

export type User = {
   id: string
   profile: {
     login: string
   }
 }

const USER_SCHEMA = Joi.object({
  id: Joi.string().required(),
  profile: Joi.object({
    login: Joi.string().required(),
  }).unknown(true),
}).unknown(true)

const USERS_RESPONSE_SCHEMA = Joi.array().items(USER_SCHEMA).required()

export const areUsers = createSchemeGuard<User[]>(
  USERS_RESPONSE_SCHEMA, 'Received an invalid response for the users'
)

export const getUsers = async (paginator: clientUtils.Paginator): Promise<User[]> => {
  const paginationArgs = {
    url: '/api/v1/users',
    paginationField: 'after',
    // omit credentials and other unnecessary fields from the response
    headers: { 'Content-Type': 'application/json; okta-response=omitCredentials,omitCredentialsLinks' },
  }
  const users = await log.time(async () => (
    await toArrayAsync(
      paginator(paginationArgs, page => makeArray(page) as clientUtils.ResponseValue[])
    )).flat(),
  'getUsers with pagination')
  if (!areUsers(users)) {
    return []
  }
  return users
}
