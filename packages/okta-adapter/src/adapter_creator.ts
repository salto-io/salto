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
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { InstanceElement, Adapter } from '@salto-io/adapter-api'
import { client as clientUtils, config as configUtils } from '@salto-io/adapter-components'
import OktaClient from './client/client'
import OktaAdapter from './adapter'
import { Credentials, accessTokenCredentialsType } from './auth'
import { configType, OktaConfig, API_DEFINITIONS_CONFIG, FETCH_CONFIG, DEFAULT_CONFIG, CLIENT_CONFIG, OktaClientConfig, OktaSwaggerApiConfig, PRIVATE_API_DEFINITIONS_CONFIG, OktaDuckTypeApiConfig } from './config'
import { createConnection } from './client/connection'
import { OKTA } from './constants'
import { getAdminUrl } from './client/admin'

const log = logger(module)
const { validateClientConfig, validateCredentials } = clientUtils
const {
  validateSwaggerApiDefinitionConfig, validateSwaggerFetchConfig, validateDuckTypeApiDefinitionConfig,
} = configUtils

const credentialsFromConfig = (config: Readonly<InstanceElement>): Credentials => {
  const { baseUrl, token } = config.value
  const hostName = new URL(baseUrl).hostname
  if (!hostName.includes(OKTA)) {
    throw new Error(`'${hostName}' is not a valid okta account url`)
  }
  return {
    baseUrl,
    token,
  }
}

const adapterConfigFromConfig = (config: Readonly<InstanceElement> | undefined): OktaConfig => {
  const apiDefinitions = configUtils.mergeWithDefaultConfig(
    DEFAULT_CONFIG.apiDefinitions,
    config?.value.apiDefinitions
  ) as OktaSwaggerApiConfig

  const privateApiDefinitions = configUtils.mergeWithDefaultConfig(
    DEFAULT_CONFIG[PRIVATE_API_DEFINITIONS_CONFIG],
    config?.value.privateApiDefinitions
  ) as OktaDuckTypeApiConfig

  const fetch = _.defaults(
    {}, config?.value.fetch, DEFAULT_CONFIG[FETCH_CONFIG],
  )

  const client = configUtils.mergeWithDefaultConfig(
    DEFAULT_CONFIG[CLIENT_CONFIG] ?? {},
    config?.value?.client
  ) as OktaClientConfig

  validateClientConfig(CLIENT_CONFIG, client)
  validateSwaggerApiDefinitionConfig(API_DEFINITIONS_CONFIG, apiDefinitions)
  validateSwaggerFetchConfig(
    FETCH_CONFIG,
    fetch,
    apiDefinitions,
  )
  validateDuckTypeApiDefinitionConfig(PRIVATE_API_DEFINITIONS_CONFIG, privateApiDefinitions)

  const adapterConfig: { [K in keyof Required<OktaConfig>]: OktaConfig[K] } = {
    client,
    fetch,
    apiDefinitions,
    privateApiDefinitions,
  }
  Object.keys(config?.value ?? {})
    .filter(k => !Object.keys(adapterConfig).includes(k))
    .forEach(k => log.debug('Unknown config property was found: %s', k))
  return adapterConfig
}

const createAdminClient = (credentials: Credentials, config: OktaConfig): OktaClient | undefined => {
  const clientConfig = config[CLIENT_CONFIG]
  if (clientConfig?.usePrivateAPI !== true) {
    // we use admin client for private api calls only
    return undefined
  }
  const adminUrl = getAdminUrl(credentials.baseUrl)
  return adminUrl !== undefined
    ? new OktaClient({
      credentials: { ...credentials, baseUrl: adminUrl },
      config: clientConfig,
    })
    : undefined
}

export const adapter: Adapter = {
  operations: context => {
    const config = adapterConfigFromConfig(
      context.config,
    )
    const credentials = credentialsFromConfig(context.credentials)
    const adapterOperations = new OktaAdapter({
      client: new OktaClient({
        credentials,
        config: config.client,
      }),
      config,
      getElemIdFunc: context.getElemIdFunc,
      elementsSource: context.elementsSource,
      adminClient: createAdminClient(credentials, config),
    })

    return {
      deploy: adapterOperations.deploy.bind(adapterOperations),
      fetch: async args => {
        const fetchRes = await adapterOperations.fetch(args)
        return {
          ...fetchRes,
          updatedConfig: fetchRes.updatedConfig,
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
      credentialsType: accessTokenCredentialsType,
    },
  },
  configType,
}
