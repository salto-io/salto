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
import axios from 'axios'
import axiosRetry from 'axios-retry'
import { AccountId } from '@salto-io/adapter-api'
import { client as clientUtils } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { Credentials, isOauthAccessTokenCredentials, OauthAccessTokenCredentials, UsernamePasswordCredentials } from '../auth'

const log = logger(module)

export const instanceUrl = (subdomain: string): string => `https://${subdomain}.zendesk.com`
const baseUrl = instanceUrl
// A URL for resource files
const resourceUrl = (subdomain: string): string => (new URL('/', instanceUrl(subdomain))).href

const MARKETPLACE_NAME = 'Salto'
const MARKETPLACE_ORG_ID = 5110
const MARKETPLACE_APP_ID = 608042

export const APP_MARKETPLACE_HEADERS = {
  'X-Zendesk-Marketplace-Name': MARKETPLACE_NAME,
  'X-Zendesk-Marketplace-Organization-Id': MARKETPLACE_ORG_ID,
  'X-Zendesk-Marketplace-App-Id': MARKETPLACE_APP_ID,
}

export const validateCredentials = async ({ credentials, connection }: {
  credentials: Credentials
  connection: clientUtils.APIConnection
}): Promise<AccountId> => {
  try {
    await connection.get('/api/v2/account/settings')
  } catch (e) {
    log.error('Failed to validate credentials: %s', e)
    throw new clientUtils.UnauthorizedError(e)
  }

  return credentials.subdomain
}

const usernamePasswordAuthParamsFunc = (
  { username, password }: UsernamePasswordCredentials
): clientUtils.AuthParams => ({
  auth: {
    username,
    password,
  },
  headers: APP_MARKETPLACE_HEADERS,
})

const accessTokenAuthParamsFunc = (
  { accessToken }: OauthAccessTokenCredentials
): clientUtils.AuthParams => ({
  headers: {
    Authorization: `Bearer ${accessToken}`,
    ...APP_MARKETPLACE_HEADERS,
  },
})

export const createConnection: clientUtils.ConnectionCreator<Credentials> = (
  retryOptions: clientUtils.RetryOptions,
) => (
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

export const createResourceConnection:
  clientUtils.ConnectionCreator<Credentials> = retryOptions => {
    const login = async (
      creds: Credentials,
    ): Promise<clientUtils.AuthenticatedAPIConnection> => {
      const httpClient = axios.create({
        baseURL: resourceUrl(creds.subdomain),
        headers: APP_MARKETPLACE_HEADERS,
      })
      axiosRetry(httpClient, retryOptions)
      return {
        ...httpClient,
        accountId: creds.subdomain,
      }
    }
    return {
      login,
    }
  }
