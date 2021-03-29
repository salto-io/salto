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
import { validateCredentials, createConnection } from '../../src/client/connection'

describe('validateCredentials', () => {
  let mockAxios: MockAdapter
  let result: string
  beforeEach(async () => {
    mockAxios = new MockAdapter(axios)
    mockAxios.onGet().reply(200, { baseUrl: 'http://my.jira.net' })
    const connection = await createConnection({ retries: 1 }).login(
      { baseUrl: 'http://myJira.net', user: 'me', token: 'tok' }
    )
    result = await validateCredentials({ connection })
  })
  afterEach(() => {
    mockAxios.restore()
  })

  it('should get server info with auth headers', () => {
    expect(mockAxios.history.get).toHaveLength(1)
    const request = mockAxios.history.get[0]
    expect(request.url).toEqual('/rest/api/3/serverInfo')
    expect(request.baseURL).toEqual('http://myJira.net')
    expect(request.auth).toEqual({ username: 'me', password: 'tok' })
  })

  it('should return the base url from the response as account id', () => {
    expect(result).toEqual('http://my.jira.net')
  })
})
