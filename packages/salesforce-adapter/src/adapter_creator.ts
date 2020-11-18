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
import { collections, regex } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import {
  InstanceElement, Adapter, OAuthRequestParameters, OauthAccessTokenResponse, Values,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import SalesforceClient, { validateCredentials } from './client/client'
import changeValidator from './change_validator'
import { getChangeGroupIds } from './group_changes'
import SalesforceAdapter from './adapter'
import { configType, usernamePasswordCredentialsType, oauthRequestParameters,
  isAccessTokenConfig, INSTANCES_REGEX_SKIPPED_LIST, SalesforceConfig, accessTokenCredentialsType,
  DataManagementConfig, DATA_MANAGEMENT, UsernamePasswordCredentials,
  Credentials, OauthAccessTokenCredentials, CLIENT_CONFIG, SalesforceClientConfig } from './types'

const { makeArray } = collections.array
const log = logger(module)

const credentialsFromConfig = (config: Readonly<InstanceElement>): Credentials => {
  if (isAccessTokenConfig(config)) {
    return new OauthAccessTokenCredentials({
      instanceUrl: config.value.instanceUrl,
      accessToken: config.value.accessToken,
      isSandbox: config.value.isSandbox,
    })
  }
  return new UsernamePasswordCredentials({
    username: config.value.username,
    password: config.value.password,
    isSandbox: config.value.sandbox,
    apiToken: config.value.token,
  })
}

const adapterConfigFromConfig = (config: Readonly<InstanceElement> | undefined):
SalesforceConfig => {
  const validateRegularExpressions = (listName: string, regularExpressions: string[]): void => {
    const invalidRegularExpressions = regularExpressions
      .filter(strRegex => !regex.isValidRegex(strRegex))
    if (!_.isEmpty(invalidRegularExpressions)) {
      const errMessage = `Failed to load config due to an invalid ${listName} value. The following regular expressions are invalid: ${invalidRegularExpressions}`
      log.error(errMessage)
      throw Error(errMessage)
    }
  }

  const validateDataManagement = (dataManagementConfig: DataManagementConfig | undefined): void => {
    if (dataManagementConfig !== undefined) {
      if (dataManagementConfig.includeObjects === undefined) {
        throw Error('includeObjects is required when dataManagement is configured')
      }
      if (dataManagementConfig.saltoIDSettings === undefined) {
        throw Error('saltoIDSettings is required when dataManagement is configured')
      }
      if (dataManagementConfig.saltoIDSettings.defaultIdFields === undefined) {
        throw Error('saltoIDSettings.defaultIdFields is required when dataManagement is configured')
      }
      validateRegularExpressions(`${DATA_MANAGEMENT}.includeObjects`, makeArray(dataManagementConfig.includeObjects))
      validateRegularExpressions(`${DATA_MANAGEMENT}.excludeObjects`, makeArray(dataManagementConfig.excludeObjects))
      validateRegularExpressions(`${DATA_MANAGEMENT}.allowReferenceTo`, makeArray(dataManagementConfig.allowReferenceTo))
      if (dataManagementConfig.saltoIDSettings.overrides !== undefined) {
        const overridesObjectRegexs = dataManagementConfig.saltoIDSettings.overrides
          .map(override => override.objectsRegex)
        validateRegularExpressions(`${DATA_MANAGEMENT}.saltoIDSettings.overrides`, overridesObjectRegexs)
      }
    }
  }

  const validateClientConfig = (clientConfig: SalesforceClientConfig | undefined): void => {
    if (clientConfig?.maxConcurrentApiRequests !== undefined) {
      const invalidValues = (Object.entries(clientConfig.maxConcurrentApiRequests)
        .filter(([_name, value]) => value === 0))
      if (invalidValues.length > 0) {
        throw Error(`${CLIENT_CONFIG}.maxConcurrentApiRequests values cannot be set to 0. Invalid keys: ${invalidValues.map(([name]) => name).join(', ')}`)
      }
    }
  }

  const instancesRegexSkippedList = makeArray(config?.value?.instancesRegexSkippedList)
  validateRegularExpressions(INSTANCES_REGEX_SKIPPED_LIST, instancesRegexSkippedList)
  validateDataManagement(config?.value?.dataManagement)
  validateClientConfig(config?.value?.client)
  const adapterConfig: { [K in keyof Required<SalesforceConfig>]: SalesforceConfig[K] } = {
    metadataTypesSkippedList: makeArray(config?.value?.metadataTypesSkippedList),
    instancesRegexSkippedList: makeArray(config?.value?.instancesRegexSkippedList),
    maxItemsInRetrieveRequest: config?.value?.maxItemsInRetrieveRequest,
    enableHideTypesInNacls: config?.value?.enableHideTypesInNacls,
    dataManagement: config?.value?.dataManagement,
    useOldProfiles: config?.value?.useOldProfiles,
    client: config?.value?.client,
  }
  Object.keys(config?.value ?? {})
    .filter(k => !Object.keys(adapterConfig).includes(k))
    .forEach(k => log.debug('Unknown config property was found: %s', k))
  return adapterConfig
}

const createOAuthRequest = (userInput: InstanceElement): OAuthRequestParameters => {
  const endpoint = userInput.value.isSandbox ? 'test' : 'login'
  const url = `https://${endpoint}.salesforce.com/services/oauth2/authorize?response_type=token&client_id=${userInput.value.consumerKey}&redirect_uri=http://localhost:${userInput.value.port}`
  return {
    url,
    accessTokenField: 'access_token',
  }
}

export const adapter: Adapter = {
  operations: context => {
    const config = adapterConfigFromConfig(context.config)
    const credentials = credentialsFromConfig(context.credentials)
    return new SalesforceAdapter({
      client: new SalesforceClient({ credentials, config: config[CLIENT_CONFIG] }),
      config,
      getElemIdFunc: context.getElemIdFunc,
    })
  },
  validateCredentials: async config => validateCredentials(credentialsFromConfig(config)),
  authenticationMethods: {
    basic: {
      credentialsType: usernamePasswordCredentialsType,
    },
    oauth: {
      createOAuthRequest,
      credentialsType: accessTokenCredentialsType,
      oauthRequestParameters,
      createFromOauthResponse: (oldConfig: Values, response: OauthAccessTokenResponse) => ({
        isSandbox: oldConfig.isSandbox,
        accessToken: response.accessToken,
        instanceUrl: response.instanceUrl,
      }),
    },
  },
  configType,
  deployModifiers: {
    changeValidator,
    getChangeGroupIds,
  },
}
