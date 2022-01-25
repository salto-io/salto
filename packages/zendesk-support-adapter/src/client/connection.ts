/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { AuthParams } from '@salto-io/adapter-components/src/client/http_connection'
import { logger } from '@salto-io/logging'
import { Credentials, isOauthAccessTokenCredentials, OauthAccessTokenCredentials, UsernamePasswordCredentials } from '../auth'

const log = logger(module)

const baseUrl = (subdomain: string): string => `https://${subdomain}.zendesk.com/api/v2`

const MARKETPLACE_NAME = 'Salto'
const MARKETPLACE_ORG_ID = 5110
const MARKETPLACE_APP_ID = 608042

const APP_MARKETPLACE_HEADERS = {
  'X-Zendesk-Marketplace-Name': MARKETPLACE_NAME,
  'X-Zendesk-Marketplace-Organization-Id': MARKETPLACE_ORG_ID,
  'X-Zendesk-Marketplace-App-Id': MARKETPLACE_APP_ID,
}

export const validateCredentials = async ({ credentials, connection }: {
  credentials: Credentials
  connection: clientUtils.APIConnection
}): Promise<AccountId> => {
  try {
    await connection.get('/account/settings')
  } catch (e) {
    log.error('Failed to validate credentials: %s', e)
    throw new clientUtils.UnauthorizedError(e)
  }

  return credentials.subdomain
}

const usernamePasswordAuthParamsFunc = (
  { username, password }: UsernamePasswordCredentials
): AuthParams => ({
  auth: {
    username,
    password,
  },
  headers: APP_MARKETPLACE_HEADERS,
})

const accessTokenAuthParamsFunc = (
  { accessToken }: OauthAccessTokenCredentials
): AuthParams => ({
  headers: {
    Authorization: `Bearer ${accessToken}`,
    ...APP_MARKETPLACE_HEADERS,
  },
})

export const createConnection: clientUtils.ConnectionCreator<Credentials> = retryOptions => (
  clientUtils.axiosConnection({
    retryOptions,
    authParamsFunc: async (creds: Credentials) => (
      isOauthAccessTokenCredentials(creds)
        ? accessTokenAuthParamsFunc(creds)
        : usernamePasswordAuthParamsFunc(creds)
    ),
    baseURLFunc: ({ subdomain }) => baseUrl(subdomain),
    credValidateFunc: validateCredentials,
  })
)
