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
import ZendeskClient from '../../src/client/client'

describe('client', () => {
  describe('getSinglePage', () => {
    let mockAxios: MockAdapter
    let client: ZendeskClient
    beforeEach(() => {
      mockAxios = new MockAdapter(axios)
      client = new ZendeskClient({ credentials: { username: 'a', password: 'b', subdomain: 'ignore' } })
    })

    afterEach(() => {
      mockAxios.restore()
    })

    it('should return an empty result when there is a 404 response', async () => {
      // The first replyOnce with 200 is for the client authentication
      mockAxios.onGet().replyOnce(200).onGet().replyOnce(404)
      const res = await client.getSinglePage({ url: '/routing/attributes' })
      expect(res.data).toEqual([])
      expect(res.status).toEqual(404)
    })
    it('should return an empty result when there is a 403 response and we asked for workspaces', async () => {
      // The first replyOnce with 200 is for the client authentication
      mockAxios.onGet().replyOnce(200).onGet().replyOnce(403)
      const res = await client.getSinglePage({ url: '/workspaces' })
      expect(res.data).toEqual([])
      expect(res.status).toEqual(403)
    })
    it('should throw when there is a 403 response but we did not ask for workspaces', async () => {
      // The first replyOnce with 200 is for the client authentication
      mockAxios.onGet().replyOnce(200).onGet().replyOnce(403)
      await expect(client.getSinglePage({ url: '/routing/attributes' })).rejects.toThrow()
    })
    it('should throw if there is no status in the error', async () => {
      // The first replyOnce with 200 is for the client authentication
      mockAxios.onGet().replyOnce(200).onGet().replyOnce(() => { throw new Error('Err') })
      await expect(
        client.getSinglePage({ url: '/routing/attributes' })
      ).rejects.toThrow()
    })
  })
})
