/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'
import WorkatoClient from '../../src/client/client'

describe('client', () => {
  describe('get', () => {
    let mockAxios: MockAdapter
    let client: WorkatoClient
    beforeEach(() => {
      mockAxios = new MockAdapter(axios)
      client = new WorkatoClient({ credentials: { token: 'dummy_token' } })
    })

    afterEach(() => {
      mockAxios.restore()
    })

    it('should return an empty result when there is a 400 response and we asked for roles', async () => {
      // The first replyOnce with 200 is for the client authentication
      mockAxios.onGet().replyOnce(200).onGet().replyOnce(400)
      const res = await client.get({ url: '/roles' })
      expect(res.data).toEqual([])
      expect(res.status).toEqual(400)
    })
    it('should throw when there is a 400 response but we did not ask for roles', async () => {
      // The first replyOnce with 200 is for the client authentication
      mockAxios.onGet().replyOnce(200).onGet().replyOnce(400)
      await expect(client.get({ url: '/api_access_profiles' })).rejects.toThrow()
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
      await expect(client.get({ url: '/connections' })).rejects.toThrow()
    })
  })
})
