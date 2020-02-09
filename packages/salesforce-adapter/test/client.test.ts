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
    nock('https://login.salesforce.com')
      .persist()
      .post(/.*/)
      .reply(200, '<serverUrl>http://dodo22</serverUrl>/')
  })
  const client = new SalesforceClient({ credentials: {
    isSandbox: false,
    username: '',
    password: '',
  },
  retryOptions: {
    maxAttempts: 4, // try 5 times
    retryDelay: 100, // wait for 100ms before trying again
    retryStrategy: RetryStrategies.NetworkError, // retry on network errors
  } })

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
        }, {
          'content-type': 'application/json',
        })

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
          { 'content-type': 'application/json' })

      try {
        await client.listMetadataTypes()
        throw new Error('client should have failed')
      } catch (e) {
        expect(e.message).toBe('server error')
        expect(e.attempts).toBeUndefined()
      }
      expect(dodoScope.isDone()).toBeFalsy()
    })

    it('continue in case of error in single chunk', async () => {
      const dodoScope = nock('http://dodo22/services/Soap/m/47.0')
        .post(/.*/)
        .times(2)
        .reply(200,
          {
            'a:Envelope': { 'a:Body': { a: { result: { records: [{ fullName: 'BLA' }] } } } },
          },
          {
            'content-type': 'application/json',
          })
        .post(/.*/)
        .times(1)
        .reply(500, 'server error')
      // create an array with 30 names so we will have 3 calls (chunk size is 10 for readMetadata)
      const result = await client.readMetadata('FakeType', Array.from({ length: 30 }, () => 'FakeName'))
      expect(result).toHaveLength(2)
      expect(dodoScope.isDone()).toBeTruthy()
    })

    it('fail in case of error in all chunk', async () => {
      const dodoScope = nock('http://dodo22/services/Soap/m/47.0')
        .post(/.*/)
        .times(2)
        .reply(500, 'server error')
      // create an array with 20 names so we will have 2 calls
      await expect(client.readMetadata('FakeType', Array.from({ length: 20 }, () => 'FakeName')))
        .rejects.toEqual(new Error('server error'))
      expect(dodoScope.isDone()).toBeTruthy()
    })
  })
})
