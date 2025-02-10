/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import defaultOpts from '../../functions/default_opts'
import { RetryStrategy } from '../strategy'
import { validators } from '../../validators'

type IntervalsRetryOpts = {
  maxRetries: number
  interval: number
}

export default defaultOpts(
  (opts: IntervalsRetryOpts): RetryStrategy => {
    let retryNumber = 0

    return () => {
      retryNumber += 1
      return retryNumber > opts.maxRetries ? `max retries ${opts.maxRetries} exceeded` : opts.interval
    }
  },
  {
    maxRetries: 50,
    interval: 250,
  },
  {
    maxRetries: validators.greaterThan(0),
    interval: validators.greaterThan(0),
  },
)
