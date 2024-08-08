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
import axios from 'axios'
import { AccountInfo } from '@salto-io/adapter-api'
import { client as clientUtils } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { Credentials, getAuthenticationBaseUrl } from './oauth'

const log = logger(module)

export const validateCredentials = async ({
  credentials: { tenantId },
  connection,
}: {
  credentials: Credentials
  connection: clientUtils.APIConnection
}): Promise<AccountInfo> => {
  try {
    await connection.get('/v1.0/me')
    return {
      accountId: tenantId,
    }
  } catch (e) {
    log.error('Failed to validate credentials: %s', e)
    throw new clientUtils.UnauthorizedError(e)
  }
}

const getAccessToken = async ({ tenantId, clientId, clientSecret, refreshToken }: Credentials): Promise<string> => {
  const httpClient = axios.create({
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  })
  const data = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })
  const res = await httpClient.post(`${getAuthenticationBaseUrl(tenantId)}/token`, data)
  return res.data.access_token
}

export const createConnection: clientUtils.ConnectionCreator<Credentials> = retryOptions =>
  clientUtils.axiosConnection({
    retryOptions,
    baseURLFunc: async () => 'https://graph.microsoft.com',
    authParamsFunc: async (credentials: Credentials) => {
      const accessToken = await getAccessToken(credentials)
      return {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    },
    credValidateFunc: validateCredentials,
  })
