/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Pool, Lease, LeaseUpdateOpts, InstanceNotLeasedError } from '../../src/types'
import RenewedLease from '../../src/lib/renewed_lease'
import { createMockPool } from '../mock_repo'

jest.useFakeTimers({ legacyFakeTimers: true })

describe('RenewedLease', () => {
  type MyType = { x: number }
  let pool: jest.Mocked<Pool<MyType>>
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
    it('when renew throws InstanceNotLeasedError should stop silently', () => {
      jest.clearAllMocks()
      const instanceNotLeasedError = new InstanceNotLeasedError({ id: '1', typeName: '1', clientId: '1' })
      pool.updateTimeout.mockRejectedValueOnce(instanceNotLeasedError)
      expect(setTimeout).not.toHaveBeenCalled()
    })
    // eslint-disable-next-line jest/no-disabled-tests
    it.skip('when renew throws unknown error should stop silently', () => {
      jest.clearAllMocks()
      const instanceNotLeasedError = new Error()
      pool.updateTimeout.mockRejectedValueOnce(instanceNotLeasedError)
      expect(setTimeout).not.toHaveBeenCalled()
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
