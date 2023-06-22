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
import { AccountInfo } from '@salto-io/adapter-api'
import { client as clientUtils, client } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { Credentials, AccessTokenCredentials } from '../auth'

const log = logger(module)

export const validateCredentials = async (_creds: {
  credentials: Credentials
  connection: clientUtils.APIConnection
}): Promise<AccountInfo> => {
  try {
    const response = await _creds.connection.get('/api/v1/org')
    return { accountId: response.data.id }
  } catch (error) {
    if (error.response?.status === 401) {
      log.error('Failed to validate credentials: %s', error)
      throw new client.UnauthorizedError('Invalid Credentials')
    }
    throw error
  }
}

const accessTokenAuthParamsFunc = (
  { token }: AccessTokenCredentials
): clientUtils.AuthParams => ({
  headers: {
    Authorization: `SSWS ${token}`,
  },
})

export const createConnection: clientUtils.ConnectionCreator<Credentials> = (
  retryOptions: clientUtils.RetryOptions,
) => (
  clientUtils.axiosConnection({
    retryOptions,
    authParamsFunc: async (creds: Credentials) => (
      accessTokenAuthParamsFunc(creds)
    ),
    baseURLFunc: ({ baseUrl }) => baseUrl,
    credValidateFunc: validateCredentials,
  })
)
