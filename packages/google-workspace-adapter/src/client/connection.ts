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
import { client as clientUtils } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { OAuth2Client } from 'google-auth-library'
import { Credentials } from '../auth'
import { OauthAccessTokenCredentials } from './oauth'

const log = logger(module)

export const validateCredentials = async ({
  connection,
}: {
  connection: clientUtils.APIConnection
}): Promise<AccountInfo> => {
  try {
    await connection.get('https://admin.googleapis.com/admin/directory/v1/customer/my_customer/roles')
    return { accountId: 'googoo' }
  } catch (e) {
    log.error('Failed to validate credentials: %s', e)
    throw new clientUtils.UnauthorizedError(e)
  }
}

const isOauthCredentials = (cred: Credentials): cred is OauthAccessTokenCredentials => 'refreshToken' in cred

export const createConnection: clientUtils.ConnectionCreator<Credentials> = retryOptions =>
  clientUtils.axiosConnection({
    retryOptions,
    baseURLFunc: async () => '',
    authParamsFunc: async (creds: Credentials) => {
      if (!isOauthCredentials(creds)) {
        return {
          headers: {
            Authorization: `Bearer ${creds.accessToken}`,
          },
        }
      }
      const oAuth2Client = new OAuth2Client(creds.clientId, creds.clientSecret)
      oAuth2Client.setCredentials({ refresh_token: creds.refreshToken })
      const { token } = await oAuth2Client.getAccessToken()
      return {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    },
    credValidateFunc: validateCredentials,
  })
