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

describe('Microsoft Entra adapter', () => {
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
          'administrativeUnit',
          'application',
          'authenticationMethodPolicy',
          'authenticationMethodPolicy__authenticationMethodConfigurations',
          'authenticationStrengthPolicy',
          'conditionalAccessPolicy',
          'conditionalAccessPolicyNamedLocation',
          'crossTenantAccessPolicy',
          'customSecurityAttributeDefinition',
          'customSecurityAttributeDefinition__allowedValues',
          'customSecurityAttributeSet',
          'directoryRoleTemplate',
          'domain',
          'group',
          'groupLifeCyclePolicy',
          'group__appRoleAssignments',
          'oauth2PermissionGrant',
          'permissionGrantPolicy',
          'roleDefinition',
          'servicePrincipal',
        ])
        // TODO: Validate sub-types and structure of the elements
      })
    })
  })
  // TODO: implement deploy UTs
})
