/*
*                      Copyright 2020 Salto Labs Ltd.
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
import { adapter } from '../src/adapter_creator'
import SalesforceClient, { validateCredentials } from '../src/client/client'
import SalesforceAdapter from '../src/adapter'
import { usernamePasswordCredentialsType, UsernamePasswordCredentials, oauthRequestParameters, OauthAccessTokenCredentials, accessTokenCredentialsType } from '../src/types'

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
      metadataTypesSkippedList: ['test1'],
      instancesRegexSkippedList: ['test3', 'test2'],
      notExist: ['not exist'],
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
      adapter.operations({ credentials, config })
      expect(SalesforceClient).toHaveBeenCalledWith({
        credentials: new UsernamePasswordCredentials({
          username: 'myUser',
          password: 'myPassword',
          isSandbox: false,
          apiToken: 'myToken',
        }),
      })
    })

    it('creates the adapter correctly', () => {
      adapter.operations({ credentials, config })
      expect(SalesforceAdapter).toHaveBeenCalledWith({
        config: {
          metadataTypesSkippedList: ['test1'],
          instancesRegexSkippedList: ['test3', 'test2'],
        },
        client: expect.any(Object),
        getElemIdFunc: undefined,
      })
    })

    it('should throw an error when creating the adapter with an invalid regex for instancesRegexSkippedList', () => {
      const invalidConfig = new InstanceElement(
        ElemID.CONFIG_NAME,
        adapter.configType as ObjectType,
        { instancesRegexSkippedList: ['\\'] },
      )
      expect(() => adapter.operations({ credentials, config: invalidConfig })).toThrow()
    })

    it('should throw an error when creating adapter with invalid regex in dataManagement.includeObjects', () => {
      const invalidConfig = new InstanceElement(
        ElemID.CONFIG_NAME,
        adapter.configType as ObjectType,
        { dataManagement: {
          includeObjects: ['\\'],
          saltoIDSettings: {
            defaultIdFields: ['field'],
          },
        } },
      )
      expect(() => adapter.operations({ credentials, config: invalidConfig })).toThrow('Failed to load config due to an invalid dataManagement.includeObjects value. The following regular expressions are invalid: \\')
    })

    it('should throw an error when creating adapter with invalid regex in dataManagement.excludeObjects', () => {
      const invalidConfig = new InstanceElement(
        ElemID.CONFIG_NAME,
        adapter.configType as ObjectType,
        { dataManagement: {
          includeObjects: ['obj'],
          excludeObjects: ['\\'],
          saltoIDSettings: {
            defaultIdFields: ['field'],
          },
        } },
      )
      expect(() => adapter.operations({ credentials, config: invalidConfig })).toThrow('Failed to load config due to an invalid dataManagement.excludeObjects value. The following regular expressions are invalid: \\')
    })

    it('should throw an error when creating adapter with invalid regex in dataManagement.allowReferenceTo', () => {
      const invalidConfig = new InstanceElement(
        ElemID.CONFIG_NAME,
        adapter.configType as ObjectType,
        { dataManagement: {
          includeObjects: ['obj'],
          allowReferenceTo: ['\\'],
          saltoIDSettings: {
            defaultIdFields: ['field'],
          },
        } },
      )
      expect(() => adapter.operations({ credentials, config: invalidConfig })).toThrow('Failed to load config due to an invalid dataManagement.allowReferenceTo value. The following regular expressions are invalid: \\')
    })

    it('should throw an error when creating adapter with invalid regex in dataManagement.saltoIDSettings.overrides objectsRegex', () => {
      const invalidConfig = new InstanceElement(
        ElemID.CONFIG_NAME,
        adapter.configType as ObjectType,
        { dataManagement: {
          includeObjects: ['obj'],
          saltoIDSettings: {
            defaultIdFields: ['field'],
            overrides: [
              { objectsRegex: '\\', idFields: ['Id'] },
            ],
          },
        } },
      )
      expect(() => adapter.operations({ credentials, config: invalidConfig })).toThrow('Failed to load config due to an invalid dataManagement.saltoIDSettings.overrides value. The following regular expressions are invalid: \\')
    })


    it('should throw error when dataManagement is created without includeObjects', () => {
      const invalidConfig = new InstanceElement(
        ElemID.CONFIG_NAME,
        adapter.configType as ObjectType,
        { dataManagement: {
          saltoIDSettings: {
            defaultIdFields: ['field'],
            overrides: [
              { objectsRegex: '\\', idFields: ['Id'] },
            ],
          },
        } },
      )
      expect(() => adapter.operations({ credentials, config: invalidConfig })).toThrow('includeObjects is required when dataManagement is configured')
    })

    it('should throw error when dataManagement is created without saltoIDSettings', () => {
      const invalidConfig = new InstanceElement(
        ElemID.CONFIG_NAME,
        adapter.configType as ObjectType,
        { dataManagement: {
          includeObjects: ['obj'],
        } },
      )
      expect(() => adapter.operations({ credentials, config: invalidConfig })).toThrow('saltoIDSettings is required when dataManagement is configured')
    })

    it('should throw error when dataManagement is created without saltoIDSettings.defaultIdFields', () => {
      const invalidConfig = new InstanceElement(
        ElemID.CONFIG_NAME,
        adapter.configType as ObjectType,
        { dataManagement: {
          includeObjects: ['obj'],
          saltoIDSettings: {
            overrides: [
              { objectsRegex: '\\', idFields: ['Id'] },
            ],
          },
        } },
      )
      expect(() => adapter.operations({ credentials, config: invalidConfig })).toThrow('saltoIDSettings.defaultIdFields is required when dataManagement is configured')
    })
  })
})
