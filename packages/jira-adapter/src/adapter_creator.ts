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
  InstanceElement, Adapter, Values, AccountId,
} from '@salto-io/adapter-api'
import { client as clientUtils, config as configUtils } from '@salto-io/adapter-components'
import { filterErrorsBy } from '@salto-io/adapter-utils/'
import JiraClient from './client/client'
import JiraAdapter from './adapter'
import { Credentials, basicAuthCredentialsType } from './auth'
import { configType, JiraConfig, getApiDefinitions, DEFAULT_CONFIG } from './config'
import { createConnection, validateCredentials } from './client/connection'

const log = logger(module)
const { validateClientConfig, createRetryOptions, DEFAULT_RETRY_OPTS } = clientUtils
const { validateSwaggerApiDefinitionConfig, validateSwaggerFetchConfig } = configUtils
const InvalidCredentialErrorMessages = ['Invalid Credentials']
const isInValidCredentials = (error: Error): boolean =>
  InvalidCredentialErrorMessages.includes(error.message)

const TYPES_TO_ADD_TO_CONFIG = [
  'IssueEvents',
]

const credentialsFromConfig = (config: Readonly<InstanceElement>): Credentials => (
  config.value as Credentials
)

const validateFetchConfig = (config?: JiraConfig['fetch']): void => {
  if (
    config === undefined
    || !Array.isArray(config.includeTypes)
    || config.includeTypes.some(val => !_.isString(val))
  ) {
    throw new Error('fetch.includeTypes must be array of strings')
  }
}

function validateConfig(config: Values): asserts config is JiraConfig {
  const { client, apiDefinitions, fetch } = config

  validateClientConfig('client', client)
  if (!_.isPlainObject(apiDefinitions)) {
    throw new Error('Missing apiDefinitions from configuration')
  }
  // Note - this is a temporary way of handling multiple swagger defs in the same adapter
  // this will be replaced by built-in infrastructure support for multiple swagger defs
  // in the configuration
  Object.values(getApiDefinitions(apiDefinitions)).forEach(swaggerDef => {
    validateSwaggerApiDefinitionConfig('apiDefinitions', swaggerDef)
  })
  validateSwaggerFetchConfig('fetch', fetch, apiDefinitions)
  validateFetchConfig(fetch)
}

const adapterConfigFromConfig = (config: Readonly<InstanceElement> | undefined): JiraConfig => {
  const fullConfig = configUtils.mergeWithDefaultConfig(
    _.omit(DEFAULT_CONFIG, 'fetch'),
    config?.value
  )

  // We can remove this once SALTO-1792 is implemented
  fullConfig.fetch.includeTypes = [
    ...fullConfig.fetch.includeTypes ?? [],
    ...TYPES_TO_ADD_TO_CONFIG,
  ]
  validateConfig(fullConfig)

  // Hack to make sure this is coupled with the type definition of JiraConfig
  const adapterConfig: Record<keyof Required<JiraConfig>, null> = {
    apiDefinitions: null,
    client: null,
    fetch: null,
    deploy: null,
  }
  Object.keys(fullConfig)
    .filter(k => !Object.keys(adapterConfig).includes(k))
    .forEach(k => log.debug('Unknown config property was found: %s', k))

  return fullConfig
}

export const adapter: Adapter = {
  operations: context => {
    const config = adapterConfigFromConfig(context.config)
    const credentials = credentialsFromConfig(context.credentials)
    return new JiraAdapter({
      client: new JiraClient({
        credentials,
        config: config.client,
      }),
      config,
      getElemIdFunc: context.getElemIdFunc,
      elementsSource: context.elementsSource,
    })
  },
  validateCredentials: async config => {
    const connection = createConnection(createRetryOptions(DEFAULT_RETRY_OPTS))
    const validateCredentialsFunction = async (): Promise<AccountId> =>
      validateCredentials({ connection: await connection.login(credentialsFromConfig(config)) })
    return filterErrorsBy<AccountId>(validateCredentialsFunction, isInValidCredentials)
  },
  authenticationMethods: {
    basic: {
      credentialsType: basicAuthCredentialsType,
    },
  },
  configType,
}
