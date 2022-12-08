/*
*                      Copyright 2022 Salto Labs Ltd.
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
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import {
  InstanceElement, Adapter, OAuthRequestParameters, OauthAccessTokenResponse,
  Values,
} from '@salto-io/adapter-api'
import SalesforceClient, { validateCredentials } from './client/client'
import SalesforceAdapter from './adapter'
import {
  configType, usernamePasswordCredentialsType, oauthRequestParameters,
  isAccessTokenConfig, SalesforceConfig, accessTokenCredentialsType,
  UsernamePasswordCredentials, Credentials, OauthAccessTokenCredentials, CLIENT_CONFIG,
  SalesforceClientConfig, RetryStrategyName, FETCH_CONFIG, MAX_ITEMS_IN_RETRIEVE_REQUEST,
  ChangeValidatorConfig, ENUM_FIELD_PERMISSIONS,
} from './types'
import { validateFetchParameters } from './fetch_profile/fetch_profile'
import { ConfigValidationError } from './config_validation'
import { updateDeprecatedConfiguration } from './deprecated_config'
import createChangeValidator, { changeValidators } from './change_validator'
import { getChangeGroupIds } from './group_changes'
import { ConfigChange } from './config_change'
import { configCreator } from './config_creator'

const log = logger(module)

const credentialsFromConfig = (config: Readonly<InstanceElement>): Credentials => {
  if (isAccessTokenConfig(config)) {
    return new OauthAccessTokenCredentials({
      refreshToken: config.value.refreshToken,
      instanceUrl: config.value.instanceUrl,
      accessToken: config.value.accessToken,
      isSandbox: config.value.sandbox,
      clientId: config.value.clientId,
      clientSecret: config.value.clientSecret,
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
    if (clientConfig?.readMetadataChunkSize !== undefined) {
      const defaultValue = clientConfig?.readMetadataChunkSize.default
      if (defaultValue && (defaultValue < 1 || defaultValue > 10)) {
        throw new ConfigValidationError([CLIENT_CONFIG, 'readMetadataChunkSize'], `readMetadataChunkSize default value should be between 1 to 10. current value is ${defaultValue}`)
      }
      const overrides = clientConfig?.readMetadataChunkSize.overrides
      if (overrides) {
        const invalidValues = Object.entries(overrides)
          .filter(([_name, value]) => ((value < 1) || (value > 10)))
        if (invalidValues.length > 0) {
          throw new ConfigValidationError([CLIENT_CONFIG, 'readMetadataChunkSize'], `readMetadataChunkSize values should be between 1 to 10. Invalid keys: ${invalidValues.map(([name]) => name).join(', ')}`)
        }
      }
    }
  }

  const validateValidatorsConfig = (validators: ChangeValidatorConfig | undefined): void => {
    if (validators !== undefined && !_.isPlainObject(validators)) {
      throw new ConfigValidationError(['validators'], 'Enabled validators configuration must be an object if it is defined')
    }
    if (_.isPlainObject(validators)) {
      const validValidatorsNames = Object.keys(changeValidators)
      Object.entries(validators as {}).forEach(([key, value]) => {
        if (!validValidatorsNames.includes(key)) {
          throw new ConfigValidationError(['validators', key], `Validator ${key} does not exist, expected one of ${validValidatorsNames.join(',')}`)
        }
        if (!_.isBoolean(value)) {
          throw new ConfigValidationError(['validators', key], 'Value must be true or false')
        }
      })
    }
  }

  const validateEnumFieldPermissions = (enumFieldPermissions: boolean | undefined): void => {
    if (enumFieldPermissions !== undefined && !_.isBoolean(enumFieldPermissions)) {
      throw new ConfigValidationError(['enumFieldPermissions'], 'Enabled enumFieldPermissions configuration must be true or false if it is defined')
    }
  }

  validateFetchParameters(config?.value?.[FETCH_CONFIG] ?? {}, [FETCH_CONFIG])

  validateClientConfig(config?.value?.client)

  validateValidatorsConfig(config?.value?.validators)

  validateEnumFieldPermissions(config?.value?.enumFieldPermissions)

  const adapterConfig: { [K in keyof Required<SalesforceConfig>]: SalesforceConfig[K] } = {
    fetch: config?.value?.[FETCH_CONFIG],
    maxItemsInRetrieveRequest: config?.value?.[MAX_ITEMS_IN_RETRIEVE_REQUEST],
    enumFieldPermissions: config?.value?.[ENUM_FIELD_PERMISSIONS],
    client: config?.value?.[CLIENT_CONFIG],
    validators: config?.value?.validators,
  }
  Object.keys(config?.value ?? {})
    .filter(k => !Object.keys(adapterConfig).includes(k))
    .forEach(k => log.debug('Unknown config property was found: %s', k))

  return adapterConfig
}

export const createUrlFromUserInput = (value: Values): string => {
  const endpoint = value.sandbox ? 'test' : 'login'
  return `https://${endpoint}.salesforce.com/services/oauth2/authorize?response_type=token&client_id=${value.consumerKey}&scope=refresh_token%20full&redirect_uri=http://localhost:${value.port}&prompt=login%20consent`
}

const createOAuthRequest = (userInput: InstanceElement): OAuthRequestParameters => ({
  url: createUrlFromUserInput(userInput.value),
  oauthRequiredFields: ['refresh_token', 'instance_url', 'access_token'],
})

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

  return configFromFetch
}

export const adapter: Adapter = {
  operations: context => {
    const updatedConfig = context.config && updateDeprecatedConfiguration(context.config)
    const config = adapterConfigFromConfig(updatedConfig?.config ?? context.config)
    const credentials = credentialsFromConfig(context.credentials)
    const client = new SalesforceClient({ credentials, config: config[CLIENT_CONFIG] })
    const salesforceAdapter = new SalesforceAdapter({
      client,
      config,
      getElemIdFunc: context.getElemIdFunc,
      elementsSource: context.elementsSource,
    })

    return {
      fetch: async opts => {
        const fetchResults = await salesforceAdapter.fetch(opts)
        fetchResults.updatedConfig = getConfigChange(
          fetchResults.updatedConfig,
          updatedConfig && {
            config: [updatedConfig.config],
            message: updatedConfig.message,
          },
        )
        return fetchResults
      },

      deploy: salesforceAdapter.deploy.bind(salesforceAdapter),
      validate: salesforceAdapter.validate.bind(salesforceAdapter),
      deployModifiers: {
        changeValidator: createChangeValidator(
          { config, isSandbox: credentials.isSandbox, checkOnly: false, client }
        ),
        getChangeGroupIds,
      },
      validationModifiers: {
        changeValidator: createChangeValidator(
          { config, isSandbox: credentials.isSandbox, checkOnly: true, client }
        ),
      },
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
        sandbox: oldConfig.sandbox,
        clientId: oldConfig.consumerKey,
        clientSecret: oldConfig.consumerSecret,
        accessToken: response.fields.accessToken,
        instanceUrl: response.fields.instanceUrl,
        refreshToken: response.fields.refreshToken,
      }),
    },
  },
  configType,
  configCreator,
}
