/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { ClientRateLimitConfig } from '../../src/client/config'
import { AdapterHTTPClient, ClientOpts, ConnectionCreator, UnauthorizedError } from '../../src/client'
import { createConnection, Credentials } from './common'

describe('client_http_client', () => {
  let mockAxiosAdapter: MockAdapter
  beforeEach(() => {
    mockAxiosAdapter = new MockAdapter(axios, { delayResponse: 1, onNoMatch: 'throwException' })
  })

  afterEach(() => {
    mockAxiosAdapter.restore()
  })

  const mockCreateConnection: ConnectionCreator<Credentials> = jest.fn(createConnection)

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
          rateLimit: { total: -1, get: 3 },
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
