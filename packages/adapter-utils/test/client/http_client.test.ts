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
import moxios from 'moxios'
import { ClientRateLimitConfig } from '../../src/client/config'
import { AdapterHTTPClient, ClientOpts } from '../../src/client/http_client'
import { ConnectionCreator } from '../../src/client/http_connection'
import { GetAllItemsFunc } from '../../src/client/pagination'
import { createConnection, Credentials } from './common'

describe('client_http_client', () => {
  beforeEach(() => {
    moxios.install()
  })

  afterEach(() => {
    moxios.uninstall()
  })

  describe('get', () => {
    const getPage: GetAllItemsFunc = jest.fn(async () => {
      await new Promise(resolve => setTimeout(resolve, 10))
      return []
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
      const getRes = client.get({ endpointName: '/ep' })

      // should not call getPage until auth succeeds
      expect(getPage).toHaveBeenCalledTimes(0)

      moxios.withMock(() => {
        moxios.wait(async () => {
          const req = moxios.requests.mostRecent()
          await req.respondWith({
            status: 200,
            response: {
              accountId: 'ACCOUNT_ID',
            },
          })
        })
      })

      await getRes
      await client.get({ endpointName: '/ep2', paginationField: 'page', queryArgs: { a: 'AAA' } })
      expect(getPage).toHaveBeenCalledTimes(2)
      expect(getPage).toHaveBeenCalledWith({
        conn: expect.anything(), pageSize: 123, getParams: { endpointName: '/ep' },
      })
      expect(getPage).toHaveBeenCalledWith({
        conn: expect.anything(),
        pageSize: 123,
        getParams: { endpointName: '/ep2', paginationField: 'page', queryArgs: { a: 'AAA' } },
      })
      expect(mockCreateConnection).toHaveBeenCalledTimes(1)
    })
  })
})
