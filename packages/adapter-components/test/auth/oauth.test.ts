/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'
import { oauthClientCredentialsBearerToken, oauthAccessTokenRefresh } from '../../src/auth'

describe('oauth', () => {
  describe('oauthClientCredentialsBearerToken', () => {
    let mockAxiosAdapter: MockAdapter
    beforeEach(() => {
      mockAxiosAdapter = new MockAdapter(axios, { delayResponse: 1, onNoMatch: 'throwException' })
    })

    afterEach(() => {
      mockAxiosAdapter.restore()
    })

    it('should make the right request and return a header on success', async () => {
      mockAxiosAdapter.onPost('/oauth/token').reply(200, {
        // eslint-disable-next-line camelcase
        access_token: 'token123',
        expires_in: 3599,
        token_type: 'bearer',
        scope: 'abc def',
      })

      expect(
        await oauthClientCredentialsBearerToken({
          baseURL: 'localhost',
          clientId: 'client id',
          clientSecret: 'secret',
          retryOptions: { retries: 2 },
        }),
      ).toEqual({ headers: { Authorization: 'Bearer token123' } })
      expect(mockAxiosAdapter.history.post.length).toBe(1)
      const req = mockAxiosAdapter.history.post[0]
      expect(req.url).toEqual('/oauth/token')
      expect(req.auth).toBeUndefined()
      expect(req.data).toEqual('client_id=client%20id&client_secret=secret&grant_type=client_credentials')
      expect(req.headers).toEqual({
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: expect.stringContaining('application/json'),
      })
    })
    it('should throw error on failure', async () => {
      mockAxiosAdapter.onPost('/oauth/token').reply(400, {})

      await expect(() =>
        oauthClientCredentialsBearerToken({
          baseURL: 'localhost',
          clientId: 'client id',
          clientSecret: 'secret',
          retryOptions: { retries: 2 },
        }),
      ).rejects.toThrow(new Error('Request failed with status code 400'))
    })
    it('should throw error on unexpected token type', async () => {
      mockAxiosAdapter.onPost('/oauth/token').reply(200, {
        // eslint-disable-next-line camelcase
        access_token: 'token123',
        expires_in: 3599,
        token_type: 'mac',
        scope: 'abc def',
      })

      await expect(() =>
        oauthClientCredentialsBearerToken({
          baseURL: 'localhost',
          clientId: 'client id',
          clientSecret: 'secret',
          retryOptions: { retries: 2 },
        }),
      ).rejects.toThrow(new Error('Unsupported token type mac'))
    })
    it('should retry on transient errors', async () => {
      mockAxiosAdapter.onPost('/oauth/token').reply(503).onPost('/oauth/token').reply(200, {
        // eslint-disable-next-line camelcase
        access_token: 'token123',
        expires_in: 3599,
        token_type: 'bearer',
        scope: 'abc def',
      })

      expect(
        await oauthClientCredentialsBearerToken({
          baseURL: 'localhost',
          clientId: 'client id',
          clientSecret: 'secret',
          retryOptions: { retries: 2 },
        }),
      ).toEqual({ headers: { Authorization: 'Bearer token123' } })
    })
    it('should support customizations', async () => {
      mockAxiosAdapter.onPost('/custom_oauth_endpoint').reply(200, {
        // eslint-disable-next-line camelcase
        access_token: 'token123',
        expires_in: 3599,
        token_type: 'bearer',
        scope: 'abc def',
      })

      expect(
        await oauthClientCredentialsBearerToken({
          endpoint: '/custom_oauth_endpoint',
          baseURL: 'localhost',
          clientId: 'client id',
          clientSecret: 'secret',
          retryOptions: { retries: 2 },
          additionalHeaders: {
            aaa: 'bbb',
            ccc: 'ddd',
          },
        }),
      ).toEqual({ headers: { Authorization: 'Bearer token123' } })
      expect(mockAxiosAdapter.history.post.length).toBe(1)
      const req = mockAxiosAdapter.history.post[0]
      expect(req.url).toEqual('/custom_oauth_endpoint')
      expect(req.auth).toBeUndefined()
      expect(req.data).toEqual('client_id=client%20id&client_secret=secret&grant_type=client_credentials')
      expect(req.headers).toEqual({
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: expect.stringContaining('application/json'),
        aaa: 'bbb',
        ccc: 'ddd',
      })
    })
  })
  describe('oauthAccessTokenRefresh', () => {
    let mockAxiosAdapter: MockAdapter
    beforeEach(() => {
      mockAxiosAdapter = new MockAdapter(axios, { delayResponse: 1, onNoMatch: 'throwException' })
    })

    afterEach(() => {
      mockAxiosAdapter.restore()
    })

    it('should make the right request and return a header on success', async () => {
      mockAxiosAdapter.onPost('/oauth/token').reply(200, {
        // eslint-disable-next-line camelcase
        access_token: 'token123',
        expires_in: 3599,
        token_type: 'Bearer',
        scope: 'abc def',
      })

      expect(
        await oauthAccessTokenRefresh({
          endpoint: '/oauth/token',
          baseURL: 'localhost',
          clientId: 'client id',
          clientSecret: 'secret',
          refreshToken: 'refresh',
          retryOptions: { retries: 2 },
        }),
      ).toEqual({ headers: { Authorization: 'Bearer token123' } })
      expect(mockAxiosAdapter.history.post.length).toBe(1)
      const req = mockAxiosAdapter.history.post[0]
      expect(req.url).toEqual('/oauth/token')
      expect(req.auth).toBeUndefined()
      expect(req.data).toEqual('refresh_token=refresh&grant_type=refresh_token')
      expect(req.headers).toEqual({
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: expect.stringContaining('application/json'),
        Authorization: expect.stringContaining('Basic'),
      })
    })
    it('should throw error on failure', async () => {
      mockAxiosAdapter.onPost('/oauth/token').reply(400, {})

      await expect(() =>
        oauthAccessTokenRefresh({
          endpoint: '/oauth/token',
          baseURL: 'localhost',
          clientId: 'client id',
          clientSecret: 'secret',
          refreshToken: 'refresh',
          retryOptions: { retries: 2 },
        }),
      ).rejects.toThrow(new Error('Request failed with status code 400'))
    })
    it('should throw error on unexpected token type', async () => {
      mockAxiosAdapter.onPost('/oauth/token').reply(200, {
        // eslint-disable-next-line camelcase
        access_token: 'token123',
        expires_in: 3599,
        token_type: 'mac',
        scope: 'abc def',
      })

      await expect(() =>
        oauthAccessTokenRefresh({
          endpoint: '/oauth/token',
          baseURL: 'localhost',
          clientId: 'client id',
          clientSecret: 'secret',
          refreshToken: 'refresh',
          retryOptions: { retries: 2 },
        }),
      ).rejects.toThrow(new Error('Unsupported token type mac'))
    })
    it('should retry on transient errors', async () => {
      mockAxiosAdapter.onPost('/oauth/token').reply(503).onPost('/oauth/token').reply(200, {
        // eslint-disable-next-line camelcase
        access_token: 'token123',
        expires_in: 3599,
        token_type: 'bearer',
        scope: 'abc def',
      })

      expect(
        await oauthAccessTokenRefresh({
          endpoint: '/oauth/token',
          baseURL: 'localhost',
          clientId: 'client id',
          clientSecret: 'secret',
          refreshToken: 'refresh',
          retryOptions: { retries: 2 },
        }),
      ).toEqual({ headers: { Authorization: 'Bearer token123' } })
    })
  })
})
