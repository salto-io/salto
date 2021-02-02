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
import { InstanceElement, ElemID, ObjectType, OAuthMethod } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { adapter } from '../src/adapter_creator'
import SalesforceClient, { validateCredentials } from '../src/client/client'
import SalesforceAdapter from '../src/adapter'
import { usernamePasswordCredentialsType, UsernamePasswordCredentials, oauthRequestParameters, OauthAccessTokenCredentials, accessTokenCredentialsType } from '../src/types'
import { RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS } from '../src/constants'

jest.mock('../src/client/client')
jest.mock('../src/adapter')


describe('SalesforceAdapter creator', () => {
  const credentials = new InstanceElement(
    ElemID.CONFIG_NAME,
    usernamePasswordCredentialsType,
    {
      username: 'myUser',
      password: 'myPassword',
      token: 'myToken',
      sandbox: false,
      authType: 'basic',
    }
  )
  const oauthCredentials = new InstanceElement(
    ElemID.CONFIG_NAME,
    accessTokenCredentialsType,
    {
      accessToken: 'accessToken',
      instanceUrl: 'instanceUrl',
      isSandbox: false,
      authType: 'oauth',
    }
  )
  const config = new InstanceElement(
    ElemID.CONFIG_NAME,
    adapter.configType as ObjectType,
    {
      fetch: {
        metadata: {
          exclude: [
            { metadataType: 'test1' },
            { name: 'test2' },
            { name: 'test3' },
          ],
        },
      },
      notExist: ['not exist'],
      client: {
        maxConcurrentApiRequests: {
          list: RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
          read: 55,
          retrieve: 3,
          total: RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
        },
      },
    }
  )
  describe('when validateCredentials is called with username/password credentials', () => {
    beforeEach(() => {
      adapter.validateCredentials(credentials)
    })

    it('should call validateCredentials with the correct credentials', () => {
      expect(validateCredentials).toHaveBeenCalledWith(new UsernamePasswordCredentials({
        username: 'myUser',
        password: 'myPassword',
        isSandbox: false,
        apiToken: 'myToken',
      }))
    })
  })

  describe('when validateCredentials is called with oauth credentials', () => {
    beforeEach(() => {
      adapter.validateCredentials(oauthCredentials)
    })

    it('should call validateCredentials with the correct credentials', () => {
      expect(validateCredentials).toHaveBeenCalledWith(new OauthAccessTokenCredentials({
        accessToken: 'accessToken',
        instanceUrl: 'instanceUrl',
        isSandbox: false,
      }))
    })
  })

  describe('when creating oauth request', () => {
    const oauthLoginInput = new InstanceElement(ElemID.CONFIG_NAME, oauthRequestParameters, {
      consumerKey: 'testConsumerKey',
      port: 8080,
    })
    it('creates oauth request with url using parameters', () => {
      const request = (
        adapter.authenticationMethods.oauth as OAuthMethod).createOAuthRequest(oauthLoginInput)
      expect(request.url.includes(oauthLoginInput.value.consumerKey)).toBeTruthy()
      expect(request.url.includes(oauthLoginInput.value.port)).toBeTruthy()
    })
    it('creates the right object from the response', () => {
      const creds = (adapter.authenticationMethods.oauth as OAuthMethod).createFromOauthResponse(
        { isSandbox: false },
        {
          accessToken: 'testAccessToken',
          instanceUrl: 'testInstanceUrl',
        }
      )
      expect(creds).toEqual({
        isSandbox: false,
        accessToken: 'testAccessToken',
        instanceUrl: 'testInstanceUrl',
      })
    })
  })

  describe('when passed config elements', () => {
    it('creates the client correctly', () => {
      adapter.operations({
        credentials,
        config,
        elementsSource: buildElementsSourceFromElements([]),
      })
      expect(SalesforceClient).toHaveBeenCalledWith({
        credentials: new UsernamePasswordCredentials({
          username: 'myUser',
          password: 'myPassword',
          isSandbox: false,
          apiToken: 'myToken',
        }),
        config: {
          maxConcurrentApiRequests: {
            list: RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
            read: 55,
            retrieve: 3,
            total: RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
          },
        },
      })
    })

    it('creates the adapter correctly', () => {
      adapter.operations({
        credentials,
        config,
        elementsSource: buildElementsSourceFromElements([]),
      })
      expect(SalesforceAdapter).toHaveBeenCalledWith({
        config: {
          fetch: {
            metadata: {
              exclude: [
                { metadataType: 'test1' },
                { name: 'test2' },
                { name: 'test3' },
              ],
            },
          },
          client: {
            maxConcurrentApiRequests: {
              list: RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
              read: 55,
              retrieve: 3,
              total: RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
            },
          },
        },
        client: expect.any(Object),
        getElemIdFunc: undefined,
      })
    })

    it('should throw an error when creating the adapter with an invalid regex for instancesRegexSkippedList', () => {
      const invalidConfig = new InstanceElement(
        ElemID.CONFIG_NAME,
        adapter.configType as ObjectType,
        { fetch: { metadata: { include: [{ name: '\\' }] } } },
      )
      expect(() => adapter.operations({
        credentials,
        config: invalidConfig,
        elementsSource: buildElementsSourceFromElements([]),
      })).toThrow()
    })

    it('should throw an error when creating adapter with invalid regex in dataManagement.includeObjects', () => {
      const invalidConfig = new InstanceElement(
        ElemID.CONFIG_NAME,
        adapter.configType as ObjectType,
        {
          fetch: {
            data: {
              includeObjects: ['\\'],
              saltoIDSettings: {
                defaultIdFields: ['field'],
              },
            },
          },
        },
      )
      expect(() => adapter.operations({
        credentials,
        config: invalidConfig,
        elementsSource: buildElementsSourceFromElements([]),
      })).toThrow('Failed to load config due to an invalid fetch.data.includeObjects value. The following regular expressions are invalid: \\')
    })

    it('should throw an error when creating adapter with invalid regex in dataManagement.excludeObjects', () => {
      const invalidConfig = new InstanceElement(
        ElemID.CONFIG_NAME,
        adapter.configType as ObjectType,
        {
          fetch: {
            data: {
              includeObjects: ['obj'],
              excludeObjects: ['\\'],
              saltoIDSettings: {
                defaultIdFields: ['field'],
              },
            },
          },
        },
      )
      expect(() => adapter.operations({
        credentials,
        config: invalidConfig,
        elementsSource: buildElementsSourceFromElements([]),
      })).toThrow('Failed to load config due to an invalid fetch.data.excludeObjects value. The following regular expressions are invalid: \\')
    })

    it('should throw an error when creating adapter with invalid regex in dataManagement.allowReferenceTo', () => {
      const invalidConfig = new InstanceElement(
        ElemID.CONFIG_NAME,
        adapter.configType as ObjectType,
        {
          fetch: {
            data: {
              includeObjects: ['obj'],
              allowReferenceTo: ['\\'],
              saltoIDSettings: {
                defaultIdFields: ['field'],
              },
            },
          },
        },
      )
      expect(() => adapter.operations({
        credentials,
        config: invalidConfig,
        elementsSource: buildElementsSourceFromElements([]),
      })).toThrow('Failed to load config due to an invalid fetch.data.allowReferenceTo value. The following regular expressions are invalid: \\')
    })

    it('should throw an error when creating adapter with invalid regex in dataManagement.saltoIDSettings.overrides objectsRegex', () => {
      const invalidConfig = new InstanceElement(
        ElemID.CONFIG_NAME,
        adapter.configType as ObjectType,
        {
          fetch: {
            data: {
              includeObjects: ['obj'],
              saltoIDSettings: {
                defaultIdFields: ['field'],
                overrides: [
                  { objectsRegex: '\\', idFields: ['Id'] },
                ],
              },
            },
          },
        },
      )
      expect(() => adapter.operations({
        credentials,
        config: invalidConfig,
        elementsSource: buildElementsSourceFromElements([]),
      })).toThrow('Failed to load config due to an invalid fetch.data.saltoIDSettings.overrides value. The following regular expressions are invalid: \\')
    })


    it('should throw error when dataManagement is created without includeObjects', () => {
      const invalidConfig = new InstanceElement(
        ElemID.CONFIG_NAME,
        adapter.configType as ObjectType,
        {
          fetch: {
            data: {
              saltoIDSettings: {
                defaultIdFields: ['field'],
                overrides: [
                  { objectsRegex: '\\', idFields: ['Id'] },
                ],
              },
            },
          },
        },
      )
      expect(() => adapter.operations({
        credentials,
        config: invalidConfig,
        elementsSource: buildElementsSourceFromElements([]),
      })).toThrow('Failed to load config due to an invalid fetch.data.includeObjects value. includeObjects is required when dataManagement is configured')
    })

    it('should throw error when dataManagement is created without saltoIDSettings', () => {
      const invalidConfig = new InstanceElement(
        ElemID.CONFIG_NAME,
        adapter.configType as ObjectType,
        {
          fetch: {
            data: {
              includeObjects: ['obj'],
            },
          },
        },
      )
      expect(() => adapter.operations({
        credentials,
        config: invalidConfig,
        elementsSource: buildElementsSourceFromElements([]),
      })).toThrow('Failed to load config due to an invalid fetch.data.saltoIDSettings value. saltoIDSettings is required when dataManagement is configured')
    })

    it('should throw error when dataManagement is created without saltoIDSettings.defaultIdFields', () => {
      const invalidConfig = new InstanceElement(
        ElemID.CONFIG_NAME,
        adapter.configType as ObjectType,
        {
          fetch: {
            data: {
              includeObjects: ['obj'],
              saltoIDSettings: {
                overrides: [
                  { objectsRegex: '\\', idFields: ['Id'] },
                ],
              },
            },
          },
        },
      )
      expect(() => adapter.operations({
        credentials,
        config: invalidConfig,
        elementsSource: buildElementsSourceFromElements([]),
      })).toThrow('Failed to load config due to an invalid fetch.data.saltoIDSettings.defaultIdFields value. saltoIDSettings.defaultIdFields is required when dataManagement is configured')
    })

    it('should throw an error when creating adapter with invalid rate limits in client.maxConcurrentApiRequests', () => {
      const invalidConfig = new InstanceElement(
        ElemID.CONFIG_NAME,
        adapter.configType as ObjectType,
        {
          client: {
            maxConcurrentApiRequests: {
              list: RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
              read: 0,
              retrieve: 3,
              total: RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
            },
          },
        },
      )
      expect(() => adapter.operations({
        credentials,
        config: invalidConfig,
        elementsSource: buildElementsSourceFromElements([]),
      })).toThrow('Failed to load config due to an invalid client.maxConcurrentApiRequests value. maxConcurrentApiRequests values cannot be set to 0. Invalid keys: read')
    })
    it('should not throw an error when all rate limits client.maxConcurrentApiRequests are valid', () => {
      const validConfig = new InstanceElement(
        ElemID.CONFIG_NAME,
        adapter.configType as ObjectType,
        {
          client: {
            maxConcurrentApiRequests: {
              list: RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
              retrieve: 3,
              total: undefined,
            },
          },
        },
      )
      expect(() => adapter.operations({
        credentials,
        config: validConfig,
        elementsSource: buildElementsSourceFromElements([]),
      })).not.toThrow()
    })

    it('should not throw an error when maxConcurrentApiRequests is not set', () => {
      const validConfig = new InstanceElement(
        ElemID.CONFIG_NAME,
        adapter.configType as ObjectType,
        {},
      )
      expect(() => adapter.operations({
        credentials,
        config: validConfig,
        elementsSource: buildElementsSourceFromElements([]),
      })).not.toThrow()
    })

    it('should not throw an error when a valid retry strategy is set', () => {
      const validConfig = new InstanceElement(
        ElemID.CONFIG_NAME,
        adapter.configType as ObjectType,
        {
          client: {
            retry: {
              maxAttempts: 5,
              retryDelay: 5000,
              retryStrategy: 'HttpError',
            },
          },
        },
      )
      const adapterContext = {
        credentials,
        config: validConfig,
        elementsSource: buildElementsSourceFromElements([]),
      }
      expect(() => adapter.operations(adapterContext)).not.toThrow()
      validConfig.value.client.retry.retryStrategy = 'HTTPOrNetworkError'
      expect(() => adapter.operations(adapterContext)).not.toThrow()
      validConfig.value.client.retry.retryStrategy = 'NetworkError'
      expect(() => adapter.operations(adapterContext)).not.toThrow()
      validConfig.value.client.retry.retryStrategy = undefined
      expect(() => adapter.operations(adapterContext)).not.toThrow()
    })

    it('should throw an error when an invalid retry strategy is set', () => {
      const invalidConfig = new InstanceElement(
        ElemID.CONFIG_NAME,
        adapter.configType as ObjectType,
        { client: { retry: { retryStrategy: 'somethingElse' } } },
      )
      expect(() => adapter.operations({
        credentials,
        config: invalidConfig,
        elementsSource: buildElementsSourceFromElements([]),
      })).toThrow('Failed to load config due to an invalid client.clientConfig.retry.retryStrategy value. retryStrategy value \'somethingElse\' is not supported')
    })

    it('should not throw an error when no config is passed', () => {
      expect(() => adapter.operations({
        credentials,
        elementsSource: buildElementsSourceFromElements([]),
      })).not.toThrow()
    })
  })

  describe('validateDeprecatedParameters', () => {
    describe('instancesRegexSkippedList', () => {
      it('invalid instancesRegexSkippedList should throw an error', () => {
        const configClone = config.clone()
        configClone.value.instancesRegexSkippedList = ['(']

        expect(() => adapter.operations({
          credentials,
          elementsSource: buildElementsSourceFromElements([]),
          config: configClone,
        })).toThrow('Failed to load config due to an invalid instancesRegexSkippedList value. The following regular expressions are invalid: (')
      })

      it('valid instancesRegexSkippedList should not throw', () => {
        const configClone = config.clone()
        configClone.value.instancesRegexSkippedList = ['valid']

        expect(() => adapter.operations({
          credentials,
          elementsSource: buildElementsSourceFromElements([]),
          config: configClone,
        })).not.toThrow()
      })
    })

    describe('dataManagement', () => {
      it('invalid dataManagement should throw an error', () => {
        const configClone = config.clone()
        configClone.value.dataManagement = {}

        expect(() => adapter.operations({
          credentials,
          elementsSource: buildElementsSourceFromElements([]),
          config: configClone,
        })).toThrow('Failed to load config due to an invalid dataManagement.includeObjects value. includeObjects is required when dataManagement is configured')
      })

      it('valid dataManagement should not throw', () => {
        const configClone = config.clone()
        configClone.value.dataManagement = {
          includeObjects: [
            '^SBQQ__.*',
          ],
          saltoIDSettings: {
            defaultIdFields: ['##allMasterDetailFields##', 'Name'],
            overrides: [],
          },
        }

        expect(() => adapter.operations({
          credentials,
          elementsSource: buildElementsSourceFromElements([]),
          config: configClone,
        })).not.toThrow()
      })

      it('valid dataManagement and fetch.data should throw an error', () => {
        const configClone = config.clone()
        const dataConf = {
          includeObjects: [
            '^SBQQ__.*',
          ],
          saltoIDSettings: {
            defaultIdFields: ['##allMasterDetailFields##', 'Name'],
            overrides: [],
          },
        }
        configClone.value.dataManagement = dataConf
        configClone.value.fetch.data = dataConf

        expect(() => adapter.operations({
          credentials,
          elementsSource: buildElementsSourceFromElements([]),
          config: configClone,
        })).toThrow('Failed to load config due to an invalid dataManagement value. fetch.data configuration option cannot be used with dataManagement option. The configuration of dataManagement should be moved to fetch.data')
      })
    })

    describe('metadataTypesSkippedList', () => {
      it('valid metadataTypesSkippedList should not throw', () => {
        const configClone = config.clone()
        configClone.value.metadataTypesSkippedList = ['valid']

        expect(() => adapter.operations({
          credentials,
          elementsSource: buildElementsSourceFromElements([]),
          config: configClone,
        })).not.toThrow()
      })
    })
  })
})
