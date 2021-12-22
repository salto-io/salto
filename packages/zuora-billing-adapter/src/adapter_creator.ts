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
  InstanceElement, Adapter,
} from '@salto-io/adapter-api'
import { client as clientUtils, config as configUtils } from '@salto-io/adapter-components'
import ZuoraClient from './client/client'
import ZuoraAdapter from './adapter'
import { Credentials, oauthClientCredentialsType, isSandboxSubdomain, toZuoraBaseUrl } from './auth'
import {
  configType, ZuoraConfig, CLIENT_CONFIG, API_DEFINITIONS_CONFIG,
  FETCH_CONFIG, DEFAULT_CONFIG,
} from './config'
import { createConnection } from './client/connection'

const log = logger(module)
const { validateCredentials, validateClientConfig } = clientUtils
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
  const fullConfig = configUtils.mergeWithDefaultConfig(DEFAULT_CONFIG, config?.value)

  validateClientConfig(CLIENT_CONFIG, fullConfig.client)
  validateSwaggerApiDefinitionConfig(API_DEFINITIONS_CONFIG, fullConfig.apiDefinitions)
  validateSwaggerFetchConfig(
    FETCH_CONFIG,
    API_DEFINITIONS_CONFIG,
    fullConfig.fetch,
    fullConfig.apiDefinitions
  )

  const adapterConfig: { [K in keyof Required<ZuoraConfig>]: ZuoraConfig[K] } = {
    client: fullConfig.client,
    fetch: fullConfig.fetch,
    apiDefinitions: fullConfig.apiDefinitions,
  }
  Object.keys(fullConfig)
    .filter(k => !Object.keys(adapterConfig).includes(k))
    .forEach(k => log.debug('Unknown config property was found: %s', k))
  return adapterConfig
}

export const adapter: Adapter = {
  operations: context => {
    const config = adapterConfigFromConfig(context.config)
    const credentials = credentialsFromConfig(context.credentials)
    return new ZuoraAdapter({
      client: new ZuoraClient({
        credentials,
        config: config[CLIENT_CONFIG],
      }),
      config,
    })
  },
  validateCredentials: async config => validateCredentials(
    credentialsFromConfig(config),
    {
      createConnection,
    },
  ),
  authenticationMethods: {
    basic: {
      credentialsType: oauthClientCredentialsType,
    },
  },
  configType,
}
