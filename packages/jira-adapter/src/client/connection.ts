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

const isAuthorized = async (connection: clientUtils.APIConnection): Promise<boolean> => {
  try {
    await connection.get('/rest/api/3/configuration')
    return true
  } catch (e) {
    if (e.response?.status === 401) {
      return false
    }
    throw e
  }
}

const getBaseUrl = async (connection: clientUtils.APIConnection): Promise<string> => {
  const response = await connection.get('/rest/api/3/serverInfo')
  return response.data.baseUrl
}

export const validateCredentials = async (
  { connection }: { connection: clientUtils.APIConnection },
): Promise<AccountId> => {
  if (await isAuthorized(connection)) {
    return getBaseUrl(connection)
  }
  return Promise.reject(new Error('Invalid Credentials'))
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
