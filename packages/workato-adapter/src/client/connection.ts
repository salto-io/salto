/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { AccountInfo, CredentialError } from '@salto-io/adapter-api'
import { client as clientUtils } from '@salto-io/adapter-components'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { Credentials } from '../auth'

const log = logger(module)

const DEFAULT_BASE_URL = 'https://www.workato.com'

export const validateCredentials = async ({
  connection,
}: {
  connection: clientUtils.APIConnection
}): Promise<AccountInfo> => {
  try {
    await connection.get('/users/me')
    // there is no good stable account id in workato, so we default to empty string
    return { accountId: '' }
  } catch (error) {
    log.error(
      'Failed to validate credentials, error: %s, stack: %s',
      safeJsonStringify({ data: error?.response?.data, status: error?.response?.status }),
      error.stack,
    )
    if (error.response?.status === 401) {
      throw new CredentialError('Invalid Credentials')
    }
    throw error
  }
}

export const createConnection: clientUtils.ConnectionCreator<Credentials> = (retryOptions, timeout) =>
  clientUtils.axiosConnection({
    retryOptions,
    authParamsFunc: async ({ username, token }: Credentials) => ({
      headers:
        username === undefined || _.isEmpty(username)
          ? {
              Authorization: `Bearer ${token}`,
            }
          : {
              'x-user-email': username,
              'x-user-token': token,
            },
    }),
    baseURLFunc: async ({ baseUrl }) => `${baseUrl ?? DEFAULT_BASE_URL}/api/`,
    credValidateFunc: validateCredentials,
    timeout,
  })
