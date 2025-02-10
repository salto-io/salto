/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { AccountInfo } from '@salto-io/adapter-api'
import { auth as authUtils, client as clientUtils } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { Credentials } from '../auth'

const log = logger(module)

const { oauthClientCredentialsBearerToken } = authUtils

const validateCredentials = async ({ connection }: { connection: clientUtils.APIConnection }): Promise<AccountInfo> => {
  // oauth was already authenticated when the connection was created, but validating just in case
  try {
    const res = await connection.post('/v1/connections', {})
    if (res.status !== 200 || !res.data.success) {
      throw new clientUtils.UnauthorizedError('Authentication failed')
    }
  } catch (e) {
    log.error('Failed to validate credentials: %s', e)
    throw new clientUtils.UnauthorizedError(e)
  }

  // default to empty to avoid preventing users from refreshing their credentials in the SaaS.
  return { accountId: '' }
}

export const createConnection: clientUtils.ConnectionCreator<Credentials> = (retryOptions, timeout) =>
  clientUtils.axiosConnection({
    retryOptions,
    authParamsFunc: async (creds: Credentials) =>
      oauthClientCredentialsBearerToken({
        ...creds,
        retryOptions,
      }),
    baseURLFunc: async ({ baseURL }) => baseURL,
    credValidateFunc: validateCredentials,
    timeout,
  })
