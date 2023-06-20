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
import { ObjectType, InstanceElement, ReadOnlyElementsSource, AdapterOperations, Account } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { adapter } from '../src/adapter_creator'
import { JiraConfig, getDefaultConfig } from '../src/config/config'
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

  it('should support basic auth', () => {
    expect(adapter.authenticationMethods.basic.credentialsType).toBeInstanceOf(ObjectType)
  })

  describe('validateCredentials', () => {
    describe('with valid credentials', () => {
      let accountId: string
      let accountType: string
      beforeEach(async () => {
        mockAxiosAdapter.onGet().reply(200, { baseUrl: 'http://my_account.net' });
        ({ accountId, accountType } = await adapter.validateCredentials(
          createCredentialsInstance({ baseUrl: 'http://my.net', user: 'u', token: 't' })
        ))
      })
      it('should make an authenticated rest call', () => {
        expect(mockAxiosAdapter.history).toBeDefined()
      })
      it('should return base url as account ID', () => {
        expect(accountId).toEqual('http://my_account.net')
      })
      it('should return Unknown as account type', () => {
        expect(accountType).toEqual('Unknown')
      })
    })

    describe('with invalid credentials', () => {
      let result: Promise<Account>
      beforeEach(() => {
        mockAxiosAdapter.onGet().reply(403)
        result = adapter.validateCredentials(
          createCredentialsInstance({ baseUrl: 'http://my.net', user: 'u', token: 't' })
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
      credentialsInstance = createCredentialsInstance({ baseUrl: 'url', user: 'u', token: 't' })
    })
    describe('with valid config', () => {
      let result: AdapterOperations
      beforeEach(() => {
        const configWithExtraValue = {
          ...getDefaultConfig({ isDataCenter: false }),
          extraValue: true,
        }
        result = adapter.operations({
          elementsSource,
          credentials: credentialsInstance,
          config: createConfigInstance(configWithExtraValue),
        })
      })
      it('should return jira operations', () => {
        expect(result).toBeDefined()
      })
    })

    describe('without config', () => {
      it('should fail to create operations', () => {
        expect(
          () => adapter.operations({ elementsSource, credentials: credentialsInstance })
        ).toThrow()
      })
    })

    describe('without fetch config', () => {
      it('should fail to create operations', () => {
        expect(() => adapter.operations({
          elementsSource,
          credentials: credentialsInstance,
          config: createConfigInstance({
            ...getDefaultConfig({ isDataCenter: false }),
            fetch: undefined,
          } as unknown as JiraConfig),
        })).toThrow()
      })
    })

    describe('with an invalid api config', () => {
      it('should fail to create operations', () => {
        expect(() => adapter.operations({
          elementsSource,
          credentials: credentialsInstance,
          config: createConfigInstance({
            ...getDefaultConfig({ isDataCenter: false }),
            apiDefinitions: { typeDefaults: 2 },
          } as unknown as JiraConfig),
        })).toThrow()
      })
    })
  })
})
