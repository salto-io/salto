/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { logger } from '@salto-io/logging'
import * as AWS from '@aws-sdk/client-s3'
import { StandardRetryStrategy, defaultRetryDecider, RetryDecider } from '@aws-sdk/middleware-retry'

const log = logger(module)

const NUMBER_OF_RETRIES = 5

export const retryDecider: RetryDecider = error => {
  if (defaultRetryDecider(error) || (error as { code?: string })?.code === 'ECONNREFUSED') {
    log.warn(`S3 operation failed: ${error.message}. Retrying`)
    return true
  }
  return false
}

export const createS3Client = (numberOfRetries = NUMBER_OF_RETRIES): AWS.S3 =>
  new AWS.S3({
    ...(process.env.AWS_ENDPOINT_URL === undefined
      ? {}
      : { endpoint: process.env.AWS_ENDPOINT_URL, forcePathStyle: true }),
    retryStrategy: new StandardRetryStrategy(() => Promise.resolve(numberOfRetries), { retryDecider }),
  })
