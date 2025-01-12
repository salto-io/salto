/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'
import ZendeskClient from '../../src/client/client'
import ZendeskGuideClient from '../../src/client/guide_client'

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
    let guideClient: ZendeskGuideClient
    beforeEach(() => {
      mockAxios = new MockAdapter(axios)
      logTrace.mockReset()
      const client1 = new ZendeskClient({
        credentials: { username: 'a', password: 'b', subdomain: 'one' },
        config: { retry: { retryDelay: 0 } },
      })
      const client2 = new ZendeskClient({
        credentials: { username: 'a', password: 'b', subdomain: 'two' },
        config: { retry: { retryDelay: 0 } },
      })
      guideClient = new ZendeskGuideClient({ 1: client1, 2: client2 })
    })

    afterEach(() => {
      mockAxios.restore()
    })

    it('should return response from correct client', async () => {
      // The first replyOnce with 200 is for the client authentication
      mockAxios
        .onGet()
        .replyOnce(200)
        .onGet('https://one.zendesk.com/api/v2/test')
        .replyOnce(200, {
          test: [
            {
              id: 1,
              client: 'one',
            },
          ],
        })

      mockAxios
        .onGet()
        .replyOnce(200)
        .onGet('https://two.zendesk.com/api/v2/test')
        .replyOnce(200, {
          test: [
            {
              id: 2,
              client: 'two',
            },
          ],
        })
      const res = await guideClient.get({ url: '/api/v2/test', params: { brand: { id: '1' } } })
      expect(res.data).toEqual({
        test: [
          {
            id: 1,
            client: 'one',
          },
        ],
      })
      expect(res.status).toEqual(200)
    })
    it('should return an empty result if client id does not exist', async () => {
      const res = await guideClient.get({ url: '/api/v2/test', params: { brand: { id: '3' } } })
      expect(res.data).toEqual([])
      expect(res.status).toEqual(404)
    })
    it('should throw when brand id is not defined', async () => {
      await expect(guideClient.get({ url: '/api/v2/test' })).rejects.toThrow()
    })
  })
})
