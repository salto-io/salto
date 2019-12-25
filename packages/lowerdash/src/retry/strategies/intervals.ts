import defaultOpts from '../../functions/default_opts'
import { RetryStrategy } from '../strategy'
import { validators } from '../../validators'

export type IntervalsRetryOpts = {
  maxRetries: number
  interval: number
}

export default defaultOpts((opts: IntervalsRetryOpts): RetryStrategy => {
  let retryNumber = 0

  return () => {
    retryNumber += 1
    return retryNumber > opts.maxRetries
      ? `max retries ${opts.maxRetries} exceeded`
      : opts.interval
  }
}, {
  maxRetries: 50,
  interval: 250,
}, {
  maxRetries: validators.greaterThan(0),
  interval: validators.greaterThan(0),
})
