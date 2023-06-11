/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { ObjectType, InstanceElement, AccountId, ReadOnlyElementsSource, AdapterOperations, AccountType, Account, IsProduction } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { adapter } from '../src/adapter_creator'
import { OktaConfig, DEFAULT_CONFIG } from '../src/config'
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
    expect(Object.keys(adapter.configType?.fields ?? {})).toEqual(['client', 'fetch', 'apiDefinitions', 'privateApiDefinitions'])
  })

  it('should support basic auth', () => {
    expect(adapter.authenticationMethods.basic.credentialsType).toBeInstanceOf(ObjectType)
  })

  describe('validateCredentials', () => {
    describe('with valid credentials', () => {
      let accountId: AccountId
      let accountType: AccountType
      let isProduction: IsProduction
      beforeEach(async () => {
        mockAxiosAdapter.onGet().reply(200, { id: 'orgId', subdomain: 'my' });
        ({ accountId, accountType, isProduction } = await adapter.validateCredentials(
          createCredentialsInstance({ baseUrl: 'http://my-account.okta.net', token: 't' })
        ))
      })
      it('should make an authenticated rest call', () => {
        expect(mockAxiosAdapter.history).toBeDefined()
      })
      it('should return org id account ID', () => {
        expect(accountId).toEqual('orgId')
      })
      it('should return account type Unknown', () => {
        expect(accountType).toEqual('Unknown') // TODO: modify to actual accountType logic when implemented
      })
      it('should return isProduction undefined', () => {
        expect(isProduction).toBeUndefined() // TODO: modify to actual isProduction logic when implemented
      })
    })

    describe('with invalid credentials', () => {
      let result: Promise<Account>
      beforeEach(() => {
        mockAxiosAdapter.onGet().reply(403)
        result = adapter.validateCredentials(
          createCredentialsInstance({ baseUrl: 'http://my.net', token: 't' })
        )
      })
      it('should fail', async () => {
        await expect(result).rejects.toThrow()
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

    describe('with an invalid api config', () => {
      it('should fail to create operations with invalid apiDefinitions', () => {
        expect(() => adapter.operations({
          elementsSource,
          credentials: credentialsInstance,
          config: createConfigInstance({
            ...DEFAULT_CONFIG,
            apiDefinitions: { typeDefaults: 2 },
          } as unknown as OktaConfig),
        })).toThrow()
      })

      it('should fail to create operations with invalid privateApiDefinitions', () => {
        expect(() => adapter.operations({
          elementsSource,
          credentials: credentialsInstance,
          config: createConfigInstance({
            ...DEFAULT_CONFIG,
            privateApiDefinitions: { typeDefaults: 2 },
          } as unknown as OktaConfig),
        })).toThrow()
      })
    })
  })
})
