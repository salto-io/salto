/*
 *                      Copyright 2024 Salto Labs Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
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
