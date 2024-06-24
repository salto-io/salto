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
import { RetryStrategy } from '../../../src/retry/strategies'
import intervals from '../../../src/retry/strategies/intervals'

describe('intervals', () => {
  let subject: RetryStrategy

  const times = <T>(n: number, f: (i: number) => T): T[] => Array.from({ length: n }).map((_, i) => f(i))

  describe('when no opts are specified', () => {
    beforeEach(() => {
      subject = intervals()
    })

    it('should return the correct results', () => {
      const expected = times<number | string>(50, () => 250).concat(times(2, () => 'max retries 50 exceeded'))
      expect(times(expected.length, () => subject())).toEqual(expected)
    })
  })

  describe('when opts are specified', () => {
    beforeEach(() => {
      subject = intervals({ maxRetries: 10, interval: 12 })
    })

    it('should return the correct results', () => {
      const expected = times<number | string>(10, () => 12).concat(times(2, () => 'max retries 10 exceeded'))
      expect(times(expected.length, () => subject())).toEqual(expected)
    })
  })
})
