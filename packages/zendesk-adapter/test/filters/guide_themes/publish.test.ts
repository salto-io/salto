/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import ZendeskClient from '../../../src/client/client'
import { publish } from '../../../src/filters/guide_themes/publish'

describe('create', () => {
  let client: ZendeskClient
  let mockPost: jest.SpyInstance

  beforeEach(() => {
    client = new ZendeskClient({
      credentials: { username: 'a', password: 'b', subdomain: 'ignore' },
    })
    mockPost = jest.spyOn(client, 'post')
  })

  describe('successful flow', () => {
    describe('no errors', () => {
      beforeEach(() => {
        mockPost.mockResolvedValue({
          status: 200,
        })
      })

      it('returns no errors when successful', async () => {
        expect(await publish('1', client)).toEqual([])
        expect(mockPost).toHaveBeenCalledTimes(1)
        expect(mockPost).toHaveBeenCalledWith({
          url: '/api/v2/guide/theming/themes/1/publish',
        })
      })
    })

    describe('with errors', () => {
      beforeEach(() => {
        mockPost.mockResolvedValue({
          status: 400,
        })
      })

      it('returns an errors', async () => {
        expect(await publish('1', client)).toEqual(['Failed to publish theme 1. Received status code 400'])
      })
    })
  })
})
