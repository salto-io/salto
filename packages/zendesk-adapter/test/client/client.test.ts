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
import ZendeskClient from '../../src/client/client'

const logTrace = jest.fn()
jest.mock('@salto-io/logging', () => {
  const actual = jest.requireActual('@salto-io/logging')
  return {
    ...actual,
    logger: () => ({ ...actual.logger('test'), trace: (...args: unknown[]) => logTrace(args) }),
  }
})

describe('client', () => {
  describe('get', () => {
    let mockAxios: MockAdapter
    let client: ZendeskClient
    beforeEach(() => {
      mockAxios = new MockAdapter(axios)
      logTrace.mockReset()
      client = new ZendeskClient({
        credentials: { username: 'a', password: 'b', subdomain: 'ignore' },
        config: { retry: { retryDelay: 0 } },
      })
    })

    afterEach(() => {
      mockAxios.restore()
    })

    it('should return a holiday response with start_year and end_year', async () => {
      // The first replyOnce with 200 is for the client authentication
      mockAxios
        .onGet()
        .replyOnce(200)
        .onGet()
        .replyOnce(200, {
          holidays: [
            {
              id: 1,
            },
            {
              id: 2,
            },
          ],
        })
      const res = await client.get({ url: '/api/v2/business_hours/schedules/123/holidays' })
      expect(res.data).toEqual({
        holidays: [
          {
            id: 1,
            start_year: 0,
            end_year: 0,
          },
          {
            id: 2,
            start_year: 1,
            end_year: 1,
          },
        ],
      })
      expect(res.status).toEqual(200)
    })
    it('should return a support address response with username', async () => {
      // The first replyOnce with 200 is for the client authentication
      mockAxios
        .onGet()
        .replyOnce(200)
        .onGet()
        .replyOnce(200, {
          recipient_addresses: [
            {
              id: 1,
            },
            {
              id: 2,
            },
          ],
        })
      const res = await client.get({ url: '/api/v2/recipient_addresses' })
      expect(res.data).toEqual({
        recipient_addresses: [
          {
            id: 1,
            username: 0,
          },
          {
            id: 2,
            username: 1,
          },
        ],
      })
      expect(res.status).toEqual(200)
    })
    it('should return a article attachment response with hash', async () => {
      // The first replyOnce with 200 is for the client authentication
      mockAxios
        .onGet()
        .replyOnce(200)
        .onGet()
        .replyOnce(200, {
          article_attachments: [
            {
              id: 1,
            },
            {
              id: 2,
            },
          ],
        })
      const res = await client.get({ url: '/api/v2/help_center/articles/123/attachments' })
      expect(res.data).toEqual({
        article_attachments: [
          {
            id: 1,
            hash: 0,
          },
          {
            id: 2,
            hash: 1,
          },
        ],
      })
      expect(res.status).toEqual(200)
    })
    it('should return an empty result when there is a 404 response', async () => {
      // The first replyOnce with 200 is for the client authentication
      mockAxios.onGet().replyOnce(200).onGet().replyOnce(404)
      const res = await client.get({ url: '/api/v2/routing/attributes' })
      expect(res.data).toEqual([])
      expect(res.status).toEqual(404)
    })
    it('should throw when there is a 403 response', async () => {
      // The first replyOnce with 200 is for the client authentication
      mockAxios.onGet().replyOnce(200).onGet().replyOnce(403)
      await expect(client.get({ url: '/api/v2/routing/attributes' })).rejects.toThrow()
    })
    it('should throw if there is no status in the error', async () => {
      // The first replyOnce with 200 is for the client authentication
      mockAxios
        .onGet()
        .replyOnce(200)
        .onGet()
        .replyOnce(() => {
          throw new Error('Err')
        })
      await expect(client.get({ url: '/api/v2/routing/attributes' })).rejects.toThrow()
    })
    it('should retry on 409, 429 and 503', async () => {
      // The first replyOnce with 200 is for the client authentication
      mockAxios
        .onGet()
        .replyOnce(200)
        .onPost()
        .replyOnce(429)
        .onPost()
        .replyOnce(409)
        .onPost()
        .replyOnce(503)
        .onPost()
        .replyOnce(200)
      await client.post({ url: '/api/v2/routing/attributes', data: {} })
      expect(mockAxios.history.post.length).toEqual(4)
    })

    it('should filter out responses data by config', async () => {
      const orgsResponse = {
        organizations: [
          { id: 1, name: 'org1' },
          { id: 2, name: 'org2' },
        ],
      }

      mockAxios
        .onGet()
        .replyOnce(200)
        .onGet()
        .reply(() => [200, orgsResponse])
      const notFilteringClient = new ZendeskClient({
        credentials: { username: 'a', password: 'b', subdomain: 'ignore' },
        allowOrganizationNames: true,
      })
      await notFilteringClient.get({ url: 'organizations/show_many' })
      await notFilteringClient.get({ url: 'organizations/autocomplete' })

      await client.get({ url: 'organizations/show_many' })
      await client.get({ url: 'organizations/autocomplete' })

      const responseText1 =
        '{"url":"organizations/show_many","method":"GET","status":200,"response":{"organizations":[{"id":1,"name":"org1"},{"id":2,"name":"org2"}]}}'

      expect(logTrace).toHaveBeenNthCalledWith(1, [
        'Full HTTP response for %s on %s (size %d): %s',
        'GET',
        'organizations/show_many',
        responseText1.length,
        responseText1,
      ])

      const responseText2 =
        '{"url":"organizations/autocomplete","method":"GET","status":200,"response":{"organizations":[{"id":1,"name":"org1"},{"id":2,"name":"org2"}]}}'

      expect(logTrace).toHaveBeenNthCalledWith(2, [
        'Full HTTP response for %s on %s (size %d): %s',
        'GET',
        'organizations/autocomplete',
        responseText2.length,
        responseText2,
      ])

      const responseText3 =
        '{"url":"organizations/show_many","method":"GET","status":200,"response":{"organizations":[{"id":1,"name":"<OMITTED>"},{"id":2,"name":"<OMITTED>"}]}}'

      expect(logTrace).toHaveBeenNthCalledWith(3, [
        'Full HTTP response for %s on %s (size %d): %s',
        'GET',
        'organizations/show_many',
        responseText3.length,
        responseText3,
      ])

      const responseText4 =
        '{"url":"organizations/autocomplete","method":"GET","status":200,"response":{"organizations":[{"id":1,"name":"<OMITTED>"},{"id":2,"name":"<OMITTED>"}]}}'

      expect(logTrace).toHaveBeenNthCalledWith(4, [
        'Full HTTP response for %s on %s (size %d): %s',
        'GET',
        'organizations/autocomplete',
        responseText4.length,
        responseText4,
      ])
    })
  })
})
