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
import { logger } from '@salto-io/logging'
import { InstanceElement, Adapter, ElemID } from '@salto-io/adapter-api'
import { client as clientUtils, config as configUtils, definitions } from '@salto-io/adapter-components'
import _ from 'lodash'
import StripeClient from './client/client'
import StripeAdapter from './adapter'
import { Credentials, accessTokenCredentialsType } from './auth'
import {
  configType,
  StripeConfig,
  CLIENT_CONFIG,
  API_DEFINITIONS_CONFIG,
  FETCH_CONFIG,
  DEFAULT_CONFIG,
  StripeApiConfig,
} from './config'
import { createConnection } from './client/connection'

const log = logger(module)
const { validateCredentials } = clientUtils
const { validateClientConfig } = definitions
const { validateSwaggerApiDefinitionConfig, validateSwaggerFetchConfig } = configUtils

const credentialsFromConfig = (config: Readonly<InstanceElement>): Credentials => ({
  token: config.value.token,
})

const adapterConfigFromConfig = (config: Readonly<InstanceElement> | undefined): StripeConfig => {
  const apiDefinitions = configUtils.mergeWithDefaultConfig(
    DEFAULT_CONFIG.apiDefinitions,
    config?.value.apiDefinitions,
  ) as StripeApiConfig

  const fetch = _.defaults({}, config?.value.fetch, DEFAULT_CONFIG[FETCH_CONFIG])

  validateClientConfig(CLIENT_CONFIG, config?.value?.client)
  validateSwaggerApiDefinitionConfig(API_DEFINITIONS_CONFIG, apiDefinitions)
  validateSwaggerFetchConfig(FETCH_CONFIG, fetch, apiDefinitions)

  const adapterConfig: { [K in keyof Required<StripeConfig>]: StripeConfig[K] } = {
    client: config?.value?.client,
    fetch,
    apiDefinitions,
  }
  Object.keys(config?.value ?? {})
    .filter(k => !Object.keys(adapterConfig).includes(k))
    .forEach(k => log.debug('Unknown config property was found: %s', k))
  return adapterConfig
}

export const adapter: Adapter = {
  operations: context => {
    // This can be removed once all the workspaces configs were migrated
    const updatedConfig = configUtils.configMigrations.migrateDeprecatedIncludeList(
      // Creating new instance is required because the type is not resolved in context.config
      new InstanceElement(ElemID.CONFIG_NAME, configType, context.config?.value),
      DEFAULT_CONFIG,
    )
    const config = adapterConfigFromConfig(updatedConfig?.config[0] ?? context.config)
    const credentials = credentialsFromConfig(context.credentials)
    const adapterOperations = new StripeAdapter({
      client: new StripeClient({
        credentials,
        config: config[CLIENT_CONFIG],
      }),
      config,
    })

    return {
      deploy: adapterOperations.deploy.bind(adapterOperations),
      fetch: async args => {
        const fetchRes = await adapterOperations.fetch(args)
        return {
          ...fetchRes,
          updatedConfig,
        }
      },
      deployModifiers: adapterOperations.deployModifiers,
    }
  },
  validateCredentials: async config =>
    validateCredentials(credentialsFromConfig(config), {
      createConnection,
    }),
  authenticationMethods: {
    basic: {
      credentialsType: accessTokenCredentialsType,
    },
  },
  configType,
}
