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
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import {
  InstanceElement, Adapter,
} from '@salto-io/adapter-api'
import { client as clientUtils, config as configUtils } from '@salto-io/adapter-components'
import JiraClient from './client/client'
import JiraAdapter from './adapter'
import { Credentials, basicAuthCredentialsType } from './auth'
import { configType, JiraConfig, getApiDefinitions } from './config'
import { createConnection, validateCredentials } from './client/connection'

const log = logger(module)
const { validateClientConfig, createRetryOptions, DEFAULT_RETRY_OPTS } = clientUtils
const { validateSwaggerApiDefinitionConfig } = configUtils

const credentialsFromConfig = (config: Readonly<InstanceElement>): Credentials => (
  config.value as Credentials
)

type JiraConfigInstance = InstanceElement & { value: InstanceElement['value'] & JiraConfig }

const validateFetchConfig = (config?: JiraConfig['fetch']): void => {
  if (
    config === undefined
    || !Array.isArray(config.includeTypes)
    || config.includeTypes.some(val => !_.isString(val))
  ) {
    throw new Error('fetch.includeTypes must be array of strings')
  }
}

function validateConfig(config?: Readonly<InstanceElement>): asserts config is JiraConfigInstance {
  if (config === undefined) {
    throw new Error('configuration must not be empty')
  }

  const { client, apiDefinitions, fetch } = config.value

  validateClientConfig('client', client)
  if (!_.isPlainObject(apiDefinitions)) {
    throw new Error('Missing apiDefinitions from configuration')
  }
  getApiDefinitions(apiDefinitions).forEach(swaggerDef => {
    validateSwaggerApiDefinitionConfig('apiDefinitions', swaggerDef)
  })
  validateFetchConfig(fetch)
}

const adapterConfigFromConfig = (config: Readonly<InstanceElement> | undefined): JiraConfig => {
  validateConfig(config)

  // Hack to make sure this is coupled with the type definition of JiraConfig
  const adapterConfig: Record<keyof Required<JiraConfig>, null> = {
    apiDefinitions: null,
    client: null,
    fetch: null,
  }
  Object.keys(config.value)
    .filter(k => !Object.keys(adapterConfig).includes(k))
    .forEach(k => log.debug('Unknown config property was found: %s', k))

  return config.value
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
    })
  },
  validateCredentials: async config => {
    const connection = createConnection(createRetryOptions(DEFAULT_RETRY_OPTS))
    return validateCredentials({
      connection: await connection.login(credentialsFromConfig(config)),
    })
  },
  authenticationMethods: {
    basic: {
      credentialsType: basicAuthCredentialsType,
    },
  },
  configType,
}
