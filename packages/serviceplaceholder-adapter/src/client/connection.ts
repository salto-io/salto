/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { AccountInfo } from '@salto-io/adapter-api'
import { client as clientUtils } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { Credentials } from '../auth'

const log = logger(module)

export const validateCredentials = async ({
  connection,
  credentials,
}: {
  credentials: Credentials
  connection: clientUtils.APIConnection
}): Promise<AccountInfo> => {
  try {
    // TODO replace with some valid endpoint, identify production accounts
    const res = await connection.get('/api/v2/account')
    const accountId = credentials.subdomain
    const isSandbox = _.get(res.data, 'account.sandbox')
    if (isSandbox !== undefined) {
      return { accountId, isProduction: !isSandbox }
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
    baseURLFunc: async () => 'https://localhost:80', // TODO replace with base URL, creds can be used
    authParamsFunc: async ({ username, password }: Credentials) => ({
      // TODO adjust / remove (usually only one of the following is needed)
      auth: { username, password },
      // headers: {
      //   Authorization: `Bearer ${token}`,
      //   'x-custom-header': `${token}`,
      // },
    }),
    credValidateFunc: validateCredentials,
  })
