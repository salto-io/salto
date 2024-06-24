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
import defaultOpts from '../../functions/default_opts'
import { validators } from '../../validators'
import { RetryStrategy } from '../strategy'

export type ExponentialBackoffOpts = {
  initial: number
  multiplier: number
  max: number
  randomizationFactor: number
  maxElapsed?: number
}

const randomInRange = (minInclusive: number, maxInclusive: number): number =>
  Math.floor(minInclusive + Math.random() * (maxInclusive - minInclusive + 1))

export default defaultOpts(
  (opts: ExponentialBackoffOpts): RetryStrategy => {
    let interval = opts.initial
    const cutoffTime = opts.maxElapsed && Date.now() + opts.maxElapsed

    return () => {
      if (cutoffTime !== undefined && Date.now() >= cutoffTime) {
        return `max elapsed time ${opts.maxElapsed} exceeded`
      }
      const delta = opts.randomizationFactor * interval
      const minInterval = interval - delta
      const maxInterval = interval + delta
      const result = randomInRange(minInterval, maxInterval)
      interval = interval >= opts.max / opts.multiplier ? opts.max : interval * opts.multiplier
      return result
    }
  },
  {
    initial: 250,
    multiplier: 1.5,
    max: 30000,
    randomizationFactor: 0.5,
    maxElapsed: 90000,
  },
  {
    initial: validators.greaterThan(0),
    multiplier: validators.greaterOrEqualThan(1),
    randomizationFactor: validators.inRangeInclusive()([0, 1]),
    max: validators.greaterOrEqualThan(o => o.initial),
    maxElapsed: validators.undefinedOr(validators.greaterThan(0)),
  },
)
