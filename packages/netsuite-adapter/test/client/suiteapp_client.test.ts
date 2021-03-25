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
import Bottleneck from 'bottleneck'
import _ from 'lodash'
import SoapClient from '../../src/client/suiteapp_client/soap_client/soap_client'
import { ReadFileEncodingError, ReadFileError } from '../../src/client/suiteapp_client/errors'
import SuiteAppClient from '../../src/client/suiteapp_client/suiteapp_client'

jest.mock('axios')

describe('SuiteAppClient', () => {
  let postMock: jest.SpyInstance
  let client: SuiteAppClient
  beforeEach(() => {
    postMock = jest.spyOn(axios, 'post')
    client = new SuiteAppClient({
      credentials: {
        accountId: 'ACCOUNT_ID',
        suiteAppTokenId: 'tokenId',
        suiteAppTokenSecret: 'tokenSecret',
      },
      globalLimiter: new Bottleneck(),
    })
  })

  describe('runSuiteQL', () => {
    it('successful query should return the results', async () => {
      postMock.mockResolvedValue({
        data: {
          hasMore: false,
          items: [{ links: [], a: 1 }, { links: [], a: 2 }],
        },
      })

      const results = await client.runSuiteQL('query')

      expect(results).toEqual([{ a: 1 }, { a: 2 }])
      expect(postMock).toHaveBeenCalledWith(
        'https://account-id.suitetalk.api.netsuite.com/services/rest/query/v1/suiteql?limit=1000&offset=0',
        { q: 'query' },
        {
          headers: {
            Authorization: expect.any(String),
            'Content-Type': 'application/json',
            prefer: 'transient',
          },
        }
      )
    })

    it('should return all pages', async () => {
      const items = _.range(1500).map(i => ({ i }))

      postMock.mockImplementation(async rawUrl => {
        const url = new URL(rawUrl)
        const limit = parseInt(url.searchParams.get('limit') ?? '', 10)
        const offset = parseInt(url.searchParams.get('offset') ?? '', 10)
        return {
          data: {
            hasMore: offset + limit < items.length,
            items: items.slice(offset, offset + limit).map(item => ({ ...item, links: [] })),
          },
        }
      })

      const results = await client.runSuiteQL('query')

      expect(results).toEqual(items)
      expect(postMock).toHaveBeenCalledWith(
        'https://account-id.suitetalk.api.netsuite.com/services/rest/query/v1/suiteql?limit=1000&offset=0',
        { q: 'query' },
        {
          headers: {
            Authorization: expect.any(String),
            'Content-Type': 'application/json',
            prefer: 'transient',
          },
        }
      )

      expect(postMock).toHaveBeenCalledWith(
        'https://account-id.suitetalk.api.netsuite.com/services/rest/query/v1/suiteql?limit=1000&offset=1000',
        { q: 'query' },
        {
          headers: {
            Authorization: expect.any(String),
            'Content-Type': 'application/json',
            prefer: 'transient',
          },
        }
      )
    })

    describe('query failure', () => {
      it('exception thrown', async () => {
        postMock.mockRejectedValue(new Error())
        expect(await client.runSuiteQL('')).toBeUndefined()
      })
      it('invalid results', async () => {
        postMock.mockResolvedValue({ data: {} })
        expect(await client.runSuiteQL('')).toBeUndefined()
      })
    })
  })

  describe('runSavedSearchQuery', () => {
    it('successful query should return the results', async () => {
      postMock.mockResolvedValue({
        data: {
          status: 'success',
          results: [{ a: 1 }, { a: 2 }],
        },
      })

      const results = await client.runSavedSearchQuery({
        type: 'type',
        columns: [],
        filters: [],
      })

      expect(results).toEqual([{ a: 1 }, { a: 2 }])
      expect(postMock).toHaveBeenCalledWith(
        'https://account-id.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=customscript_salto_restlet&deploy=customdeploy_salto_restlet',
        {
          operation: 'search',
          args: {
            type: 'type',
            columns: [],
            filters: [],
            offset: 0,
            limit: 1000,
          },
        },
        {
          headers: {
            Authorization: expect.any(String),
            'Content-Type': 'application/json',
          },
        }
      )
    })

    describe('query failure', () => {
      it('exception thrown', async () => {
        postMock.mockRejectedValue(new Error())
        expect(await client.runSavedSearchQuery({
          type: 'type',
          columns: [],
          filters: [],
        })).toBeUndefined()
      })

      it('invalid saved search results', async () => {
        postMock.mockResolvedValue({ data: { status: 'success', results: {} } })
        expect(await client.runSavedSearchQuery({
          type: 'type',
          columns: [],
          filters: [],
        })).toBeUndefined()
      })

      it('invalid restlet results', async () => {
        postMock.mockResolvedValue({ data: {} })
        expect(await client.runSavedSearchQuery({
          type: 'type',
          columns: [],
          filters: [],
        })).toBeUndefined()
      })

      it('error status', async () => {
        postMock.mockResolvedValue({ data: { status: 'error', message: '' } })
        expect(await client.runSavedSearchQuery({
          type: 'type',
          columns: [],
          filters: [],
        })).toBeUndefined()
      })
    })

    it('should return all pages', async () => {
      const items = _.range(1500).map(i => ({ i }))

      postMock.mockImplementation(async (_url, data) => ({
        data: {
          status: 'success',
          results: items.slice(data.args.offset, data.args.offset + data.args.limit),
        },
      }))

      const results = await client.runSavedSearchQuery({
        type: 'type',
        columns: [],
        filters: [],
      })

      expect(results).toEqual(items)
      expect(postMock).toHaveBeenCalledWith(
        'https://account-id.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=customscript_salto_restlet&deploy=customdeploy_salto_restlet',
        {
          operation: 'search',
          args: {
            type: 'type',
            columns: [],
            filters: [],
            offset: 0,
            limit: 1000,
          },
        },
        {
          headers: {
            Authorization: expect.any(String),
            'Content-Type': 'application/json',
          },
        }
      )
      expect(postMock).toHaveBeenCalledWith(
        'https://account-id.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=customscript_salto_restlet&deploy=customdeploy_salto_restlet',
        {
          operation: 'search',
          args: {
            type: 'type',
            columns: [],
            filters: [],
            offset: 1000,
            limit: 1000,
          },
        },
        {
          headers: {
            Authorization: expect.any(String),
            'Content-Type': 'application/json',
          },
        }
      )
    })
  })


  describe('getSystemInformation', () => {
    it('successful request should return the results', async () => {
      postMock.mockResolvedValue({
        data: {
          status: 'success',
          results: {
            appVersion: [0, 1, 2],
            time: 1000,
          },
        },
      })

      const results = await client.getSystemInformation()

      expect(results).toEqual({ appVersion: [0, 1, 2], time: new Date(1000) })
      expect(postMock).toHaveBeenCalledWith(
        'https://account-id.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=customscript_salto_restlet&deploy=customdeploy_salto_restlet',
        {
          operation: 'sysInfo',
          args: {},
        },
        {
          headers: {
            Authorization: expect.any(String),
            'Content-Type': 'application/json',
          },
        }
      )
    })

    describe('request failure', () => {
      it('exception thrown', async () => {
        postMock.mockRejectedValue(new Error())
        expect(await client.getSystemInformation()).toBeUndefined()
      })
      it('invalid results', async () => {
        postMock.mockResolvedValue({ data: { status: 'success', results: {} } })
        expect(await client.getSystemInformation()).toBeUndefined()
      })
    })
  })

  describe('validateCredentials', () => {
    it('should fail when request fails', async () => {
      postMock.mockRejectedValue(new Error())
      await expect(SuiteAppClient.validateCredentials({
        accountId: 'ACCOUNT_ID',
        suiteAppTokenId: 'tokenId',
        suiteAppTokenSecret: 'tokenSecret',
      })).rejects.toThrow()
    })

    it('should succeed', async () => {
      postMock.mockResolvedValue({
        data: {
          status: 'success',
          results: {
            appVersion: [0, 1, 2],
            time: '2021-02-22T18:55:17.949Z',
          },
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
      postMock.mockResolvedValue({
        data: {
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
                name: 'OTHER_ERROR',
              },
            },
          ],
        },
      })

      const results = await client.readFiles([1, 2, 3, 4])
      expect(results).toEqual([
        Buffer.from('someText1'),
        Buffer.from('someText2'),
        expect.any(ReadFileEncodingError),
        expect.any(ReadFileError),
      ])

      expect(postMock).toHaveBeenCalledWith(
        'https://account-id.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=customscript_salto_restlet&deploy=customdeploy_salto_restlet',
        {
          operation: 'file',
          args: {
            actions: [{ action: 'read', id: 1 }, { action: 'read', id: 2 }, { action: 'read', id: 3 }, { action: 'read', id: 4 }],
          },
        },
        {
          headers: {
            Authorization: expect.any(String),
            'Content-Type': 'application/json',
          },
        }
      )
    })

    it('Invalid response should return undefined', async () => {
      postMock.mockResolvedValue({
        data: {
          status: 'success',
          results: { invalid: 1 },
        },
      })

      expect(await client.readFiles([1, 2, 3, 4])).toBeUndefined()
    })

    it('When exception is thrown should return undefined', async () => {
      postMock.mockRejectedValue(new Error())
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
