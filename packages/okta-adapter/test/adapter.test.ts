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
import { AdapterOperations, ElemID, ElemIdGetter, ServiceIds, ObjectType, InstanceElement } from '@salto-io/adapter-api'
import { elements, openapi } from '@salto-io/adapter-components'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import MockAdapter from 'axios-mock-adapter'
import axios from 'axios'
import { adapter as adapterCreator } from '../src/adapter_creator'
import { DEFAULT_CONFIG } from '../src/config'
import { OKTA } from '../src/constants'
import { createCredentialsInstance, createConfigInstance } from './utils'
import { oauthAccessTokenCredentialsType } from '../src/auth'

const { getAllInstances } = elements.swagger
const { generateTypes } = openapi

jest.mock('@salto-io/adapter-components', () => {
  const actual = jest.requireActual('@salto-io/adapter-components')
  // only including relevant functions
  return {
    ...actual,
    deployment: {
      ...actual.deployment,
      changeValidators: actual.deployment.changeValidators,
      deployChange: jest.fn().mockImplementation(actual.elements.swagger.deployChange),
    },
    elements: {
      ...actual.elements,
      swagger: {
        flattenAdditionalProperties: actual.elements.swagger.flattenAdditionalProperties,
        getAllInstances: jest.fn().mockImplementation(() => {
          throw new Error('getAllInstances called without a mock')
        }),
      },
    },
    openapi: {
      ...actual.openapi,
      generateTypes: jest.fn().mockImplementation(() => {
        throw new Error('generateTypes called without a mock')
      }),
      addDeploymentAnnotations: jest.fn(),
    },
  }
})

const mockIsClassicOrg = jest.fn().mockImplementation(() => false)
jest.mock('../src/utils', () => {
  const actual = jest.requireActual('../src/utils')
  return {
    ...actual,
    isClassicEngineOrg: jest.fn(args => mockIsClassicOrg(args)),
  }
})

const mockGetUsers = jest.fn()
jest.mock('../src/user_utils', () => ({
  ...jest.requireActual<{}>('../src/user_utils'),
  getUsers: jest.fn(args => mockGetUsers(args)),
}))

describe('Okta adapter', () => {
  jest.setTimeout(1000 * 7)
  let getElemIdFunc: ElemIdGetter
  const adapterSetup = (credentials: InstanceElement): AdapterOperations => {
    const elementsSource = buildElementsSourceFromElements([])
    getElemIdFunc = (adapterName: string, _serviceIds: ServiceIds, name: string): ElemID =>
      new ElemID(adapterName, name)

    const config = createConfigInstance(DEFAULT_CONFIG)

    return adapterCreator.operations({
      elementsSource,
      credentials,
      config,
      getElemIdFunc,
    })
  }

  describe('fetch', () => {
    let oktaTestType: ObjectType
    let testInstance: InstanceElement
    let mockAxiosAdapter: MockAdapter

    beforeEach(async () => {
      jest.clearAllMocks()
      oktaTestType = new ObjectType({
        elemID: new ElemID(OKTA, 'okta'),
      })
      testInstance = new InstanceElement('test', oktaTestType)
      ;(generateTypes as jest.MockedFunction<typeof generateTypes>).mockResolvedValueOnce({
        allTypes: { OktaTest: oktaTestType },
        parsedConfigs: { OktaTest: { request: { url: 'okta' } } },
      })
      ;(getAllInstances as jest.MockedFunction<typeof getAllInstances>).mockResolvedValue({ elements: [testInstance] })
      mockAxiosAdapter = new MockAdapter(axios)
      // mock as there are gets of users during fetch
      mockAxiosAdapter.onGet().reply(200, {})

      mockAxiosAdapter.onPost('/oauth2/v1/token').reply(200, {
        // eslint-disable-next-line camelcase
        token_type: 'Bearer',
        access_token: 'token123',
        expires_in: 10000,
        refresh_token: 'refresh',
      })
    })

    it('should return all types and instances returned from the infrastructure', async () => {
      // const adapter = adapterSetup(createCredentialsInstance({ baseUrl: 'http:/okta.test', token: 't' }))
      const adapter = adapterSetup(createCredentialsInstance({ baseUrl: 'https://test.okta.com', token: 't' }))
      const result = await adapter.fetch({ progressReporter: { reportProgress: () => null } })
      expect(result.elements).toContain(oktaTestType)
      expect(result.elements).toContain(testInstance)
    })

    it('should config change suggestion and fetch warning when usePrivateApi is enabled and authentication method is OAuth', async () => {
      const oauthCredentials = new InstanceElement(ElemID.CONFIG_NAME, oauthAccessTokenCredentialsType, {
        authType: 'oauth',
        baseUrl: 'https://a.okta.com',
        refreshToken: 'refresh',
        clientId: 'a',
        clientSecret: 'b',
      })
      const adapter = adapterSetup(oauthCredentials)
      const result = await adapter.fetch({ progressReporter: { reportProgress: () => null } })
      expect(result.errors).toHaveLength(1)
      expect(result.errors).toEqual([
        {
          message:
            'Salto could not access private API when connecting with OAuth. Group Push and Settings types could not be fetched',
          severity: 'Warning',
        },
      ])
      expect(result.updatedConfig?.message).toContain('Private APIs can not be accessed when using OAuth login')
      expect(result.updatedConfig?.config[0].value.client).toEqual({
        usePrivateAPI: false,
      })
      expect(result.elements).toContain(oktaTestType)
      expect(result.elements).toContain(testInstance)
    })

    it('should call getUsers if convertUserIds flag is enabled', async () => {
      const adapter = adapterSetup(createCredentialsInstance({ baseUrl: 'https://okta.oktapreview.com', token: 't' }))
      await adapter.fetch({ progressReporter: { reportProgress: () => null } })
      expect(mockGetUsers).toHaveBeenCalledTimes(1)
    })

    it('should create updated config for classic orgs when isClassicOrg config flag is undefined', async () => {
      mockIsClassicOrg.mockImplementationOnce(() => true)
      const adapter = adapterSetup(createCredentialsInstance({ baseUrl: 'https://okta-test.okta.com', token: 't' }))
      const result = await adapter.fetch({ progressReporter: { reportProgress: () => null } })
      expect(mockIsClassicOrg).toHaveBeenCalledTimes(1)
      expect(result.updatedConfig).toBeDefined()
      expect(result.updatedConfig?.config[0].value.fetch).toEqual({
        ...DEFAULT_CONFIG.fetch,
        isClassicOrg: true,
      })
    })
  })
})
