import { RetryStrategy } from '../../../src/retry/strategies'
import none from '../../../src/retry/strategies/none'

describe('intervals', () => {
  let subject: RetryStrategy

  const times = <T>(
    n: number, f: (i: number) => T
  ): T[] => Array.from({ length: n }).map((_, i) => f(i))

  describe('when no opts are specified', () => {
    beforeEach(() => {
      subject = none()
    })

    it('should return the correct results', () => {
      const expected = times<number | string>(10, () => 'no retry')
      expect(times(expected.length, () => subject())).toEqual(expected)
    })
  })
})
