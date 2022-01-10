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
import { validateCredentials, axiosConnection, UnauthorizedError } from '../../src/client'
import { createConnection, BASE_URL } from './common'

describe('client_http_connection', () => {
  let mockAxiosAdapter: MockAdapter
  beforeEach(() => {
    mockAxiosAdapter = new MockAdapter(axios, { delayResponse: 1, onNoMatch: 'throwException' })
  })

  afterEach(() => {
    mockAxiosAdapter.restore()
  })

  describe('validateCredentials with axiosConnection', () => {
    it('should login', async () => {
      mockAxiosAdapter.onGet(
        '/users/me',
        undefined,
        expect.objectContaining({
          customheader1: 'user123',
        })
      ).reply(200, {
        accountId: 'ACCOUNT_ID',
      })
      const validateRes = validateCredentials({ username: 'user123', password: 'pass' }, { createConnection })
      expect(await validateRes).toEqual('ACCOUNT_ID:user123')
      expect(mockAxiosAdapter.history.get.length).toBe(1)
      const req = mockAxiosAdapter.history.get[0]
      expect(req.url).toEqual('/users/me')
      expect(req.auth).toEqual({ username: 'user123', password: 'pass' })
      // already verified the customheader1 header in the onGet header matcher
    })
    it('should throw Unauthorized on UnauthorizedError', async () => {
      await expect(() => validateCredentials(
        { username: 'user123', password: 'pass' },
        { createConnection: retryOptions => (axiosConnection({
          retryOptions,
          authParamsFunc: async () => ({}),
          baseURLFunc: () => BASE_URL,
          credValidateFunc: async () => { throw new UnauthorizedError('aaa') },
        })) },
      )).rejects.toThrow(new UnauthorizedError('Unauthorized - update credentials and try again'))
    })
    it('should throw Error on other errors', async () => {
      await expect(() => validateCredentials(
        { username: 'user123', password: 'pass' },
        { createConnection: retryOptions => (axiosConnection({
          retryOptions,
          authParamsFunc: async () => ({}),
          baseURLFunc: () => BASE_URL,
          credValidateFunc: async () => { throw new Error('aaa') },
        })) },
      )).rejects.toThrow(new Error('Login failed with error: Error: aaa'))
    })
  })
})
