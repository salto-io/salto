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
import { collections } from '@salto-io/lowerdash'
import { ClientRateLimitConfig } from '../../src/client/config'
import { AdapterHTTPClient, ClientOpts, ConnectionCreator, GetAllItemsFunc } from '../../src/client'
import { createConnection, Credentials } from './common'

const { toArrayAsync } = collections.asynciterable

describe('client_http_client', () => {
  let mockAxiosAdapter: MockAdapter
  beforeEach(() => {
    mockAxiosAdapter = new MockAdapter(axios, { delayResponse: 1, onNoMatch: 'throwException' })
  })

  afterEach(() => {
    mockAxiosAdapter.restore()
  })

  describe('get', () => {
    const getPage: GetAllItemsFunc = jest.fn(async function *x() {
      await new Promise(resolve => setTimeout(resolve, 10))
      yield []
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

      protected getAllItems = getPage
    }

    it('should make the right request', async () => {
      expect(mockCreateConnection).not.toHaveBeenCalled()
      const client = new MyCustomClient({ credentials: { username: 'user', password: 'password' } })
      expect(mockCreateConnection).toHaveBeenCalledTimes(1)

      mockAxiosAdapter.onGet('/users/me').reply(200, {
        accountId: 'ACCOUNT_ID',
      })

      const getRes = client.get({ url: '/ep' })
      // should not call getPage until auth succeeds
      expect(getPage).toHaveBeenCalledTimes(0)
      await toArrayAsync(await getRes)
      await toArrayAsync(await client.get({ url: '/ep2', paginationField: 'page', queryParams: { a: 'AAA' } }))
      expect(getPage).toHaveBeenCalledTimes(2)
      expect(getPage).toHaveBeenCalledWith({
        conn: expect.anything(), pageSize: 123, getParams: { url: '/ep' },
      })
      expect(getPage).toHaveBeenCalledWith({
        conn: expect.anything(),
        pageSize: 123,
        getParams: { url: '/ep2', paginationField: 'page', queryParams: { a: 'AAA' } },
      })
      expect(mockCreateConnection).toHaveBeenCalledTimes(1)
    })
  })
})
