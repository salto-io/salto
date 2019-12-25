import withRetry, { RetryError } from '../../src/retry/with_retry'
import retryStrategies from '../../src/retry/strategies'

jest.mock('../../src/retry/strategies', () => ({
  intervals: jest.fn(() => () => () => 'testing'),
}))

describe('withRetry', () => {
  describe('when the predicate first returns false', () => {
    let predicate: jest.Mock<Promise<string | false>>

    beforeEach(async () => {
      predicate = jest.fn(() => Promise.resolve(predicate.mock.calls.length > 2 ? 'ok' : false))
    })

    describe('when waitStrategy returns an error', () => {
      let result: Promise<unknown>

      beforeEach(() => {
        result = withRetry(() => Promise.resolve(false), {
          strategy: () => () => 'testing error',
          description: 'my action',
        })
      })

      it(
        'should throw WaitError',
        () => expect(result).rejects.toThrow(RetryError)
      )

      it(
        'should include the strategy\'s error message in the thrown error',
        () => expect(result).rejects.toThrow(/my action\b.*\btesting error/)
      )
    })

    describe('when waitStrategy returns a number', () => {
      let result: string | false
      let setTimeout: jest.SpyInstance

      beforeEach(async () => {
        setTimeout = jest.spyOn(global, 'setTimeout')
        result = await withRetry(predicate, {
          strategy: () => () => 3,
        })
      })

      it('should wait for the returned interval', () => {
        expect(setTimeout).toHaveBeenCalled()
        expect(setTimeout.mock.calls[0][1]).toEqual(3)
      })

      it('should call the predicate again', () => {
        expect(predicate).toHaveBeenCalledTimes(3)
      })

      it('should return the predicate\'s value', () => {
        expect(result).toEqual('ok')
      })
    })
  })

  describe('when no opts specified', () => {
    let caught: Error

    beforeEach(async () => {
      try {
        await withRetry(() => Promise.resolve(false))
      } catch (e) {
        caught = e
      }
      expect(caught).toBeDefined()
    })

    it('uses retryStrategies.intervals', () => {
      expect(retryStrategies.intervals).toHaveBeenCalled()
    })

    it('uses an empty description', () => expect(caught.message).toMatch(
      /Error while waiting: testing/
    ))
  })
})
