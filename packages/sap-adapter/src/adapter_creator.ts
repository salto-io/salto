/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { client as clientUtils, config as configUtils } from '@salto-io/adapter-components'
import SAPAdapter from './adapter'
import { Credentials, usernamePasswordCredentialsType } from './auth'
import {
  configType,
  SAPConfig,
  CLIENT_CONFIG,
  FETCH_CONFIG,
  validateFetchConfig,
  API_DEFINITIONS_CONFIG,
  DEFAULT_CONFIG,
  SAPFetchConfig,
} from './config'
import SAPClient from './client/client'
import { createConnection } from './client/connection'
import { configCreator } from './config_creator'

const log = logger(module)
const { validateCredentials, validateClientConfig } = clientUtils
const { validateDuckTypeApiDefinitionConfig } = configUtils

const credentialsFromConfig = (config: Readonly<InstanceElement>): Credentials => {
  const domain = config.value.domain === undefined || config.value.domain === ''
    ? undefined
    : config.value.domain
  return {
    username: config.value.username,
    password: config.value.password,
    subdomain: config.value.subdomain,
    domain,
  }
}

const adapterConfigFromConfig = (config: Readonly<InstanceElement> | undefined): SAPConfig => {
  const configValue = config?.value ?? {}
  const apiDefinitions = configUtils.mergeWithDefaultConfig(
    DEFAULT_CONFIG.apiDefinitions,
    config?.value.apiDefinitions
  ) as configUtils.AdapterDuckTypeApiConfig

  const fetch = configUtils.mergeWithDefaultConfig(
    DEFAULT_CONFIG.fetch,
    config?.value.fetch
  ) as SAPFetchConfig

  const adapterConfig: { [K in keyof Required<SAPConfig>]: SAPConfig[K] } = {
    client: configValue.client,
    fetch,
    apiDefinitions,
  }

  validateClientConfig(CLIENT_CONFIG, adapterConfig.client)
  validateFetchConfig(FETCH_CONFIG, adapterConfig.fetch, apiDefinitions)
  validateDuckTypeApiDefinitionConfig(API_DEFINITIONS_CONFIG, apiDefinitions)

  Object.keys(configValue)
    .filter(k => !Object.keys(adapterConfig).includes(k))
    .forEach(k => log.debug('Unknown config property was found: %s', k))
  return adapterConfig
}

export const adapter: Adapter = {
  operations: context => {
    // This can be removed once all the workspaces configs were migrated
    const updatedConfig = configUtils.configMigrations.migrateDeprecatedIncludeList(
      // Creating new instance is required because the type is not resolved in context.config
      new InstanceElement(
        ElemID.CONFIG_NAME,
        configType,
        context.config?.value
      ),
      DEFAULT_CONFIG,
    )
    const config = adapterConfigFromConfig(updatedConfig?.config[0] ?? context.config)
    const credentials = credentialsFromConfig(context.credentials)
    const adapterOperations = new SAPAdapter({
      client: new SAPClient({
        credentials,
        config: config[CLIENT_CONFIG],
      }),
      credentials,
      config,
      getElemIdFunc: context.getElemIdFunc,
      configInstance: context.config,
      elementsSource: context.elementsSource,
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
  validateCredentials: async config => validateCredentials(
    credentialsFromConfig(config),
    {
      createConnection,
    },
  ),
  authenticationMethods: {
    basic: {
      credentialsType: usernamePasswordCredentialsType,
    },
  },
  configType,
  configCreator,
}
