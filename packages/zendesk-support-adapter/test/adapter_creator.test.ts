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
import { ObjectType, InstanceElement, OAuthMethod } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import ZendeskAdapter from '../src/adapter'
import { adapter, createUrlFromUserInput } from '../src/adapter_creator'
import { oauthAccessTokenCredentialsType, usernamePasswordCredentialsType } from '../src/auth'
import { configType } from '../src/config'
import { ZENDESK_SUPPORT } from '../src/constants'
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
      Object.keys(usernamePasswordCredentialsType.fields)
    )
  })
  it('should use accessToken as the OAuth auth method', () => {
    expect(adapter.authenticationMethods.oauth).toBeDefined()
    expect(Object.keys(
      (adapter.authenticationMethods.oauth as OAuthMethod).credentialsType.fields
    )).toEqual(Object.keys(oauthAccessTokenCredentialsType.fields))
  })
  it('should return oauth params - only accessToken and subdomain', () => {
    expect((adapter.authenticationMethods.oauth as OAuthMethod).createFromOauthResponse(
      {
        clientId: 'client',
        clientSecret: 'secret',
        port: 8080,
        subdomain: 'abc',
      },
      {
        fields: {
          accessToken: 'token',
        },
      }
    )).toEqual({
      subdomain: 'abc',
      accessToken: 'token',
    })
  })
  it('should return the zendesk adapter', () => {
    // with basic auth method
    expect(adapter.operations({
      credentials: new InstanceElement(ZENDESK_SUPPORT,
        adapter.authenticationMethods.basic.credentialsType),
      config: new InstanceElement(
        ZENDESK_SUPPORT,
        adapter.configType as ObjectType,
        {
          fetch: {
            includeTypes: [],
          },
          apiDefinitions: {
            types: {},
          },
        },
      ),
      elementsSource: buildElementsSourceFromElements([]),
    })).toBeInstanceOf(ZendeskAdapter)

    // with OAuth auth method
    expect(adapter.operations({
      credentials: new InstanceElement(
        ZENDESK_SUPPORT,
        adapter.authenticationMethods.oauth?.credentialsType as ObjectType,
        {
          authType: 'oauth',
          accessToken: 'token',
          subdomain: 'abc',
        }
      ),
      config: new InstanceElement(
        ZENDESK_SUPPORT,
        adapter.configType as ObjectType,
        {
          fetch: {
            includeTypes: [],
          },
          apiDefinitions: {
            types: {},
          },
        },
      ),
      elementsSource: buildElementsSourceFromElements([]),
    })).toBeInstanceOf(ZendeskAdapter)
  })

  it('should ignore unexpected configuration values', () => {
    expect(adapter.operations({
      credentials: new InstanceElement(ZENDESK_SUPPORT,
        adapter.authenticationMethods.basic.credentialsType),
      config: new InstanceElement(
        ZENDESK_SUPPORT,
        adapter.configType as ObjectType,
        {
          fetch: {
            includeTypes: [],
          },
          apiDefinitions: {
            types: {},
          },
          somethingElse: {},
        },
      ),
      elementsSource: buildElementsSourceFromElements([]),
    })).toBeInstanceOf(ZendeskAdapter)
  })

  it('should throw error on inconsistent configuration between fetch and apiDefinitions', () => {
    expect(() => adapter.operations({
      credentials: new InstanceElement(ZENDESK_SUPPORT,
        adapter.authenticationMethods.basic.credentialsType),
      config: new InstanceElement(
        ZENDESK_SUPPORT,
        adapter.configType as ObjectType,
        {
          fetch: {
            includeTypes: [
              'a',
              'b',
            ],
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
        },
      ),
      elementsSource: buildElementsSourceFromElements([]),
    })).toThrow(new Error('Invalid type names in fetch: a,b'))
  })

  it('should return right url for oauth request', () => {
    expect(createUrlFromUserInput({
      subdomain: 'abc',
      port: 8080,
      clientId: 'client',
    })).toEqual('https://abc.zendesk.com/oauth/authorizations/new?response_type=token&redirect_uri=http://localhost:8080&client_id=client&scope=read%20write')
  })

  it('should validate credentials using createConnection', async () => {
    jest.spyOn(connection, 'createConnection')
    jest.spyOn(connection, 'validateCredentials')
    mockAxiosAdapter.onGet('/account/settings').reply(200, {
      settings: {},
    })

    // basic auth method
    expect(await adapter.validateCredentials(new InstanceElement(
      'config',
      usernamePasswordCredentialsType,
      { username: 'user123', password: 'pwd456', subdomain: 'abc' },
    ))).toEqual('abc')

    // OAuth auth method
    expect(await adapter.validateCredentials(new InstanceElement(
      'config',
      oauthAccessTokenCredentialsType,
      { authType: 'oauth', accessToken: 'token', subdomain: 'abc' },
    ))).toEqual('abc')

    expect(connection.createConnection).toHaveBeenCalledTimes(2)
    expect(connection.validateCredentials).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        credentials: { username: 'user123', password: 'pwd456', subdomain: 'abc' },
      })
    )

    expect(connection.validateCredentials).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        credentials: { accessToken: 'token', subdomain: 'abc' },
      })
    )
  })
})
