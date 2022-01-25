/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { mockFunction } from '@salto-io/test-utils'
import { ClientRateLimitConfig } from '../../src/client/config'
import { AdapterHTTPClient, APIConnection, ClientOpts, ConnectionCreator, HTTPError, UnauthorizedError } from '../../src/client'
import { createConnection, Credentials } from './common'
import { TimeoutError } from '../../src/client/http_client'

describe('client_http_client', () => {
  let mockAxiosAdapter: MockAdapter
  let mockCreateConnection: jest.MockedFunction<ConnectionCreator<Credentials>>

  beforeEach(() => {
    mockAxiosAdapter = new MockAdapter(axios, { delayResponse: 1, onNoMatch: 'throwException' })
    mockCreateConnection = jest.fn(createConnection)
  })

  afterEach(() => {
    mockAxiosAdapter.restore()
  })

  class MyCustomClient extends AdapterHTTPClient<
    Credentials, ClientRateLimitConfig
  > {
    constructor(
      clientOpts: ClientOpts<Credentials, ClientRateLimitConfig>,
    ) {
      super(
        'MyCustom',
        clientOpts,
        mockCreateConnection,
        {
          pageSize: { get: 123 },
          rateLimit: { total: -1, get: 3, deploy: 4 },
          retry: { maxAttempts: 3, retryDelay: 123 },
        }
      )
    }
  }

  describe('getSinglePage', () => {
    it('should make the right request', async () => {
      expect(mockCreateConnection).not.toHaveBeenCalled()
      const client = new MyCustomClient({ credentials: { username: 'user', password: 'password' } })
      expect(mockCreateConnection).toHaveBeenCalledTimes(1)

      mockAxiosAdapter.onGet('/users/me').reply(200, {
        accountId: 'ACCOUNT_ID',
      })
      mockAxiosAdapter.onGet('/ep').replyOnce(200, { a: 'b' })
      mockAxiosAdapter.onGet('/ep2', { a: 'AAA' }).replyOnce(200, { c: 'd' })

      const getRes = await client.getSinglePage({ url: '/ep' })
      const getRes2 = await client.getSinglePage({ url: '/ep2', queryParams: { a: 'AAA' } })
      expect(getRes).toEqual({ data: { a: 'b' }, status: 200 })
      expect(getRes2).toEqual({ data: { c: 'd' }, status: 200 })
    })

    it('should throw Unauthorized on login 401', async () => {
      const client = new MyCustomClient({ credentials: { username: 'user', password: 'password' } })
      mockAxiosAdapter.onGet('/users/me').reply(401, {
        accountId: 'ACCOUNT_ID',
      })
      await expect(client.getSinglePage({ url: '/ep' })).rejects.toThrow(UnauthorizedError)
    })

    it('should throw HTTPError on other http errors', async () => {
      const client = new MyCustomClient({ credentials: { username: 'user', password: 'password' } })
      mockAxiosAdapter.onGet('/users/me').reply(200, {
        accountId: 'ACCOUNT_ID',
      })
      mockAxiosAdapter.onGet('/ep').replyOnce(400, { a: 'b' })
      await expect(client.getSinglePage({ url: '/ep' })).rejects.toThrow(HTTPError)
    })

    it('should throw TimeoutError if received ETIMEDOUT', async () => {
      class ETIMEDOUTError {
        readonly code: string
        constructor() {
          this.code = 'ETIMEDOUT'
        }
      }
      mockCreateConnection.mockReturnValue({
        login: async () => ({
          get: mockFunction<APIConnection['get']>().mockRejectedValue(new ETIMEDOUTError()),
          post: mockFunction<APIConnection['post']>(),
          put: mockFunction<APIConnection['put']>(),
          patch: mockFunction<APIConnection['patch']>(),
          delete: mockFunction<APIConnection['delete']>(),
          accountId: 'ACCOUNT_ID',
        }),
      })
      const client = new MyCustomClient({ credentials: { username: 'user', password: 'password' } })
      await expect(client.getSinglePage({ url: '/ep' })).rejects.toThrow(TimeoutError)
    })
  })

  describe('post', () => {
    it('should make the right request', async () => {
      expect(mockCreateConnection).not.toHaveBeenCalled()
      const client = new MyCustomClient({ credentials: { username: 'user', password: 'password' } })
      expect(mockCreateConnection).toHaveBeenCalledTimes(1)

      mockAxiosAdapter.onGet('/users/me').reply(200, {
        accountId: 'ACCOUNT_ID',
      })
      mockAxiosAdapter.onPost('/ep', 'someData').replyOnce(200, { a: 'b' })

      const postRes = await client.post({ url: '/ep', data: 'someData' })
      expect(postRes).toEqual({ data: { a: 'b' }, status: 200 })
    })
  })

  describe('put', () => {
    it('should make the right request', async () => {
      expect(mockCreateConnection).not.toHaveBeenCalled()
      const client = new MyCustomClient({ credentials: { username: 'user', password: 'password' } })
      expect(mockCreateConnection).toHaveBeenCalledTimes(1)

      mockAxiosAdapter.onGet('/users/me').reply(200, {
        accountId: 'ACCOUNT_ID',
      })
      mockAxiosAdapter.onPut('/ep', 'someData').replyOnce(200, { a: 'b' })

      const putRes = await client.put({ url: '/ep', data: 'someData' })
      expect(putRes).toEqual({ data: { a: 'b' }, status: 200 })
    })
  })

  describe('delete', () => {
    it('should make the right request', async () => {
      expect(mockCreateConnection).not.toHaveBeenCalled()
      const client = new MyCustomClient({ credentials: { username: 'user', password: 'password' } })
      expect(mockCreateConnection).toHaveBeenCalledTimes(1)

      mockAxiosAdapter.onGet('/users/me').reply(200, {
        accountId: 'ACCOUNT_ID',
      })
      mockAxiosAdapter.onDelete('/ep', { a: 'AAA' }).replyOnce(200, { a: 'b' })

      const getRes = await client.delete({ url: '/ep' })
      expect(getRes).toEqual({ data: { a: 'b' }, status: 200 })
    })
  })

  describe('patch', () => {
    it('should make the right request', async () => {
      expect(mockCreateConnection).not.toHaveBeenCalled()
      const client = new MyCustomClient({ credentials: { username: 'user', password: 'password' } })
      expect(mockCreateConnection).toHaveBeenCalledTimes(1)

      mockAxiosAdapter.onGet('/users/me').reply(200, {
        accountId: 'ACCOUNT_ID',
      })
      mockAxiosAdapter.onPatch('/ep', 'someData').replyOnce(200, { a: 'b' })

      const patchRes = await client.patch({ url: '/ep', data: 'someData' })
      expect(patchRes).toEqual({ data: { a: 'b' }, status: 200 })
    })
  })

  describe('getPageSize', () => {
    it('should return the default when no pageSize is specified in config', () => {
      const client = new MyCustomClient({ credentials: { username: 'user', password: 'password' } })
      expect(client.getPageSize()).toEqual(123)
    })

    it('should return the provided value when specified', () => {
      const client = new MyCustomClient({
        credentials: { username: 'user', password: 'password' },
        config: {
          pageSize: {
            get: 55,
          },
        },
      })
      expect(client.getPageSize()).toEqual(55)
    })
  })
})
