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
import { AccountInfo } from '@salto-io/adapter-api'
import { axiosConnection, ConnectionCreator, APIConnection } from '../../src/client/http_connection'

export type Credentials = { username: string; password: string }

export const BASE_URL = 'http://localhost:1234/api/v1'

export const validateCreds = async ({
  credentials,
  connection,
}: {
  credentials: Credentials
  connection: APIConnection
}): Promise<AccountInfo> => {
  const user = await connection.get('/users/me')
  return {
    accountId: `${user.data.accountId}:${credentials.username}`,
    accountType: 'Sandbox',
    isProduction: false,
  }
}

export const createConnection: ConnectionCreator<Credentials> = (retryOptions, timeout) =>
  axiosConnection({
    retryOptions,
    authParamsFunc: async ({ username, password }: Credentials) => ({
      headers: {
        customheader1: username,
      },
      auth: {
        username,
        password,
      },
    }),
    baseURLFunc: async () => BASE_URL,
    credValidateFunc: validateCreds,
    timeout,
  })
