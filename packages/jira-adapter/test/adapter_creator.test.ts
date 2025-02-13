/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
      beforeEach(async () => {
        mockAxiosAdapter.onGet('/rest/api/3/instance/license').reply(200, { applications: [{ plan: 'FREE' }] })
        mockAxiosAdapter.onGet().reply(200, { baseUrl: 'http://my_account.net' })
        ;({ accountId } = await adapter.validateCredentials(
          createCredentialsInstance({ baseUrl: 'http://my.net', user: 'u', token: 't' }),
        ))
      })
      it('should make an authenticated rest call', () => {
        expect(mockAxiosAdapter.history).toBeDefined()
      })
      it('should return base url as account ID', () => {
        expect(accountId).toEqual('http://my_account.net')
      })
    })

    describe('with invalid credentials', () => {
      let result: Promise<AccountInfo>
      beforeEach(() => {
        mockAxiosAdapter.onGet().reply(403)
        result = adapter.validateCredentials(
          createCredentialsInstance({ baseUrl: 'http://my.net', user: 'u', token: 't' }),
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
    describe.each([
      [true, 'dc'],
      [false, 'cloud'],
    ])('with valid %s config', (isDataCenter, variationName) => {
      let result: AdapterOperations
      beforeEach(() => {
        const configWithExtraValue = {
          ...getDefaultConfig({ isDataCenter }),
          extraValue: true,
        }
        result = adapter.operations({
          elementsSource,
          credentials: credentialsInstance,
          config: createConfigInstance(configWithExtraValue),
        })
      })
      it(`should return jira operations on ${variationName}`, () => {
        expect(result).toBeDefined()
      })
    })

    describe('with an invalid api config', () => {
      it('should fail to create operations', () => {
        expect(() =>
          adapter.operations({
            elementsSource,
            credentials: credentialsInstance,
            config: createConfigInstance({
              ...getDefaultConfig({ isDataCenter: false }),
              apiDefinitions: { typeDefaults: 2 },
            } as unknown as JiraConfig),
          }),
        ).toThrow()
      })

      it('should fail on validating Jira DC config with JSM enabled', () => {
        credentialsInstance.value = { ...credentialsInstance.value, isDataCenter: true }
        expect(() =>
          adapter.operations({
            elementsSource,
            credentials: credentialsInstance,
            config: createConfigInstance({
              ...getDefaultConfig({ isDataCenter: true }),
              fetch: {
                enableJSM: true,
              },
            } as unknown as JiraConfig),
          }),
        ).toThrow()
      })
    })
  })
})
