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
import nock from 'nock'
import { RetryStrategies } from 'requestretry'
import SalesforceClient from '../src/client/client'


describe('salesforce client', () => {
  beforeEach(() => {
    nock.cleanAll()
    nock('https://test.salesforce.com')
      .persist()
      .post(/.*/)
      .reply(200, '<serverUrl>http://dodo22</serverUrl>/')
  })
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
      await expect(client.readMetadata('FakeType', Array.from({ length: 20 }, () => 'FakeName')))
        .rejects.toEqual(new Error('server error'))
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
})
