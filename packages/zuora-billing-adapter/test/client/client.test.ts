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
import ZuoraClient from '../../src/client/client'

describe('client', () => {
  describe('get', () => {
    let mockAxios: MockAdapter
    let client: ZuoraClient
    beforeEach(() => {
      mockAxios = new MockAdapter(axios)
      client = new ZuoraClient({ credentials: { baseURL: 'http://localhost', clientId: 'id', clientSecret: 'secret' } })
      // client authentication
      mockAxios
        .onPost('/oauth/token')
        .reply(200, {
          token_type: 'bearer',
          access_token: 'token123',
          expires_in: 10000,
        })
        .onPost('/v1/connections')
        .reply(200, { success: true })
    })

    afterEach(() => {
      mockAxios.restore()
      jest.clearAllMocks()
    })

    it('should return an empty result when there is a 404 response', async () => {
      mockAxios.onGet().replyOnce(404)
      const res = await client.get({ url: '/api/v1/workflows/111/export' })
      expect(res.data).toEqual([])
      expect(res.status).toEqual(404)
    })
    it('should throw if there is a different status', async () => {
      mockAxios.onGet().replyOnce(400)
      await expect(client.get({ url: '/api/v1/workflows/111/export' })).rejects.toThrow()
    })
  })
})
