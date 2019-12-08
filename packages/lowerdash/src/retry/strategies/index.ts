import _ from 'lodash'
import intervals from './intervals'
import exponentialBackoff from './exponential_backoff'
import none from './none'

export { RetryStrategy } from '../strategy'

const wrap = <TArgs extends unknown[], TReturn> (
  f: (...args: TArgs) => TReturn,
): (...args: TArgs) => () => TReturn => (...args: TArgs) => () => f(...args)

const retryStrategies = { intervals, exponentialBackoff, none }

type RetryStrategies = typeof retryStrategies
type WrappedStrategies = {
  [P in keyof RetryStrategies]: (
    ...args: Parameters<RetryStrategies[P]>
  ) => () => ReturnType<RetryStrategies[P]>
}

const wrappedStrategies: WrappedStrategies = _.mapValues(retryStrategies, v => wrap(v))

export default wrappedStrategies
