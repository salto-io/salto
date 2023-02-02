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
import axios, { AxiosError } from 'axios'
import MockAdapter from 'axios-mock-adapter'
import { RetryOptions } from '../../src/client/http_connection'
import { validateCredentials, axiosConnection, UnauthorizedError, createRetryOptions } from '../../src/client'
import { createConnection, BASE_URL } from './common'

describe('client_http_connection', () => {
  let mockAxiosAdapter: MockAdapter
  beforeEach(() => {
    mockAxiosAdapter = new MockAdapter(axios, { delayResponse: 1, onNoMatch: 'throwException' })
  })

  afterEach(() => {
    mockAxiosAdapter.restore()
  })

  describe('validateCredentials with axiosConnection', () => {
    it('should login', async () => {
      mockAxiosAdapter.onGet(
        '/users/me',
        undefined,
        expect.objectContaining({
          customheader1: 'user123',
        })
      ).reply(200, {
        accountId: 'ACCOUNT_ID',
      })
      const validateRes = validateCredentials({ username: 'user123', password: 'pass' }, { createConnection })
      expect(await validateRes).toEqual('ACCOUNT_ID:user123')
      expect(mockAxiosAdapter.history.get.length).toBe(1)
      const req = mockAxiosAdapter.history.get[0]
      expect(req.url).toEqual('/users/me')
      expect(req.auth).toEqual({ username: 'user123', password: 'pass' })
      // already verified the customheader1 header in the onGet header matcher
    })
    it('should throw Unauthorized on UnauthorizedError', async () => {
      await expect(() => validateCredentials(
        { username: 'user123', password: 'pass' },
        { createConnection: retryOptions => (axiosConnection({
          retryOptions,
          authParamsFunc: async () => ({}),
          baseURLFunc: () => BASE_URL,
          credValidateFunc: async () => { throw new UnauthorizedError('aaa') },
        })) },
      )).rejects.toThrow(new UnauthorizedError('Unauthorized - update credentials and try again'))
    })
    it('should throw Error on other errors', async () => {
      await expect(() => validateCredentials(
        { username: 'user123', password: 'pass' },
        { createConnection: retryOptions => (axiosConnection({
          retryOptions,
          authParamsFunc: async () => ({}),
          baseURLFunc: () => BASE_URL,
          credValidateFunc: async () => { throw new Error('aaa') },
        })) },
      )).rejects.toThrow(new Error('Login failed with error: Error: aaa'))
    })
  })
  describe('createRetryOptions', () => {
    let retryOptions: RetryOptions

    beforeEach(() => {
      retryOptions = createRetryOptions({ maxAttempts: 3, retryDelay: 100, additionalStatusCodesToRetry: [] })
    })
    it('should retry error code 429', () => {
      expect(retryOptions.retryCondition?.({
        response: {
          status: 429,
        },
      } as AxiosError)).toBeTruthy()
    })

    it('should use the retry-after header when available', () => {
      expect(retryOptions.retryDelay?.(1, {
        response: {
          headers: {
            'Retry-After': '10',
          },
        },
        code: 'code',
        config: {
          url: 'url',
        },
      } as AxiosError)).toBe(10000)

      expect(retryOptions.retryDelay?.(1, {
        response: {
          headers: {
            date: 'Wed, 14 Sep 2022 11:22:45 GMT',
            'x-rate-limit-reset': '1663154597',
          },
        },
        code: 'code',
        config: {
          url: 'url',
        },
      } as AxiosError)).toBe(32000)

      expect(retryOptions.retryDelay?.(1, {
        response: {
          headers: {
            'retry-after': '10',
          },
        },
        code: 'code',
        config: {
          url: 'url',
        },
      } as AxiosError)).toBe(10000)
    })

    it('should use the input delay when retry-after header is not available', () => {
      expect(retryOptions.retryDelay?.(1, {
        response: {
          headers: {},
          status: 429,
        },
        code: 'code',
        config: {
          url: 'url',
        },
      } as AxiosError)).toBe(100)
    })

    it('should use the input delay when retry-after header is invalid', () => {
      expect(retryOptions.retryDelay?.(1, {
        response: {
          headers: {
            'Retry-After': 'invalid',
          },
        },
        code: 'code',
        config: {
          url: 'url',
        },
      } as AxiosError)).toBe(100)
    })
  })
})
