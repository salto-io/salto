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
import { client as clientUtils } from '@salto-io/adapter-components'
import { Credentials } from '../auth'

export const validateCredentials = async (
  { connection }: { connection: clientUtils.APIConnection },
): Promise<AccountId> => {
  const res = await connection.get('/rest/api/3/serverInfo')
  return res.data.baseUrl
}

export const createConnection: clientUtils.ConnectionCreator<Credentials> = retryOptions => (
  clientUtils.axiosConnection({
    retryOptions,
    authParamsFunc: async credentials => ({
      auth: {
        username: credentials.user,
        password: credentials.token,
      },
    }),
    baseURLFunc: ({ baseUrl }) => baseUrl,
    credValidateFunc: async () => '', // There is no login endpoint to call
  })
)
