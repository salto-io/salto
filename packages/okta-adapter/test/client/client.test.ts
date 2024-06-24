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
import { promises } from '@salto-io/lowerdash'
import OktaClient, { DEFAULT_RATE_LIMIT_BUFFER, UNLIMITED_MAX_REQUESTS_PER_MINUTE } from '../../src/client/client'
import * as clientModule from '../../src/client/client'

const { sleep } = promises.timeout

describe('client', () => {
  let client: OktaClient
  let mockAxios: MockAdapter
  let clearValuesFromResponseDataFunc: jest.SpyInstance
  let extractHeadersFunc: jest.SpyInstance
  beforeEach(() => {
    mockAxios = new MockAdapter(axios)
    client = new OktaClient({ credentials: { baseUrl: 'http://my.okta.net', token: 'token' } })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    clearValuesFromResponseDataFunc = jest.spyOn(OktaClient.prototype as any, 'clearValuesFromResponseData')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    extractHeadersFunc = jest.spyOn(OktaClient.prototype as any, 'extractHeaders')
  })
  afterEach(() => {
    mockAxios.restore()
  })

  describe('get', () => {
    let result: clientUtils.ResponseValue
    beforeEach(async () => {
      // The first replyOnce with 200 is for the client authentication
      mockAxios.onGet('/api/v1/org').replyOnce(200, { id: 1 }).onGet('/myPath').replyOnce(200, { response: 'asd' })
      result = await client.get({ url: '/myPath' })
    })
    it('should return the response', () => {
      expect(result).toEqual({ status: 200, data: { response: 'asd' } })
    })
    it('should request the correct path with auth headers', () => {
      const request = mockAxios.history.get[1]
      expect(request.headers?.Authorization).toEqual('SSWS token')
      expect(request.baseURL).toEqual('http://my.okta.net')
      expect(request.url).toEqual('/myPath')
    })
    it('should return empty array for 404 on AppUserSchema api call', async () => {
      mockAxios.onGet('/api/v1/meta/schemas/apps/0oa6e1b1916fcAiWq5d7/default').replyOnce(404)
      result = await client.get({ url: '/api/v1/meta/schemas/apps/0oa6e1b1916fcAiWq5d7/default' })
      expect(result.data).toEqual([])
    })
    it('should return empty array for 410 errors', async () => {
      mockAxios.onGet('/api/v1/deprecated').replyOnce(410)
      result = await client.get({ url: '/api/v1/deprecated' })
      expect(result.data).toEqual([])
    })
  })
  describe('rateLimits', () => {
    let oktaGetSinglePageSpy: jest.SpyInstance
    let clientGetSinglePageSpy: jest.SpyInstance
    let waitSpy: jest.SpyInstance
    let updateRateLimitsSpy: jest.SpyInstance
    beforeEach(() => {
      jest.restoreAllMocks()
      oktaGetSinglePageSpy = jest.spyOn(client, 'get')
      clientGetSinglePageSpy = jest.spyOn(clientUtils.AdapterHTTPClient.prototype, 'get')
      waitSpy = jest.spyOn(clientModule, 'waitForRateLimit')
      updateRateLimitsSpy = jest.spyOn(clientModule, 'updateRateLimits')
    })
    it('should wait for first request, then wait according to rate limit', async () => {
      for (let i = 1; i <= 2; i += 1) {
        for (let j = 1; j <= 4; j += 1) {
          // eslint-disable-next-line no-loop-func
          clientGetSinglePageSpy.mockImplementationOnce(async () => {
            await sleep(100)
            return {
              headers: {
                'x-rate-limit-remaining': (DEFAULT_RATE_LIMIT_BUFFER + 5 - j).toString(),
                'x-rate-limit-reset': Date.now() / 1000 + 1, // 1 in order to be longer than the total length of the test
                'x-rate-limit-limit': 1, // 1 in order to cancel this condition
              },
            }
          })
        }
      }

      const requests = Array(6)
        .fill(0)
        .map((_, i) => `/api/v1/org${i}`)

      const promise = requests.map(async request => client.get({ url: request }))
      await Promise.all(promise)

      // all enter, 5 wait and 1 continue, 1 wait and 4 continue, 1 continue
      expect(waitSpy).toHaveBeenCalledTimes(5 + 1)
      expect(clientGetSinglePageSpy).toHaveBeenCalledTimes(6)
    })
    it('should enter immediately if rate limit is not exceeded', async () => {
      clientGetSinglePageSpy.mockRejectedValueOnce({
        response: {
          headers: {
            'x-rate-limit-remaining': '99',
            'x-rate-limit-reset': '123',
            'x-rate-limit-limit': 100,
          },
          status: 410,
        },
      })
      clientGetSinglePageSpy.mockImplementationOnce(async () => {
        await sleep(100)
        return { headers: { 'x-rate-limit-remaining': '98', 'x-rate-limit-reset': '123', 'x-rate-limit-limit': 100 } }
      })
      clientGetSinglePageSpy.mockImplementationOnce(async () => {
        await sleep(100)
        return { headers: { 'x-rate-limit-remaining': '97', 'x-rate-limit-reset': '123', 'x-rate-limit-limit': 100 } }
      })
      clientGetSinglePageSpy.mockImplementationOnce(async () => ({
        headers: {
          'x-rate-limit-remaining': '96',
          'x-rate-limit-reset': '123',
          'x-rate-limit-limit': 100,
        },
      }))
      const firstRequest = client.get({ url: '/api/v1/org1' })
      const secondRequest = client.get({ url: '/api/v1/org2' })
      const thirdRequest = client.get({ url: '/api/v1/org3' })
      await firstRequest
      const forthRequest = client.get({ url: '/api/v1/org4' })
      await Promise.all([secondRequest, thirdRequest, forthRequest])

      // The first request should enter immediately while the second and third wait for the first to finish
      // The first returns and updates the rate limit, then the forth request enters immediately
      // Then the second and third requests finish waiting and enters
      expect(clientGetSinglePageSpy).toHaveBeenCalledTimes(4)
      expect(waitSpy).toHaveBeenCalledTimes(2)

      expect(oktaGetSinglePageSpy).toHaveBeenNthCalledWith(1, { url: '/api/v1/org1' })
      expect(oktaGetSinglePageSpy).toHaveBeenNthCalledWith(2, { url: '/api/v1/org2' })
      expect(oktaGetSinglePageSpy).toHaveBeenNthCalledWith(3, { url: '/api/v1/org3' })
      expect(oktaGetSinglePageSpy).toHaveBeenNthCalledWith(4, { url: '/api/v1/org4' })

      expect(clientGetSinglePageSpy).toHaveBeenNthCalledWith(1, { url: '/api/v1/org1' })
      expect(clientGetSinglePageSpy).toHaveBeenNthCalledWith(2, { url: '/api/v1/org4' })
      expect(clientGetSinglePageSpy).toHaveBeenNthCalledWith(3, { url: '/api/v1/org2' })
      expect(clientGetSinglePageSpy).toHaveBeenNthCalledWith(4, { url: '/api/v1/org3' })
    })
    it('should skip the rate limit code if rateLimitBuffer is set to -1', async () => {
      const unlimitedClient = new OktaClient({
        credentials: { baseUrl: 'http://my.okta.net', token: 'token' },
        config: { rateLimit: { rateLimitBuffer: UNLIMITED_MAX_REQUESTS_PER_MINUTE } },
      })
      const requests = Array(5)
        .fill(0)
        .map((_, i) => `/api/v1/org${i}`)
      requests.forEach(_ => {
        clientGetSinglePageSpy.mockImplementationOnce(async () => {
          await sleep(100)
          return {}
        })
      })

      const promise = requests.map(async request => unlimitedClient.get({ url: request }))
      await Promise.all(promise)

      expect(waitSpy).toHaveBeenCalledTimes(0)
      expect(updateRateLimitsSpy).toHaveBeenCalledTimes(0)
    })
    it('should not pass max rate-limit-limit', async () => {
      const unlimitedClient = new OktaClient({
        credentials: { baseUrl: 'http://my.okta.net', token: 'token' },
        config: { rateLimit: { rateLimitBuffer: 0 } },
      })
      const requests = Array(5)
        .fill(0)
        .map((_, i) => `/api/v1/org${i}`)
      requests.forEach(_ => {
        clientGetSinglePageSpy.mockImplementationOnce(async () => {
          await sleep(100)
          return {
            headers: {
              'x-rate-limit-remaining': '3',
              'x-rate-limit-reset': '123',
              'x-rate-limit-limit': 3,
            },
          }
        })
      })

      const promise = requests.map(async request => unlimitedClient.get({ url: request }))
      await Promise.all(promise)

      // 1 enter and 4 wait, then 3 enter and 1 wait
      expect(waitSpy).toHaveBeenCalledTimes(4 + 1)
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
    const usersRes = [
      { id: 'a', status: 'ACTIVE', profile: { firstName: 'test', login: 'user@example.com', mobilePhone: 123 } },
      { id: 'b', status: 'ACTIVE', profile: { firstName: 'test2', login: 'user2@example.com', mobilePhone: 123 } },
    ]
    beforeEach(async () => {
      jest.clearAllMocks()
      // The first replyOnce with 200 is for the client authentication
      mockAxios
        .onGet('/api/v1/org')
        .replyOnce(200, { id: 1 })
        .onGet('/api/v1/idps')
        .replyOnce(200, idpsResponse, { h: '123' })
        .onGet('/api/v1/authenticators')
        .replyOnce(200, autheticatorsRes, {
          h: '123',
          link: 'aaa',
          'x-rate-limit': '456',
          'x-rate-limit-remaining': '456',
        })
        .onGet('/api/v1/users')
        .replyOnce(200, usersRes, { h: 'abc' })
    })
    it('should return response data with no secrets and only the relevant headers', async () => {
      const firstRes = await client.get({ url: '/api/v1/idps' })
      expect(firstRes).toEqual({ status: 200, data: idpsResponse, headers: {} })
      const secondRes = await client.get({ url: '/api/v1/authenticators' })
      expect(secondRes).toEqual({
        status: 200,
        data: autheticatorsRes,
        headers: { link: 'aaa', 'x-rate-limit': '456', 'x-rate-limit-remaining': '456' },
      })
      const thirdRes = await client.get({ url: '/api/v1/users' })
      expect(thirdRes).toEqual({ status: 200, data: usersRes, headers: {} })
      expect(clearValuesFromResponseDataFunc).toHaveBeenCalledTimes(3)
      expect(clearValuesFromResponseDataFunc).toHaveNthReturnedWith(1, {
        id: '123',
        protocol: {
          type: 'OIDC',
          credentials: '<OMITTED>',
        },
        array: [{ credentials: '<OMITTED>' }, { somethingElse: 'b' }],
      })
      expect(clearValuesFromResponseDataFunc).toHaveNthReturnedWith(2, [
        {
          id: 'a',
          type: 'google',
          methods: [{ google: { secretKey: '<OMITTED>' } }, { sso: { secretKey: '<OMITTED>' } }],
        },
        {
          id: 'b',
          type: 'password',
          credentials: { client: '123' },
          methods: ['1', '2', '3'],
          sharedSecret: '<OMITTED>',
        },
      ])
      expect(clearValuesFromResponseDataFunc).toHaveNthReturnedWith(3, [
        { id: 'a', status: 'ACTIVE', profile: { login: 'user@example.com' } },
        { id: 'b', status: 'ACTIVE', profile: { login: 'user2@example.com' } },
      ])
      expect(extractHeadersFunc).toHaveBeenCalledTimes(6)
      expect(extractHeadersFunc).toHaveNthReturnedWith(1, {})
      expect(extractHeadersFunc).toHaveNthReturnedWith(2, {})
      expect(extractHeadersFunc).toHaveNthReturnedWith(3, {
        link: 'aaa',
        'x-rate-limit': '456',
        'x-rate-limit-remaining': '456',
      })
      expect(extractHeadersFunc).toHaveNthReturnedWith(4, {
        link: 'aaa',
        'x-rate-limit': '456',
        'x-rate-limit-remaining': '456',
      })
    })
  })
  describe('get baseurl', () => {
    it('should return the base url', () => {
      expect(client.baseUrl).toEqual('http://my.okta.net')
    })
  })
  describe('getResource ', () => {
    let result: clientUtils.ResponseValue
    it('should return the response', async () => {
      // The first replyOnce with 200 is for the client authentication
      mockAxios.onGet('/api/v1/org').replyOnce(200, { id: 1 }).onGet('/myPath').replyOnce(200, { response: 'asd' })
      result = await client.getResource({ url: '/myPath' })
      expect(result).toEqual({ status: 200, data: { response: 'asd' } })
    })
    it('sholud throw error if the response is not 200', async () => {
      mockAxios.onGet('/myPath').replyOnce(404)
      await expect(client.getResource({ url: '/myPath' })).rejects.toThrow('Request failed with status code 404')
    })
  })
})
