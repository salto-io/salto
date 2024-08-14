/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Resolvable, makeResolvablePromise } from '@salto-io/test-utils'
import { createRateLimitersFromConfig, throttle, RateLimitBuckets, RateLimiter } from '../../src/client'

type MyRateLimitConfig = {
  total: number
  a: number
  b: number
  c: number
  d: number
}

class A {
  readonly rateLimiters: RateLimitBuckets<MyRateLimitConfig>
  constructor(limits: MyRateLimitConfig) {
    this.rateLimiters = createRateLimitersFromConfig({
      rateLimit: limits,
      clientName: 'abc',
    })
  }

  // eslint-disable-next-line class-methods-use-this
  @throttle<MyRateLimitConfig>({})
  async runSomething(promise: Promise<number>): Promise<void> {
    await promise
  }

  // eslint-disable-next-line class-methods-use-this
  @throttle<MyRateLimitConfig>({ bucketName: 'a' })
  async runA(promise: Promise<number>): Promise<void> {
    await promise
  }

  // eslint-disable-next-line class-methods-use-this
  @throttle<MyRateLimitConfig>({ bucketName: 'b' })
  async runB(promise: Promise<number>): Promise<void> {
    await promise
  }
}

const RATE_LIMITER_UPDATE_DELAY = 100

const isCurrentLimitEqual = async (rateLimiter: RateLimiter, limit: number | undefined): Promise<boolean> =>
  rateLimiter.options.maxConcurrentCalls === limit

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
    const ZERO_COUNTERS = { total: 0, pending: 0, running: 0, done: 0, failed: 0, succeeded: 0, retries: 0 }
    it('should throttle when bucket is limited', async () => {
      const resolvables: Resolvable<number>[] = []
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      a1.runB(addPromise(resolvables))
      // wait for the rate limiters to update
      await new Promise(resolve => setTimeout(resolve, RATE_LIMITER_UPDATE_DELAY))
      expect(a1.rateLimiters.b.counters).toEqual({ ...ZERO_COUNTERS, total: 1, running: 1 })
      expect(a1.rateLimiters.total.counters).toEqual({ ...ZERO_COUNTERS, total: 1, running: 1 })

      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      a1.runB(addPromise(resolvables))
      await new Promise(resolve => setTimeout(resolve, RATE_LIMITER_UPDATE_DELAY))
      expect(a1.rateLimiters.b.counters).toEqual({ ...ZERO_COUNTERS, total: 2, running: 2 })
      expect(a1.rateLimiters.total.counters).toEqual({ ...ZERO_COUNTERS, total: 2, running: 2 })

      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      a1.runB(addPromise(resolvables))
      await new Promise(resolve => setTimeout(resolve, RATE_LIMITER_UPDATE_DELAY))
      expect(a1.rateLimiters.b.counters).toEqual({ ...ZERO_COUNTERS, total: 3, pending: 1, running: 2 })
      expect(a1.rateLimiters.total.counters).toEqual({ ...ZERO_COUNTERS, total: 2, running: 2 })

      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      a1.runSomething(addPromise(resolvables))
      await new Promise(resolve => setTimeout(resolve, RATE_LIMITER_UPDATE_DELAY))
      expect(a1.rateLimiters.b.counters).toEqual({ ...ZERO_COUNTERS, total: 3, pending: 1, running: 2 })
      expect(a1.rateLimiters.total.counters).toEqual({ ...ZERO_COUNTERS, total: 3, running: 3 })

      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      a1.runSomething(addPromise(resolvables))
      await new Promise(resolve => setTimeout(resolve, RATE_LIMITER_UPDATE_DELAY))
      expect(a1.rateLimiters.b.counters).toEqual({ ...ZERO_COUNTERS, total: 3, pending: 1, running: 2 })
      expect(a1.rateLimiters.total.counters).toEqual({ ...ZERO_COUNTERS, total: 4, pending: 1, running: 3 })

      resolvables[0].resolve()
      // wait for the rate limiters to update
      await new Promise(resolve => setTimeout(resolve, RATE_LIMITER_UPDATE_DELAY))
      expect(a1.rateLimiters.b.counters).toEqual({ ...ZERO_COUNTERS, total: 3, running: 2, done: 1, succeeded: 1 })
      expect(a1.rateLimiters.total.counters).toEqual({
        ...ZERO_COUNTERS,
        total: 5,
        pending: 1,
        running: 3,
        done: 1,
        succeeded: 1,
      })

      resolvables[1].resolve()
      await new Promise(resolve => setTimeout(resolve, RATE_LIMITER_UPDATE_DELAY))
      expect(a1.rateLimiters.b.counters).toEqual({ ...ZERO_COUNTERS, total: 3, running: 1, done: 2, succeeded: 2 })

      expect(a1.rateLimiters.total.counters).toEqual({ ...ZERO_COUNTERS, total: 5, running: 3, done: 2, succeeded: 2 })

      resolvables[3].resolve()
      await new Promise(resolve => setTimeout(resolve, RATE_LIMITER_UPDATE_DELAY))
      expect(a1.rateLimiters.b.counters).toEqual({ ...ZERO_COUNTERS, total: 3, running: 1, done: 2, succeeded: 2 })
      expect(a1.rateLimiters.total.counters).toEqual({ ...ZERO_COUNTERS, total: 5, running: 2, done: 3, succeeded: 3 })

      resolvables[4].resolve()
      await new Promise(resolve => setTimeout(resolve, RATE_LIMITER_UPDATE_DELAY))
      expect(a1.rateLimiters.b.counters).toEqual({ ...ZERO_COUNTERS, total: 3, running: 1, done: 2, succeeded: 2 })
      expect(a1.rateLimiters.total.counters).toEqual({ ...ZERO_COUNTERS, total: 5, running: 1, done: 4, succeeded: 4 })

      resolvables[2].resolve()
      await new Promise(resolve => setTimeout(resolve, RATE_LIMITER_UPDATE_DELAY))
      expect(a1.rateLimiters.b.counters).toEqual({ ...ZERO_COUNTERS, total: 3, done: 3, succeeded: 3 })
      expect(a1.rateLimiters.total.counters).toEqual({ ...ZERO_COUNTERS, total: 5, done: 5, succeeded: 5 })
    })
  })
})
