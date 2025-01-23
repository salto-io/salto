/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { InstanceElement, Adapter } from '@salto-io/adapter-api'
import { client as clientUtils, definitions } from '@salto-io/adapter-components'
import WorkatoAdapter from './adapter'
import { Credentials, usernameTokenCredentialsType, workatoBaseUrlOptions } from './auth'
import { DEFAULT_CONFIG, WorkatoUserConfig, configType } from './user_config'
import WorkatoClient from './client/client'
import { createConnection } from './client/connection'
import { configCreator } from './config_creator'

const log = logger(module)
const { validateCredentials } = clientUtils
const { adapterConfigFromConfig } = definitions

const validateBaseUrl = (baseUrl: unknown): void => {
  if (typeof baseUrl !== 'string') {
    throw new Error('Invalid base URL, value must be string')
  }
  if (!workatoBaseUrlOptions.includes(baseUrl)) {
    log.error('received invalid Workato base URL: %s', baseUrl)
    throw new Error('Received invalid Workato base URL')
  }
}

const credentialsFromConfig = (config: Readonly<InstanceElement>): Credentials => {
  const baseUrl = !_.isEmpty(config.value.baseUrl) ? config.value.baseUrl : undefined
  if (baseUrl !== undefined) {
    validateBaseUrl(baseUrl)
  }
  return {
    username: config.value.username,
    baseUrl,
    token: config.value.token,
  }
}

export const adapter: Adapter = {
  operations: context => {
    const config = adapterConfigFromConfig<never, WorkatoUserConfig>(context.config, DEFAULT_CONFIG)
    const credentials = credentialsFromConfig(context.credentials)
    const adapterOperations = new WorkatoAdapter({
      client: new WorkatoClient({
        credentials,
        config: config.client,
      }),
      config,
      getElemIdFunc: context.getElemIdFunc,
      accountName: context.accountName,
      elementsSource: context.elementsSource,
    })

    return {
      deploy: adapterOperations.deploy.bind(adapterOperations),
      fetch: async args => adapterOperations.fetch(args),
      deployModifiers: adapterOperations.deployModifiers,
      postFetch: adapterOperations.postFetch.bind(adapterOperations),
    }
  },
  validateCredentials: async config =>
    validateCredentials(credentialsFromConfig(config), {
      createConnection,
    }),
  authenticationMethods: {
    basic: {
      credentialsType: usernameTokenCredentialsType,
    },
  },
  configType,
  configCreator,
}
