/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { logger } from '@salto-io/logging'
import { InstanceElement, Adapter } from '@salto-io/adapter-api'
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

const log = logger(module)
const { validateCredentials } = clientUtils
const { validateClientConfig, mergeWithDefaultConfig } = definitions
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
  const apiDefinitions = mergeWithDefaultConfig(
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
    const config = adapterConfigFromConfig(context.config)
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
      fetch: async args => adapterOperations.fetch(args),
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
