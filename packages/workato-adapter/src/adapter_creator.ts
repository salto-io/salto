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
import WorkatoAdapter from './adapter'
import { Credentials, usernameTokenCredentialsType } from './auth'
import {
  configType, WorkatoConfig, CLIENT_CONFIG, validateFetchConfig,
  FETCH_CONFIG, DEFAULT_CONFIG, WorkatoFetchConfig,
} from './config'
import WorkatoClient from './client/client'
import { createConnection } from './client/connection'

const log = logger(module)
const { validateCredentials, validateClientConfig } = clientUtils

const credentialsFromConfig = (config: Readonly<InstanceElement>): Credentials => ({
  username: config.value.username,
  token: config.value.token,
})

const adapterConfigFromConfig = (config: Readonly<InstanceElement> | undefined): WorkatoConfig => {
  const configValue = config?.value ?? {}

  const apiDefinitions = configUtils.mergeWithDefaultConfig(
    DEFAULT_CONFIG.apiDefinitions,
    config?.value.apiDefinitions
  ) as configUtils.AdapterDuckTypeApiConfig

  const fetch = configUtils.mergeWithDefaultConfig(
    DEFAULT_CONFIG.fetch,
    config?.value.fetch
  ) as WorkatoFetchConfig

  const adapterConfig: { [K in keyof Required<WorkatoConfig>]: WorkatoConfig[K] } = {
    client: configValue.client,
    fetch,
    apiDefinitions,
  }

  validateClientConfig(CLIENT_CONFIG, adapterConfig.client)
  validateFetchConfig(FETCH_CONFIG, adapterConfig.fetch, apiDefinitions)

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
    const adapterOperations = new WorkatoAdapter({
      client: new WorkatoClient({
        credentials,
        config: config[CLIENT_CONFIG],
      }),
      config,
      getElemIdFunc: context.getElemIdFunc,
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
      postFetch: adapterOperations.postFetch.bind(adapterOperations),
    }
  },
  validateCredentials: async config => {
    const accountId = await validateCredentials(
      credentialsFromConfig(config),
      {
        createConnection,
      },
    )
    return { accountId, accountType: 'Unknown', isProduction: undefined } // TODO: implement actual accountType & isProduction logic
  },
  authenticationMethods: {
    basic: {
      credentialsType: usernameTokenCredentialsType,
    },
  },
  configType,
}
