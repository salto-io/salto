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
import { ObjectType, InstanceElement } from '@salto-io/adapter-api'
import { client as clientUtils } from '@salto-io/adapter-components'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { adapter } from '../src/adapter_creator'
import { oauthClientCredentialsType } from '../src/auth'
import { configType, DEFAULT_CONFIG, FETCH_CONFIG } from '../src/config'
import { ZUORA_BILLING } from '../src/constants'
import * as connection from '../src/client/connection'

describe('adapter creator', () => {
  let mockAxiosAdapter: MockAdapter
  beforeEach(() => {
    mockAxiosAdapter = new MockAdapter(axios, { delayResponse: 1, onNoMatch: 'throwException' })
  })

  afterEach(() => {
    mockAxiosAdapter.restore()
    jest.clearAllMocks()
  })

  it('should return a config containing the right parameters', () => {
    const config = adapter.configType as ObjectType
    expect(Object.keys(config?.fields)).toEqual(Object.keys(configType.fields))
  })
  it('should use oauth token as the basic auth method', () => {
    expect(Object.keys(adapter.authenticationMethods.basic.credentialsType.fields)).toEqual(
      Object.keys(oauthClientCredentialsType.fields),
    )
  })
  it('should return the zuora_billing adapter', () => {
    expect(
      adapter.operations({
        credentials: new InstanceElement(ZUORA_BILLING, adapter.authenticationMethods.basic.credentialsType, {
          clientId: 'id',
          clientSecret: 'secret',
          subdomain: 'sandbox.na',
          production: false,
        }),
        config: new InstanceElement(ZUORA_BILLING, adapter.configType as ObjectType, {
          fetch: {
            include: [],
            exclude: [],
          },
          apiDefinitions: {
            endpoints: {},
          },
        }),
        elementsSource: buildElementsSourceFromElements([]),
      }),
    ).toBeDefined()
  })
  it('should return the zuora_billing adapter if configuration is missing', () => {
    expect(
      adapter.operations({
        credentials: new InstanceElement(ZUORA_BILLING, adapter.authenticationMethods.basic.credentialsType, {
          clientId: 'id',
          clientSecret: 'secret',
          subdomain: 'sandbox.na',
          production: false,
        }),
        elementsSource: buildElementsSourceFromElements([]),
      }),
    ).toBeDefined()
    expect(
      adapter.operations({
        credentials: new InstanceElement(ZUORA_BILLING, adapter.authenticationMethods.basic.credentialsType, {
          clientId: 'id',
          clientSecret: 'secret',
          subdomain: 'sandbox.na',
          production: false,
        }),
        config: new InstanceElement(ZUORA_BILLING, adapter.configType as ObjectType),
        elementsSource: buildElementsSourceFromElements([]),
      }),
    ).toBeDefined()
  })
  it('should ignore unexpected configuration values', () => {
    expect(
      adapter.operations({
        credentials: new InstanceElement(ZUORA_BILLING, adapter.authenticationMethods.basic.credentialsType, {
          clientId: 'id',
          clientSecret: 'secret',
          subdomain: 'sandbox.na',
          production: false,
        }),
        config: new InstanceElement(ZUORA_BILLING, adapter.configType as ObjectType, {
          fetch: {
            include: [],
            exclude: [],
          },
          apiDefinitions: {
            endpoints: {},
          },
          somethingElse: {},
        }),
        elementsSource: buildElementsSourceFromElements([]),
      }),
    ).toBeDefined()
  })

  it('should throw error on invalid configuration', () => {
    expect(() =>
      adapter.operations({
        credentials: new InstanceElement(ZUORA_BILLING, adapter.authenticationMethods.basic.credentialsType, {
          clientId: 'id',
          clientSecret: 'secret',
          subdomain: 'sandbox.na',
          production: false,
        }),
        config: new InstanceElement(ZUORA_BILLING, adapter.configType as ObjectType, {
          fetch: DEFAULT_CONFIG[FETCH_CONFIG],
          apiDefinitions: {
            swagger: {
              url: 'https://raw.githubusercontent.com/salto-io/adapter-swaggers/test',
            },
            types: {
              CustomObject: {
                transformation: {
                  dataField: 'definitions',
                  idFields: ['type'],
                  fieldsToHide: [{ fieldName: 'a' }, { fieldName: 'a' }],
                },
              },
            },
          },
        }),
        elementsSource: buildElementsSourceFromElements([]),
      }),
    ).toThrow(new Error('Duplicate fieldsToHide params found in apiDefinitions for the following types: CustomObject'))

    expect(() =>
      adapter.operations({
        credentials: new InstanceElement(ZUORA_BILLING, adapter.authenticationMethods.basic.credentialsType, {
          clientId: 'id',
          clientSecret: 'secret',
          subdomain: 'sandbox.na',
          production: false,
        }),
        config: new InstanceElement(ZUORA_BILLING, adapter.configType as ObjectType, {
          fetch: {
            include: [{ type: 'CatalogProduct2' }],
          },
          apiDefinitions: {
            swagger: {
              url: 'https://raw.githubusercontent.com/salto-io/adapter-swaggers/test',
            },
            types: {
              CustomObject: {
                transformation: {
                  dataField: 'definitions',
                  idFields: ['type'],
                  fieldsToHide: [{ fieldName: 'a' }],
                },
              },
            },
            supportedTypes: {},
          },
        }),
        elementsSource: buildElementsSourceFromElements([]),
      }),
    ).toThrow(new Error('Invalid type names in fetch: CatalogProduct2 does not match any of the supported types.'))
  })

  it('should throw error on invalid credentials', () => {
    expect(() =>
      adapter.operations({
        credentials: new InstanceElement(ZUORA_BILLING, adapter.authenticationMethods.basic.credentialsType, {
          clientId: 'id',
          clientSecret: 'secret',
          subdomain: 'sandbox.na',
          production: true,
        }),
        config: new InstanceElement(ZUORA_BILLING, adapter.configType as ObjectType, {
          fetch: {
            include: [],
            exclude: [],
          },
          apiDefinitions: {
            swagger: {
              url: 'https://raw.githubusercontent.com/salto-io/adapter-swaggers/test',
            },
            types: {},
          },
        }),
        elementsSource: buildElementsSourceFromElements([]),
      }),
    ).toThrow(new Error("'sandbox.na' is a sandbox subdomain and cannot be used for production"))
    expect(() =>
      adapter.operations({
        credentials: new InstanceElement(ZUORA_BILLING, adapter.authenticationMethods.basic.credentialsType, {
          clientId: 'id',
          clientSecret: 'secret',
          subdomain: '',
          production: false,
        }),
        config: new InstanceElement(ZUORA_BILLING, adapter.configType as ObjectType, {
          fetch: {
            include: [],
            exclude: [],
          },
          apiDefinitions: {
            swagger: {
              url: 'https://raw.githubusercontent.com/salto-io/adapter-swaggers/test',
            },
            types: {},
          },
        }),
        elementsSource: buildElementsSourceFromElements([]),
      }),
    ).toThrow(new Error("'' is not a valid sandbox subdomain"))
  })

  it('should validate oauth credentials using createConnection', async () => {
    jest.spyOn(connection, 'createConnection')
    mockAxiosAdapter.onPost('/oauth/token').reply(200, {
      token_type: 'bearer',
      access_token: 'token123',
      expires_in: 10000,
    })
    mockAxiosAdapter.onPost('/v1/connections').reply(200, { success: true })

    expect(
      await adapter.validateCredentials(
        new InstanceElement('config', oauthClientCredentialsType, {
          clientId: 'id',
          clientSecret: 'secret',
          subdomain: 'sandbox.na',
          production: false,
        }),
      ),
    ).toEqual({ accountId: '' })
    expect(connection.createConnection).toHaveBeenCalledTimes(1)
  })

  it('should throw error when token generation fails', async () => {
    jest.spyOn(connection, 'createConnection')
    mockAxiosAdapter.onPost('/oauth/token').reply(500)

    await expect(() =>
      adapter.validateCredentials(
        new InstanceElement('config', oauthClientCredentialsType, {
          clientId: 'id',
          clientSecret: 'secret',
          subdomain: 'sandbox.na',
          production: false,
        }),
      ),
    ).rejects.toThrow(new Error('Request failed with status code 500'))
    expect(connection.createConnection).toHaveBeenCalledTimes(1)
  })

  it('should throw UnauthorizedError when auth validation returns success=false', async () => {
    jest.spyOn(connection, 'createConnection')
    mockAxiosAdapter.onPost('/oauth/token').reply(200, {
      token_type: 'bearer',
      access_token: 'token123',
      expires_in: 10000,
    })
    mockAxiosAdapter.onPost('/v1/connections').reply(200, { success: false })

    await expect(() =>
      adapter.validateCredentials(
        new InstanceElement('config', oauthClientCredentialsType, {
          clientId: 'id',
          clientSecret: 'secret',
          subdomain: 'sandbox.na',
          production: false,
        }),
      ),
    ).rejects.toThrow(new clientUtils.UnauthorizedError('Unauthorized - update credentials and try again'))
    expect(connection.createConnection).toHaveBeenCalledTimes(1)
  })

  it('should throw UnauthorizedError when auth validation returns an unexpected HTTP code', async () => {
    jest.spyOn(connection, 'createConnection')
    mockAxiosAdapter.onPost('/oauth/token').reply(200, {
      token_type: 'bearer',
      access_token: 'token123',
      expires_in: 10000,
    })
    mockAxiosAdapter.onPost('/v1/connections').reply(500)

    await expect(() =>
      adapter.validateCredentials(
        new InstanceElement('config', oauthClientCredentialsType, {
          clientId: 'id',
          clientSecret: 'secret',
          subdomain: 'sandbox.na',
          production: false,
        }),
      ),
    ).rejects.toThrow(new clientUtils.UnauthorizedError('Unauthorized - update credentials and try again'))
    expect(connection.createConnection).toHaveBeenCalledTimes(1)
  })
})
