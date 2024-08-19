/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'
import { InstanceElement, isInstanceElement, ObjectType } from '@salto-io/adapter-api'
import { definitions } from '@salto-io/adapter-components'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { adapter } from '../src/adapter_creator'
import { credentialsType } from '../src/client/oauth'
import { DEFAULT_CONFIG } from '../src/config'
import fetchMockReplies from './fetch_mock_replies.json'

type MockReply = {
  url: string
  method: definitions.HTTPMethod
  params?: Record<string, string>
  response: unknown
}

describe('Microsoft Security adapter', () => {
  jest.setTimeout(10 * 1000)
  let mockAxiosAdapter: MockAdapter

  beforeEach(async () => {
    mockAxiosAdapter = new MockAdapter(axios, { delayResponse: 1, onNoMatch: 'throwException' })
    mockAxiosAdapter.onGet('/v1.0/me').reply(200, { app: { id_code: '123' } })
    mockAxiosAdapter.onPost('https://login.microsoftonline.com/testTenantId/oauth2/v2.0/token').reply(200, {
      access_token: 'testAccessToken',
    })
    ;([...fetchMockReplies] as MockReply[]).forEach(({ url, params, response }) => {
      const mock = mockAxiosAdapter.onGet.bind(mockAxiosAdapter)
      const handler = mock(url, !_.isEmpty(params) ? { params } : undefined)
      handler.replyOnce(200, response)
    })
  })

  afterEach(() => {
    mockAxiosAdapter.restore()
    jest.clearAllMocks()
  })

  describe('fetch', () => {
    describe('full', () => {
      it('should generate the right elements on fetch', async () => {
        expect(adapter.configType).toBeDefined()
        const { elements } = await adapter
          .operations({
            credentials: new InstanceElement('config', credentialsType, {
              tenantId: 'testTenantId',
              clientId: 'testClientId',
              clientSecret: 'testClient',
              refreshToken: 'testRefreshToken',
            }),
            config: new InstanceElement('config', adapter.configType as ObjectType, DEFAULT_CONFIG),
            elementsSource: buildElementsSourceFromElements([]),
          })
          .fetch({ progressReporter: { reportProgress: () => null } })

        expect([...new Set(elements.filter(isInstanceElement).map(e => e.elemID.typeName))].sort()).toEqual([
          'entra_administrativeUnit',
          'entra_appRole',
          'entra_application',
          'entra_authenticationMethodPolicy',
          'entra_authenticationMethodPolicy__authenticationMethodConfigurations',
          'entra_authenticationStrengthPolicy',
          'entra_conditionalAccessPolicy',
          'entra_conditionalAccessPolicyNamedLocation',
          'entra_crossTenantAccessPolicy',
          'entra_customSecurityAttributeDefinition',
          'entra_customSecurityAttributeDefinition__allowedValues',
          'entra_customSecurityAttributeSet',
          'entra_directoryRoleTemplate',
          'entra_domain',
          'entra_group',
          'entra_groupLifeCyclePolicy',
          'entra_group__appRoleAssignments',
          'entra_oauth2PermissionGrant',
          'entra_permissionGrantPolicy',
          'entra_roleDefinition',
          'entra_servicePrincipal',
          'intune_application',
        ])
        // TODO: Validate Entra sub-types and structure of the elements

        /* Specific instances: */
        const instances = elements.filter(isInstanceElement)

        // Intune applications
        const intuneApplications = instances.filter(e => e.elemID.typeName === 'intune_application')
        expect(intuneApplications).toHaveLength(6)

        const intuneApplicationNames = intuneApplications.map(e => e.elemID.name)
        expect(intuneApplicationNames).toEqual(
          expect.arrayContaining([
            'iosStoreApp_test',
            'androidStoreApp_com_test@uv',
            'androidManagedStoreApp_com_test@uv',
            'managedIOSStoreApp_test',
            'managedAndroidStoreApp_com_test2@uv',
            'managedAndroidStoreApp_com_test@uv',
          ]),
        )

        const intuneApplicationParts = intuneApplications.map(e => e.path)
        expect(intuneApplicationParts).toEqual(
          expect.arrayContaining([
            ['microsoft_security', 'Records', 'intune_application', 'iosStoreApp', 'test'],
            ['microsoft_security', 'Records', 'intune_application', 'androidStoreApp', 'com_test'],
            ['microsoft_security', 'Records', 'intune_application', 'androidManagedStoreApp', 'com_test'],
            ['microsoft_security', 'Records', 'intune_application', 'managedIOSStoreApp', 'test'],
            ['microsoft_security', 'Records', 'intune_application', 'managedAndroidStoreApp', 'com_test2'],
            ['microsoft_security', 'Records', 'intune_application', 'managedAndroidStoreApp', 'com_test'],
          ]),
        )
      })
    })
  })
  // TODO: implement deploy UTs
})
