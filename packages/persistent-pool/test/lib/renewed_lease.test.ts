import { RenewedLease, Pool, Lease, LeaseUpdateOpts } from '../../src/index'
import { MockObj, createMockPool } from '../mock_repo'

jest.useFakeTimers()

describe('RenewedLease', () => {
  type MyType = { x: number }
  let pool: MockObj<Pool<MyType>>
  const lease: Lease<MyType> = { id: 'my-id', value: { x: 42 } }
  const timeout = 100
  const renewMargin = 5
  let renewedLease: RenewedLease<MyType>

  beforeEach(() => {
    pool = createMockPool()
  })

  describe('constructor', () => {
    beforeEach(() => {
      jest.clearAllMocks()
    })

    beforeEach(() => {
      renewedLease = new RenewedLease({
        poolOrFactory: pool,
        lease,
        timeout,
        renewMargin,
      })
    })

    it('has the Lease properties', () => {
      expect(renewedLease).toMatchObject(lease)
    })

    it('sets a renew timeout', () => {
      expect(setTimeout).toHaveBeenLastCalledWith(expect.any(Function), 95)
    })

    describe('renew timeout', () => {
      beforeEach(() => {
        jest.clearAllMocks()
        jest.advanceTimersByTime(95)
      })

      it('calls pool.updateTimeout correctly', () => {
        expect(pool.updateTimeout).toHaveBeenLastCalledWith(lease.id, 100)
      })

      it('sets another renew timeout', () => {
        expect(setTimeout).toHaveBeenLastCalledWith(expect.any(Function), 95)
      })

      describe('another renew timeout', () => {
        beforeEach(() => {
          jest.clearAllMocks()
          jest.advanceTimersByTime(95)
        })

        it('calls pool.updateTimeout correctly', () => {
          expect(pool.updateTimeout).toHaveBeenLastCalledWith(lease.id, 100)
        })

        it('sets another renew timeout', () => {
          expect(setTimeout).toHaveBeenLastCalledWith(expect.any(Function), 95)
        })

        describe('when calling return', () => {
          const opts: LeaseUpdateOpts = { validateClientId: false }
          beforeEach(async () => {
            jest.clearAllMocks()
            await renewedLease.return(opts)
          })

          it('calls pool.return correctly', () => {
            expect(pool.return).toHaveBeenCalledWith('my-id', opts)
          })

          it('clears the renew timeout', () => {
            expect(clearTimeout).toHaveBeenCalled()
          })

          describe('once another renew time had passed', () => {
            beforeEach(() => {
              jest.advanceTimersByTime(timeout * 10)
            })

            it('does not call pool.updateTimeout', () => {
              expect(pool.updateTimeout).not.toHaveBeenCalled()
            })
          })

          describe('when calling return again', () => {
            beforeEach(async () => {
              jest.clearAllMocks()
              await renewedLease.return(opts)
            })

            it('does not clear the renew timeout again', () => {
              expect(clearTimeout).not.toHaveBeenCalled()
            })
          })
        })
      })
    })
  })

  describe('poolOrFactory', () => {
    describe('when it is a factory Pool', () => {
      beforeEach(() => {
        renewedLease = new RenewedLease({
          poolOrFactory: () => Promise.resolve(pool),
          lease,
          timeout,
          renewMargin,
        })

        jest.clearAllMocks()
        jest.advanceTimersByTime(95)
      })

      it('calls pool.updateTimeout correctly', () => {
        expect(pool.updateTimeout).toHaveBeenLastCalledWith(lease.id, 100)
      })
    })
  })
})
