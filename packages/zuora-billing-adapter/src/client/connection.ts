/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { auth as authUtils, client as clientUtils } from '@salto-io/adapter-components'
import { Credentials, isOAuthClientCredentials, isUsernamePasswordCredentials } from '../auth'

const { oauthClientCredentialsBearerToken } = authUtils

export const validateCredentials = async (
  creds: Credentials, conn: clientUtils.APIConnection,
): Promise<AccountId> => {
  if (isUsernamePasswordCredentials(creds)) {
    const res = await conn.post('/v1/connections', {})
    if (res.status !== 200 || !res.data.success) {
      throw new Error('Authentication failed')
    }
  }
  // the oauth variant was already authenticated when the connection was created

  // default to empty to avoid preventing users from refreshing their credentials in the SaaS.
  return ''
}

export const createConnection: clientUtils.ConnectionCreator<Credentials> = retryOptions => (
  clientUtils.axiosConnection({
    retryOptions,
    authParamsFunc: async (creds: Credentials) => {
      if (isOAuthClientCredentials(creds)) {
        return oauthClientCredentialsBearerToken({
          ...creds,
          retryOptions,
        })
      }
      return {
        headers: {
          apiAccessKeyId: creds.username,
          apiSecretAccessKey: creds.password,
        },
      }
    },
    baseURLFunc: ({ baseURL }) => baseURL,
    credValidateFunc: validateCredentials,
  })
)
