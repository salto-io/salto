/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { logger } from '@salto-io/logging'
import { AccountInfo, CredentialError } from '@salto-io/adapter-api'
import { client as clientUtils } from '@salto-io/adapter-components'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { Credentials } from '../auth'
import { EXPERIMENTAL_API_HEADERS, FORCE_ACCEPT_LANGUAGE_HEADERS } from './headers'
import { getProductSettings } from '../product_settings'

const log = logger(module)

const AUTHENTICATION_DENIED_HEADER = 'x-authentication-denied-reason'
const CAPTCHA_CHALLENGE = 'CAPTCHA_CHALLENGE'

type appInfo = {
  id: string
  plan: string
}

const isAuthorized = async (connection: clientUtils.APIConnection): Promise<boolean> => {
  try {
    await connection.get('/rest/api/3/configuration')
    return true
  } catch (e) {
    if (e.response?.status === 401) {
      return false
    }
    if (e.response?.status === 403 && e.response?.headers?.[AUTHENTICATION_DENIED_HEADER] !== undefined) {
      log.error(`Failed to authorize connection, denied reason is: ${e.response.headers[AUTHENTICATION_DENIED_HEADER]}`)
      if (e.response.headers[AUTHENTICATION_DENIED_HEADER].startsWith(CAPTCHA_CHALLENGE)) {
        throw new CredentialError('Captcha challenge')
      }
    }

    throw e
  }
}

const getBaseUrl = async (connection: clientUtils.APIConnection): Promise<string> => {
  const response = await connection.get('/rest/api/3/serverInfo')
  return response.data.baseUrl
}

/*
Based on the current implementation of the Jira API, we can't know if the account is a production
account, but in some cases we can know that it's not a production account.
*/
export const validateCredentials = async ({
  connection,
  credentials,
}: {
  connection: clientUtils.APIConnection
  credentials: Credentials
}): Promise<AccountInfo> => {
  const productSettings = getProductSettings({ isDataCenter: Boolean(credentials.isDataCenter) })
  const wrappedConnection = productSettings.wrapConnection(connection)
  if (await isAuthorized(wrappedConnection)) {
    const accountId = await getBaseUrl(wrappedConnection)
    if (accountId.includes('-sandbox-')) {
      return { accountId, isProduction: false, accountType: 'Sandbox' }
    }

    if (credentials.isDataCenter) {
      return { accountId }
    }
    const response = await wrappedConnection.get('/rest/api/3/instance/license')
    log.info(`Jira application's info: ${safeJsonStringify(response.data.applications)}`)
    const hasPaidApp = response.data.applications.some((app: appInfo) => app.plan === 'PAID')
    const isProduction = hasPaidApp ? undefined : false
    return { accountId, isProduction }
  }
  throw new CredentialError('Invalid Credentials')
}

export const createConnection: clientUtils.ConnectionCreator<Credentials> = (retryOptions, timeout) =>
  clientUtils.axiosConnection({
    retryOptions,
    authParamsFunc: async credentials => ({
      auth: {
        username: credentials.user,
        password: credentials.token,
      },
      headers: credentials.isDataCenter ? {} : { ...FORCE_ACCEPT_LANGUAGE_HEADERS, ...EXPERIMENTAL_API_HEADERS },
    }),
    baseURLFunc: async ({ baseUrl }) => baseUrl,
    credValidateFunc: validateCredentials,
    timeout,
  })

export const createLogoConnection: clientUtils.ConnectionCreator<Credentials> = (retryOptions, timeout) =>
  clientUtils.axiosConnection({
    retryOptions,
    authParamsFunc: async ({ token }) => ({
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Issuer': 'micros-group/jsm-cmdb',
      },
    }),
    baseURLFunc: async ({ baseUrl }) => baseUrl,
    credValidateFunc: async () => ({ accountId: '' }), // There is no login endpoint to call
    timeout,
  })
