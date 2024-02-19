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
import { accessTokenCredentialsType } from '../src/auth'
import { configType, DEFAULT_API_DEFINITIONS, DEFAULT_CONFIG, FETCH_CONFIG } from '../src/config'
import { STRIPE } from '../src/constants'
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
  it('should use access token as the basic auth method', () => {
    expect(Object.keys(adapter.authenticationMethods.basic.credentialsType.fields)).toEqual(
      Object.keys(accessTokenCredentialsType.fields),
    )
  })
  it('should return the stripe adapter', () => {
    expect(
      adapter.operations({
        credentials: new InstanceElement(STRIPE, adapter.authenticationMethods.basic.credentialsType, { token: 'aaa' }),
        config: new InstanceElement(STRIPE, adapter.configType as ObjectType, {
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
  it('should return the stripe adapter if configuration is missing', () => {
    expect(
      adapter.operations({
        credentials: new InstanceElement(STRIPE, adapter.authenticationMethods.basic.credentialsType, { token: 'aaa' }),
        elementsSource: buildElementsSourceFromElements([]),
      }),
    ).toBeDefined()
    expect(
      adapter.operations({
        credentials: new InstanceElement(STRIPE, adapter.authenticationMethods.basic.credentialsType, { token: 'aaa' }),
        config: new InstanceElement(STRIPE, adapter.configType as ObjectType),
        elementsSource: buildElementsSourceFromElements([]),
      }),
    ).toBeDefined()
  })
  it('should ignore unexpected configuration values', () => {
    expect(
      adapter.operations({
        credentials: new InstanceElement(STRIPE, adapter.authenticationMethods.basic.credentialsType, { token: 'aaa' }),
        config: new InstanceElement(STRIPE, adapter.configType as ObjectType, {
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
        credentials: new InstanceElement(STRIPE, adapter.authenticationMethods.basic.credentialsType, { token: 'aaa' }),
        config: new InstanceElement(STRIPE, adapter.configType as ObjectType, {
          fetch: DEFAULT_CONFIG[FETCH_CONFIG],
          apiDefinitions: {
            swagger: {
              url: 'https://raw.githubusercontent.com/salto-io/adapter-swaggers/test',
            },
            types: {
              Product: {
                transformation: {
                  idFields: ['id'],
                  fieldsToHide: [{ fieldName: 'a' }, { fieldName: 'a' }],
                },
              },
            },
          },
        }),
        elementsSource: buildElementsSourceFromElements([]),
      }),
    ).toThrow(new Error('Duplicate fieldsToHide params found in apiDefinitions for the following types: Product'))

    expect(() =>
      adapter.operations({
        credentials: new InstanceElement(STRIPE, adapter.authenticationMethods.basic.credentialsType, { token: 'aaa' }),
        config: new InstanceElement(STRIPE, adapter.configType as ObjectType, {
          fetch: {
            include: [
              {
                type: 'country_spec2',
              },
            ],
            exclude: [],
          },
          apiDefinitions: {
            ...DEFAULT_API_DEFINITIONS,
            supportedTypes: {},
          },
        }),
        elementsSource: buildElementsSourceFromElements([]),
      }),
    ).toThrow(new Error('Invalid type names in fetch: country_spec2 does not match any of the supported types.'))
  })

  it('should validate credentials using createConnection', async () => {
    jest.spyOn(connection, 'createConnection')
    mockAxiosAdapter.onGet('/v1/products').reply(200, {})
    expect(
      await adapter.validateCredentials(new InstanceElement('config', accessTokenCredentialsType, { token: 'aaa' })),
    ).toEqual({ accountId: '' })
    expect(connection.createConnection).toHaveBeenCalledTimes(1)
  })

  it('should throw UnauthorizedError when auth validation returns an unexpected HTTP code', async () => {
    jest.spyOn(connection, 'createConnection')
    mockAxiosAdapter.onGet('/v1/products').reply(203)
    await expect(() =>
      adapter.validateCredentials(new InstanceElement('config', accessTokenCredentialsType, { token: 'aaa' })),
    ).rejects.toThrow(new clientUtils.UnauthorizedError('Unauthorized - update credentials and try again'))
    expect(connection.createConnection).toHaveBeenCalledTimes(1)
  })
})
