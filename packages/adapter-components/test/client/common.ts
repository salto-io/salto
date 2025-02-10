/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { AccountInfo } from '@salto-io/adapter-api'
import { axiosConnection, ConnectionCreator, APIConnection } from '../../src/client/http_connection'

export type Credentials = { username: string; password: string }

export const BASE_URL = 'http://localhost:1234/api/v1'

const validateCredentials = async ({
  credentials,
  connection,
}: {
  credentials: Credentials
  connection: APIConnection
}): Promise<AccountInfo> => {
  const user = await connection.get('/users/me')
  return {
    accountId: `${user.data.accountId}:${credentials.username}`,
    accountType: 'Sandbox',
    isProduction: false,
  }
}

export const createConnection: ConnectionCreator<Credentials> = (retryOptions, timeout) =>
  axiosConnection({
    retryOptions,
    authParamsFunc: async ({ username, password }: Credentials) => ({
      headers: {
        customHeader1: username,
      },
      auth: {
        username,
        password,
      },
    }),
    baseURLFunc: async () => BASE_URL,
    credValidateFunc: validateCredentials,
    timeout,
  })
