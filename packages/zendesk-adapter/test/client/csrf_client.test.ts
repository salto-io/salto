/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'
import ZendeskClient from '../../src/client/client'
import ZendeskCsrfClient from '../../src/client/csrf_client'

describe('ZendeskCsrfClient', () => {
  let client: ZendeskCsrfClient
  let mockAxios: MockAdapter

  beforeEach(() => {
    mockAxios = new MockAdapter(axios)

    const zendeskClient = new ZendeskClient({
      credentials: { username: 'a', password: 'b', subdomain: 'one' },
      config: { retry: { retryDelay: 0 } },
    })
    client = ZendeskCsrfClient.createFromZendeskClient(zendeskClient)
  })

  afterEach(() => {
    mockAxios.restore()
  })

  describe('get (should act like ZendeskClient)', () => {
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
  })

  describe('post', () => {
    it('should get a CSRF token and add it to the request', async () => {
      const endpoint = '/api/v2/some_endpoint'
      // The first replyOnce with 200 is for the client authentication
      mockAxios
        .onGet()
        .replyOnce(200)
        .onGet()
        .replyOnce(200, {
          user: {
            authenticity_token: 'secret-csrf-token',
          },
        })
        .onPost(
          endpoint,
          { some: 'data' },
          expect.objectContaining({
            'Content-Type': 'application/json',
            'X-CSRF-Token': 'secret-csrf-token',
          }),
        )
        .replyOnce(200, { data: 'success' })
      const res = await client.post({ url: endpoint, data: { some: 'data' } })
      expect(res.data).toEqual({ data: 'success' })
      expect(res.status).toEqual(200)
    })

    it('should retry the request with a new CSRF token if the first request fails with 400', async () => {
      const endpoint = '/api/v2/some_endpoint'
      // The first replyOnce with 200 is for the client authentication
      mockAxios
        .onGet()
        .replyOnce(200)
        .onGet()
        .replyOnce(200, {
          user: {
            authenticity_token: 'secret-csrf-token',
          },
        })
        .onPost(
          endpoint,
          { some: 'data' },
          expect.objectContaining({
            'Content-Type': 'application/json',
            'X-CSRF-Token': 'secret-csrf-token',
          }),
        )
        .replyOnce(400)
        .onGet()
        .replyOnce(200, {
          user: {
            authenticity_token: 'new-secret-csrf-token',
          },
        })
        .onPost(
          endpoint,
          { some: 'data' },
          expect.objectContaining({
            'Content-Type': 'application/json',
            'X-CSRF-Token': 'new-secret-csrf-token',
          }),
        )
        .replyOnce(200, { data: 'success' })
      const res = await client.post({ url: endpoint, data: { some: 'data' } })
      expect(res.data).toEqual({ data: 'success' })
      expect(res.status).toEqual(200)
    })

    it('should throw an error if the first request fails with a status code other than 400', async () => {
      const endpoint = '/api/v2/some_endpoint'
      // The first replyOnce with 200 is for the client authentication
      mockAxios
        .onGet()
        .replyOnce(200)
        .onGet()
        .replyOnce(200, {
          user: {
            authenticity_token: 'secret-csrf-token',
          },
        })
        .onPost(endpoint, { some: 'data' })
        .replyOnce(500)
      await expect(() => client.post({ url: endpoint, data: { some: 'data' } })).rejects.toThrow(
        new Error('Failed to post /api/v2/some_endpoint with error: Request failed with status code 500'),
      )
    })
  })
})
