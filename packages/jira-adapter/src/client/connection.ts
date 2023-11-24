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
import { logger } from '@salto-io/logging'
import { AccountInfo, CredentialError } from '@salto-io/adapter-api'
import { client as clientUtils } from '@salto-io/adapter-components'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { AxiosError } from 'axios'
import { Credentials } from '../auth'
import { EXPERIMENTAL_API_HEADERS, FORCE_ACCEPT_LANGUAGE_HEADERS } from './headers'

const log = logger(module)

type appInfo = {
  id: string
  plan: string
}

const isAuthorized = async (
  connection: clientUtils.APIConnection,
): Promise<boolean> => {
  try {
    await connection.get('/rest/api/3/configuration')
    return true
  } catch (e) {
    if ((e as AxiosError).response?.status === 401) {
      return false
    }
    throw e
  }
}

const getBaseUrl = async (
  connection: clientUtils.APIConnection,
): Promise<string> => {
  const response = await connection.get('/rest/api/3/serverInfo')
  return response.data.baseUrl
}

/*
Based on the current implementation of the Jira API, we can't know if the account is a production
account, but in some cases we can know that it's not a production account.
*/
export const validateCredentials = async (
  { connection, isDataCenter }: { connection: clientUtils.APIConnection; isDataCenter: boolean },
): Promise<AccountInfo> => {
  if (await isAuthorized(connection)) {
    const accountId = await getBaseUrl(connection)
    if (accountId.includes('-sandbox-')) {
      return { accountId, isProduction: false, accountType: 'Sandbox' }
    }

    if (isDataCenter) {
      return { accountId }
    }
    const response = await connection.get('/rest/api/3/instance/license')
    log.info(`Jira application's info: ${safeJsonStringify(response.data.applications)}`)
    const hasPaidApp = response.data.applications.some((app: appInfo) => app.plan === 'PAID')
    const isProduction = hasPaidApp ? undefined : false
    return { accountId, isProduction }
  }
  throw new CredentialError('Invalid Credentials')
}

export const createConnection: clientUtils.ConnectionCreator<Credentials> = retryOptions => (
  clientUtils.axiosConnection({
    retryOptions,
    authParamsFunc: async credentials => (
      {
        auth: {
          username: credentials.user,
          password: credentials.token,
        },
        headers: credentials.isDataCenter ? {} : { ...FORCE_ACCEPT_LANGUAGE_HEADERS, ...EXPERIMENTAL_API_HEADERS },
      }
    ),
    baseURLFunc: async ({ baseUrl }) => baseUrl,
    credValidateFunc: async () => ({ accountId: '' }), // There is no login endpoint to call
  })
)
