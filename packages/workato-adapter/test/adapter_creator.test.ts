/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'
import { ObjectType, InstanceElement } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { adapter } from '../src/adapter_creator'
import { usernameTokenCredentialsType } from '../src/auth'
import { configType } from '../src/user_config'
import { WORKATO } from '../src/constants'
import * as connection from '../src/client/connection'

describe('adapter creator', () => {
  let mockAxiosAdapter: MockAdapter
  beforeEach(() => {
    mockAxiosAdapter = new MockAdapter(axios, { delayResponse: 1, onNoMatch: 'throwException' })
  })

  afterEach(() => {
    mockAxiosAdapter.restore()
  })

  it('should return a config containing the right parameters', () => {
    const config = adapter.configType as ObjectType
    expect(Object.keys(config?.fields)).toEqual(Object.keys(configType.fields))
  })
  it('should use username+token as the basic auth method', () => {
    expect(Object.keys(adapter.authenticationMethods.basic.credentialsType.fields)).toEqual(
      Object.keys(usernameTokenCredentialsType.fields),
    )
  })
  it('should return the workato adapter', () => {
    expect(
      adapter.operations({
        credentials: new InstanceElement(WORKATO, adapter.authenticationMethods.basic.credentialsType),
        config: new InstanceElement(WORKATO, adapter.configType as ObjectType, {
          fetch: {
            include: [],
            exclude: [],
          },
          apiDefinitions: {
            types: {},
          },
        }),
        elementsSource: buildElementsSourceFromElements([]),
      }),
    ).toBeDefined()
  })

  it('should ignore unexpected configuration values', () => {
    expect(
      adapter.operations({
        credentials: new InstanceElement(WORKATO, adapter.authenticationMethods.basic.credentialsType),
        config: new InstanceElement(WORKATO, adapter.configType as ObjectType, {
          fetch: {
            include: [],
            exclude: [],
          },
          apiDefinitions: {
            types: {},
          },
          somethingElse: {},
        }),
        elementsSource: buildElementsSourceFromElements([]),
      }),
    ).toBeDefined()
  })

  // Skipped until we decide how fetch is supposed to know which service connection is supported.
  // see Jira ticket SALTO-1705
  // eslint-disable-next-line jest/no-disabled-tests
  it.skip('should throw error on invalid serviceConnectionNames configuration', () => {
    expect(() =>
      adapter.operations({
        credentials: new InstanceElement(WORKATO, adapter.authenticationMethods.basic.credentialsType),
        config: new InstanceElement(WORKATO, adapter.configType as ObjectType, {
          fetch: {
            include: [],
            exclude: [],
            serviceConnectionNames: {
              salesforce: ['abc'],
              unsupportedName: ['def'],
            },
          },
          apiDefinitions: {
            types: {
              c: {
                request: {
                  url: '/c',
                },
              },
            },
          },
        }),
        elementsSource: buildElementsSourceFromElements([]),
      }),
    ).toThrow(
      new Error(
        'Unsupported service names in fetch.serviceConnectionNames: unsupportedName. The supported services are: salesforce,netsuite,zuora_billing',
      ),
    )
  })

  it('should validate credentials using createConnection', async () => {
    jest.spyOn(connection, 'createConnection')
    mockAxiosAdapter.onGet('/users/me').reply(200, {
      id: 'user123',
    })
    expect(
      await adapter.validateCredentials(
        new InstanceElement('config', usernameTokenCredentialsType, { username: 'user123', token: 'token456' }),
      ),
    ).toEqual({ accountId: '' })
    expect(connection.createConnection).toHaveBeenCalledTimes(1)
  })
})
