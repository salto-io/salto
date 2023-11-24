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
import { auth as authUtils, client as clientUtils } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { Credentials } from '../auth'

const log = logger(module)

const { oauthClientCredentialsBearerToken } = authUtils

const BASE_SERVICE = '/odata/v4/api/mcm/v1/'

export const validateCredentials = async ({ connection }: {
  connection: clientUtils.APIConnection
}): Promise<AccountInfo> => {
  // oauth was already authenticated when the connection was created, but validating just in case
  try {
    const res = await connection.get('/')
    if (res.status !== 200) {
      log.error('Got %s:%s response from base service url', res.status, res.statusText)
      throw new clientUtils.UnauthorizedError('Authentication failed')
    }
  } catch (e) {
    log.error('Failed to validate credentials: %s', e)
    throw new clientUtils.UnauthorizedError((e as Error).message)
  }

  // default to empty to avoid preventing users from refreshing their credentials in the SaaS.
  return { accountId: '' }
}

export const createConnection: clientUtils.ConnectionCreator<Credentials> = retryOptions => (
  clientUtils.axiosConnection({
    retryOptions,
    authParamsFunc: async (creds: Credentials) => (
      oauthClientCredentialsBearerToken({
        clientId: creds.clientId,
        clientSecret: creds.clientSecret,
        baseURL: creds.authUrl,
        retryOptions,
        additionalData: { response_type: 'token' },
      })
    ),
    baseURLFunc: async ({ baseUrl }) => baseUrl + BASE_SERVICE,
    credValidateFunc: validateCredentials,
  })
)
