/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import axios, { AxiosHeaders } from 'axios'
import MockAdapter from 'axios-mock-adapter'
import { mockFunction } from '@salto-io/test-utils'
import { ClientRateLimitConfig } from '../../src/definitions/user/client_config'
import {
  AdapterHTTPClient,
  APIConnection,
  ClientOpts,
  ConnectionCreator,
  HTTPError,
  RATE_LIMIT_DEFAULT_OPTIONS,
  UnauthorizedError,
} from '../../src/client'
import { createConnection, Credentials } from './common'
import { TimeoutError } from '../../src/client/http_client'

const STATUSES_TO_RETRY = [1, 2, 3]

describe('client_http_client', () => {
  let mockAxiosAdapter: MockAdapter
  let mockCreateConnection: jest.MockedFunction<ConnectionCreator<Credentials>>

  beforeEach(() => {
    jest.clearAllMocks()
    mockAxiosAdapter = new MockAdapter(axios, { delayResponse: 1, onNoMatch: 'throwException' })
    mockCreateConnection = jest.fn(createConnection)
  })

  afterEach(() => {
    mockAxiosAdapter.restore()
  })

  class MyCustomClient extends AdapterHTTPClient<Credentials, ClientRateLimitConfig> {
    constructor(clientOpts: ClientOpts<Credentials, ClientRateLimitConfig>) {
      super('MyCustom', clientOpts, mockCreateConnection, {
        pageSize: { get: 123 },
        rateLimit: { total: -1, get: 3, deploy: 4 },
        maxRequestsPerMinute: -1,
        delayPerRequestMS: 0,
        useBottleneck: RATE_LIMIT_DEFAULT_OPTIONS.useBottleneck,
        retry: {
          maxAttempts: 3,
          retryDelay: 123,
          additionalStatusCodesToRetry: STATUSES_TO_RETRY,
        },
        timeout: {
          lastRetryNoTimeout: true,
          retryOnTimeout: true,
        },
      })
    }
  }

  describe('get', () => {
    it('should make the right request', async () => {
      expect(mockCreateConnection).not.toHaveBeenCalled()
      const client = new MyCustomClient({ credentials: { username: 'user', password: 'password' } })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const clearValuesFromResponseDataFunc = jest.spyOn(MyCustomClient.prototype as any, 'clearValuesFromResponseData')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const extractHeadersFunc = jest.spyOn(MyCustomClient.prototype as any, 'extractHeaders')
      expect(mockCreateConnection).toHaveBeenCalledTimes(1)

      mockAxiosAdapter.onGet('/users/me').reply(200, {
        accountId: 'ACCOUNT_ID',
      })
      mockAxiosAdapter.onGet('/ep').replyOnce(200, { a: 'b' }, { h: '123', 'X-Rate-Limit': '456', 'Retry-After': '93' })
      mockAxiosAdapter.onGet('/ep2', { a: ['AAA', 'BBB'], c: '' }).replyOnce(200, { c: 'd' }, { hh: 'header' })
      mockAxiosAdapter.onGet('/ep3', { a: 'A' }).replyOnce(200, { c: 'd' }, { hh: 'header' })

      const getRes = await client.get({ url: '/ep' })
      const getRes2 = await client.get({
        url: '/ep2',
        queryParams: { a: ['AAA', 'BBB'], c: '' },
        queryParamsSerializer: { indexes: null },
      })
      const getRes3 = await client.get({
        url: '/ep3',
        queryParams: { a: 'A', b: '' },
        queryParamsSerializer: { omitEmpty: true },
      })
      expect(getRes).toEqual({ data: { a: 'b' }, status: 200, headers: { 'X-Rate-Limit': '456', 'Retry-After': '93' } })
      expect(getRes2).toEqual({ data: { c: 'd' }, status: 200, headers: {} })
      expect(getRes3).toEqual({ data: { c: 'd' }, status: 200, headers: {} })
      expect(clearValuesFromResponseDataFunc).toHaveBeenCalledTimes(3)
      expect(clearValuesFromResponseDataFunc).toHaveBeenNthCalledWith(1, { a: 'b' }, '/ep')
      expect(clearValuesFromResponseDataFunc).toHaveBeenNthCalledWith(2, { c: 'd' }, '/ep2')
      expect(extractHeadersFunc).toHaveBeenCalledTimes(6)
      expect(extractHeadersFunc).toHaveBeenNthCalledWith(
        1,
        new AxiosHeaders({ h: '123', 'X-Rate-Limit': '456', 'Retry-After': '93' }),
      )
      expect(extractHeadersFunc).toHaveBeenNthCalledWith(
        2,
        new AxiosHeaders({ h: '123', 'X-Rate-Limit': '456', 'Retry-After': '93' }),
      )
      expect(extractHeadersFunc).toHaveBeenNthCalledWith(3, new AxiosHeaders({ hh: 'header' }))
      expect(extractHeadersFunc).toHaveBeenNthCalledWith(4, new AxiosHeaders({ hh: 'header' }))
      expect(extractHeadersFunc).toHaveBeenNthCalledWith(5, new AxiosHeaders({ hh: 'header' }))
      expect(extractHeadersFunc).toHaveBeenNthCalledWith(6, new AxiosHeaders({ hh: 'header' }))
      const request = mockAxiosAdapter.history.get[2]
      expect(request.url).toEqual('/ep2')
      expect(request.paramsSerializer).toEqual({ indexes: null })
    })

    it('should throw Unauthorized on login 401', async () => {
      const client = new MyCustomClient({ credentials: { username: 'user', password: 'password' } })
      mockAxiosAdapter.onGet('/users/me').reply(401, {
        accountId: 'ACCOUNT_ID',
      })
      await expect(client.get({ url: '/ep' })).rejects.toThrow(UnauthorizedError)
    })

    it('should throw HTTPError on other http errors', async () => {
      const client = new MyCustomClient({ credentials: { username: 'user', password: 'password' } })
      mockAxiosAdapter.onGet('/users/me').reply(200, {
        accountId: 'ACCOUNT_ID',
      })
      mockAxiosAdapter.onGet('/ep').replyOnce(400, { a: 'b' })
      await expect(client.get({ url: '/ep' })).rejects.toThrow(HTTPError)
    })

    it('should throw TimeoutError if received ETIMEDOUT', async () => {
      class ETIMEDOUTError {
        readonly code: string
        constructor() {
          this.code = 'ETIMEDOUT'
        }
      }
      mockCreateConnection.mockReturnValue({
        login: async () => ({
          get: mockFunction<APIConnection['get']>().mockRejectedValue(new ETIMEDOUTError()),
          post: mockFunction<APIConnection['post']>(),
          put: mockFunction<APIConnection['put']>(),
          patch: mockFunction<APIConnection['patch']>(),
          delete: mockFunction<APIConnection['delete']>(),
          head: mockFunction<APIConnection['delete']>(),
          options: mockFunction<APIConnection['delete']>(),
          accountInfo: {
            accountId: 'ACCOUNT_ID',
            accountType: 'Sandbox',
            isProduction: false,
          },
        }),
      })
      const client = new MyCustomClient({ credentials: { username: 'user', password: 'password' } })
      await expect(client.get({ url: '/ep' })).rejects.toThrow(TimeoutError)
    })
  })

  describe('head', () => {
    it('should make the right request', async () => {
      expect(mockCreateConnection).not.toHaveBeenCalled()
      const client = new MyCustomClient({ credentials: { username: 'user', password: 'password' } })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const clearValuesFromResponseDataFunc = jest.spyOn(MyCustomClient.prototype as any, 'clearValuesFromResponseData')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const extractHeadersFunc = jest.spyOn(MyCustomClient.prototype as any, 'extractHeaders')
      expect(mockCreateConnection).toHaveBeenCalledTimes(1)

      mockAxiosAdapter.onGet('/users/me').reply(200, {
        accountId: 'ACCOUNT_ID',
      })
      mockAxiosAdapter
        .onHead('/ep')
        .replyOnce(200, { a: 'b' }, { h: '123', 'X-Rate-Limit': '456', 'Retry-After': '93' })
      mockAxiosAdapter.onHead('/ep2', { a: 'AAA' }).replyOnce(200, { c: 'd' }, { hh: 'header' })

      const res = await client.head({ url: '/ep' })
      const res2 = await client.head({ url: '/ep2', queryParams: { a: 'AAA' } })
      expect(res).toEqual({ data: { a: 'b' }, status: 200, headers: { 'X-Rate-Limit': '456', 'Retry-After': '93' } })
      expect(res2).toEqual({ data: { c: 'd' }, status: 200, headers: {} })
      expect(clearValuesFromResponseDataFunc).toHaveBeenCalledTimes(2)
      expect(clearValuesFromResponseDataFunc).toHaveBeenNthCalledWith(1, { a: 'b' }, '/ep')
      expect(clearValuesFromResponseDataFunc).toHaveBeenNthCalledWith(2, { c: 'd' }, '/ep2')
      expect(extractHeadersFunc).toHaveBeenCalledTimes(4)
      expect(extractHeadersFunc).toHaveBeenNthCalledWith(
        1,
        new AxiosHeaders({ h: '123', 'X-Rate-Limit': '456', 'Retry-After': '93' }),
      )
      expect(extractHeadersFunc).toHaveBeenNthCalledWith(
        2,
        new AxiosHeaders({ h: '123', 'X-Rate-Limit': '456', 'Retry-After': '93' }),
      )
      expect(extractHeadersFunc).toHaveBeenNthCalledWith(3, new AxiosHeaders({ hh: 'header' }))
      expect(extractHeadersFunc).toHaveBeenNthCalledWith(4, new AxiosHeaders({ hh: 'header' }))
    })

    it('should throw HTTPError on http errors', async () => {
      const client = new MyCustomClient({ credentials: { username: 'user', password: 'password' } })
      mockAxiosAdapter.onGet('/users/me').reply(200, {
        accountId: 'ACCOUNT_ID',
      })
      mockAxiosAdapter.onHead('/ep').replyOnce(400, { a: 'b' })
      await expect(client.head({ url: '/ep' })).rejects.toThrow(HTTPError)
    })
  })

  describe('options', () => {
    it('should make the right request', async () => {
      expect(mockCreateConnection).not.toHaveBeenCalled()
      const client = new MyCustomClient({ credentials: { username: 'user', password: 'password' } })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const clearValuesFromResponseDataFunc = jest.spyOn(MyCustomClient.prototype as any, 'clearValuesFromResponseData')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const extractHeadersFunc = jest.spyOn(MyCustomClient.prototype as any, 'extractHeaders')
      expect(mockCreateConnection).toHaveBeenCalledTimes(1)

      mockAxiosAdapter.onGet('/users/me').reply(200, {
        accountId: 'ACCOUNT_ID',
      })
      mockAxiosAdapter
        .onOptions('/ep')
        .replyOnce(200, { a: 'b' }, { h: '123', 'X-Rate-Limit': '456', 'Retry-After': '93' })
      mockAxiosAdapter.onOptions('/ep2', { a: 'AAA' }).replyOnce(200, { c: 'd' }, { hh: 'header' })

      const res = await client.options({ url: '/ep' })
      const res2 = await client.options({ url: '/ep2', queryParams: { a: 'AAA' } })
      expect(res).toEqual({ data: { a: 'b' }, status: 200, headers: { 'X-Rate-Limit': '456', 'Retry-After': '93' } })
      expect(res2).toEqual({ data: { c: 'd' }, status: 200, headers: {} })
      expect(clearValuesFromResponseDataFunc).toHaveBeenCalledTimes(2)
      expect(clearValuesFromResponseDataFunc).toHaveBeenNthCalledWith(1, { a: 'b' }, '/ep')
      expect(clearValuesFromResponseDataFunc).toHaveBeenNthCalledWith(2, { c: 'd' }, '/ep2')
      expect(extractHeadersFunc).toHaveBeenCalledTimes(4)
      expect(extractHeadersFunc).toHaveBeenNthCalledWith(
        1,
        new AxiosHeaders({ h: '123', 'X-Rate-Limit': '456', 'Retry-After': '93' }),
      )
      expect(extractHeadersFunc).toHaveBeenNthCalledWith(
        2,
        new AxiosHeaders({ h: '123', 'X-Rate-Limit': '456', 'Retry-After': '93' }),
      )
      expect(extractHeadersFunc).toHaveBeenNthCalledWith(3, new AxiosHeaders({ hh: 'header' }))
      expect(extractHeadersFunc).toHaveBeenNthCalledWith(4, new AxiosHeaders({ hh: 'header' }))
    })

    it('should throw HTTPError on http errors', async () => {
      const client = new MyCustomClient({ credentials: { username: 'user', password: 'password' } })
      mockAxiosAdapter.onGet('/users/me').reply(200, {
        accountId: 'ACCOUNT_ID',
      })
      mockAxiosAdapter.onOptions('/ep').replyOnce(400, { a: 'b' })
      await expect(client.options({ url: '/ep' })).rejects.toThrow(HTTPError)
    })
  })

  describe('post', () => {
    it('should make the right request', async () => {
      expect(mockCreateConnection).not.toHaveBeenCalled()
      const client = new MyCustomClient({ credentials: { username: 'user', password: 'password' } })
      expect(mockCreateConnection).toHaveBeenCalledTimes(1)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const clearValuesFromResponseDataFunc = jest.spyOn(MyCustomClient.prototype as any, 'clearValuesFromResponseData')

      mockAxiosAdapter.onGet('/users/me').reply(200, {
        accountId: 'ACCOUNT_ID',
      })
      mockAxiosAdapter.onPost('/ep', 'someData').replyOnce(200, { a: 'b' })

      const postRes = await client.post({ url: '/ep', data: 'someData' })
      expect(postRes).toEqual({ data: { a: 'b' }, status: 200, headers: {} })
      expect(clearValuesFromResponseDataFunc).toHaveBeenCalledTimes(1)
      expect(clearValuesFromResponseDataFunc).toHaveBeenCalledWith({ a: 'b' }, '/ep')
    })
    it('should retry on given status codes', async () => {
      // The first replyOnce with 200 is for the client authentication
      mockAxiosAdapter.onGet('/users/me').reply(200, { accountId: 'ACCOUNT_ID' })
      STATUSES_TO_RETRY.forEach(status => mockAxiosAdapter.onPost().replyOnce(status))
      mockAxiosAdapter.onPost().replyOnce(200)

      const client = new MyCustomClient({ credentials: { username: 'user', password: 'password' } })
      await client.post({ url: '/ep', data: '' })
      expect(mockAxiosAdapter.history.post.length).toEqual(STATUSES_TO_RETRY.length + 1)
    })
  })

  describe('put', () => {
    it('should make the right request', async () => {
      expect(mockCreateConnection).not.toHaveBeenCalled()
      const client = new MyCustomClient({ credentials: { username: 'user', password: 'password' } })
      expect(mockCreateConnection).toHaveBeenCalledTimes(1)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const clearValuesFromResponseDataFunc = jest.spyOn(MyCustomClient.prototype as any, 'clearValuesFromResponseData')

      mockAxiosAdapter.onGet('/users/me').reply(200, {
        accountId: 'ACCOUNT_ID',
      })
      mockAxiosAdapter.onPut('/ep', 'someData').replyOnce(200, { a: 'b' })

      const putRes = await client.put({ url: '/ep', data: 'someData' })
      expect(putRes).toEqual({ data: { a: 'b' }, status: 200, headers: {} })
      expect(clearValuesFromResponseDataFunc).toHaveBeenCalledTimes(1)
      expect(clearValuesFromResponseDataFunc).toHaveBeenCalledWith({ a: 'b' }, '/ep')
    })
  })

  describe('delete', () => {
    it('should make the right request', async () => {
      expect(mockCreateConnection).not.toHaveBeenCalled()
      const client = new MyCustomClient({ credentials: { username: 'user', password: 'password' } })
      expect(mockCreateConnection).toHaveBeenCalledTimes(1)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const clearValuesFromResponseDataFunc = jest.spyOn(MyCustomClient.prototype as any, 'clearValuesFromResponseData')

      mockAxiosAdapter.onGet('/users/me').reply(200, {
        accountId: 'ACCOUNT_ID',
      })
      mockAxiosAdapter.onDelete('/ep', { a: 'AAA' }).replyOnce(200, { a: 'b' })

      const getRes = await client.delete({ url: '/ep' })
      expect(getRes).toEqual({ data: { a: 'b' }, status: 200, headers: {} })
      expect(clearValuesFromResponseDataFunc).toHaveBeenCalledTimes(1)
      expect(clearValuesFromResponseDataFunc).toHaveBeenCalledWith({ a: 'b' }, '/ep')
    })
    it('should include data when provided', async () => {
      const client = new MyCustomClient({ credentials: { username: 'user', password: 'password' } })
      mockAxiosAdapter.onGet('/users/me').reply(200, { accountId: 'ACCOUNT_ID' })
      mockAxiosAdapter.onDelete('/ep', { a: 'AAA' }).replyOnce(200, { a: 'b' })
      await client.delete({ url: '/ep', data: { b: 'c' } })
      const request = mockAxiosAdapter.history.delete[0]
      expect(request.url).toEqual('/ep')
      expect(JSON.parse(request.data)).toEqual({ b: 'c' })
    })
  })

  describe('patch', () => {
    it('should make the right request', async () => {
      expect(mockCreateConnection).not.toHaveBeenCalled()
      const client = new MyCustomClient({ credentials: { username: 'user', password: 'password' } })
      expect(mockCreateConnection).toHaveBeenCalledTimes(1)

      mockAxiosAdapter.onGet('/users/me').reply(200, {
        accountId: 'ACCOUNT_ID',
      })
      mockAxiosAdapter.onPatch('/ep', 'someData').replyOnce(200, { a: 'b' })

      const patchRes = await client.patch({ url: '/ep', data: 'someData' })
      expect(patchRes).toEqual({ data: { a: 'b' }, status: 200, headers: {} })
    })
  })

  describe('getPageSize', () => {
    it('should return the default when no pageSize is specified in config', () => {
      const client = new MyCustomClient({ credentials: { username: 'user', password: 'password' } })
      expect(client.getPageSize()).toEqual(123)
    })

    it('should return the provided value when specified', () => {
      const client = new MyCustomClient({
        credentials: { username: 'user', password: 'password' },
        config: {
          pageSize: {
            get: 55,
          },
        },
      })
      expect(client.getPageSize()).toEqual(55)
    })
  })
})
