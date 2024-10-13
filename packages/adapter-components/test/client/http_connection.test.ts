/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import axios, { AxiosError, AxiosResponse, AxiosHeaders } from 'axios'
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
      mockAxiosAdapter
        .onGet(
          '/users/me',
          undefined,
          expect.objectContaining({
            customHeader1: 'user123',
          }),
        )
        .reply(200, {
          accountId: 'ACCOUNT_ID',
        })
      const validateRes = validateCredentials({ username: 'user123', password: 'pass' }, { createConnection })
      expect(await validateRes).toEqual({
        accountId: 'ACCOUNT_ID:user123',
        accountType: 'Sandbox',
        isProduction: false,
      })
      expect(mockAxiosAdapter.history.get.length).toBe(1)
      const req = mockAxiosAdapter.history.get[0]
      expect(req.url).toEqual('/users/me')
      expect(req.auth).toEqual({ username: 'user123', password: 'pass' })
      // already verified the customHeader1 header in the onGet header matcher
    })
    it('should throw Unauthorized on UnauthorizedError', async () => {
      await expect(() =>
        validateCredentials(
          { username: 'user123', password: 'pass' },
          {
            createConnection: (retryOptions, timeout) =>
              axiosConnection({
                retryOptions,
                authParamsFunc: async () => ({}),
                baseURLFunc: async () => BASE_URL,
                credValidateFunc: async () => {
                  throw new UnauthorizedError('aaa')
                },
                timeout,
              }),
          },
        ),
      ).rejects.toThrow(new UnauthorizedError('Unauthorized - update credentials and try again'))
    })
    it('should throw Error on other errors', async () => {
      await expect(() =>
        validateCredentials(
          { username: 'user123', password: 'pass' },
          {
            createConnection: (retryOptions, timeout) =>
              axiosConnection({
                retryOptions,
                authParamsFunc: async () => ({}),
                baseURLFunc: async () => BASE_URL,
                credValidateFunc: async () => {
                  throw new Error('aaa')
                },
                timeout,
              }),
          },
        ),
      ).rejects.toThrow(new Error('Login failed with error: aaa'))
    })
  })
  describe('axiosConnection with timeout', () => {
    let retryOptions: RetryOptions
    beforeEach(() => {
      retryOptions = createRetryOptions(
        {
          maxAttempts: 3,
          retryDelay: 100,
          additionalStatusCodesToRetry: [],
        },
        {
          retryOnTimeout: true,
          lastRetryNoTimeout: true,
        },
      )
    })
    it('should set timeout to 0 for POST request', async () => {
      const connection = axiosConnection({
        retryOptions,
        authParamsFunc: async () => ({}),
        baseURLFunc: async () => BASE_URL,
        credValidateFunc: async () => ({ accountId: '1' }),
        timeout: 5000,
      })

      const mockCredentials = { username: 'test', password: 'test' }

      const httpClient = await connection.login(mockCredentials)

      // Mock a POST request
      mockAxiosAdapter.onPost('/test').reply(200, { data: 'success' })

      // Make a POST request
      const response = (await httpClient.post('/test', {})) as AxiosResponse

      expect(response.config.timeout).toBe(0)
    })
    it('should not change timeout for GET request', async () => {
      const connection = axiosConnection({
        retryOptions,
        authParamsFunc: async () => ({}),
        baseURLFunc: async () => BASE_URL,
        credValidateFunc: async () => ({ accountId: '1' }),
        timeout: 5000,
      })

      const mockCredentials = { username: 'test', password: 'test' }

      const httpClient = await connection.login(mockCredentials)

      // Mock a GET request
      mockAxiosAdapter.onGet('/test').reply(200, { data: 'success' })

      // Make a POST request
      const response = (await httpClient.get('/test')) as AxiosResponse

      expect(response.config.timeout).toBe(5000)
    })
  })
  describe('createRetryOptions', () => {
    let retryOptions: RetryOptions

    const mockAxiosError = (args: Partial<AxiosError>): AxiosError => ({
      name: 'MockAxiosError',
      message: 'mock axios error message',
      config: { headers: new AxiosHeaders() },
      isAxiosError: true,
      toJSON: () => args,
      ...args,
    })

    const mockAxiosResponse = (args: Partial<AxiosResponse>): AxiosResponse => ({
      config: { headers: new AxiosHeaders() },
      data: null,
      headers: {},
      status: 200,
      statusText: 'success',
      ...args,
    })

    beforeEach(() => {
      retryOptions = createRetryOptions(
        {
          maxAttempts: 3,
          retryDelay: 100,
          additionalStatusCodesToRetry: [],
        },
        {
          retryOnTimeout: true,
          lastRetryNoTimeout: true,
        },
      )
    })
    it('should retry error code 429', () => {
      expect(
        retryOptions.retryCondition?.({
          response: {
            status: 429,
          },
        } as AxiosError),
      ).toBeTruthy()
    })

    it('should retry on timeout if flag is true', () => {
      expect(
        retryOptions.retryCondition?.({
          response: {
            status: 408,
          },
          code: 'ECONNABORTED',
        } as AxiosError),
      ).toBeTruthy()
    })

    it('should not retry on timeout if flag is false', () => {
      retryOptions = createRetryOptions(
        {
          maxAttempts: 3,
          retryDelay: 100,
          additionalStatusCodesToRetry: [],
        },
        {
          retryOnTimeout: false,
          lastRetryNoTimeout: true,
        },
      )

      expect(
        retryOptions.retryCondition?.({
          response: {
            status: 408,
          },
          code: 'ECONNABORTED',
        } as AxiosError),
      ).toBeFalsy()
    })

    it('should use the retry-after header when available', () => {
      expect(
        retryOptions.retryDelay?.(
          1,
          mockAxiosError({
            response: mockAxiosResponse({
              headers: {
                'Retry-After': '10',
              },
            }),
            code: 'code',
            config: {
              headers: new AxiosHeaders(),
              url: 'url',
            },
          }),
        ),
      ).toBe(10000)

      expect(
        retryOptions.retryDelay?.(
          1,
          mockAxiosError({
            response: mockAxiosResponse({
              headers: {
                date: 'Wed, 14 Sep 2022 11:22:45 GMT',
                'x-rate-limit-reset': '1663154597',
              },
            }),
            code: 'code',
            config: {
              headers: new AxiosHeaders(),
              url: 'url',
            },
          }),
        ),
      ).toBe(32000)

      expect(
        retryOptions.retryDelay?.(
          1,
          mockAxiosError({
            response: mockAxiosResponse({
              headers: {
                'retry-after': '10',
              },
            }),
            code: 'code',
            config: {
              headers: new AxiosHeaders(),
              url: 'url',
            },
          }),
        ),
      ).toBe(10000)
    })

    it('should use the input delay when retry-after header is not available', () => {
      expect(
        retryOptions.retryDelay?.(1, {
          response: {
            headers: {},
            status: 429,
          },
          code: 'code',
          config: {
            url: 'url',
          },
        } as AxiosError),
      ).toBe(100)
    })

    it('should use the input delay when retry-after header is invalid', () => {
      expect(
        retryOptions.retryDelay?.(
          1,
          mockAxiosError({
            response: mockAxiosResponse({
              headers: {
                'Retry-After': 'invalid',
              },
            }),
            code: 'code',
            config: {
              headers: new AxiosHeaders(),
              url: 'url',
            },
          }),
        ),
      ).toBe(100)
    })

    describe('onRetry', () => {
      describe('last retry', () => {
        it('should set the config timeout to be 0 if lastRetryNoTimeout is true', async () => {
          const requestConfig = { timeout: 4 }
          await retryOptions.onRetry?.(3, mockAxiosError({}), requestConfig)
          expect(requestConfig.timeout).toBe(0)
        })

        it('should not update the config if lastRetryNoTimeout is false', async () => {
          retryOptions = createRetryOptions(
            {
              maxAttempts: 3,
              retryDelay: 100,
              additionalStatusCodesToRetry: [],
            },
            {
              retryOnTimeout: true,
              lastRetryNoTimeout: false,
            },
          )
          const requestConfig = { timeout: 4 }
          await retryOptions.onRetry?.(3, mockAxiosError({}), requestConfig)
          expect(requestConfig.timeout).toBe(4)
        })
      })

      it('should not update the config if not last retry', async () => {
        const requestConfig = { timeout: 4 }
        await retryOptions.onRetry?.(1, mockAxiosError({}), requestConfig)
        expect(requestConfig.timeout).toBe(4)
      })
    })
  })
})
