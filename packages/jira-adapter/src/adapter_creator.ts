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
import {
  InstanceElement, Adapter, Values, ElemID,
} from '@salto-io/adapter-api'
import { client as clientUtils, config as configUtils } from '@salto-io/adapter-components'
import JiraClient from './client/client'
import JiraAdapter from './adapter'
import { Credentials, basicAuthCredentialsType } from './auth'
import { configType, JiraConfig, getApiDefinitions, getDefaultConfig } from './config/config'
import { createConnection, validateCredentials } from './client/connection'
import { AUTOMATION_TYPE, WEBHOOK_TYPE } from './constants'
import { getProductSettings } from './product_settings'
import { configCreator } from './config_creator'

const log = logger(module)
const { validateClientConfig, createRetryOptions, DEFAULT_RETRY_OPTS } = clientUtils
const { validateSwaggerApiDefinitionConfig, validateSwaggerFetchConfig } = configUtils

const credentialsFromConfig = (config: Readonly<InstanceElement>): Credentials => (
  config.value as Credentials
)

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
}

const adapterConfigFromConfig = (
  config: Readonly<InstanceElement> | undefined,
  defaultConfig: JiraConfig
): JiraConfig => {
  const configWithoutFetch = configUtils.mergeWithDefaultConfig(
    _.omit(defaultConfig, 'fetch'),
    _.omit(config?.value ?? {}, 'fetch'),
  )
  const fetch = _.defaults(
    {}, config?.value.fetch, _.pick(defaultConfig.fetch, ['hideTypes', 'enableMissingReferences']),
  )
  const fullConfig = { ...configWithoutFetch, fetch }

  validateConfig(fullConfig)

  // Hack to make sure this is coupled with the type definition of JiraConfig
  const adapterConfig: Record<keyof Required<JiraConfig>, null> = {
    apiDefinitions: null,
    client: null,
    fetch: null,
    deploy: null,
    masking: null,
  }
  Object.keys(fullConfig)
    .filter(k => !Object.keys(adapterConfig).includes(k))
    .forEach(k => log.debug('Unknown config property was found: %s', k))

  return fullConfig
}

export const adapter: Adapter = {
  operations: context => {
    const isDataCenter = Boolean(context.credentials.value.isDataCenter)

    const defaultConfig = getDefaultConfig({ isDataCenter })

    // This can be removed once all the workspaces configs were migrated
    const updatedConfig = configUtils.configMigrations.migrateDeprecatedIncludeList(
      // Creating new instance is required because the type is not resolved in context.config
      new InstanceElement(
        ElemID.CONFIG_NAME,
        configType,
        context.config?.value
      ),
      defaultConfig,
      [
        'IssueEvent',
        WEBHOOK_TYPE,
        AUTOMATION_TYPE,
      ]
    )

    const config = adapterConfigFromConfig(
      updatedConfig?.config[0] ?? context.config,
      defaultConfig
    )
    const credentials = credentialsFromConfig(context.credentials)
    const adapterOperations = new JiraAdapter({
      client: new JiraClient({
        credentials,
        config: config.client,
        isDataCenter,
      }),
      config,
      getElemIdFunc: context.getElemIdFunc,
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
  validateCredentials: async config => {
    const connection = createConnection(createRetryOptions(DEFAULT_RETRY_OPTS))
    const creds = credentialsFromConfig(config)
    const productSettings = getProductSettings({ isDataCenter: Boolean(creds.isDataCenter) })

    return validateCredentials({
      connection: productSettings.wrapConnection(await connection.login(creds)),
    })
  },
  authenticationMethods: {
    basic: {
      credentialsType: basicAuthCredentialsType,
    },
  },
  configType,
  configCreator,
}
