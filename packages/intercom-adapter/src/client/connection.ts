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
import _ from 'lodash'
import { Credentials } from '../auth'

const log = logger(module)

const validateCredentials = async ({ connection }: { connection: clientUtils.APIConnection }): Promise<AccountInfo> => {
  try {
    const response = await connection.get('/me')
    const accountId = _.get(response.data, 'app.id_code')
    if (accountId === undefined) {
      throw new Error(`Failed to fetch account id from response, status: ${response.status} body: ${response.data}`)
    }
    return { accountId }
  } catch (e) {
    log.error('Failed to validate credentials: %s', e)
    throw new clientUtils.UnauthorizedError(e)
  }
}

export const createConnection: clientUtils.ConnectionCreator<Credentials> = retryOptions =>
  clientUtils.axiosConnection({
    retryOptions,
    baseURLFunc: async () => 'https://api.intercom.io',
    authParamsFunc: async ({ accessToken }: Credentials) => ({
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }),
    credValidateFunc: validateCredentials,
  })
