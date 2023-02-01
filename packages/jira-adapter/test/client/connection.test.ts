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
import { createConnection, validateCredentials } from '../../src/client/connection'
import { FORCE_ACCEPT_LANGUAGE_HEADERS } from '../../src/client/headers'

describe('connection', () => {
  describe('validateCredentials', () => {
    let mockAxios: MockAdapter
    let connection: clientUtils.APIConnection
    beforeEach(async () => {
      mockAxios = new MockAdapter(axios)
      mockAxios.onGet('/rest/api/3/configuration').reply(200)
      mockAxios.onGet('/rest/api/3/serverInfo').reply(200, { baseUrl: 'http://my.jira.net' })
      connection = await createConnection({ retries: 1 }).login(
        { baseUrl: 'http://myJira.net', user: 'me', token: 'tok', isDataCenter: false }
      )
    })
    afterEach(() => {
      mockAxios.restore()
    })

    describe('when authorized', () => {
      let result: string

      beforeEach(async () => {
        result = await validateCredentials({
          connection,
        })
      })

      it('should get server info with auth headers', () => {
        expect(mockAxios.history.get).toContainEqual(expect.objectContaining({
          url: '/rest/api/3/serverInfo',
          baseURL: 'http://myJira.net',
          auth: { username: 'me', password: 'tok' },
        }))
      })

      it('should return the base url from the response as account id', () => {
        expect(result).toEqual('http://my.jira.net')
      })
    })

    describe('when unauthorized', () => {
      it('should throw Invalid Credentials Error', async () => {
        mockAxios.onGet('/rest/api/3/configuration').reply(401)
        await expect(validateCredentials({ connection })).rejects.toThrow(new Error('Invalid Credentials'))
      })

      it('should rethrow unrelated Network Error', async () => {
        mockAxios.onGet('/rest/api/3/configuration').networkError()
        await expect(validateCredentials({ connection })).rejects.toThrow(new Error('Network Error'))
      })
    })
  })

  describe('validateHeaders Cloud', () => {
    let mockAxios: MockAdapter
    let connection: clientUtils.APIConnection

    beforeEach(async () => {
      mockAxios = new MockAdapter(axios)
      mockAxios.onGet('/rest/api/3/configuration').reply(200)
      mockAxios.onGet('/rest/api/3/serverInfo').reply(200, { baseUrl: 'http://my.jira.net' })
      connection = await createConnection({ retries: 1 }).login(
        { baseUrl: 'http://myJira.net', user: 'me', token: 'tok', isDataCenter: false }
      )
      await validateCredentials({
        connection,
      })
    })
    afterEach(() => {
      mockAxios.restore()
    })

    it('should have FORCE_ACCEPT_LANGUAGE headers when calling Jira Cloud', async () => {
      expect(mockAxios.history.get).toContainEqual(expect.objectContaining({
        headers: expect.objectContaining(FORCE_ACCEPT_LANGUAGE_HEADERS),
      }))
    })
  })
  describe('validateHeaders DC', () => {
    let mockAxios: MockAdapter
    let connection: clientUtils.APIConnection
    beforeEach(async () => {
      mockAxios = new MockAdapter(axios)
      mockAxios.onGet('/rest/api/3/configuration').reply(200)
      mockAxios.onGet('/rest/api/3/serverInfo').reply(200, { baseUrl: 'http://my.jira.net' })
      connection = await createConnection({ retries: 1 }).login(
        { baseUrl: 'http://myJira.net', user: 'me', token: 'tok', isDataCenter: true }
      )
      await validateCredentials({
        connection,
      })
    })
    afterEach(() => {
      mockAxios.restore()
    })

    it('should not have force accept language headers when calling Jira DC', async () => {
      mockAxios.onGet('/rest/api/3/serverInfo').reply(200, { baseUrl: 'http://my.jira.net' })
      expect(mockAxios.history.get).toContainEqual(expect.objectContaining({
        headers: expect.not.objectContaining(FORCE_ACCEPT_LANGUAGE_HEADERS),
      }))
    })
  })
})
