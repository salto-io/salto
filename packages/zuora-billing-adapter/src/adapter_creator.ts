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
import ZuoraClient from './client/client'
import ZuoraAdapter from './adapter'
import { Credentials, oauthClientCredentialsType, isSandboxSubdomain, toZuoraBaseUrl } from './auth'
import {
  configType,
  ZuoraConfig,
  CLIENT_CONFIG,
  API_DEFINITIONS_CONFIG,
  FETCH_CONFIG,
  DEFAULT_CONFIG,
  ZuoraApiConfig,
} from './config'
import { createConnection } from './client/connection'
import { SETTINGS_TYPE_PREFIX } from './constants'

const log = logger(module)
const { validateCredentials } = clientUtils
const { validateClientConfig } = definitions
const { validateSwaggerApiDefinitionConfig, validateSwaggerFetchConfig } = configUtils

const credentialsFromConfig = (config: Readonly<InstanceElement>): Credentials => {
  const { clientId, clientSecret, subdomain, production } = config.value
  if (!production && !isSandboxSubdomain(subdomain)) {
    throw new Error(`'${subdomain}' is not a valid sandbox subdomain`)
  }
  if (production && isSandboxSubdomain(subdomain)) {
    throw new Error(`'${subdomain}' is a sandbox subdomain and cannot be used for production`)
  }
  return {
    clientId,
    clientSecret,
    baseURL: toZuoraBaseUrl(subdomain),
  }
}

const adapterConfigFromConfig = (config: Readonly<InstanceElement> | undefined): ZuoraConfig => {
  const apiDefinitions = configUtils.mergeWithDefaultConfig(
    DEFAULT_CONFIG.apiDefinitions,
    config?.value.apiDefinitions,
  ) as ZuoraApiConfig

  const fetch = _.defaults({}, config?.value.fetch, DEFAULT_CONFIG[FETCH_CONFIG])

  validateClientConfig(CLIENT_CONFIG, config?.value?.client)
  validateSwaggerApiDefinitionConfig(API_DEFINITIONS_CONFIG, apiDefinitions)
  validateSwaggerFetchConfig(FETCH_CONFIG, fetch, apiDefinitions)

  const adapterConfig: { [K in keyof Required<ZuoraConfig>]: ZuoraConfig[K] } = {
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
    if (context.config?.value.fetch?.settingsIncludeTypes !== undefined) {
      context.config.value.fetch.includeTypes = [
        ...(context.config.value.fetch.includeTypes ?? []),
        ...context.config.value.fetch.settingsIncludeTypes.map(
          (typeName: string) => `${SETTINGS_TYPE_PREFIX}${typeName}`,
        ),
      ]
      delete context.config.value.fetch.settingsIncludeTypes
    }
    // This can be removed once all the workspaces configs were migrated
    const updatedConfig = configUtils.configMigrations.migrateDeprecatedIncludeList(
      // Creating new instance is required because the type is not resolved in context.config
      new InstanceElement(ElemID.CONFIG_NAME, configType, context.config?.value),
      DEFAULT_CONFIG,
    )
    const config = adapterConfigFromConfig(updatedConfig?.config[0] ?? context.config)
    const credentials = credentialsFromConfig(context.credentials)
    const adapterOperations = new ZuoraAdapter({
      client: new ZuoraClient({
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
          updatedConfig: fetchRes.updatedConfig ?? updatedConfig,
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
      credentialsType: oauthClientCredentialsType,
    },
  },
  configType,
}
