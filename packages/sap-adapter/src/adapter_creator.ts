/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import { InstanceElement, Adapter } from '@salto-io/adapter-api'
import { client as clientUtils, definitions, config as configUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import SapClient from './client/client'
import SapAdapter from './adapter'
import { Credentials, oauthClientCredentialsType } from './auth'
import {
  configType,
  SAPConfig,
  CLIENT_CONFIG,
  API_DEFINITIONS_CONFIG,
  FETCH_CONFIG,
  DEFAULT_CONFIG,
  SAPApiConfig,
} from './config'
import { createConnection } from './client/connection'

const { validateCredentials } = clientUtils
const { validateClientConfig } = definitions
const { validateSwaggerApiDefinitionConfig, validateSwaggerFetchConfig } = configUtils

const credentialsFromConfig = (config: Readonly<InstanceElement>): Credentials => {
  const { clientId, clientSecret, authorizationUrl, baseUrl } = config.value
  return {
    clientId,
    clientSecret,
    authUrl: authorizationUrl,
    baseUrl,
  }
}

const adapterConfigFromConfig = (config: Readonly<InstanceElement> | undefined): SAPConfig => {
  const apiDefinitions = configUtils.mergeWithDefaultConfig(
    DEFAULT_CONFIG.apiDefinitions,
    config?.value.apiDefinitions,
  ) as SAPApiConfig

  const fetch = _.defaults({}, config?.value.fetch, DEFAULT_CONFIG[FETCH_CONFIG])

  validateClientConfig(CLIENT_CONFIG, config?.value?.client)
  validateSwaggerApiDefinitionConfig(API_DEFINITIONS_CONFIG, apiDefinitions)
  validateSwaggerFetchConfig(FETCH_CONFIG, fetch, apiDefinitions)

  const adapterConfig: { [K in keyof Required<SAPConfig>]: SAPConfig[K] } = {
    client: config?.value?.client,
    fetch,
    apiDefinitions,
  }

  return adapterConfig
}

export const adapter: Adapter = {
  operations: context => {
    const config = adapterConfigFromConfig(context.config)
    const credentials = credentialsFromConfig(context.credentials)
    const adapterOperations = new SapAdapter({
      client: new SapClient({
        credentials,
        config: config[CLIENT_CONFIG],
      }),
      config,
    })

    return {
      deploy: adapterOperations.deploy.bind(adapterOperations),
      fetch: adapterOperations.fetch.bind(adapterOperations),
      deployModifiers: adapterOperations.deployModifiers,
    }
  },
  validateCredentials: async config =>
    validateCredentials(credentialsFromConfig(config), {
      createConnection,
    }),
  authenticationMethods: {
    basic: {
      credentialsType: oauthClientCredentialsType,
    },
  },
  configType,
}
