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
import { client as clientUtils } from '@salto-io/adapter-components'
import JiraClient from '../../src/client/client'

describe('client', () => {
  let client: JiraClient
  let mockAxios: MockAdapter
  beforeEach(() => {
    mockAxios = new MockAdapter(axios)
    client = new JiraClient({ credentials: { baseUrl: 'http://myjira.net', user: 'me', token: 'tok' } })
  })
  afterEach(() => {
    mockAxios.restore()
  })

  describe('getSinglePage', () => {
    let result: clientUtils.ResponseValue
    beforeEach(async () => {
      mockAxios.onGet().reply(200, { response: 'asd' })
      result = await client.getSinglePage({ url: '/myPath' })
    })
    it('should not try to call a login endpoint', () => {
      expect(mockAxios.history.get).toHaveLength(1)
    })
    it('should request the correct path with auth headers', () => {
      const request = mockAxios.history.get[0]
      expect(request.auth).toEqual({ username: 'me', password: 'tok' })
      expect(request.baseURL).toEqual('http://myjira.net')
      expect(request.url).toEqual('/myPath')
    })
    it('should return the response', () => {
      expect(result).toEqual({ status: 200, data: { response: 'asd' } })
    })
  })
})
