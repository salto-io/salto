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
import axios, { AxiosRequestConfig } from 'axios'
import MockAdapter from 'axios-mock-adapter'
import { client as clientUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { validateCredentials, createConnection } from '../../src/client/connection'


describe('Jira connection', () => {
  describe('validateCredentials', () => {
    let mockAxios: MockAdapter
    let connection: clientUtils.APIConnection

    beforeEach(async () => {
      mockAxios = new MockAdapter(axios)
      mockAxios.onGet('/rest/api/3/configuration').reply(200)
      mockAxios.onGet('/rest/api/3/serverInfo').reply(200, { baseUrl: 'http://my.jira.net' })
      connection = await createConnection({ retries: 1 }).login(
        { baseUrl: 'http://myJira.net', user: 'me', token: 'tok' }
      )
    })
    afterEach(() => {
      mockAxios.restore()
    })

    describe('pass', () => {
      let result: string

      const getServerInfoRequest = (): AxiosRequestConfig => {
        const request = mockAxios.history.get.find(r => r.url === '/rest/api/3/serverInfo')
        if (_.isUndefined(request)) {
          throw new Error('No serverInfo request was sent')
        }
        return request
      }

      beforeEach(async () => {
        result = await validateCredentials({ connection })
      })

      it('should get server info with auth headers', () => {
        const { url, baseURL, auth } = getServerInfoRequest()
        expect(url).toEqual('/rest/api/3/serverInfo')
        expect(baseURL).toEqual('http://myJira.net')
        expect(auth).toEqual({ username: 'me', password: 'tok' })
      })

      it('should return the base url from the response as account id', () => {
        expect(result).toEqual('http://my.jira.net')
      })
    })

    describe('fail', () => {
      beforeEach(() => {
        mockAxios.onGet('/rest/api/3/configuration').reply(401)
      })

      it('throws Invalid Credentials Error when unauthorized', async () => {
        await expect(validateCredentials({ connection })).rejects.toThrow(new Error('Invalid Credentials'))
      })
    })
  })
})
