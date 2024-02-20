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
import _ from 'lodash'
import { AxiosRequestHeaders } from 'axios'
import { AccountInfo, CredentialError } from '@salto-io/adapter-api'
import { client as clientUtils } from '@salto-io/adapter-components'
import { Credentials } from '../auth'

const BASE_URL = 'https://www.workato.com/api'

export const validateCredentials = async ({
  connection,
}: {
  connection: clientUtils.APIConnection
}): Promise<AccountInfo> => {
  try {
    await connection.get('/users/me')
    // there is no good stable account id in workato, so we default to empty string to avoid
    // preventing users from refreshing their credentials in the SaaS.
    return { accountId: '' }
  } catch (error) {
    if (error.response?.status === 401) {
      throw new CredentialError('Invalid Credentials')
    }
    throw error
  }
}

export const createConnection: clientUtils.ConnectionCreator<Credentials> = (retryOptions, timeout) =>
  clientUtils.axiosConnection({
    retryOptions,
    authParamsFunc: async ({ username, token }: Credentials) => ({
      headers:
        username === undefined || _.isEmpty(username)
          ? ({
              Authorization: `Bearer ${token}`,
            } as AxiosRequestHeaders)
          : {
              'x-user-email': username,
              'x-user-token': token,
            },
    }),
    baseURLFunc: async () => BASE_URL,
    credValidateFunc: validateCredentials,
    timeout,
  })
