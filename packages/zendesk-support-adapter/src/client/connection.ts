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
import { client as clientUtils } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { Credentials, UsernamePasswordCredentials } from '../auth'

const log = logger(module)

const baseUrl = (subdomain: string): string => `https://${subdomain}.zendesk.com/api/v2`

// TODO change validation when switching to oauth
export const validateCredentials = async ({ credentials, connection }: {
  credentials: UsernamePasswordCredentials
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

export const createConnection: clientUtils.ConnectionCreator<Credentials> = retryOptions => (
  clientUtils.axiosConnection({
    retryOptions,
    authParamsFunc: async ({ username, password }: Credentials) => ({
      auth: {
        username,
        password,
      },
    }),
    baseURLFunc: ({ subdomain }) => baseUrl(subdomain),
    credValidateFunc: validateCredentials,
  })
)
