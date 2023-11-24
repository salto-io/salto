/*
*                      Copyright 2023 Salto Labs Ltd.
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
import Bottleneck from 'bottleneck'
import { Resolvable, makeResolvablePromise } from '@salto-io/test-utils'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { createRateLimitersFromConfig, throttle, BottleneckBuckets } from '../../src/client'

type MyRateLimitConfig = {
  total: number
  a: number
  b: number
  c: number
  d: number
}

class A {
  readonly rateLimiters: BottleneckBuckets<MyRateLimitConfig>
  constructor(limits: MyRateLimitConfig) {
    this.rateLimiters = createRateLimitersFromConfig({
      rateLimit: limits,
      clientName: 'abc',
    })
  }

  @throttle<MyRateLimitConfig>({})
  // eslint-disable-next-line class-methods-use-this
  async runSomething(promise: Promise<number>): Promise<void> {
    await promise
  }

  @throttle<MyRateLimitConfig>({ bucketName: 'a' })
  // eslint-disable-next-line class-methods-use-this
  async runA(promise: Promise<number>): Promise<void> {
    await promise
  }

  @throttle<MyRateLimitConfig>({ bucketName: 'b' })
  // eslint-disable-next-line class-methods-use-this
  async runB(promise: Promise<number>): Promise<void> {
    await promise
  }
}

const RATE_LIMITER_UPDATE_DELAY = 100

const isCurrentLimitEqual = async (b: Bottleneck, limit: number | undefined): Promise<boolean> => {
  // all the numbers we use are lower
  if (limit === undefined) {
    return b.check(100)
  }
  if (limit === 0) {
    return !(await b.check(1))
  }
  return (await b.check(limit) && !(await b.check(limit + 1)))
}

describe('client_rate_limit', () => {
  let a1: A
  let a2: A
  beforeAll(() => {
    a1 = new A({ total: 3, a: -1, b: 2, c: 0, d: -33 })
    a2 = new A({ total: -1, a: 1, b: 2, c: 3, d: -1 })
  })
  describe('createRateLimitersFromConfig', () => {
    it('should initialize the relevant rate limiters', async () => {
      expect(new Set(Object.keys(a1.rateLimiters))).toEqual(new Set(['total', 'a', 'b', 'c', 'd']))
    })
    it('should limit to provided value when the value is positive', async () => {
      expect(isCurrentLimitEqual(a1.rateLimiters.total, 5)).toBeTruthy()
      expect(isCurrentLimitEqual(a1.rateLimiters.b, 2)).toBeTruthy()
    })
    it('should initialize to unlimited if value is non-positive', async () => {
      expect(isCurrentLimitEqual(a1.rateLimiters.a, undefined)).toBeTruthy()
      expect(isCurrentLimitEqual(a1.rateLimiters.c, undefined)).toBeTruthy()
      expect(isCurrentLimitEqual(a1.rateLimiters.d, undefined)).toBeTruthy()
    })
    it('should use separate buckets for separate instances', async () => {
      expect(isCurrentLimitEqual(a2.rateLimiters.total, undefined)).toBeTruthy()
      expect(isCurrentLimitEqual(a2.rateLimiters.a, 1)).toBeTruthy()
    })
  })

  describe('throttle', () => {
    const addPromise = (resolvables: Resolvable<number>[]): Promise<number> => {
      const p = makeResolvablePromise(3)
      resolvables.push(p)
      return p.promise
    }
    it('should throttle when bucket is limited', async () => {
      const resolvables: Resolvable<number>[] = []
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      a1.runB(addPromise(resolvables))
      // wait for the rate limiters to update
      await new Promise(resolve => setTimeout(resolve, RATE_LIMITER_UPDATE_DELAY))
      expect(await a1.rateLimiters.b.running()).toEqual(1)
      expect(a1.rateLimiters.b.queued()).toEqual(0)
      expect(await a1.rateLimiters.b.done()).toEqual(0)
      expect(await a1.rateLimiters.total.running()).toEqual(1)
      expect(a1.rateLimiters.total.queued()).toEqual(0)
      expect(await a1.rateLimiters.total.done()).toEqual(0)

      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      a1.runB(addPromise(resolvables))
      await new Promise(resolve => setTimeout(resolve, RATE_LIMITER_UPDATE_DELAY))
      expect(await a1.rateLimiters.b.running()).toEqual(2)
      expect(a1.rateLimiters.b.queued()).toEqual(0)
      expect(await a1.rateLimiters.b.done()).toEqual(0)
      expect(await a1.rateLimiters.total.running()).toEqual(2)
      expect(a1.rateLimiters.total.queued()).toEqual(0)
      expect(await a1.rateLimiters.total.done()).toEqual(0)

      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      a1.runB(addPromise(resolvables))
      await new Promise(resolve => setTimeout(resolve, RATE_LIMITER_UPDATE_DELAY))
      expect(await a1.rateLimiters.b.running()).toEqual(2)
      expect(a1.rateLimiters.b.queued()).toEqual(1)
      expect(await a1.rateLimiters.b.done()).toEqual(0)
      expect(await a1.rateLimiters.total.running()).toEqual(2)
      expect(a1.rateLimiters.total.queued()).toEqual(0)
      expect(await a1.rateLimiters.total.done()).toEqual(0)

      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      a1.runSomething(addPromise(resolvables))
      await new Promise(resolve => setTimeout(resolve, RATE_LIMITER_UPDATE_DELAY))
      expect(await a1.rateLimiters.b.running()).toEqual(2)
      expect(a1.rateLimiters.b.queued()).toEqual(1)
      expect(await a1.rateLimiters.b.done()).toEqual(0)
      expect(await a1.rateLimiters.total.running()).toEqual(3)
      expect(a1.rateLimiters.total.queued()).toEqual(0)
      expect(await a1.rateLimiters.total.done()).toEqual(0)

      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      a1.runSomething(addPromise(resolvables))
      await new Promise(resolve => setTimeout(resolve, RATE_LIMITER_UPDATE_DELAY))
      expect(await a1.rateLimiters.b.running()).toEqual(2)
      expect(a1.rateLimiters.b.queued()).toEqual(1)
      expect(await a1.rateLimiters.b.done()).toEqual(0)
      expect(await a1.rateLimiters.total.running()).toEqual(3)
      expect(a1.rateLimiters.total.queued()).toEqual(1)
      expect(await a1.rateLimiters.total.done()).toEqual(0)

      resolvables[0].resolve()
      // wait for the rate limiters to update
      await new Promise(resolve => setTimeout(resolve, RATE_LIMITER_UPDATE_DELAY))
      expect(await a1.rateLimiters.b.running()).toEqual(2)
      expect(a1.rateLimiters.b.queued()).toEqual(0)
      expect(await a1.rateLimiters.b.done()).toEqual(1)
      expect(await a1.rateLimiters.total.running()).toEqual(3)
      expect(a1.rateLimiters.total.queued()).toEqual(1)
      expect(await a1.rateLimiters.total.done()).toEqual(1)

      resolvables[1].resolve()
      await new Promise(resolve => setTimeout(resolve, RATE_LIMITER_UPDATE_DELAY))
      expect(await a1.rateLimiters.b.running()).toEqual(1)
      expect(a1.rateLimiters.b.queued()).toEqual(0)
      expect(await a1.rateLimiters.b.done()).toEqual(2)
      expect(await a1.rateLimiters.total.running()).toEqual(3)
      expect(a1.rateLimiters.total.queued()).toEqual(0)
      expect(await a1.rateLimiters.total.done()).toEqual(2)

      resolvables[3].resolve()
      await new Promise(resolve => setTimeout(resolve, RATE_LIMITER_UPDATE_DELAY))
      expect(await a1.rateLimiters.b.running()).toEqual(1)
      expect(a1.rateLimiters.b.queued()).toEqual(0)
      expect(await a1.rateLimiters.b.done()).toEqual(2)
      expect(await a1.rateLimiters.total.running()).toEqual(2)
      expect(a1.rateLimiters.total.queued()).toEqual(0)
      expect(await a1.rateLimiters.total.done()).toEqual(3)

      resolvables[4].resolve()
      await new Promise(resolve => setTimeout(resolve, RATE_LIMITER_UPDATE_DELAY))
      expect(await a1.rateLimiters.b.running()).toEqual(1)
      expect(a1.rateLimiters.b.queued()).toEqual(0)
      expect(await a1.rateLimiters.b.done()).toEqual(2)
      expect(await a1.rateLimiters.total.running()).toEqual(1)
      expect(a1.rateLimiters.total.queued()).toEqual(0)
      expect(await a1.rateLimiters.total.done()).toEqual(4)

      resolvables[2].resolve()
      await new Promise(resolve => setTimeout(resolve, RATE_LIMITER_UPDATE_DELAY))
      expect(await a1.rateLimiters.b.running()).toEqual(0)
      expect(a1.rateLimiters.b.queued()).toEqual(0)
      expect(await a1.rateLimiters.b.done()).toEqual(3)
      expect(await a1.rateLimiters.total.running()).toEqual(0)
      expect(a1.rateLimiters.total.queued()).toEqual(0)
      expect(await a1.rateLimiters.total.done()).toEqual(5)
    })
  })
})
