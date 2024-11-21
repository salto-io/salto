/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { InstanceElement, Adapter } from '@salto-io/adapter-api'
import { client as clientUtils, definitions } from '@salto-io/adapter-components'
import WorkatoAdapter from './adapter'
import { Credentials, usernameTokenCredentialsType } from './auth'
import { DEFAULT_CONFIG, WorkatoUserConfig, configType } from './user_config'
import WorkatoClient from './client/client'
import { createConnection } from './client/connection'
import { configCreator } from './config_creator'

const { validateCredentials } = clientUtils
const { adapterConfigFromConfig } = definitions

const credentialsFromConfig = (config: Readonly<InstanceElement>): Credentials => ({
  username: config.value.username,
  token: config.value.token,
})

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
  authenticationMethods: () => ({
    basic: {
      credentialsType: usernameTokenCredentialsType,
    },
  }),
  configType,
  configCreator,
}
