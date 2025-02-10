/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { AccountInfo } from '@salto-io/adapter-api'
import { client as clientUtils } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { Credentials } from '../auth'

const log = logger(module)

const BASE_URL = 'https://api.stripe.com'

const validateCredentials = async ({ connection }: { connection: clientUtils.APIConnection }): Promise<AccountInfo> => {
  try {
    const res = await connection.get('/v1/products')
    if (res.status !== 200) {
      throw new clientUtils.UnauthorizedError('Authentication failed')
    }
  } catch (e) {
    log.error('Failed to validate credentials: %s', e)
    throw new clientUtils.UnauthorizedError(e)
  }
  return { accountId: '' }
}

export const createConnection: clientUtils.ConnectionCreator<Credentials> = (retryOptions, timeout) =>
  clientUtils.axiosConnection({
    retryOptions,
    authParamsFunc: async (creds: Credentials) => ({
      headers: {
        Authorization: `Bearer ${creds.token}`,
      },
    }),
    baseURLFunc: async () => BASE_URL,
    credValidateFunc: validateCredentials,
    timeout,
  })
