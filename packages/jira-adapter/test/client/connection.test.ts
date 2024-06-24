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
import { client as clientUtils } from '@salto-io/adapter-components'
import { createConnection, validateCredentials } from '../../src/client/connection'
import { FORCE_ACCEPT_LANGUAGE_HEADERS } from '../../src/client/headers'
import { Credentials } from '../../src/auth'

describe('connection', () => {
  describe('validateCredentials', () => {
    let mockAxios: MockAdapter
    let connection: clientUtils.APIConnection
    let credentials: Credentials
    beforeEach(async () => {
      mockAxios = new MockAdapter(axios)
      mockAxios.onGet('/rest/api/3/configuration').reply(200)
      mockAxios.onGet('/rest/api/3/serverInfo').reply(200, { baseUrl: 'http://my.jira.net' })
      mockAxios.onGet('/rest/api/3/instance/license').reply(200, { applications: [{ plan: 'FREE' }] })
      credentials = { baseUrl: 'http://myJira.net', user: 'me', token: 'tok', isDataCenter: false }
      connection = await createConnection({ retries: 1 }).login(credentials)
    })
    afterEach(() => {
      mockAxios.restore()
    })

    describe('when authorized', () => {
      let accountId: string

      beforeEach(async () => {
        ;({ accountId } = await validateCredentials({
          connection,
          credentials,
        }))
      })

      it('should get server info with auth headers', () => {
        expect(mockAxios.history.get).toContainEqual(
          expect.objectContaining({
            url: '/rest/api/3/serverInfo',
            baseURL: 'http://myJira.net',
            auth: { username: 'me', password: 'tok' },
          }),
        )
      })

      it('should return the base url from the response as account id', () => {
        expect(accountId).toEqual('http://my.jira.net')
      })
    })

    describe('when unauthorized', () => {
      it('should throw Invalid Credentials Error', async () => {
        mockAxios.onGet('/rest/api/3/configuration').reply(401)
        await expect(validateCredentials({ connection, credentials })).rejects.toThrow(new Error('Invalid Credentials'))
      })

      it('should rethrow unrelated Network Error', async () => {
        mockAxios.onGet('/rest/api/3/configuration').networkError()
        await expect(validateCredentials({ connection, credentials })).rejects.toThrow(new Error('Network Error'))
      })
    })
  })

  describe('validateHeaders Cloud', () => {
    let mockAxios: MockAdapter
    let connection: clientUtils.APIConnection
    let credentials: Credentials

    beforeEach(async () => {
      mockAxios = new MockAdapter(axios)
      mockAxios.onGet('/rest/api/3/configuration').reply(200)
      mockAxios.onGet('/rest/api/3/serverInfo').reply(200, { baseUrl: 'http://my.jira.net' })
      mockAxios.onGet('/rest/api/3/instance/license').reply(200, { applications: [{ plan: 'FREE' }] })
      credentials = { baseUrl: 'http://myJira.net', user: 'me', token: 'tok', isDataCenter: false }
      connection = await createConnection({ retries: 1 }).login(credentials)
      await validateCredentials({
        connection,
        credentials,
      })
    })
    afterEach(() => {
      mockAxios.restore()
    })

    it('should have FORCE_ACCEPT_LANGUAGE headers when calling Jira Cloud', async () => {
      expect(mockAxios.history.get).toContainEqual(
        expect.objectContaining({
          headers: expect.objectContaining(FORCE_ACCEPT_LANGUAGE_HEADERS),
        }),
      )
    })
  })
  describe('validateHeaders DC', () => {
    let mockAxios: MockAdapter
    let connection: clientUtils.APIConnection
    let credentials: Credentials
    beforeEach(async () => {
      mockAxios = new MockAdapter(axios)
      mockAxios.onGet('/rest/api/2/configuration').reply(200)
      mockAxios.onGet('/rest/api/2/serverInfo').reply(200, { baseUrl: 'http://my.jira.net' })
      mockAxios.onGet('/rest/api/2/instance/license').reply(200, { applications: [{ plan: 'FREE' }] })
      credentials = { baseUrl: 'http://myJira.net', user: 'me', token: 'tok', isDataCenter: true }
      connection = await createConnection({ retries: 1 }).login(credentials)
      await validateCredentials({
        connection,
        credentials,
      })
    })
    afterEach(() => {
      mockAxios.restore()
    })

    it('should not have force accept language headers when calling Jira DC', async () => {
      mockAxios.onGet('/rest/api/2/serverInfo').reply(200, { baseUrl: 'http://my.jira.net' })
      mockAxios.onGet('/rest/api/2/instance/license').reply(200, { applications: [{ plan: 'FREE' }] })
      expect(mockAxios.history.get).toContainEqual(
        expect.objectContaining({
          headers: expect.not.objectContaining(FORCE_ACCEPT_LANGUAGE_HEADERS),
        }),
      )
    })
  })
  describe('validate isProduction', () => {
    let mockAxios: MockAdapter
    let connection: clientUtils.APIConnection
    beforeEach(async () => {
      jest.clearAllMocks()
      mockAxios = new MockAdapter(axios)
      // initial calls as part of login func, for regular Jira
      mockAxios.onGet('/rest/api/3/configuration').reply(200)
      mockAxios.onGet('/rest/api/3/serverInfo').replyOnce(200, { baseUrl: 'http://my.jira.net' })
      mockAxios.onGet('/rest/api/3/instance/license').replyOnce(200, { applications: [] })
      // initial calls as part of login func, for DC
      mockAxios.onGet('/rest/api/2/configuration').reply(200)
      mockAxios.onGet('/rest/api/2/serverInfo').replyOnce(200, { baseUrl: 'http://my.jira.net' })
      mockAxios.onGet('/rest/api/2/instance/license').replyOnce(200, { applications: [] })
    })
    afterEach(() => {
      mockAxios.restore()
    })
    it('should return isProduction undefined and accountType = undefined when account id does not include -sandbox- and has paid app', async () => {
      const credentials = { baseUrl: 'http://myJira.net', user: 'me', token: 'tok', isDataCenter: true }
      connection = await createConnection({ retries: 1 }).login(credentials)
      mockAxios.onGet('/rest/api/2/serverInfo').reply(200, { baseUrl: 'http://my.jira.net' })
      mockAxios.onGet('/rest/api/2/instance/license').reply(200, {
        applications: [
          { id: 'software', plan: 'PAID' },
          { id: 'serviceDesk', plan: 'FREE' },
        ],
      })
      const { isProduction, accountType } = await validateCredentials({
        connection,
        credentials,
      })
      expect(isProduction).toEqual(undefined)
      expect(accountType).toEqual(undefined)
    })
    it('should return isProduction false and accountType = "Sandbox" when account id includes -sandbox-', async () => {
      const credentials = {
        baseUrl: 'https://test-sandbox-999.atlassian.net',
        user: 'me',
        token: 'tok',
        isDataCenter: false,
      }
      connection = await createConnection({ retries: 1 }).login(credentials)
      mockAxios.onGet('/rest/api/3/serverInfo').reply(200, { baseUrl: 'https://test-sandbox-999.atlassian.net' })
      mockAxios.onGet('/rest/api/3/instance/license').reply(200, { applications: [{ plan: 'PAID' }] })
      const { isProduction, accountType } = await validateCredentials({
        connection,
        credentials,
      })
      expect(isProduction).toEqual(false)
      expect(accountType).toEqual('Sandbox')
    })
    it('should return isProduction false and accountType = undefined when account id does not include -sandbox- but has no paid app', async () => {
      const credentials = {
        baseUrl: 'https://test-sandbox-999.atlassian.net',
        user: 'me',
        token: 'tok',
        isDataCenter: false,
      }
      connection = await createConnection({ retries: 1 }).login(credentials)
      mockAxios.onGet('/rest/api/3/serverInfo').reply(200, { baseUrl: 'https://test.atlassian.net' })
      mockAxios.onGet('/rest/api/3/instance/license').reply(200, { applications: [{ plan: 'FREE' }] })
      const { isProduction, accountType } = await validateCredentials({
        connection,
        credentials,
      })
      expect(accountType).toEqual(undefined)
      expect(isProduction).toEqual(false)
    })

    it('should return isProduction undefined and accountType = undefined', async () => {
      const credentials = {
        baseUrl: 'https://test-sandbox-999.atlassian.net',
        user: 'me',
        token: 'tok',
        isDataCenter: true,
      }
      connection = await createConnection({ retries: 1 }).login(credentials)
      mockAxios.onGet('/rest/api/2/serverInfo').reply(200, { baseUrl: 'https://test.atlassian.net' })
      mockAxios.onGet('/rest/api/2/instance/license').reply(200, { applications: [{ plan: 'FREE' }] })
      const { isProduction, accountType } = await validateCredentials({
        connection,
        credentials,
      })
      expect(accountType).toEqual(undefined)
      expect(isProduction).toEqual(undefined)
    })
  })
})
