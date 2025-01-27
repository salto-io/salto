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

const validateCredentials = async ({
  connection,
  credentials,
}: {
  connection: clientUtils.APIConnection
  credentials: Credentials
}): Promise<AccountInfo> => {
  try {
    await connection.get('/services')
    return { accountId: credentials.subdomain }
  } catch (e) {
    log.error('Failed to validate credentials: %s', e)
    throw new clientUtils.UnauthorizedError(e)
  }
}

export const createConnection: clientUtils.ConnectionCreator<Credentials> = retryOptions =>
  clientUtils.axiosConnection({
    retryOptions,
    baseURLFunc: async () => 'https://api.pagerduty.com',
    authParamsFunc: async ({ accessToken }: Credentials) => ({
      headers: {
        Authorization: `Token token=${accessToken}`,
      },
    }),
    credValidateFunc: validateCredentials,
  })
