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
import { SuiteAppClient } from '../../src/client/suiteapp_client/suiteapp_client'

jest.mock('axios')

describe('SuiteAppClient', () => {
  let postMock: jest.SpyInstance
  let client: SuiteAppClient
  beforeEach(() => {
    postMock = jest.spyOn(axios, 'post')
    client = new SuiteAppClient({
      credentials: {
        accountId: 'ACCOUNT_ID',
        tokenId: 'tokenId',
        tokenSecret: 'tokenSecret',
      },
      callsLimiter: new Bottleneck(),
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
})
