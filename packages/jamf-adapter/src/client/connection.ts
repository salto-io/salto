/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { AccountInfo } from '@salto-io/adapter-api'
import { client as clientUtils, auth as authUtils } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { Credentials } from '../auth'

const log = logger(module)

export const VALIDATE_CREDENTIALS_URL = '/JSSResource/classes'

const validateCredentials = async ({
  connection,
  credentials,
}: {
  credentials: Credentials
  connection: clientUtils.APIConnection
}): Promise<AccountInfo> => {
  try {
    await connection.get(VALIDATE_CREDENTIALS_URL)
    // TODO SALTO-6138 support isProduction
    const accountId = credentials.baseUrl
    return { accountId }
  } catch (e) {
    log.error('Failed to validate credentials: %s', e)
    throw new clientUtils.UnauthorizedError(e)
  }
}

export const createConnection: clientUtils.ConnectionCreator<Credentials> = retryOptions =>
  clientUtils.axiosConnection({
    retryOptions,
    baseURLFunc: async ({ baseUrl }) => baseUrl,
    authParamsFunc: ({ baseUrl: baseURL, clientId, clientSecret }) =>
      authUtils.oauthClientCredentialsBearerToken({
        endpoint: '/api/oauth/token',
        baseURL,
        clientId,
        clientSecret,
        retryOptions: {},
      }),
    credValidateFunc: validateCredentials,
  })
