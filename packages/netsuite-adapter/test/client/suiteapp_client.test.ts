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
import Bottleneck from 'bottleneck'
import MockAdapter from 'axios-mock-adapter'
import _ from 'lodash'
import SoapClient from '../../src/client/suiteapp_client/soap_client/soap_client'
import { ReadFileEncodingError, ReadFileError, ReadFileInsufficientPermissionError } from '../../src/client/suiteapp_client/errors'
import SuiteAppClient, { PAGE_SIZE } from '../../src/client/suiteapp_client/suiteapp_client'
import { InvalidSuiteAppCredentialsError } from '../../src/client/types'


describe('SuiteAppClient', () => {
  let mockAxiosAdapter: MockAdapter
  let client: SuiteAppClient
  beforeEach(() => {
    mockAxiosAdapter = new MockAdapter(axios, { delayResponse: 1, onNoMatch: 'throwException' })

    client = new SuiteAppClient({
      credentials: {
        accountId: 'ACCOUNT_ID',
        suiteAppTokenId: 'tokenId',
        suiteAppTokenSecret: 'tokenSecret',
      },
      globalLimiter: new Bottleneck(),
    })
  })

  afterEach(() => {
    mockAxiosAdapter.restore()
  })

  describe('runSuiteQL', () => {
    it('successful query should return the results', async () => {
      mockAxiosAdapter.onPost().reply(200, {
        hasMore: false,
        items: [{ links: [], a: 1 }, { links: [], a: 2 }],
      })

      const results = await client.runSuiteQL('query')

      expect(results).toEqual([{ a: 1 }, { a: 2 }])
      expect(mockAxiosAdapter.history.post.length).toBe(1)
      const req = mockAxiosAdapter.history.post[0]
      expect(req.url).toEqual('https://account-id.suitetalk.api.netsuite.com/services/rest/query/v1/suiteql?limit=1000&offset=0')
      expect(JSON.parse(req.data)).toEqual({ q: 'query' })
      expect(req.headers).toEqual({
        Authorization: expect.any(String),
        'Content-Type': 'application/json',
        Accept: 'application/json, text/plain, */*',
        prefer: 'transient',
      })
    })

    it('should return all pages', async () => {
      const range = _.range(1500)
      const items = range.map(i => ({ i }))
      const chunks = range.filter(i => i % PAGE_SIZE === 0)

      chunks.forEach(offset => {
        mockAxiosAdapter.onPost(new RegExp(`.*limit=${PAGE_SIZE}.*offset=${offset}`)).reply(200, {
          hasMore: offset + PAGE_SIZE < items.length,
          items: items.slice(offset, offset + PAGE_SIZE).map(item => ({ ...item, links: [] })),
        })
      })

      const results = await client.runSuiteQL('query')

      expect(results).toEqual(items)
      expect(mockAxiosAdapter.history.post.length).toBe(2)
      const requests = mockAxiosAdapter.history.post
      expect(requests[0].url).toEqual('https://account-id.suitetalk.api.netsuite.com/services/rest/query/v1/suiteql?limit=1000&offset=0')
      expect(requests[1].url).toEqual('https://account-id.suitetalk.api.netsuite.com/services/rest/query/v1/suiteql?limit=1000&offset=1000')
    })

    it('should throw InvalidSuiteAppCredentialsError', async () => {
      mockAxiosAdapter.onPost().reply(401, 'Invalid SuiteApp credentials')
      await expect(client.runSuiteQL('query')).rejects.toThrow(InvalidSuiteAppCredentialsError)
    })

    describe('query failure', () => {
      jest.setTimeout(7000)
      it('exception thrown', async () => {
        mockAxiosAdapter.onPost().reply(() => [])
        expect(await client.runSuiteQL('')).toBeUndefined()
      })
      it('with retry', async () => {
        mockAxiosAdapter
          .onPost().replyOnce(500)
          .onPost().replyOnce(200, {
            hasMore: false,
            items: [{ links: [], a: 1 }, { links: [], a: 2 }],
          })

        expect(await client.runSuiteQL('query')).toEqual([{ a: 1 }, { a: 2 }])
        expect(mockAxiosAdapter.history.post.length).toBe(2)
      })
      it('invalid results', async () => {
        mockAxiosAdapter.onPost().reply(200, {})
        expect(await client.runSuiteQL('')).toBeUndefined()
      })
    })
  })

  describe('runSavedSearchQuery', () => {
    it('successful query should return the results', async () => {
      mockAxiosAdapter.onPost().reply(200, {
        status: 'success',
        results: [{ a: 1 }, { a: 2 }],
      })

      const results = await client.runSavedSearchQuery({
        type: 'type',
        columns: [],
        filters: [],
      })

      expect(results).toEqual([{ a: 1 }, { a: 2 }])
      expect(mockAxiosAdapter.history.post.length).toBe(1)
      const req = mockAxiosAdapter.history.post[0]
      expect(req.url).toEqual('https://account-id.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=customscript_salto_restlet&deploy=customdeploy_salto_restlet')
      expect(JSON.parse(req.data)).toEqual({
        operation: 'search',
        args: {
          type: 'type',
          columns: [],
          filters: [],
          offset: 0,
          limit: 1000,
        },
      })
    })

    describe('query failure', () => {
      it('exception thrown', async () => {
        mockAxiosAdapter.onPost().reply(() => [])
        expect(await client.runSavedSearchQuery({
          type: 'type',
          columns: [],
          filters: [],
        })).toBeUndefined()
      })

      it('invalid saved search results', async () => {
        mockAxiosAdapter.onPost().reply(200, { status: 'success', results: {} })
        expect(await client.runSavedSearchQuery({
          type: 'type',
          columns: [],
          filters: [],
        })).toBeUndefined()
      })

      it('invalid restlet results', async () => {
        mockAxiosAdapter.onPost().reply(200, {})
        expect(await client.runSavedSearchQuery({
          type: 'type',
          columns: [],
          filters: [],
        })).toBeUndefined()
      })

      it('error status', async () => {
        mockAxiosAdapter.onPost().reply(200, { status: 'error', message: '' })
        expect(await client.runSavedSearchQuery({
          type: 'type',
          columns: [],
          filters: [],
        })).toBeUndefined()
      })
    })

    it('should return all pages', async () => {
      const items = _.range(1500).map(i => ({ i }))

      mockAxiosAdapter.onPost().reply(({ data }) => {
        const { args } = JSON.parse(data)
        return [
          200,
          {
            status: 'success',
            results: items.slice(args.offset, args.offset + args.limit),
          },
        ]
      })

      const results = await client.runSavedSearchQuery({
        type: 'type',
        columns: [],
        filters: [],
      })

      expect(results).toEqual(items)
      expect(mockAxiosAdapter.history.post.length).toBe(2)
      const requests = mockAxiosAdapter.history.post

      expect(JSON.parse(requests[0].data)).toEqual({
        operation: 'search',
        args: {
          type: 'type',
          columns: [],
          filters: [],
          offset: 0,
          limit: 1000,
        },
      })

      expect(JSON.parse(requests[1].data)).toEqual({
        operation: 'search',
        args: {
          type: 'type',
          columns: [],
          filters: [],
          offset: 1000,
          limit: 1000,
        },
      })
    })
  })

  describe('getSystemInformation', () => {
    it('successful request should return the results', async () => {
      mockAxiosAdapter.onPost().reply(200, {
        status: 'success',
        results: {
          appVersion: [0, 1, 2],
          time: 1000,
        },
      })

      const results = await client.getSystemInformation()

      expect(results).toEqual({ appVersion: [0, 1, 2], time: new Date(1000) })
      expect(mockAxiosAdapter.history.post.length).toBe(1)
      const req = mockAxiosAdapter.history.post[0]
      expect(JSON.parse(req.data)).toEqual({
        operation: 'sysInfo',
        args: {},
      })
    })

    describe('request failure', () => {
      it('exception thrown', async () => {
        mockAxiosAdapter.onPost().reply(() => [])
        expect(await client.getSystemInformation()).toBeUndefined()
      })
      it('invalid results', async () => {
        mockAxiosAdapter.onPost().reply(200, { status: 'success', results: {} })
        expect(await client.getSystemInformation()).toBeUndefined()
      })
    })
  })

  describe('validateCredentials', () => {
    it('should fail when request fails', async () => {
      mockAxiosAdapter.onPost().reply(() => [])
      await expect(SuiteAppClient.validateCredentials({
        accountId: 'ACCOUNT_ID',
        suiteAppTokenId: 'tokenId',
        suiteAppTokenSecret: 'tokenSecret',
      })).rejects.toThrow()
    })

    it('should succeed', async () => {
      mockAxiosAdapter.onPost().reply(200, {
        status: 'success',
        results: {
          appVersion: [0, 1, 2],
          time: '2021-02-22T18:55:17.949Z',
        },
      })

      await expect(SuiteAppClient.validateCredentials({
        accountId: 'ACCOUNT_ID',
        suiteAppTokenId: 'tokenId',
        suiteAppTokenSecret: 'tokenSecret',
      })).resolves.toBeUndefined()
    })
  })

  describe('readFiles', () => {
    it('should return the right results', async () => {
      mockAxiosAdapter.onPost().reply(200, {
        status: 'success',
        results: [
          {
            status: 'success',
            type: 'PLAINTEXT',
            content: 'someText1',
          },
          {
            status: 'success',
            type: 'bin',
            content: Buffer.from('someText2').toString('base64'),
          },
          {
            status: 'error',
            error: {
              name: 'INVALID_FILE_ENCODING',
            },
          },
          {
            status: 'error',
            error: {
              name: 'INSUFFICIENT_PERMISSION',
            },
          },
          {
            status: 'error',
            error: {
              name: 'OTHER_ERROR',
            },
          },
        ],
      })

      const results = await client.readFiles([1, 2, 3, 4, 5])
      expect(results).toEqual([
        Buffer.from('someText1'),
        Buffer.from('someText2'),
        expect.any(ReadFileEncodingError),
        expect.any(ReadFileInsufficientPermissionError),
        expect.any(ReadFileError),
      ])

      expect(mockAxiosAdapter.history.post.length).toBe(1)
      const req = mockAxiosAdapter.history.post[0]
      expect(req.url).toEqual('https://account-id.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=customscript_salto_restlet&deploy=customdeploy_salto_restlet')
      expect(JSON.parse(req.data)).toEqual({
        operation: 'readFile',
        args: {
          ids: [1, 2, 3, 4, 5],
        },
      })
    })

    it('Invalid response should return undefined', async () => {
      mockAxiosAdapter.onPost().reply(200, {
        status: 'success',
        results: { invalid: 1 },
      })

      expect(await client.readFiles([1, 2, 3, 4])).toBeUndefined()
    })

    it('When exception is thrown should return undefined', async () => {
      mockAxiosAdapter.onPost().reply(() => [])

      expect(await client.readFiles([1, 2, 3, 4])).toBeUndefined()
    })
  })

  describe('readLargeFile', () => {
    const readFileMock = jest.spyOn(SoapClient.prototype, 'readFile')
    beforeEach(() => {
      readFileMock.mockReset()
    })

    it('Should return the SOAP client results', async () => {
      readFileMock.mockResolvedValue(Buffer.from('aaa'))
      expect(await client.readLargeFile(1)).toEqual(Buffer.from('aaa'))
      expect(readFileMock).toHaveBeenCalledWith(1)
    })

    it('Should return the SOAP client error', async () => {
      readFileMock.mockRejectedValue(new Error('bbb'))
      expect(await client.readLargeFile(1)).toEqual(new Error('bbb'))
    })
  })
})
