/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { AccountId } from '@salto-io/adapter-api'
import { client as clientUtils } from '@salto-io/adapter-utils'
import { Credentials } from '../auth'

const BASE_URL = 'https://www.workato.com/api'

export const validateCredentials = async (
  _creds: Credentials, conn: clientUtils.APIConnection,
): Promise<AccountId> => {
  const user = await conn.get('/users/me')
  // TODO confirm the user id is good enough (doesn't seem to have an account id beyond that)
  // TODO https://docs.workato.com/oem/oem-api/managed-users.html#get-customer-account in OEM API
  return user.data.company_name ?? user.data.id
}

export const createConnection: clientUtils.ConnectionCreator<Credentials> = retryOptions => (
  clientUtils.axiosConnection({
    retryOptions,
    authParamsFunc: ({ username, token }: Credentials) => ({
      headers: {
        'x-user-email': username,
        'x-user-token': token,
      },
    }),
    baseURLFunc: () => BASE_URL,
    credValidateFunc: validateCredentials,
  })
)
