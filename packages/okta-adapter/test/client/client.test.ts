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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clearValuesFromResponseDataFunc = jest.spyOn(OktaClient.prototype as any, 'clearValuesFromResponseData')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extractHeadersFunc = jest.spyOn(OktaClient.prototype as any, 'extractHeaders')
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

  describe('clearValuesFromResponseData + extractHeaders', () => {
    const idpsResponse = {
      id: '123',
      protocol: {
        type: 'OIDC',
        credentials: {
          client: {
            client_id: 'test',
            client_secret: 'test2',
          },
        },
      },
      array: [{ credentials: 'a' }, { somethingElse: 'b' }],
    }
    const autheticatorsRes = [
      { id: 'a', type: 'google', methods: [{ google: { secretKey: '123' } }, { sso: { secretKey: '122' } }] },
      { id: 'b', type: 'password', credentials: { client: '123' }, methods: ['1', '2', '3'], sharedSecret: 'a' },
    ]
    beforeEach(async () => {
      jest.clearAllMocks()
      // The first replyOnce with 200 is for the client authentication
      mockAxios
        .onGet('/api/v1/org').replyOnce(200, { id: 1 })
        .onGet('/api/v1/idps').replyOnce(200, idpsResponse, { h: '123' })
        .onGet('/api/v1/authenticators')
        .replyOnce(200, autheticatorsRes, { h: '123', link: 'aaa', 'x-rate-limit': '456', 'x-rate-limit-remaining': '456' })
    })
    it('should return response data with no secrets and only the relevant headers', async () => {
      const firstRes = await client.getSinglePage({ url: '/api/v1/idps' })
      expect(firstRes).toEqual({ status: 200, data: idpsResponse, headers: { } })
      const secondRes = await client.getSinglePage({ url: '/api/v1/authenticators' })
      expect(secondRes).toEqual({ status: 200, data: autheticatorsRes, headers: { link: 'aaa', 'x-rate-limit': '456', 'x-rate-limit-remaining': '456' } })
      expect(clearValuesFromResponseDataFunc).toHaveBeenCalledTimes(2)
      expect(clearValuesFromResponseDataFunc).toHaveNthReturnedWith(1,
        {
          id: '123',
          protocol: {
            type: 'OIDC',
            credentials: '<SECRET>',
          },
          array: [{ credentials: '<SECRET>' }, { somethingElse: 'b' }],
        })
      expect(clearValuesFromResponseDataFunc).toHaveNthReturnedWith(2,
        [
          { id: 'a', type: 'google', methods: [{ google: { secretKey: '<SECRET>' } }, { sso: { secretKey: '<SECRET>' } }] },
          { id: 'b', type: 'password', credentials: { client: '123' }, methods: ['1', '2', '3'], sharedSecret: '<SECRET>' },
        ])
      expect(extractHeadersFunc).toHaveBeenCalledTimes(2)
      expect(extractHeadersFunc).toHaveNthReturnedWith(1, {})
      expect(extractHeadersFunc).toHaveNthReturnedWith(2, { link: 'aaa', 'x-rate-limit': '456', 'x-rate-limit-remaining': '456' })
    })
  })
})
