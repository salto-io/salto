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
import { client as clientUtils, auth as authUtils } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { Credentials } from '../auth'

const log = logger(module)

export const VALIDATE_CREDENTIALS_URL = '/JSSResource/classes'

export const validateCredentials = async ({
  connection,
  credentials,
}: {
  credentials: Credentials
  connection: clientUtils.APIConnection
}): Promise<AccountInfo> => {
  try {
    await connection.get(VALIDATE_CREDENTIALS_URL)
    // TODO SALTO-6138 support isProduction
    const accountId = credentials.baseUrl
    return { accountId }
  } catch (e) {
    log.error('Failed to validate credentials: %s', e)
    throw new clientUtils.UnauthorizedError(e)
  }
}

export const createConnection: clientUtils.ConnectionCreator<Credentials> = retryOptions =>
  clientUtils.axiosConnection({
    retryOptions,
    baseURLFunc: async ({ baseUrl }) => baseUrl,
    authParamsFunc: ({ baseUrl: baseURL, clientId, clientSecret }) =>
      authUtils.oauthClientCredentialsBearerToken({
        endpoint: '/api/oauth/token',
        baseURL,
        clientId,
        clientSecret,
        retryOptions: {},
      }),
    credValidateFunc: validateCredentials,
  })
