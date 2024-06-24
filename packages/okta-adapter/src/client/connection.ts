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
import { client as clientUtils, client, auth as authUtils } from '@salto-io/adapter-components'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import {
  Credentials,
  AccessTokenCredentials,
  isOAuthAccessTokenCredentials,
  OAuthAccessTokenCredentials,
} from '../auth'

const log = logger(module)

// We can only detect if an account is a preview account, as production accounts don't have indicators in their base URL
// For more info see: https://developer.okta.com/docs/concepts/okta-organizations/#preview-and-production
const isOktaPreviewAccount = (baseUrl: string): boolean => /.*\.oktapreview\..*/.test(baseUrl)
const isOktaDevAccount = (baseUrl: string): boolean => /.*:\/\/dev-[0-9]*\..*/.test(baseUrl)
const PRODUCTION_ACCOUNT_TYPE = 'Production'
const PREVIEW_ACCOUNT_TYPE = 'Preview'
const DEV_ACCOUNT_TYPE = 'Dev'

type OktaAccountType = 'Production' | 'Preview' | 'Dev'
const getAccountType = (baseUrl: string): OktaAccountType => {
  if (isOktaPreviewAccount(baseUrl)) {
    return PREVIEW_ACCOUNT_TYPE
  }
  if (isOktaDevAccount(baseUrl)) {
    return DEV_ACCOUNT_TYPE
  }
  return PRODUCTION_ACCOUNT_TYPE
}

export const validateCredentials = async (_creds: {
  credentials: Credentials
  connection: clientUtils.APIConnection
}): Promise<AccountInfo> => {
  try {
    const response = await _creds.connection.get('/api/v1/org')
    const accountType = getAccountType(_creds.credentials.baseUrl)
    return {
      accountId: response.data.id,
      accountType,
      isProduction: accountType === PRODUCTION_ACCOUNT_TYPE,
    }
  } catch (error) {
    log.error(
      'Failed to validate credentials, error: %s, stack: %s',
      safeJsonStringify({ data: error?.response?.data, status: error?.response?.status }),
      error.stack,
    )
    throw new client.UnauthorizedError('Invalid Credentials')
  }
}

const apiTokenAuthParamsFunc = ({ token }: AccessTokenCredentials): clientUtils.AuthParams => ({
  headers: {
    Authorization: `SSWS ${token}`,
  },
})

const oauthAuthParamsFunc = async (
  creds: OAuthAccessTokenCredentials,
  retryOptions: clientUtils.RetryOptions,
): Promise<clientUtils.AuthParams> => {
  const { baseUrl, clientId, clientSecret, refreshToken } = creds
  return authUtils.oauthAccessTokenRefresh({
    endpoint: '/oauth2/v1/token',
    baseURL: baseUrl,
    clientId,
    clientSecret,
    refreshToken,
    retryOptions,
  })
}

export const createConnection: clientUtils.ConnectionCreator<Credentials> = (retryOptions, timeout) =>
  clientUtils.axiosConnection({
    retryOptions,
    authParamsFunc: async (creds: Credentials) =>
      isOAuthAccessTokenCredentials(creds) ? oauthAuthParamsFunc(creds, retryOptions) : apiTokenAuthParamsFunc(creds),
    baseURLFunc: async ({ baseUrl }) => baseUrl,
    credValidateFunc: validateCredentials,
    timeout,
  })
