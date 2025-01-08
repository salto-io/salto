/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { InstanceElement } from '@salto-io/adapter-api'
import {
  createFromOauthResponse,
  createOAuthRequest,
  getAuthenticationBaseUrl,
  getOAuthRequiredScopes,
} from '../../src/client/oauth'
import { objectTypeMock } from '../mocks'

jest.mock('axios', () => ({
  create: jest.fn().mockReturnValue({
    post: jest.fn().mockResolvedValue({
      data: {
        access_token: 'access_token',
        refresh_token: 'refresh_token',
      },
    }),
  }),
}))

describe('OAuth client', () => {
  describe(`${getOAuthRequiredScopes}`, () => {
    describe('when all services are requested', () => {
      it('should return all scopes', () => {
        const scopes = getOAuthRequiredScopes({ Entra: true, Intune: true })
        // Basic scopes
        expect(scopes).toContain('Group.ReadWrite.All')
        // Entra scopes sample
        expect(scopes).toContain('AdministrativeUnit.ReadWrite.All')
        // Intune scopes sample
        expect(scopes).toContain('DeviceManagementApps.ReadWrite.All')
      })
    })

    describe('when only entra is requested', () => {
      it('should return only entra scopes', () => {
        const scopes = getOAuthRequiredScopes({ Entra: true, Intune: false })
        // Basic scopes
        expect(scopes).toContain('Group.ReadWrite.All')
        // Entra scopes sample
        expect(scopes).toContain('AdministrativeUnit.ReadWrite.All')
        expect(scopes).not.toContain('DeviceManagementApps.ReadWrite.All')
      })
    })

    describe('when only intune is requested', () => {
      it('should return only intune scopes', () => {
        const scopes = getOAuthRequiredScopes({ Entra: false, Intune: true })
        // Basic scopes
        expect(scopes).toContain('Group.ReadWrite.All')
        // Intune scopes sample
        expect(scopes).toContain('DeviceManagementApps.ReadWrite.All')
        expect(scopes).not.toContain('AdministrativeUnit.ReadWrite.All')
      })
    })
  })

  describe(`${getAuthenticationBaseUrl.name}`, () => {
    it('should return the correct authentication base url', () => {
      expect(getAuthenticationBaseUrl('tenantId')).toEqual('https://login.microsoftonline.com/tenantId/oauth2/v2.0')
    })
  })

  describe(`${createOAuthRequest.name}`, () => {
    it('should return the correct request', () => {
      const userInput = new InstanceElement('oauthRequest', objectTypeMock, {
        tenantId: 'tenantId',
        clientId: 'clientId',
        clientSecret: 'clientSecret',
        port: 1234,
        Entra: true,
        Intune: false,
      })
      const request = createOAuthRequest(userInput)
      expect(request).toEqual({
        oauthRequiredFields: ['code'],
        url: expect.stringContaining(
          'https://login.microsoftonline.com/tenantId/oauth2/v2.0/authorize?client_id=clientId&response_type=code&redirect_uri=http://localhost:1234/extract&scope=offline_access ',
        ),
      })
    })

    it('should throw an error when no service is selected', () => {
      const userInput = new InstanceElement('oauthRequest', objectTypeMock, {
        tenantId: 'tenantId',
        clientId: 'clientId',
        clientSecret: 'clientSecret',
        port: 1234,
        Entra: false,
        Intune: false,
      })
      expect(() => createOAuthRequest(userInput)).toThrow(
        'At least one service should be selected to be managed by Salto',
      )
    })
  })

  describe(`${createFromOauthResponse.name}`, () => {
    it('should return the correct credentials', async () => {
      const input = {
        tenantId: 'tenantId',
        clientId: 'clientId',
        clientSecret: 'clientSecret',
        port: 1234,
        Entra: true,
        Intune: false,
      }
      const response = {
        fields: {
          code: 'code',
        },
      }
      const credentials = await createFromOauthResponse(input, response)
      expect(credentials).toEqual({
        tenantId: 'tenantId',
        clientId: 'clientId',
        clientSecret: 'clientSecret',
        refreshToken: 'refresh_token',
        servicesToManage: { Entra: true, Intune: false },
      })
    })
  })
})
