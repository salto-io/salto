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
import { mockFunction } from '@salto-io/test-utils'
import { CredentialError } from '@salto-io/adapter-api'
import { createConnection, validateCredentials } from '../../src/client/connection'

describe('client connection', () => {
  describe('validateCredentials', () => {
    const mockGet = jest.fn()
    const mockConnection: clientUtils.APIConnection = {
      get: mockFunction<clientUtils.APIConnection['get']>()
        .mockImplementation(url => mockGet(url)),
      post: mockFunction<clientUtils.APIConnection['post']>(),
      put: mockFunction<clientUtils.APIConnection['put']>(),
      delete: mockFunction<clientUtils.APIConnection['delete']>(),
      patch: mockFunction<clientUtils.APIConnection['patch']>(),
    }
    it('should always extract empty account id', async () => {
      mockGet.mockImplementationOnce(url => Promise.resolve(
        url === '/users/me'
          // eslint-disable-next-line camelcase
          ? ({ data: { id: 'id123', company_name: 'company123' }, status: 200, statusText: 'OK' })
          : { data: {}, status: 200, statusText: 'OK' }
      ))
      mockGet.mockImplementationOnce(url => Promise.resolve(
        url === '/users/me'
          ? ({ data: { id: 'id456' }, status: 200, statusText: 'OK' })
          : { data: {}, status: 200, statusText: 'OK' }
      ))
      expect(await validateCredentials({ connection: mockConnection })).toEqual('')
      expect(await validateCredentials({ connection: mockConnection })).toEqual('')
    })
    it('should throw credential error when response is 401', async () => {
      mockGet.mockRejectedValueOnce({ response: { status: 401 } })
      await expect(validateCredentials({ connection: mockConnection }))
        .rejects.toThrow(CredentialError)
    })
    it('should throw error when response is not 401', async () => {
      const connectionError = new Error('connection error')
      Object.assign(connectionError, { response: { status: 404 } })
      mockGet.mockRejectedValueOnce(connectionError)
      await expect(validateCredentials({ connection: mockConnection }))
        .rejects.toThrow(connectionError)
    })
  })

  describe('createConnection', () => {
    let mockAxiosAdapter: MockAdapter
    beforeEach(() => {
      mockAxiosAdapter = new MockAdapter(axios, { delayResponse: 1, onNoMatch: 'throwException' })
    })

    afterEach(() => {
      mockAxiosAdapter.restore()
    })

    it('should make get requests with correct parameters', async () => {
      const conn = createConnection({ retries: 3 })
      mockAxiosAdapter.onGet(
        '/users/me', undefined, expect.objectContaining({ 'x-user-email': 'user123', 'x-user-token': 'token123' }),
      ).reply(200, {
        id: 'user123',
      }).onGet(
        '/a/b', undefined, expect.objectContaining({ 'x-user-email': 'user123', 'x-user-token': 'token123' }),
      ).reply(200, {
        something: 'bla',
      })
      const apiConn = await conn.login({ username: 'user123', token: 'token123' })
      expect(apiConn.accountId).toEqual('')
      expect(mockAxiosAdapter.history.get.length).toBe(1)

      const getRes = apiConn.get('/a/b')
      const res = await getRes
      expect(res.data).toEqual({ something: 'bla' })
      expect(res.status).toEqual(200)
      expect(mockAxiosAdapter.history.get.length).toBe(2)
    })
  })
})
