/*
*                      Copyright 2020 Salto Labs Ltd.
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
import { RetryStrategies } from 'requestretry'
import { Values } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import SalesforceClient, { ApiLimitsTooLowError, getConnectionDetails, validateCredentials } from '../src/client/client'
import mockClient from './client'

const { array, asynciterable } = collections
const { makeArray } = array
const { mapAsync, toArrayAsync } = asynciterable

describe('salesforce client', () => {
  beforeEach(() => {
    nock.cleanAll()
    nock('https://test.salesforce.com')
      .persist()
      .post(/.*/)
      .reply(200, '<serverUrl>http://dodo22</serverUrl>/')
  })
  const credentials = {
    username: 'myUser',
    password: 'myPass',
    apiToken: 'myToken',
    isSandbox: false,
  }
  const { connection } = mockClient()
  const client = new SalesforceClient({ credentials: {
    isSandbox: true,
    username: '',
    password: '',
  },
  retryOptions: {
    maxAttempts: 4, // try 5 times
    retryDelay: 100, // wait for 100ms before trying again
    retryStrategy: RetryStrategies.NetworkError, // retry on network errors
  } })
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
      const dodoScope = nock('http://dodo22/services/Soap/m/47.0')
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
      const dodoScope = nock('http://dodo22/services/Soap/m/47.0')
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
      const dodoScope = nock('http://dodo22/services/Soap/m/47.0')
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
      const dodoScope = nock('http://dodo22/servies/Soap/m/47.0')
        .post(/.*/)
        .reply(500, 'targetObject is invalid')

      await expect(client.readMetadata('QuickAction', 'SendEmail')).resolves.not.toThrow()
      expect(dodoScope.isDone()).toBeTruthy()
    })

    it('should return non error responses', async () => {
      const dodoScope = nock('http://dodo22/servies/Soap/m/47.0')
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
      _.sum(_.flatten(await toArrayAsync(await mapAsync(
        iterator,
        vals => makeArray(vals).map(() => 1)
      ))))

    describe('when all results are in a single query', () => {
      beforeEach(async () => {
        dodoScope = nock('http://dodo22/services/data/v47.0/query/')
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

    describe('when results are returned in more tha one query', () => {
      beforeEach(async () => {
        dodoScope = nock('http://dodo22/services/data/v47.0/query')
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
  })
  describe('bulkLoadOperation', () => {
    let dodoScope: nock.Scope
    beforeEach(() => {
      dodoScope = nock('http://dodo22/services/async/47.0/job')
        .post(/.*/)
        .reply(
          200,
          '<?xml version="1.0" encoding="UTF-8"?><jobInfo\n   xmlns="http://www.force.com/2009/06/asyncapi/dataload">\n <id>7503z00000WDQ4SAAX</id>\n <operation>update</operation>\n <object>SBQQ__ProductRule__c</object>\n <createdById>0053z00000BCOCMAA5</createdById>\n <createdDate>2020-06-22T07:23:32.000Z</createdDate>\n <systemModstamp>2020-06-22T07:23:32.000Z</systemModstamp>\n <state>Open</state>\n <concurrencyMode>Parallel</concurrencyMode>\n <contentType>CSV</contentType>\n <numberBatchesQueued>0</numberBatchesQueued>\n <numberBatchesInProgress>0</numberBatchesInProgress>\n <numberBatchesCompleted>0</numberBatchesCompleted>\n <numberBatchesFailed>0</numberBatchesFailed>\n <numberBatchesTotal>0</numberBatchesTotal>\n <numberRecordsProcessed>0</numberRecordsProcessed>\n <numberRetries>0</numberRetries>\n <apiVersion>47.0</apiVersion>\n <numberRecordsFailed>0</numberRecordsFailed>\n <totalProcessingTime>0</totalProcessingTime>\n <apiActiveProcessingTime>0</apiActiveProcessingTime>\n <apexProcessingTime>0</apexProcessingTime>\n</jobInfo>',
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

    it('should throw error when returned with errors', async () => {
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
      await expect(client.bulkLoadOperation('SBQQ__ProductRule__c', 'update', [{ Id: 'a0w3z000007qWOLAA2' }])).rejects.toEqual(new Error('error'))
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
      await expect(client.bulkLoadOperation('SBQQ__ProductRule__c', 'update', [{ Id: 'a0w3z000007qWOLAA2' }])).resolves.not.toThrow()
    })

    afterEach(() => {
      dodoScope.done()
    })
  })
})
