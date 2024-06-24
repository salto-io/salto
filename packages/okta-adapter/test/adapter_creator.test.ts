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
import {
  ObjectType,
  InstanceElement,
  ReadOnlyElementsSource,
  AdapterOperations,
  AccountInfo,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { adapter } from '../src/adapter_creator'
import { OktaUserConfig, DEFAULT_CONFIG } from '../src/user_config'
import { createCredentialsInstance, createConfigInstance } from './utils'

describe('adapter creator', () => {
  let mockAxiosAdapter: MockAdapter
  beforeEach(() => {
    mockAxiosAdapter = new MockAdapter(axios, { delayResponse: 1, onNoMatch: 'throwException' })
  })

  afterEach(() => {
    mockAxiosAdapter.restore()
  })

  it('should have a config type', () => {
    expect(adapter.configType).toBeInstanceOf(ObjectType)
  })

  it('should have all config sections', () => {
    expect(adapter.configType).toBeInstanceOf(ObjectType)
    expect(Object.keys(adapter.configType?.fields ?? {})).toEqual(['client', 'fetch', 'deploy'])
  })

  it('should support basic auth', () => {
    expect(adapter.authenticationMethods.basic.credentialsType).toBeInstanceOf(ObjectType)
  })

  describe('validateCredentials', () => {
    describe('with valid credentials', () => {
      let accountId: string
      beforeEach(async () => {
        mockAxiosAdapter.onGet().reply(200, { id: 'orgId', subdomain: 'my' })
        ;({ accountId } = await adapter.validateCredentials(
          createCredentialsInstance({ baseUrl: 'https://my-account.okta.com', token: 't' }),
        ))
      })
      it('should make an authenticated rest call', () => {
        expect(mockAxiosAdapter.history).toBeDefined()
      })
      it('should return org id account ID', () => {
        expect(accountId).toEqual('orgId')
      })
    })

    describe('with invalid credentials', () => {
      let result: Promise<AccountInfo>
      beforeEach(() => {
        mockAxiosAdapter.onGet().reply(403)
        result = adapter.validateCredentials(
          createCredentialsInstance({ baseUrl: 'https://my-account.okta.com', token: 't' }),
        )
      })
      it('should fail', async () => {
        await expect(result).rejects.toThrow()
      })
    })
    describe('identify account type', () => {
      beforeEach(async () => {
        mockAxiosAdapter.onGet().reply(200, { id: 'orgId', subdomain: 'my' })
      })
      it('when using a preview account', async () => {
        const { accountType, isProduction } = await adapter.validateCredentials(
          createCredentialsInstance({ baseUrl: 'https://my-account.oktapreview.com', token: 't' }),
        )
        expect(accountType).toEqual('Preview')
        expect(isProduction).toEqual(false)
      })
      it('when using a preview dev account', async () => {
        const { accountType, isProduction } = await adapter.validateCredentials(
          createCredentialsInstance({ baseUrl: 'https://dev-123123.oktapreview.com', token: 't' }),
        )
        expect(accountType).toEqual('Preview')
        expect(isProduction).toEqual(false)
      })
      it('when using a production account', async () => {
        const { accountType, isProduction } = await adapter.validateCredentials(
          createCredentialsInstance({ baseUrl: 'https://dev-123123.okta.com', token: 't' }),
        )
        expect(accountType).toEqual('Dev')
        expect(isProduction).toEqual(false)
      })
      it('when using production account', async () => {
        const { accountType, isProduction } = await adapter.validateCredentials(
          createCredentialsInstance({ baseUrl: 'https://my-account.okta.com', token: 't' }),
        )
        expect(accountType).toEqual('Production')
        expect(isProduction).toEqual(true)
      })
    })
  })

  describe('create adapter', () => {
    let elementsSource: ReadOnlyElementsSource
    let credentialsInstance: InstanceElement
    beforeEach(() => {
      elementsSource = buildElementsSourceFromElements([])
      credentialsInstance = createCredentialsInstance({ baseUrl: 'https://a.oktapreview.com', token: 't' })
    })
    describe('with valid config', () => {
      let result: AdapterOperations
      beforeEach(() => {
        const configWithExtraValue = {
          ...DEFAULT_CONFIG,
          extraValue: true,
        }
        result = adapter.operations({
          elementsSource,
          credentials: credentialsInstance,
          config: createConfigInstance(configWithExtraValue),
        })
      })
      it('should return okta operations', () => {
        expect(result).toBeDefined()
      })
    })

    describe('with valid fetch config', () => {
      it('should not fail if excluded type name is part of private api defs', () => {
        expect(() =>
          adapter.operations({
            elementsSource,
            credentials: credentialsInstance,
            config: createConfigInstance({
              ...DEFAULT_CONFIG,
              fetch: { exclude: [{ type: 'ThirdPartyAdmin' }] },
            } as unknown as OktaUserConfig),
          }),
        ).not.toThrow()
      })
    })

    describe('with invalid credentials instance', () => {
      it('should fail if provided baseUrl is invalid', () => {
        expect(() =>
          adapter.operations({
            elementsSource,
            credentials: createCredentialsInstance({ baseUrl: 'https://a.mydomain.com', token: 't' }),
            config: createConfigInstance(DEFAULT_CONFIG),
          }),
        ).toThrow('baseUrl is invalid')
      })
    })

    describe('with valid credentials instance', () => {
      it('should not fail for valid domains', () => {
        const preview = adapter.operations({
          elementsSource,
          credentials: createCredentialsInstance({ baseUrl: 'https://a-b.oktapreview.com', token: 't' }),
          config: createConfigInstance(DEFAULT_CONFIG),
        })
        expect(preview).toBeDefined()

        const okta = adapter.operations({
          elementsSource,
          credentials: createCredentialsInstance({ baseUrl: 'https://a-b.okta.com', token: 't' }),
          config: createConfigInstance(DEFAULT_CONFIG),
        })
        expect(okta).toBeDefined()

        const trexcloud = adapter.operations({
          elementsSource,
          credentials: createCredentialsInstance({ baseUrl: 'https://a-b.trexcloud.com', token: 't' }),
          config: createConfigInstance(DEFAULT_CONFIG),
        })
        expect(trexcloud).toBeDefined()
      })
    })
  })
})
