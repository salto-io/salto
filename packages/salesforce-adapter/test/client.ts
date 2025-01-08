/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Values } from '@salto-io/adapter-api'
import { MockInterface } from '@salto-io/test-utils'
import Connection from '../src/client/jsforce'
import SalesforceClient from '../src/client/client'
import { mockJsforce } from './connection'
import { MAX_TOTAL_CONCURRENT_API_REQUEST, RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS } from '../src/constants'

const mockClient = (values?: Values): { connection: MockInterface<Connection>; client: SalesforceClient } => {
  const connection = mockJsforce()
  const client = new SalesforceClient({
    credentials: {
      username: 'mockUser',
      password: 'mockPassword',
      isSandbox: false,
    },
    connection,
    config: {
      maxConcurrentApiRequests: {
        total: MAX_TOTAL_CONCURRENT_API_REQUEST,
        retrieve: 3,
        read: RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
        list: RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
        query: 4,
        describe: RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
        deploy: RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
      },
      dataRetry: {
        maxAttempts: 3,
        retryDelay: 100,
        retryDelayMultiplier: 1.2,
        retryableFailures: ['err1', 'err2'],
      },
      ...(values ?? {}),
    },
  })

  return { connection, client }
}

export default mockClient
