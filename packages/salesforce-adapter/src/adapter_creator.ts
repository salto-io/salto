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
import { logger } from '@salto-io/logging'
import {
  InstanceElement, Adapter, OAuthRequestParameters, OauthAccessTokenResponse,
  Values,
} from '@salto-io/adapter-api'
import SalesforceClient, { validateCredentials } from './client/client'
import changeValidator from './change_validator'
import { getChangeGroupIds } from './group_changes'
import SalesforceAdapter from './adapter'
import { configType, usernamePasswordCredentialsType, oauthRequestParameters,
  isAccessTokenConfig, SalesforceConfig, accessTokenCredentialsType,
  UsernamePasswordCredentials, Credentials, OauthAccessTokenCredentials, CLIENT_CONFIG,
  SalesforceClientConfig, RetryStrategyName, FETCH_CONFIG, MAX_ITEMS_IN_RETRIEVE_REQUEST, USE_OLD_PROFILES } from './types'
import { validateFetchParameters } from './fetch_profile/fetch_profile'
import { ConfigValidationError } from './config_validation'
import { updateDeprecatedConfiguration } from './deprecated_config'
import { ConfigChange } from './config_change'

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
  const validateClientConfig = (clientConfig: SalesforceClientConfig | undefined): void => {
    if (clientConfig?.maxConcurrentApiRequests !== undefined) {
      const invalidValues = (Object.entries(clientConfig.maxConcurrentApiRequests)
        .filter(([_name, value]) => value === 0))
      if (invalidValues.length > 0) {
        throw new ConfigValidationError([CLIENT_CONFIG, 'maxConcurrentApiRequests'], `maxConcurrentApiRequests values cannot be set to 0. Invalid keys: ${invalidValues.map(([name]) => name).join(', ')}`)
      }
    }

    if (clientConfig?.retry?.retryStrategy !== undefined
        && RetryStrategyName[clientConfig.retry.retryStrategy] === undefined) {
      throw new ConfigValidationError([CLIENT_CONFIG, 'clientConfig', 'retry', 'retryStrategy'], `retryStrategy value '${clientConfig.retry.retryStrategy}' is not supported`)
    }
  }

  validateFetchParameters(config?.value?.[FETCH_CONFIG] ?? {}, [FETCH_CONFIG])

  validateClientConfig(config?.value?.client)

  const adapterConfig: { [K in keyof Required<SalesforceConfig>]: SalesforceConfig[K] } = {
    fetch: config?.value?.[FETCH_CONFIG],
    maxItemsInRetrieveRequest: config?.value?.[MAX_ITEMS_IN_RETRIEVE_REQUEST],
    useOldProfiles: config?.value?.[USE_OLD_PROFILES],
    client: config?.value?.[CLIENT_CONFIG],
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

export const getConfigChange = (
  configFromFetch?: ConfigChange,
  configWithoutDeprecated?: ConfigChange,
): ConfigChange | undefined => {
  if (configWithoutDeprecated !== undefined && configFromFetch !== undefined) {
    return {
      config: configFromFetch.config,
      message: `${configWithoutDeprecated.message}
In Addition, ${configFromFetch.message}`,
    }
  }

  if (configWithoutDeprecated !== undefined) {
    return configWithoutDeprecated
  }

  return undefined
}

export const adapter: Adapter = {
  operations: context => {
    const updatedConfig = context.config && updateDeprecatedConfiguration(context.config)
    const config = adapterConfigFromConfig(updatedConfig?.config ?? context.config)
    const credentials = credentialsFromConfig(context.credentials)
    const salesforceAdapter = new SalesforceAdapter({
      client: new SalesforceClient({ credentials, config: config[CLIENT_CONFIG] }),
      config,
      getElemIdFunc: context.getElemIdFunc,
    })

    return {
      fetch: async opts => {
        const fetchResults = await salesforceAdapter.fetch(opts)
        fetchResults.updatedConfig = getConfigChange(fetchResults.updatedConfig, updatedConfig)
        return fetchResults
      },

      deploy: salesforceAdapter.deploy.bind(salesforceAdapter),
    }
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
