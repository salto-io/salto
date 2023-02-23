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
import { AccountId } from '@salto-io/adapter-api'
import { client as clientUtils } from '@salto-io/adapter-components'
import { Credentials, UsernamePasswordCredentials } from '../auth'

export const instanceUrl = (subdomain: string, domain?: string): string => (
  domain === undefined ? `https://${subdomain}.sap.com` : `https://${subdomain}.${domain}`
)
const baseUrl = instanceUrl

export const validateCredentials = async (): Promise<AccountId> => ''

const usernamePasswordAuthParamsFunc = (
  { username, password }: UsernamePasswordCredentials
): clientUtils.AuthParams => ({
  auth: {
    username,
    password,
  },
})

export const createConnection: clientUtils.ConnectionCreator<Credentials> = (
  retryOptions: clientUtils.RetryOptions,
) => (
  clientUtils.axiosConnection({
    retryOptions,
    authParamsFunc: async (creds: Credentials) => usernamePasswordAuthParamsFunc(creds),
    baseURLFunc: ({ subdomain, domain }) => baseUrl(subdomain, domain),
    credValidateFunc: validateCredentials,
  })
)
