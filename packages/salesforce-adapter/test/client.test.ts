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
import _ from 'lodash'
import nock from 'nock'
import { RetrieveResult, FileProperties, Metadata } from 'jsforce-types'
import { logger } from '@salto-io/logging'
import { Values } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { MockInterface } from '@salto-io/test-utils'
import SalesforceClient, { ApiLimitsTooLowError,
  getConnectionDetails, validateCredentials, API_VERSION } from '../src/client/client'
import mockClient from './client'
import { UsernamePasswordCredentials, OauthAccessTokenCredentials } from '../src/types'
import Connection from '../src/client/jsforce'
import { RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS } from '../src/constants'
import { mockRetrieveResult, mockRetrieveLocator, mockFileProperties } from './connection'

const { array, asynciterable } = collections
const { makeArray } = array
const { mapAsync, toArrayAsync } = asynciterable
const logging = logger('salesforce-adapter/client/client')

describe('salesforce client', () => {
  beforeEach(() => {
    nock.cleanAll()
    nock('https://test.salesforce.com')
      .persist()
      .post(/.*/)
      .reply(200, '<serverUrl>http://dodo22</serverUrl>/')
  })
  const credentials = new UsernamePasswordCredentials({
    username: 'myUser',
    password: 'myPass',
    isSandbox: false,
    apiToken: 'myToken',
  })
  const { connection } = mockClient()
  const client = new SalesforceClient({
    credentials: new UsernamePasswordCredentials({
      username: '',
      password: '',
      isSandbox: true,
    }),
    config: {
      retry: {
        maxAttempts: 4, // try 4 times
        retryDelay: 100, // wait for 100ms before trying again
        retryStrategy: 'NetworkError', // retry on network errors
      },
      maxConcurrentApiRequests: {
        total: RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
        retrieve: 3,
        read: RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
        list: 1,
      },
    },
  })
  const headers = { 'content-type': 'application/json' }
  const workingReadReplay = {
    'a:Envelope': { 'a:Body': { a: { result: { records: [{ fullName: 'BLA' }] } } } },
  }

  describe('with failed delete', () => {
    it('should not fail if the element is already deleted', async () => {
      const dodoScope = nock('http://dodo22')
        .post(/.*/)
        .reply(200, { 'a:Envelope': { 'a:Body': { a: { result: {
          success: false,
          fullName: 'bla',
          errors: [{
            statusCode: 'INVALID_CROSS_REFERENCE_KEY',
            message: 'no bla named foo found',
          }],
        } } } } })
      await expect(client.delete('bla', 'foo')).resolves.not.toThrow()
      expect(dodoScope.isDone()).toBeTruthy()
    })

    it('should fail delete error if it is not the specific error we filter out', async () => {
      const dodoScope = nock('http://dodo22')
        .post(/.*/)
        .reply(200, { 'a:Envelope': { 'a:Body': { a: { result: {
          success: false,
          fullName: 'bla',
          errors: [{
            statusCode: 'CANNOT_DELETE_MANAGED_OBJECT',
            message: 'bla',
          }],
        } } } } })

      await expect(client.delete('bla', 'foo')).rejects.toThrow()
      expect(dodoScope.isDone()).toBeTruthy()
    })
  })

  describe('with network errors ', () => {
    let log: jest.SpyInstance

    beforeAll(() => {
      log = jest.spyOn(logging, 'error')
    })

    it('fails if max attempts was reached ', async () => {
      const dodoScope = nock('http://dodo22')
        .persist()
        .post(/.*/)
        .replyWithError({
          message: 'something awful happened',
          code: 'ECONNRESET',
        })

      try {
        await client.listMetadataTypes()
        throw new Error('client should have failed')
      } catch (e) {
        expect(e.message).toBe('something awful happened')
        expect(e.attempts).toBe(4)
      }
      expect(dodoScope.isDone()).toBeTruthy()
    })

    it('succeeds if max attempts was not reached', async () => {
      const dodoScope = nock('http://dodo22')
        .post(/.*/)
        .times(2)
        .replyWithError({
          message: 'something awful happened',
          code: 'ECONNRESET',
        })
        .post(/.*/)
        .reply(200, {
          'a:Envelope': { 'a:Body': { a: { result: { metadataObjects: [] } } } },
        }, headers)

      const res = await client.listMetadataTypes()
      expect(dodoScope.isDone()).toBeTruthy()
      expect(res).toEqual([])
    })
    it('writes the right things to log', () => {
      expect(log).toHaveBeenCalledWith('failed to run SFDC call for reason: %s. Retrying in %ss.', 'something awful happened', 0.1)
    })
  })

  describe('with other errors ', () => {
    it('fails on first error without retries', async () => {
      const dodoScope = nock('http://dodo22')
        .post(/.*/)
        .times(1)
        .reply(500, 'server error')
        .post(/.*/)
        .reply(200, { 'a:Envelope': { 'a:Body': { a: { result: { metadataObjects: [] } } } } },
          headers)

      try {
        await client.listMetadataTypes()
        throw new Error('client should have failed')
      } catch (e) {
        expect(e.message).toBe('server error')
        expect(e.attempts).toBeUndefined()
      }
      expect(dodoScope.isDone()).toBeFalsy()
    })

    it('continue in case of error in chunk - run on each element separately', async () => {
      const dodoScope = nock(`http://dodo22/services/Soap/m/${API_VERSION}`)
        .post(/.*/)
        .times(2)
        .reply(200, workingReadReplay, headers)
        .post(/.*/)
        .times(1)
        .reply(500, 'server error')
        .post(/.*/)
        .times(10)
        .reply(200, workingReadReplay, headers)
      // create an array with 30 names so we will have 3 calls (chunk size is 10 for readMetadata)
      const { result } = await client.readMetadata(
        'FakeType', Array.from({ length: 30 }, () => 'FakeName')
      )
      expect(result).toHaveLength(12)
      expect(dodoScope.isDone()).toBeTruthy()
    })

    it('should fail in case of unhandled error', async () => {
      const dodoScope = nock(`http://dodo22/services/Soap/m/${API_VERSION}`)
        .post(/.*/)
        .times(22)
        .reply(500, 'server error')
      // create an array with 20 names so we will have 2 calls
      await expect(client.readMetadata(
        'FakeType', Array.from({ length: 20 }, () => 'FakeName')
      )).rejects.toEqual(new Error('server error'))
      expect(dodoScope.isDone()).toBeTruthy()
    })

    it('should return errors in case of handled error', async () => {
      const dodoScope = nock(`http://dodo22/services/Soap/m/${API_VERSION}`)
        .post(/.*/)
        .times(1)
        .reply(500, 'server error')
      expect(await client.readMetadata('FakeType', 'FakeName', _err => false))
        .toEqual({ result: [], errors: ['FakeName'] })
      expect(dodoScope.isDone()).toBeTruthy()
    })
  })

  describe('with suppressed errors', () => {
    it('should not fail if all errors are suppressed', async () => {
      const dodoScope = nock(`http://dodo22/servies/Soap/m/${API_VERSION}`)
        .post(/.*/)
        .reply(500, 'targetObject is invalid')

      await expect(client.readMetadata('QuickAction', 'SendEmail')).resolves.not.toThrow()
      expect(dodoScope.isDone()).toBeTruthy()
    })

    it('should return non error responses for QuickAction targetObject', async () => {
      const dodoScope = nock(`http://dodo22/servies/Soap/m/${API_VERSION}`)
        .post(/.*/)
        .times(2) // Once for the chunk and once for SendEmail
        .reply(500, 'targetObject is invalid')
        .post(/.*/)
        .times(1)
        .reply(200, workingReadReplay)

      const { result } = await client.readMetadata('QuickAction', ['SendEmail', 'LogACall'])
      expect(result).toHaveLength(1)
      expect(dodoScope.isDone()).toBeTruthy()
    })

    it('should return non error responses for insufficient access', async () => {
      const dodoScope = nock(`http://dodo22/servies/Soap/m/${API_VERSION}`)
        .post(/.*/)
        .times(2) // Once for the chunk and once for item
        .reply(
          500,
          '<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:sf="http://soap.sforce.com/2006/04/metadata"><soapenv:Body><soapenv:Fault><faultcode>sf:INSUFFICIENT_ACCESS</faultcode><faultstring>INSUFFICIENT_ACCESS: insufficient access rights on cross-reference id</faultstring></soapenv:Fault></soapenv:Body></soapenv:Envelope>',
          { 'content-type': 'text/xml' },
        )
        .post(/.*/)
        .times(1)
        .reply(200, workingReadReplay)

      const { result } = await client.readMetadata('Layout', ['aaa', 'bbb'])
      expect(result).toHaveLength(1)
      expect(dodoScope.isDone()).toBeTruthy()
    })
  })

  describe('with jsforce accessing .result on null error', () => {
    let testClient: SalesforceClient
    let testConnection: MockInterface<Connection>
    let failingImplementation: Metadata['list']
    beforeEach(() => {
      const mockClientAndConnection = mockClient()
      testConnection = mockClientAndConnection.connection
      testClient = mockClientAndConnection.client
      failingImplementation = async () => (
        // Intentionally access .result on null
        (null as unknown as { result: FileProperties[] }).result
      )
    })
    describe('when the error is recoverable', () => {
      let result: ReturnType<typeof testClient.listMetadataObjects>
      let expectedProperties: FileProperties
      beforeEach(() => {
        expectedProperties = mockFileProperties({ type: 'CustomObject', fullName: 'A__c' })
        testConnection.metadata.list
          .mockImplementationOnce(failingImplementation)
          .mockImplementationOnce(failingImplementation)
          .mockResolvedValueOnce([expectedProperties])

        result = testClient.listMetadataObjects({ type: 'CustomObject' })
      })
      it('should resolve with the value of the successful attempt', async () => {
        await expect(result).resolves.toMatchObject({ result: [expectedProperties] })
      })
    })
    describe('when the error persists', () => {
      let result: ReturnType<typeof testClient.listMetadataObjects>
      beforeEach(() => {
        testConnection.metadata.list.mockImplementation(failingImplementation)
        result = testClient.listMetadataObjects({ type: 'CustomObject' })
      })
      it('should fail with the error', async () => {
        await expect(result).rejects.toThrow()
      })
    })
  })

  describe('getConnectionDetails', () => {
    it('should return empty orgId', async () => {
      const { orgId, remainingDailyRequests } = await getConnectionDetails(credentials, connection)
      expect(orgId).toEqual('')
      expect(remainingDailyRequests).toEqual(10000)
    })
  })

  describe('validateCredentials', () => {
    it('should throw ApiLimitsTooLowError exception', async () => {
      await expect(
        validateCredentials(credentials, 100000, connection)
      ).rejects.toThrow(ApiLimitsTooLowError)
    })
    it('should return empty string', async () => {
      expect(await validateCredentials(credentials, 3, connection)).toEqual('')
    })
  })

  describe('queryAll', () => {
    let resultsIterable: AsyncIterable<Values[]>
    let dodoScope: nock.Scope

    const asyncCounter = async (
      iterator: AsyncIterable<Values[]>
    ): Promise<number> =>
      _.sum((await toArrayAsync(await mapAsync(
        iterator,
        vals => makeArray(vals).map(() => 1)
      ))).flat())

    describe('when all results are in a single query', () => {
      beforeEach(async () => {
        dodoScope = nock(`http://dodo22/services/data/v${API_VERSION}/query/`)
          .get(/.*/)
          .times(1)
          .reply(200, {
            totalSize: 2,
            done: true,
            records: [{ val: 1 }, { val: 2 }],
          })
        resultsIterable = await client.queryAll('queryString')
      })

      it('should have the query returned elements', async () => {
        const counter = await asyncCounter(resultsIterable)
        expect(counter).toEqual(2)
      })

      afterAll(() => {
        expect(connection.queryMore).not.toHaveBeenCalled()
        expect(dodoScope.isDone()).toBeTruthy()
      })
    })

    describe('when all results are in a single query from tooling api', () => {
      beforeEach(async () => {
        dodoScope = nock(`http://dodo22/services/data/v${API_VERSION}/tooling/query/`)
          .get(/.*tooling.*/)
          .times(1)
          .reply(200, {
            totalSize: 2,
            done: true,
            records: [{ val: 1 }, { val: 2 }],
          })
        resultsIterable = await client.queryAll('queryString', true)
      })

      it('should have the query returned elements', async () => {
        const counter = await asyncCounter(resultsIterable)
        expect(counter).toEqual(2)
      })

      afterAll(() => {
        expect(dodoScope.isDone()).toBeTruthy()
      })
    })

    describe('when results are returned in more than one query', () => {
      beforeEach(async () => {
        dodoScope = nock(`http://dodo22/services/data/v${API_VERSION}/query`)
          .persist()
          .get(/.*queryString/)
          .times(1)
          .reply(200, {
            totalSize: 2,
            done: false,
            nextRecordsUrl: 'next',
            records: [{ val: 1 }, { val: 2 }],
          })
          .get(/.*/)
          .times(1)
          .reply(200, {
            totalSize: 1,
            done: true,
            records: [{ val: 3 }],
          })

        resultsIterable = await client.queryAll('queryString')
      })

      it('should get the query returned elements of both query and query more', async () => {
        const counter = await asyncCounter(resultsIterable)
        expect(counter).toEqual(3)
      })

      afterAll(() => {
        expect(dodoScope.isDone()).toBeTruthy()
      })
    })
    describe('when result records are undefined / missing in the first query', () => {
      beforeEach(async () => {
        dodoScope = nock(`http://dodo22/services/data/v${API_VERSION}/query`)
          .persist()
          .get(/.*queryString/)
          .times(1)
          .reply(200, {
            totalSize: 2,
            done: false,
            nextRecordsUrl: 'next',
          })

        resultsIterable = await client.queryAll('queryString')
      })

      it('should stop the iteration without failing', async () => {
        const counter = await asyncCounter(resultsIterable)
        expect(counter).toEqual(0)
      })

      afterAll(() => {
        expect(dodoScope.isDone()).toBeTruthy()
      })
    })
    describe('when result records are undefined in the second query', () => {
      beforeEach(async () => {
        dodoScope = nock(`http://dodo22/services/data/v${API_VERSION}/query`)
          .persist()
          .get(/.*queryString/)
          .times(1)
          .reply(200, {
            totalSize: 2,
            done: false,
            nextRecordsUrl: 'next',
            records: [{ val: 1 }, { val: 2 }],
          })
          .get(/.*/)
          .times(1)
          .reply(200, {
            totalSize: 1,
            done: true,
            records: undefined,
          })

        resultsIterable = await client.queryAll('queryString')
      })

      it('should stop the iteration without failing, with a partial result', async () => {
        const counter = await asyncCounter(resultsIterable)
        expect(counter).toEqual(2)
      })

      afterAll(() => {
        expect(dodoScope.isDone()).toBeTruthy()
      })
    })
  })
  describe('bulkLoadOperation', () => {
    let dodoScope: nock.Scope
    beforeEach(() => {
      dodoScope = nock(`http://dodo22/services/async/${API_VERSION}/job`)
        .post(/.*/)
        .reply(
          200,
          '<?xml version="1.0" encoding="UTF-8"?><jobInfo\n   xmlns="http://www.force.com/2009/06/asyncapi/dataload">\n <id>7503z00000WDQ4SAAX</id>\n <operation>update</operation>\n <object>SBQQ__ProductRule__c</object>\n <createdById>0053z00000BCOCMAA5</createdById>\n <createdDate>2020-06-22T07:23:32.000Z</createdDate>\n <systemModstamp>2020-06-22T07:23:32.000Z</systemModstamp>\n <state>Open</state>\n <concurrencyMode>Parallel</concurrencyMode>\n <contentType>CSV</contentType>\n <numberBatchesQueued>0</numberBatchesQueued>\n <numberBatchesInProgress>0</numberBatchesInProgress>\n <numberBatchesCompleted>0</numberBatchesCompleted>\n <numberBatchesFailed>0</numberBatchesFailed>\n <numberBatchesTotal>0</numberBatchesTotal>\n <numberRecordsProcessed>0</numberRecordsProcessed>\n <numberRetries>0</numberRetries>\n <apiVersion>50.0</apiVersion>\n <numberRecordsFailed>0</numberRecordsFailed>\n <totalProcessingTime>0</totalProcessingTime>\n <apiActiveProcessingTime>0</apiActiveProcessingTime>\n <apexProcessingTime>0</apexProcessingTime>\n</jobInfo>',
          { 'content-type': 'application/xml' },
        )
        .post(/.*/)
        .reply(
          200,
          '<?xml version="1.0" encoding="UTF-8"?><batchInfo\n   xmlns="http://www.force.com/2009/06/asyncapi/dataload">\n <id>7513z00000Wgd6AAAR</id>\n <jobId>7503z00000WDQ4SAAX</jobId>\n <state>Queued</state>\n <createdDate>2020-06-22T07:23:32.000Z</createdDate>\n <systemModstamp>2020-06-22T07:23:32.000Z</systemModstamp>\n <numberRecordsProcessed>0</numberRecordsProcessed>\n <numberRecordsFailed>0</numberRecordsFailed>\n <totalProcessingTime>0</totalProcessingTime>\n <apiActiveProcessingTime>0</apiActiveProcessingTime>\n <apexProcessingTime>0</apexProcessingTime>\n</batchInfo>',
          { 'content-type': 'application/xml' },
        )
        .get(/.*/)
        .reply(
          200,
          '<?xml version="1.0" encoding="UTF-8"?><batchInfo\n   xmlns="http://www.force.com/2009/06/asyncapi/dataload">\n <id>7513z00000Wgd6AAAR</id>\n <jobId>7503z00000WDQ4SAAX</jobId>\n <state>Completed</state>\n <createdDate>2020-06-22T07:23:32.000Z</createdDate>\n <systemModstamp>2020-06-22T07:23:33.000Z</systemModstamp>\n <numberRecordsProcessed>1</numberRecordsProcessed>\n <numberRecordsFailed>0</numberRecordsFailed>\n <totalProcessingTime>226</totalProcessingTime>\n <apiActiveProcessingTime>170</apiActiveProcessingTime>\n <apexProcessingTime>120</apexProcessingTime>\n</batchInfo>',
          { 'content-type': 'application/xml' },
        )
    })

    it('should return not throw even when returned with errors', async () => {
      dodoScope
        .get(/.*/)
        .reply(
          200,
          '"Id","Success","Created","Error"\n"a0w3z000007qWOLAA2","false","false","error"\n',
          { 'content-type': 'text/csv' },
        )
        .post(/.*/)
        .reply(
          200,
          '<?xml version="1.0" encoding="UTF-8"?><jobInfo\n   xmlns="http://www.force.com/2009/06/asyncapi/dataload">\n <id>7513z00000Wgd6AAAR</id>\n <jobId>7503z00000WDQ4SAAX</jobId>\n <state>Completed</state>\n <createdDate>2020-06-22T07:23:32.000Z</createdDate>\n <systemModstamp>2020-06-22T07:23:33.000Z</systemModstamp>\n <numberRecordsProcessed>1</numberRecordsProcessed>\n <numberRecordsFailed>0</numberRecordsFailed>\n <totalProcessingTime>226</totalProcessingTime>\n <apiActiveProcessingTime>170</apiActiveProcessingTime>\n <apexProcessingTime>120</apexProcessingTime>\n</jobInfo>',
          { 'content-type': 'application/xml' },
        )
      const result = await client.bulkLoadOperation('SBQQ__ProductRule__c', 'update', [{ Id: 'a0w3z000007qWOLAA2' }])
      expect(result.length).toEqual(1)
      expect(result[0].id).toEqual('a0w3z000007qWOLAA2')
      expect(result[0].success).toEqual(false)
      expect(result[0].errors).toBeDefined()
      expect(result[0].errors).toHaveLength(1)
      expect((result[0].errors as string[])[0]).toEqual('error')
    })

    it('should succeed when returned without errors', async () => {
      dodoScope.get(/.*/)
        .reply(
          200,
          '"Id","Success","Created","Error"\n"a0w3z000007qWOLAA2","true","false",""\n',
          { 'content-type': 'text/csv' },
        )
        .post(/.*/)
        .reply(
          200,
          '<?xml version="1.0" encoding="UTF-8"?><jobInfo\n   xmlns="http://www.force.com/2009/06/asyncapi/dataload">\n <id>7513z00000Wgd6AAAR</id>\n <jobId>7503z00000WDQ4SAAX</jobId>\n <state>Completed</state>\n <createdDate>2020-06-22T07:23:32.000Z</createdDate>\n <systemModstamp>2020-06-22T07:23:33.000Z</systemModstamp>\n <numberRecordsProcessed>1</numberRecordsProcessed>\n <numberRecordsFailed>0</numberRecordsFailed>\n <totalProcessingTime>226</totalProcessingTime>\n <apiActiveProcessingTime>170</apiActiveProcessingTime>\n <apexProcessingTime>120</apexProcessingTime>\n</jobInfo>',
          { 'content-type': 'application/xml' },
        )
      const result = await client.bulkLoadOperation('SBQQ__ProductRule__c', 'update', [{ Id: 'a0w3z000007qWOLAA2' }])
      expect(result.length).toEqual(1)
      expect(result[0].id).toEqual('a0w3z000007qWOLAA2')
      expect(result[0].success).toEqual(true)
      expect(result[0].errors).toBeDefined()
      expect(result[0].errors).toHaveLength(0)
    })

    afterEach(() => {
      dodoScope.done()
    })
  })
  describe('get connection details for oauth credentials', () => {
    const oauthCredentials = new OauthAccessTokenCredentials({
      isSandbox: false,
      instanceUrl: 'testInstanceUrl',
      accessToken: 'testAccessToken',
    })
    it('should return empty orgId for oauth credentials', async () => {
      const { orgId, remainingDailyRequests } = await getConnectionDetails(oauthCredentials,
        connection)
      expect(orgId).toEqual('')
      expect(remainingDailyRequests).toEqual(10000)
    })
  })
  describe('upsert', () => {
    it('should call the upsert API endpoint', async () => {
      const dodoScope = nock('http://dodo22')
        .post(/.*/, /.*<upsertMetadata>.*/)
        .reply(200, { 'a:Envelope': { 'a:Body': { a: { result: {
          success: true,
          fullName: 'bla',
        } } } } })
      await expect(client.upsert('bla', { fullName: 'bla' })).resolves.not.toThrow()
      expect(dodoScope.isDone()).toBeTruthy()
    })
  })
  describe('configuration', () => {
    let testClient: SalesforceClient
    let testConnection: Connection

    describe('polling config', () => {
      beforeEach(() => {
        testConnection = mockClient().connection
        testClient = new SalesforceClient({
          credentials: new UsernamePasswordCredentials({
            username: '',
            password: '',
            isSandbox: false,
          }),
          connection: testConnection,
          config: { polling: { interval: 100, timeout: 1000 } },
        })
      })
      it('should set polling and timeout on the metadata connection', () => {
        expect(testConnection.metadata.pollInterval).toEqual(100)
        expect(testConnection.metadata.pollTimeout).toEqual(1000)
      })
      it('should set polling and timeout on the bulk connection', () => {
        expect(testConnection.bulk.pollInterval).toEqual(100)
        expect(testConnection.bulk.pollTimeout).toEqual(1000)
      })
    })

    describe('deploy configuration', () => {
      beforeEach(async () => {
        testConnection = mockClient().connection
        testClient = new SalesforceClient({
          credentials: new UsernamePasswordCredentials({
            username: '',
            password: '',
            isSandbox: false,
          }),
          connection: testConnection,
          config: { deploy: { rollbackOnError: false, testLevel: 'NoTestRun' } },
        })
        await testClient.deploy(Buffer.from(''))
      })

      it('should call deploy with the relevant parameters', () => {
        expect(testConnection.metadata.deploy).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            rollbackOnError: false,
            testLevel: 'NoTestRun',
            ignoreWarnings: true,
          }),
        )
      })
    })

    describe('rate limit configuration', () => {
      type PromiseVal<T> = T extends PromiseLike<infer U> ? U : T
      type Resolvable<T> = {
        promise: Promise<T>
        resolve: () => void
      }
      let reads: Resolvable<PromiseVal<ReturnType<typeof testConnection.metadata.read>>>[]
      let mockRead: jest.MockedFunction<typeof testConnection.metadata.read>
      let readReqs: ReturnType<typeof testClient.readMetadata>[]
      let retrieves: Resolvable<RetrieveResult>[]
      let mockRetrieve: jest.MockedFunction<typeof testConnection.metadata.retrieve>
      let retrieveReqs: ReturnType<typeof testClient.retrieve>[]
      let lists: Resolvable<PromiseVal<ReturnType<typeof testConnection.metadata.list>>>[]
      let mockList: jest.MockedFunction<typeof testConnection.metadata.list>
      let listReqs: ReturnType<typeof testClient.listMetadataObjects>[]

      let emptyRetrieveResult: RetrieveResult

      beforeAll(async () => {
        emptyRetrieveResult = await mockRetrieveResult({ fileProperties: [] })
      })

      const makeResolvablePromise = <T>(resolveValue: T): Resolvable<T> => {
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        let resolve: () => void = () => {}
        // Unsafe assumption - promise constructor calls the paramter function synchronously
        const promise = new Promise<T>(resolveFunc => {
          resolve = () => resolveFunc(resolveValue)
        })
        return { promise, resolve }
      }

      describe('with total and individual limits', () => {
        beforeAll(async () => {
          testConnection = mockClient().connection
          testClient = new SalesforceClient({
            credentials: new UsernamePasswordCredentials({
              username: '',
              password: '',
              isSandbox: false,
            }),
            connection: testConnection,
            config: {
              maxConcurrentApiRequests: {
                total: 5,
                retrieve: 3,
                read: 1,
                list: undefined,
              },
            },
          })
          mockRead = testConnection.metadata.read as jest.MockedFunction<
            typeof testConnection.metadata.read>
          mockRetrieve = testConnection.metadata.retrieve as jest.MockedFunction<
            typeof testConnection.metadata.retrieve>
          mockList = testConnection.metadata.list as jest.MockedFunction<
            typeof testConnection.metadata.list>

          reads = _.times(2, () => makeResolvablePromise([]))
          _.times(reads.length, i => mockRead.mockResolvedValueOnce(reads[i].promise))
          readReqs = _.times(reads.length, i => testClient.readMetadata(`t${i}`, 'name'))
          retrieves = _.times(4, () => makeResolvablePromise(emptyRetrieveResult))
          _.times(
            retrieves.length,
            i => mockRetrieve.mockReturnValueOnce(mockRetrieveLocator(retrieves[i].promise)),
          )
          retrieveReqs = _.times(retrieves.length, i => testClient.retrieve({
            apiVersion: API_VERSION,
            singlePackage: false,
            unpackaged: { version: API_VERSION, types: [{ name: `n${i}`, members: ['x', 'y'] }] },
          }))
          lists = _.times(2, () => makeResolvablePromise([]))
          _.times(lists.length, i => mockList.mockResolvedValueOnce(lists[i].promise))
          listReqs = _.times(lists.length, i => testClient.listMetadataObjects({ type: `t${i}` }))

          retrieves[0].resolve()
          retrieves[1].resolve()
          lists[0].resolve()
          await Promise.all(retrieveReqs.slice(0, 2))
          await listReqs[0]
        })

        it('should not call 2nd read before 1st completed', () => {
          expect(mockRead).toHaveBeenCalledTimes(1)
        })
        it('should not call last retrieve when there are too many in-flight requests', () => {
          expect(mockRetrieve.mock.calls.length).toBeGreaterThanOrEqual(2)
          expect(mockRetrieve.mock.calls.length).toBeLessThan(4)
        })

        it('should complete all the requests when they free up', async () => {
          reads[0].resolve()
          reads[1].resolve()
          retrieves[2].resolve()
          retrieves[3].resolve()
          await Promise.all(readReqs)
          await Promise.all(retrieveReqs)
          expect(mockRead).toHaveBeenCalledTimes(2)
          expect(mockRetrieve).toHaveBeenCalledTimes(4)
        })
      })

      describe('with no limits', () => {
        beforeAll(async () => {
          testConnection = mockClient().connection
          testClient = new SalesforceClient({
            credentials: new UsernamePasswordCredentials({
              username: '',
              password: '',
              isSandbox: false,
            }),
            connection: testConnection,
            config: {
              maxConcurrentApiRequests: {
                retrieve: 100,
              },
            },
          })
          mockRead = testConnection.metadata.read as jest.MockedFunction<
            typeof testConnection.metadata.read>
          mockRetrieve = testConnection.metadata.retrieve as jest.MockedFunction<
            typeof testConnection.metadata.retrieve>

          reads = _.times(2, () => makeResolvablePromise([]))
          _.times(reads.length, i => mockRead.mockResolvedValueOnce(reads[i].promise))
          readReqs = _.times(reads.length, i => testClient.readMetadata(`t${i}`, 'name'))
          retrieves = _.times(4, () => makeResolvablePromise(emptyRetrieveResult))
          _.times(
            retrieves.length,
            i => mockRetrieve.mockReturnValueOnce(mockRetrieveLocator(retrieves[i].promise)),
          )
          retrieveReqs = _.times(retrieves.length, i => testClient.retrieve({
            apiVersion: API_VERSION,
            singlePackage: false,
            unpackaged: { version: API_VERSION, types: [{ name: `n${i}`, members: ['x', 'y'] }] },
          }))
        })

        it('should call 2nd read before 1st completed', async () => {
          reads[1].resolve()
          await readReqs[1]
          expect(mockRead).toHaveBeenCalledTimes(2)
        })
        it('should call all retrieves', async () => {
          // Wait for the last retrieve - this will only work if the throttling allowed
          // the last request to run before the requests before it finished
          retrieves[3].resolve()
          await retrieveReqs[3]
          expect(mockRetrieve).toHaveBeenCalledTimes(4)
        })

        afterAll(async () => {
          [...reads, ...retrieves].forEach(delayedPromise => delayedPromise.resolve())
          await Promise.all(readReqs)
          await Promise.all(retrieveReqs)
        })
      })

      describe('with no config', () => {
        beforeAll(async () => {
          testConnection = mockClient().connection
          testClient = new SalesforceClient({
            credentials: new UsernamePasswordCredentials({
              username: '',
              password: '',
              isSandbox: false,
            }),
            connection: testConnection,
          })
          mockRetrieve = testConnection.metadata.retrieve as jest.MockedFunction<
            typeof testConnection.metadata.retrieve>

          retrieves = _.times(6, () => makeResolvablePromise(emptyRetrieveResult))
          _.times(
            retrieves.length,
            i => mockRetrieve.mockReturnValueOnce(mockRetrieveLocator(retrieves[i].promise)),
          )
          retrieveReqs = _.times(retrieves.length, i => testClient.retrieve({
            apiVersion: API_VERSION,
            singlePackage: false,
            unpackaged: { version: API_VERSION, types: [{ name: `n${i}`, members: ['x', 'y'] }] },
          }))

          retrieves[0].resolve()
          await retrieveReqs[0]
        })

        it('should call at most 4 retrieves', () => {
          expect(mockRetrieve.mock.calls.length).toBeLessThanOrEqual(4)
        })

        afterAll(async () => {
          retrieves.forEach(delayedPromise => delayedPromise.resolve())
          await Promise.all(retrieveReqs)
        })
      })
    })
  })
})
