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
import { Credentials, AccessTokenCredentials } from '../auth'


export const instanceUrl = (baseUrl: string): string => baseUrl

export const validateCredentials = async (_creds: {
  credentials: Credentials
  connection: clientUtils.APIConnection
}): Promise<AccountId> => (
  // TODO validate
  ''
)

const accessTokenAuthParamsFunc = (
  { token }: AccessTokenCredentials
): clientUtils.AuthParams => ({
  headers: {
    Authorization: `SSWS ${token}`,
  },
})

export const createConnection: clientUtils.ConnectionCreator<Credentials> = (
  retryOptions: clientUtils.RetryOptions,
) => (
  clientUtils.axiosConnection({
    retryOptions,
    authParamsFunc: async (creds: Credentials) => (
      accessTokenAuthParamsFunc(creds)
    ),
    baseURLFunc: ({ baseUrl }) => instanceUrl(baseUrl),
    credValidateFunc: validateCredentials,
  })
)
