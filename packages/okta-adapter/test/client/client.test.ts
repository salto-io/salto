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
import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'
import { client as clientUtils } from '@salto-io/adapter-components'
import OktaClient from '../../src/client/client'

describe('client', () => {
  let client: OktaClient
  let mockAxios: MockAdapter
  beforeEach(() => {
    mockAxios = new MockAdapter(axios)
    client = new OktaClient({ credentials: { baseUrl: 'http://my.okta.net', token: 'token' } })
  })
  afterEach(() => {
    mockAxios.restore()
  })

  describe('getSinglePage', () => {
    let result: clientUtils.ResponseValue
    beforeEach(async () => {
      // The first replyOnce with 200 is for the client authentication
      mockAxios.onGet('/api/v1/org').replyOnce(200, { id: 1 }).onGet('/myPath').replyOnce(200, { response: 'asd' })
      result = await client.getSinglePage({ url: '/myPath' })
    })
    it('should return the response', () => {
      expect(result).toEqual({ status: 200, data: { response: 'asd' } })
    })
    it('should request the correct path with auth headers', () => {
      const request = mockAxios.history.get[1]
      expect(request.headers.Authorization).toEqual('SSWS token')
      expect(request.baseURL).toEqual('http://my.okta.net')
      expect(request.url).toEqual('/myPath')
    })
  })
})
