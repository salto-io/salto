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
import Bottleneck from 'bottleneck'
import MockAdapter from 'axios-mock-adapter'
import _ from 'lodash'
import { EnvType } from '../../../src/client/suiteapp_client/types'
import SoapClient from '../../../src/client/suiteapp_client/soap_client/soap_client'
import {
  ReadFileEncodingError,
  ReadFileError,
  ReadFileInsufficientPermissionError,
} from '../../../src/client/suiteapp_client/errors'
import SuiteAppClient, { PAGE_SIZE } from '../../../src/client/suiteapp_client/suiteapp_client'
import { InvalidSuiteAppCredentialsError } from '../../../src/client/types'
import { SUITEAPP_CONFIG_RECORD_TYPES } from '../../../src/types'
import { INSUFFICIENT_PERMISSION_ERROR } from '../../../src/client/suiteapp_client/constants'

describe('SuiteAppClient', () => {
  let mockAxiosAdapter: MockAdapter

  beforeEach(() => {
    mockAxiosAdapter = new MockAdapter(axios, { delayResponse: 1, onNoMatch: 'throwException' })
  })

  afterEach(() => {
    mockAxiosAdapter.restore()
  })

  describe('SuiteApp client', () => {
    let client: SuiteAppClient
    beforeEach(async () => {
      client = new SuiteAppClient({
        credentials: {
          accountId: 'ACCOUNT_ID',
          suiteAppTokenId: 'tokenId',
          suiteAppTokenSecret: 'tokenSecret',
          suiteAppActivationKey: 'activationKey',
        },
        globalLimiter: new Bottleneck(),
        instanceLimiter: (_t: string, _c: number) => false,
      })

      mockAxiosAdapter.onPost().replyOnce(200, {
        status: 'success',
        results: {
          appVersion: [0, 2, 0],
          time: 1000,
          envType: EnvType.PRODUCTION,
        },
      })
      await client.getSystemInformation()
      mockAxiosAdapter.resetHistory()
    })

    describe('runSuiteQL', () => {
      it('successful query should return the results', async () => {
        mockAxiosAdapter.onPost().reply(200, {
          hasMore: false,
          items: [
            { links: [], a: 1 },
            { links: [], a: 2 },
          ],
        })

        const results = await client.runSuiteQL({ select: 'field', from: 'table' })

        expect(results).toEqual([{ a: 1 }, { a: 2 }])
        expect(mockAxiosAdapter.history.post.length).toBe(1)
        const req = mockAxiosAdapter.history.post[0]
        expect(req.url).toEqual(
          'https://account-id.suitetalk.api.netsuite.com/services/rest/query/v1/suiteql?limit=1000&offset=0',
        )
        expect(JSON.parse(req.data)).toEqual({ q: 'SELECT field FROM table' })
        expect(req.headers).toEqual({
          Authorization: expect.any(String),
          'Content-Type': 'application/json',
          Accept: 'application/json, text/plain, */*',
          prefer: 'transient',
        })
      })

      it('should return all pages using for loop', async () => {
        const forLoopFunctionSpyOn = jest.spyOn(client, 'runSuiteQLWithForLoop' as keyof SuiteAppClient)
        const range = _.range(1500)
        const items = range.map(i => ({ i }))
        const chunks = range.filter(i => i % PAGE_SIZE === 0)

        chunks.forEach(offset => {
          mockAxiosAdapter.onPost(new RegExp(`.*limit=${PAGE_SIZE}.*offset=${offset}`)).reply(200, {
            hasMore: offset + PAGE_SIZE < items.length,
            items: items.slice(offset, offset + PAGE_SIZE).map(item => ({ ...item, links: [] })),
          })
        })

        const results = await client.runSuiteQL({ select: 'field', from: 'table' })

        expect(results).toEqual(items)
        expect(mockAxiosAdapter.history.post.length).toBe(2)
        const requests = mockAxiosAdapter.history.post
        expect(requests[0].url).toEqual(
          'https://account-id.suitetalk.api.netsuite.com/services/rest/query/v1/suiteql?limit=1000&offset=0',
        )
        expect(requests[1].url).toEqual(
          'https://account-id.suitetalk.api.netsuite.com/services/rest/query/v1/suiteql?limit=1000&offset=1000',
        )
        expect(forLoopFunctionSpyOn).toHaveBeenCalled()
      })

      it('should return all pages using promise all', async () => {
        const promiseAllFunctionSpyOn = jest.spyOn(client, 'runSuiteQLWithPromiseAll' as keyof SuiteAppClient)
        const range = _.range(1500)
        const items = range.map(i => ({ i }))
        const chunks = range.filter(i => i % PAGE_SIZE === 0)

        chunks.forEach(offset => {
          mockAxiosAdapter.onPost(new RegExp(`.*limit=${PAGE_SIZE}.*offset=${offset}`)).reply(200, {
            hasMore: offset + PAGE_SIZE < items.length,
            items: items.slice(offset, offset + PAGE_SIZE).map(item => ({ ...item, links: [] })),
            links: [
              {
                rel: 'next',
                href: `https://ACCOUNT_ID.suitetalk.api.netsuite.com/services/rest/query/v1/suiteql?limit=${PAGE_SIZE}&offset=${offset + PAGE_SIZE}`,
              },
              {
                rel: 'last',
                href: `https://ACCOUNT_ID.suitetalk.api.netsuite.com/services/rest/query/v1/suiteql?limit=${PAGE_SIZE}&offset=${(chunks.length - 1) * PAGE_SIZE}`,
              },
              {
                rel: 'self',
                href: `https://ACCOUNT_ID.suitetalk.api.netsuite.com/services/rest/query/v1/suiteql?limit=${PAGE_SIZE}&offset=${offset}`,
              },
            ],
          })
        })

        const results = await client.runSuiteQL({ select: 'field', from: 'table' })

        expect(results).toEqual(items)
        expect(mockAxiosAdapter.history.post.length).toBe(2)
        const requests = mockAxiosAdapter.history.post
        expect(requests[0].url).toEqual(
          'https://account-id.suitetalk.api.netsuite.com/services/rest/query/v1/suiteql?limit=1000&offset=0',
        )
        expect(requests[1].url).toEqual(
          'https://account-id.suitetalk.api.netsuite.com/services/rest/query/v1/suiteql?limit=1000&offset=1000',
        )
        expect(promiseAllFunctionSpyOn).toHaveBeenCalled()
      })

      it('should throw InvalidSuiteAppCredentialsError', async () => {
        mockAxiosAdapter.onPost().reply(401, 'Invalid SuiteApp credentials')
        await expect(client.runSuiteQL({ select: 'field', from: 'table' })).rejects.toThrow(
          InvalidSuiteAppCredentialsError,
        )
      })

      describe('query failure', () => {
        it('exception thrown', async () => {
          mockAxiosAdapter.onPost().reply(() => [])
          expect(await client.runSuiteQL({ select: '', from: '' })).toBeUndefined()
        })
        it('should throw customize error', async () => {
          mockAxiosAdapter.onPost().reply(400, {
            code: 'SOME_CODE',
            'o:errorDetails': [
              {
                detail: 'some error',
              },
            ],
          })
          await expect(
            client.runSuiteQL({ select: 'field', from: 'table' }, { 'some err': 'custom error1' }),
          ).rejects.toThrow('custom error1')
          await expect(
            client.runSuiteQL({ select: 'field', from: 'table' }, { 'other error': 'custom error2' }),
          ).resolves.not.toThrow()
        })
        it('with concurrency error retry', async () => {
          jest
            .spyOn(global, 'setTimeout')
            .mockImplementation((cb: TimerHandler) => (_.isFunction(cb) ? cb() : undefined))
          mockAxiosAdapter
            .onPost()
            .replyOnce(429)
            .onPost()
            .replyOnce(400, {
              error: { code: 'SSS_REQUEST_LIMIT_EXCEEDED' },
            })
            .onPost()
            .replyOnce(200, {
              hasMore: false,
              items: [
                { links: [], a: 1 },
                { links: [], a: 2 },
              ],
            })

          expect(await client.runSuiteQL({ select: 'field', from: 'table' })).toEqual([{ a: 1 }, { a: 2 }])
          expect(mockAxiosAdapter.history.post.length).toBe(3)
        })
        it('with server error retry', async () => {
          jest
            .spyOn(global, 'setTimeout')
            .mockImplementation((cb: TimerHandler) => (_.isFunction(cb) ? cb() : undefined))
          mockAxiosAdapter
            .onPost()
            .replyOnce(500)
            .onPost()
            .replyOnce(501)
            .onPost()
            .replyOnce(502)
            .onPost()
            .replyOnce(200, {
              hasMore: false,
              items: [
                { links: [], a: 1 },
                { links: [], a: 2 },
              ],
            })

          expect(await client.runSuiteQL({ select: 'field', from: 'table' })).toEqual([{ a: 1 }, { a: 2 }])
          expect(mockAxiosAdapter.history.post.length).toBe(4)
        })
        it('invalid results', async () => {
          mockAxiosAdapter.onPost().reply(200, {})
          expect(await client.runSuiteQL({ select: 'field', from: 'table' })).toBeUndefined()
          expect(mockAxiosAdapter.history.post.length).toBe(6)
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
        expect(req.url).toEqual(
          'https://account-id.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=customscript_salto_restlet&deploy=customdeploy_salto_restlet',
        )
        expect(JSON.parse(req.data)).toEqual({
          operation: 'search',
          activationKey: 'activationKey',
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
          expect(
            await client.runSavedSearchQuery({
              type: 'type',
              columns: [],
              filters: [],
            }),
          ).toBeUndefined()
        })

        it('invalid saved search results', async () => {
          mockAxiosAdapter.onPost().reply(200, { status: 'success', results: {} })
          expect(
            await client.runSavedSearchQuery({
              type: 'type',
              columns: [],
              filters: [],
            }),
          ).toBeUndefined()
        })

        it('invalid restlet results', async () => {
          mockAxiosAdapter.onPost().reply(200, {})
          expect(
            await client.runSavedSearchQuery({
              type: 'type',
              columns: [],
              filters: [],
            }),
          ).toBeUndefined()
        })

        it('error status', async () => {
          mockAxiosAdapter.onPost().reply(200, { status: 'error', message: '', error: new Error('error') })
          expect(
            await client.runSavedSearchQuery({
              type: 'type',
              columns: [],
              filters: [],
            }),
          ).toBeUndefined()
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
          activationKey: 'activationKey',
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
          activationKey: 'activationKey',
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

    describe('runRecordsQuery', () => {
      it('successful query should return the results', async () => {
        mockAxiosAdapter.onPost().reply(200, {
          status: 'success',
          results: [
            {
              body: {
                scriptid: 'customworkflow123',
              },
              sublists: [],
              errors: ['some error'],
            },
            {
              body: {
                scriptid: 'customworkflow456',
              },
              sublists: [
                {
                  body: {
                    scriptid: 'customworkflow789',
                  },
                  sublists: [],
                },
              ],
              errors: ['some error 2'],
            },
          ],
        })
        const results = await client.runRecordsQuery(['1', '2'], {
          type: 'workflow',
          fields: ['scriptid'],
          filter: {
            fieldId: 'scriptid',
            in: ['customworkflow'],
          },
        })
        expect(results).toBeDefined()
      })

      describe('query failure', () => {
        it('exception thrown', async () => {
          mockAxiosAdapter.onPost().reply(() => [])
          expect(
            await client.runRecordsQuery(['1', '2'], {
              type: 'workflow',
              fields: ['scriptid'],
              filter: {
                fieldId: 'scriptid',
                in: ['customworkflow'],
              },
            }),
          ).toBeUndefined()
        })

        it('invalid record query results', async () => {
          mockAxiosAdapter.onPost().reply(200, { status: 'success', results: {} })
          expect(
            await client.runRecordsQuery(['1', '2'], {
              type: 'workflow',
              fields: ['scriptid'],
              filter: {
                fieldId: 'scriptid',
                in: ['customworkflow'],
              },
            }),
          ).toBeUndefined()
        })

        it('invalid restlet results', async () => {
          mockAxiosAdapter.onPost().reply(200, {})
          expect(
            await client.runRecordsQuery(['1', '2'], {
              type: 'workflow',
              fields: ['scriptid'],
              filter: {
                fieldId: 'scriptid',
                in: ['customworkflow'],
              },
            }),
          ).toBeUndefined()
        })

        it('error status', async () => {
          mockAxiosAdapter.onPost().reply(200, { status: 'error', message: '', error: new Error('error') })
          expect(
            await client.runRecordsQuery(['1', '2'], {
              type: 'workflow',
              fields: ['scriptid'],
              filter: {
                fieldId: 'scriptid',
                in: ['customworkflow'],
              },
            }),
          ).toBeUndefined()
        })
      })

      it('should return undefined when recordOperation feature is not supported', async () => {
        const unsupportedClient = new SuiteAppClient({
          credentials: {
            accountId: 'ACCOUNT_ID',
            suiteAppTokenId: 'tokenId',
            suiteAppTokenSecret: 'tokenSecret',
            suiteAppActivationKey: 'activationKey',
          },
          globalLimiter: new Bottleneck(),
          instanceLimiter: (_t: string, _c: number) => false,
        })
        mockAxiosAdapter.onPost().replyOnce(200, {
          status: 'success',
          results: {
            appVersion: [0, 1, 3],
            time: 1000,
          },
        })
        expect(
          await unsupportedClient.runRecordsQuery(['1', '2'], {
            type: 'workflow',
            fields: ['scriptid'],
            filter: {
              fieldId: 'scriptid',
              in: ['customworkflow'],
            },
          }),
        ).toBeUndefined()
      })
    })

    describe('getSystemInformation', () => {
      it('successful request should return the results', async () => {
        mockAxiosAdapter.onPost().reply(200, {
          status: 'success',
          results: {
            appVersion: [0, 1, 3],
            time: 1000,
            envType: EnvType.PRODUCTION,
          },
        })

        const results = await client.getSystemInformation()

        expect(results).toEqual({ appVersion: [0, 1, 3], time: new Date(1000), envType: EnvType.PRODUCTION })
        expect(mockAxiosAdapter.history.post.length).toBe(1)
        const req = mockAxiosAdapter.history.post[0]
        expect(JSON.parse(req.data)).toEqual({
          operation: 'sysInfo',
          activationKey: 'activationKey',
          args: {},
        })
      })

      describe('request failure', () => {
        it('general exception thrown', async () => {
          mockAxiosAdapter.onPost().reply(() => [])
          expect(await client.getSystemInformation()).toBeUndefined()
        })
        test.each([401, 403])(
          'Post request fails with error code %d - should throw InvalidSuiteAppCredentialsError',
          async errorCode => {
            mockAxiosAdapter.onPost().replyOnce(errorCode)
            await expect(client.getSystemInformation()).rejects.toThrow(InvalidSuiteAppCredentialsError)
          },
        )
        it('invalid results', async () => {
          mockAxiosAdapter.onPost().reply(200, { status: 'success', results: {} })
          expect(await client.getSystemInformation()).toBeUndefined()
        })
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
                name: INSUFFICIENT_PERMISSION_ERROR,
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
        expect(req.url).toEqual(
          'https://account-id.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=customscript_salto_restlet&deploy=customdeploy_salto_restlet',
        )
        expect(JSON.parse(req.data)).toEqual({
          operation: 'readFile',
          activationKey: 'activationKey',
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

    describe('getConfigRecords', () => {
      it('should return empty list when configType feature is not supported', async () => {
        const unsupportedClient = new SuiteAppClient({
          credentials: {
            accountId: 'ACCOUNT_ID',
            suiteAppTokenId: 'tokenId',
            suiteAppTokenSecret: 'tokenSecret',
            suiteAppActivationKey: 'activationKey',
          },
          globalLimiter: new Bottleneck(),
          instanceLimiter: (_t: string, _c: number) => false,
        })
        mockAxiosAdapter.onPost().replyOnce(200, {
          status: 'success',
          results: {
            appVersion: [0, 1, 3],
            time: 1000,
          },
        })
        expect(await unsupportedClient.getConfigRecords()).toEqual([])
        expect(mockAxiosAdapter.history.post.length).toBe(1)
      })
      it('should return empty list on error', async () => {
        mockAxiosAdapter.onPost().replyOnce(200, {
          status: 'error',
          message: '',
          error: new Error('error'),
        })
        expect(await client.getConfigRecords()).toEqual([])
      })
      it('should return empty list on invalid result', async () => {
        mockAxiosAdapter.onPost().replyOnce(200, {
          status: 'success',
          results: {
            results: ['a', 'b', 'c'],
            errors: [],
          },
        })
        expect(await client.getConfigRecords()).toEqual([])
      })
      it('should return only valid results', async () => {
        mockAxiosAdapter.onPost().replyOnce(200, {
          status: 'success',
          results: {
            results: [
              {
                configType: SUITEAPP_CONFIG_RECORD_TYPES[0],
                fieldsDef: [],
                data: { notFieldsProperty: {} },
              },
              {
                configType: SUITEAPP_CONFIG_RECORD_TYPES[1],
                fieldsDef: [{ notFieldDefinition: true }, { id: 'a', label: 'a', type: 'checkbox', selectOptions: [] }],
                data: { fields: { a: 'T' } },
              },
            ],
            errors: [],
          },
        })
        expect(await client.getConfigRecords()).toEqual([
          {
            configType: SUITEAPP_CONFIG_RECORD_TYPES[1],
            fieldsDef: [{ id: 'a', label: 'a', type: 'checkbox', selectOptions: [] }],
            data: { fields: { a: 'T' } },
          },
        ])
      })
    })
    describe('setConfigRecordsValues', () => {
      it('should return error when configType feature is not supported', async () => {
        const unsupportedClient = new SuiteAppClient({
          credentials: {
            accountId: 'ACCOUNT_ID',
            suiteAppTokenId: 'tokenId',
            suiteAppTokenSecret: 'tokenSecret',
            suiteAppActivationKey: 'activationKey',
          },
          globalLimiter: new Bottleneck(),
          instanceLimiter: (_t: string, _c: number) => false,
        })
        mockAxiosAdapter.onPost().replyOnce(200, {
          status: 'success',
          results: {
            appVersion: [0, 1, 3],
            time: 1000,
          },
        })
        expect(await unsupportedClient.setConfigRecordsValues([])).toEqual({
          errorMessage: "SuiteApp version doesn't support configTypes",
        })
        expect(mockAxiosAdapter.history.post.length).toBe(1)
      })
      it('should return error on error', async () => {
        mockAxiosAdapter.onPost().replyOnce(200, {
          status: 'error',
          message: 'error',
          error: new Error('error'),
        })
        expect(await client.setConfigRecordsValues([])).toEqual({
          errorMessage: 'Restlet request failed. Message: error, error: {}',
        })
      })
      it('should return error on invalid result', async () => {
        mockAxiosAdapter.onPost().replyOnce(200, {
          status: 'success',
          results: [{ a: 'a' }],
        })
        expect(await client.setConfigRecordsValues([])).toEqual({
          errorMessage: expect.stringContaining('should match some schema in anyOf'),
        })
      })
      it('should return error on invalid configType', async () => {
        mockAxiosAdapter.onPost().replyOnce(200, {
          status: 'success',
          results: [{ configType: 'a', status: 'success' }],
        })
        expect(await client.setConfigRecordsValues([])).toEqual({
          errorMessage: expect.stringContaining('should match some schema in anyOf'),
        })
      })
      it('should return error on invalid status', async () => {
        mockAxiosAdapter.onPost().replyOnce(200, {
          status: 'success',
          results: [{ configType: SUITEAPP_CONFIG_RECORD_TYPES[0], status: 'none' }],
        })
        expect(await client.setConfigRecordsValues([])).toEqual({
          errorMessage: expect.stringContaining('should match some schema in anyOf'),
        })
      })
      it('should return error on missing errorMessage', async () => {
        mockAxiosAdapter.onPost().replyOnce(200, {
          status: 'success',
          results: [{ configType: SUITEAPP_CONFIG_RECORD_TYPES[0], status: 'fail' }],
        })
        expect(await client.setConfigRecordsValues([])).toEqual({
          errorMessage: expect.stringContaining('should match some schema in anyOf'),
        })
      })
      it('should return results', async () => {
        const results = [
          { configType: SUITEAPP_CONFIG_RECORD_TYPES[0], status: 'success' },
          { configType: SUITEAPP_CONFIG_RECORD_TYPES[1], status: 'fail', errorMessage: 'error' },
        ]
        mockAxiosAdapter.onPost().replyOnce(200, {
          status: 'success',
          results,
        })
        expect(await client.setConfigRecordsValues([])).toEqual(results)
      })
    })
    describe('getInstalledBundlesOrSuiteApps', () => {
      it('should return empty array when getInstalledBundles feature is not supported', async () => {
        const unsupportedClient = new SuiteAppClient({
          credentials: {
            accountId: 'ACCOUNT_ID',
            suiteAppTokenId: 'tokenId',
            suiteAppTokenSecret: 'tokenSecret',
            suiteAppActivationKey: 'activationKey',
          },
          globalLimiter: new Bottleneck(),
          instanceLimiter: (_t: string, _c: number) => false,
        })
        mockAxiosAdapter.onPost().replyOnce(200, {
          status: 'success',
          results: {
            appVersion: [0, 1, 3],
            time: 1000,
          },
        })
        expect(await unsupportedClient.getInstalledBundles()).toEqual([])
      })
      it('should throw on error', async () => {
        mockAxiosAdapter.onPost().replyOnce(200, {
          status: 'error',
          message: '',
          error: new Error('error'),
        })
        await expect(() => client.getInstalledBundles()).rejects.toThrow()
      })
      it('should throw on invalid result', async () => {
        mockAxiosAdapter.onPost().replyOnce(200, {
          status: 'success',
          results: {
            results: ['wrong', 'value'],
            errors: [],
          },
        })
        await expect(() => client.getInstalledBundles()).rejects.toThrow()
      })
      it('should return an array of bundles', async () => {
        const results = [
          {
            id: 47492,
            name: 'Tax Audit Files',
            version: '1.86.2',
            isManaged: true,
            description: 'Description',
            publisher: { id: '3838953', name: 'NetSuite Platform Solutions Group - Tax Audit Files' },
            installedFrom: 'Production',
          },
          {
            id: 53195,
            name: 'Last SalesActivity',
            version: '1.11.2',
            isManaged: false,
            description: 'Description',
            publisher: { id: '3912261', name: 'NetSuite Platform Solutions Group - Tax Audit Files' },
            installedFrom: 'Sandbox',
          },
        ]
        mockAxiosAdapter.onPost().replyOnce(200, {
          status: 'success',
          results,
        })
        expect(await client.getInstalledBundles()).toEqual(results)
      })
      it('should return an array of suiteApps', async () => {
        const results = [
          { appId: 'appId', name: 'suiteApp name', version: '1.23.5', dateInstalled: Date() },
          { appId: 'appId.other', name: 'suiteApp name2', version: '1.65.4', dateInstalled: Date() },
        ]
        mockAxiosAdapter.onPost().replyOnce(200, {
          status: 'success',
          results,
        })
        expect(await client.getInstalledSuiteApps()).toEqual(results)
      })
    })
  })

  describe('validateCredentials', () => {
    it('should fail when request fails', async () => {
      mockAxiosAdapter.onPost().reply(() => [])
      await expect(
        SuiteAppClient.validateCredentials({
          accountId: 'ACCOUNT_ID',
          suiteAppTokenId: 'tokenId',
          suiteAppTokenSecret: 'tokenSecret',
          suiteAppActivationKey: 'activationKey',
        }),
      ).rejects.toThrow()
    })

    describe('With activationKey', () => {
      const systemInformation = {
        appVersion: [0, 1, 3],
        time: 1000,
        envType: EnvType.BETA,
      }

      beforeEach(() => {
        mockAxiosAdapter.onPost().reply(200, {
          status: 'success',
          results: systemInformation,
        })
      })

      it('should succeed and return systemInformation', async () => {
        await expect(
          SuiteAppClient.validateCredentials({
            accountId: 'ACCOUNT_ID',
            suiteAppTokenId: 'tokenId',
            suiteAppTokenSecret: 'tokenSecret',
            suiteAppActivationKey: 'activationKey',
          }),
        ).resolves.toEqual({ ...systemInformation, time: new Date(systemInformation.time) })
      })
    })

    describe('Without activationKey', () => {
      const systemInformation = {
        appVersion: [0, 1, 3],
        time: 1000,
        envType: EnvType.PRODUCTION,
      }

      beforeEach(() => {
        mockAxiosAdapter.onPost().reply(200, {
          status: 'success',
          results: systemInformation,
        })
      })

      it('should succeed and return systemInformation', async () => {
        await expect(
          SuiteAppClient.validateCredentials({
            accountId: 'ACCOUNT_ID',
            suiteAppTokenId: 'tokenId',
            suiteAppTokenSecret: 'tokenSecret',
          }),
        ).resolves.toEqual({ ...systemInformation, time: new Date(systemInformation.time) })
      })
    })
  })

  describe('versionFeatures', () => {
    let client: SuiteAppClient
    beforeEach(async () => {
      client = new SuiteAppClient({
        credentials: {
          accountId: 'ACCOUNT_ID',
          suiteAppTokenId: 'tokenId',
          suiteAppTokenSecret: 'tokenSecret',
          suiteAppActivationKey: 'activationKey',
        },
        globalLimiter: new Bottleneck(),
        instanceLimiter: (_t: string, _c: number) => false,
      })
    })
    it('should set old versionFeatures', async () => {
      mockAxiosAdapter.onPost().reply(200, {
        status: 'success',
        results: {
          appVersion: [0, 1, 1],
          time: 1000,
        },
      })
      expect(await client.isFeatureSupported('activationKey')).toBeFalsy()
    })
    it('should set new versionFeatures', async () => {
      mockAxiosAdapter.onPost().reply(200, {
        status: 'success',
        results: {
          appVersion: [0, 1, 3],
          time: 1000,
          envType: EnvType.PRODUCTION,
        },
      })
      expect(await client.isFeatureSupported('activationKey')).toBeTruthy()
    })
    it('should set versionFeatures once on parallel request', async () => {
      mockAxiosAdapter.onPost().reply(200, {
        status: 'success',
        results: {
          appVersion: [0, 1, 3],
          time: 1000,
          envType: EnvType.PRODUCTION,
        },
      })
      await Promise.all([client.getSystemInformation(), client.getSystemInformation()])
      expect(await client.isFeatureSupported('activationKey')).toBeTruthy()
      expect(mockAxiosAdapter.history.post.length).toEqual(3)
    })
    it('should not set versionFeatures when getting invalid results', async () => {
      mockAxiosAdapter.onPost().reply(200, {
        status: 'success',
        results: {
          time: 1000,
        },
      })
      expect(await client.isFeatureSupported('activationKey')).toBeFalsy()
    })
  })
})
