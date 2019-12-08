import { RetryStrategy } from '../../../src/retry/strategies'
import intervals from '../../../src/retry/strategies/intervals'

describe('intervals', () => {
  let subject: RetryStrategy

  const times = <T>(
    n: number, f: (i: number) => T
  ): T[] => Array.from({ length: n }).map((_, i) => f(i))

  describe('when no opts are specified', () => {
    beforeEach(() => {
      subject = intervals()
    })

    it('should return the correct results', () => {
      const expected = times<number | string>(50, () => 250)
        .concat(times(2, () => 'max retries 50 exceeded'))
      expect(times(expected.length, () => subject())).toEqual(expected)
    })
  })

  describe('when opts are specified', () => {
    beforeEach(() => {
      subject = intervals({ maxRetries: 10, interval: 12 })
    })

    it('should return the correct results', () => {
      const expected = times<number | string>(10, () => 12)
        .concat(times(2, () => 'max retries 10 exceeded'))
      expect(times(expected.length, () => subject())).toEqual(expected)
    })
  })
})
