/*
*                      Copyright 2021 Salto Labs Ltd.
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
import StripeAdapter from '../src/adapter'
import { adapter } from '../src/adapter_creator'
import { accessTokenCredentialsType } from '../src/auth'
import { configType } from '../src/config'
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
      Object.keys(accessTokenCredentialsType.fields)
    )
  })
  it('should return the stripe adapter', () => {
    expect(adapter.operations({
      credentials: new InstanceElement(
        STRIPE,
        adapter.authenticationMethods.basic.credentialsType,
        { token: 'aaa' },
      ),
      config: new InstanceElement(
        STRIPE,
        adapter.configType as ObjectType,
        {
          fetch: {
            includeTypes: [],
            settingsIncludeTypes: [],
          },
          apiDefinitions: {
            endpoints: {},
          },
        },
      ),
      elementsSource: buildElementsSourceFromElements([]),
    })).toBeInstanceOf(StripeAdapter)
  })
  it('should return the stripe adapter if configuration is missing', () => {
    expect(adapter.operations({
      credentials: new InstanceElement(
        STRIPE,
        adapter.authenticationMethods.basic.credentialsType,
        { token: 'aaa' },
      ),
      elementsSource: buildElementsSourceFromElements([]),
    })).toBeInstanceOf(StripeAdapter)
    expect(adapter.operations({
      credentials: new InstanceElement(
        STRIPE,
        adapter.authenticationMethods.basic.credentialsType,
        { token: 'aaa' },
      ),
      config: new InstanceElement(STRIPE, adapter.configType as ObjectType),
      elementsSource: buildElementsSourceFromElements([]),
    })).toBeInstanceOf(StripeAdapter)
  })
  it('should ignore unexpected configuration values', () => {
    expect(adapter.operations({
      credentials: new InstanceElement(
        STRIPE,
        adapter.authenticationMethods.basic.credentialsType,
        { token: 'aaa' },
      ),
      config: new InstanceElement(
        STRIPE,
        adapter.configType as ObjectType,
        {
          fetch: {
            includeTypes: [],
          },
          apiDefinitions: {
            endpoints: {},
          },
          somethingElse: {},
        },
      ),
      elementsSource: buildElementsSourceFromElements([]),
    })).toBeInstanceOf(StripeAdapter)
  })

  it('should throw error on invalid configuration', () => {
    expect(() => adapter.operations({
      credentials: new InstanceElement(
        STRIPE,
        adapter.authenticationMethods.basic.credentialsType,
        { token: 'aaa' },
      ),
      config: new InstanceElement(
        STRIPE,
        adapter.configType as ObjectType,
        {
          fetch: {
            includeTypes: [
              'stripe.v1__country_specs',
              'stripe.v1__coupons',
              'stripe.v1__plans',
              'stripe.v1__prices',
              'stripe.v1__products',
              'stripe.v1__reporting__report_types',
              'stripe.v1__tax_rates',
              'stripe.v1__webhook_endpoints',
            ],
          },
          apiDefinitions: {
            swagger: {
              url: '/tmp/swagger.yaml',
            },
            types: {
              Product: {
                transformation: {
                  idFields: ['id'],
                  fieldsToHide: [
                    { fieldName: 'a' },
                    { fieldName: 'a' },
                  ],
                },
              },
            },
          },
        },
      ),
      elementsSource: buildElementsSourceFromElements([]),
    })).toThrow(new Error('Duplicate fieldsToHide params found in apiDefinitions for the following types: Product'))
  })

  it('should validate credentials using createConnection', async () => {
    jest.spyOn(connection, 'createConnection')
    mockAxiosAdapter.onGet('/v1/products').reply(200, {})
    expect(await adapter.validateCredentials(new InstanceElement(
      'config',
      accessTokenCredentialsType,
      { token: 'aaa' },
    ))).toEqual('')
    expect(connection.createConnection).toHaveBeenCalledTimes(1)
  })

  it('should throw UnauthorizedError when auth validation returns an unexpected HTTP code', async () => {
    jest.spyOn(connection, 'createConnection')
    mockAxiosAdapter.onGet('/v1/products').reply(203)
    await expect(() => adapter.validateCredentials(new InstanceElement(
      'config',
      accessTokenCredentialsType,
      { token: 'aaa' },
    ))).rejects.toThrow(new clientUtils.UnauthorizedError('Unauthorized - update credentials and try again'))
    expect(connection.createConnection).toHaveBeenCalledTimes(1)
  })
})
