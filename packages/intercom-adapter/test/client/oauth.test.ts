/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'
import { ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { createFromOauthResponse, createOAuthRequest } from '../../src/client/oauth'

describe('Intercom OAuth', () => {
  describe('createOAuthRequest', () => {
    it('Should return the correct OAuthRequestParameters', () => {
      const oauthRequestParameters = createOAuthRequest(
        new InstanceElement('oauthRequestParameters', new ObjectType({ elemID: new ElemID('oauth') }), {
          clientId: 'clientId',
          clientSecret: 'clientSecret',
          port: 8080,
        }),
      )
      expect(oauthRequestParameters).toEqual({
        url: 'https://app.intercom.com/oauth?client_id=clientId',
        oauthRequiredFields: ['code'],
      })
    })
  })

  describe('createFromOauthResponse', () => {
    let mockAxios: MockAdapter
    beforeEach(() => {
      mockAxios = new MockAdapter(axios)
    })

    it('Should call axios post with the correct parameters and return the received access token', async () => {
      mockAxios.onPost().reply(200, {
        access_token: 'testAccessToken',
      })
      const oauthResponse = await createFromOauthResponse(
        {
          clientId: 'clientId',
          clientSecret: 'clientSecret',
        },
        { fields: { code: 'testCode' } },
      )

      // Verify correct axios call
      expect(mockAxios.history.post.length).toBe(1)
      expect(mockAxios.history.post[0].url).toBe('https://api.intercom.io/auth/eagle/token')
      expect(mockAxios.history.post[0].headers).toEqual(
        expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      )
      expect(mockAxios.history.post[0].data).toBe(
        '{"client_id":"clientId","client_secret":"clientSecret","code":"testCode"}',
      )

      // Verify correct response
      expect(oauthResponse).toEqual({
        accessToken: 'testAccessToken',
      })
    })
  })
})
