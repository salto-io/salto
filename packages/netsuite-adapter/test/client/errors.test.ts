/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { retryOnRetryableError, RetryableError } from '../../src/client/suiteapp_client/errors'

describe('suiteapp errors', () => {
  describe('retryOnRetryableError', () => {
    it('should return result without retry', async () => {
      const call = jest.fn(() => 'true')
      expect(await retryOnRetryableError(async () => call())).toEqual('true')
      expect(call).toHaveBeenCalledTimes(1)
    })
    it('should return result with retry', async () => {
      let retries = 2
      const call = jest.fn(() => {
        if (retries > 0) {
          retries -= 1
          throw new RetryableError(new Error('some error'))
        }
        return 'true'
      })
      expect(await retryOnRetryableError(async () => call())).toEqual('true')
      expect(call).toHaveBeenCalledTimes(3)
    })
    it('should throw after max retries', async () => {
      const error = new Error('some error')
      const call = jest.fn(() => {
        throw new RetryableError(error)
      })
      await expect(() => retryOnRetryableError(async () => call())).rejects.toThrow(error)
    })
    it('should throw on non-retryable error', async () => {
      const error = new Error('some error')
      const call = jest.fn(() => {
        throw error
      })
      await expect(() => retryOnRetryableError(async () => call())).rejects.toThrow(error)
    })
  })
})
