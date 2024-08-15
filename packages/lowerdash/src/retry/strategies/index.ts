/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import _ from 'lodash'
import intervals from './intervals'
import exponentialBackoff from './exponential_backoff'
import none from './none'

export { RetryStrategy } from '../strategy'

const wrap =
  <TArgs extends unknown[], TReturn>(f: (...args: TArgs) => TReturn): ((...args: TArgs) => () => TReturn) =>
  (...args: TArgs) =>
  () =>
    f(...args)

const retryStrategies = { intervals, exponentialBackoff, none }

type RetryStrategies = typeof retryStrategies
type WrappedStrategies = {
  [P in keyof RetryStrategies]: (...args: Parameters<RetryStrategies[P]>) => () => ReturnType<RetryStrategies[P]>
}

const wrappedStrategies: WrappedStrategies = _.mapValues(retryStrategies, v => wrap(v))

export default wrappedStrategies
