/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { InstanceElement, Adapter, Values } from '@salto-io/adapter-api'
import {
  client as clientUtils,
  combineCustomReferenceGetters,
  definitions as definitionsUtils,
} from '@salto-io/adapter-components'
import OktaClient from './client/client'
import OktaAdapter from './adapter'
import {
  Credentials,
  accessTokenCredentialsType,
  OAuthAccessTokenCredentials,
  isOAuthAccessTokenCredentials,
} from './auth'
import { CLIENT_CONFIG } from './config'
import { createConnection } from './client/connection'
import { validateOktaBaseUrl } from './utils'
import { getAdminUrl } from './client/admin'
import { weakReferenceHandlers } from './weak_references'
import { DEFAULT_CONFIG, OktaUserConfig, configType } from './user_config'
import { shouldAccessPrivateAPIs } from './definitions/requests/clients'

const { validateCredentials } = clientUtils
const { adapterConfigFromConfig } = definitionsUtils

const isOAuthConfigCredentials = (configValue: Readonly<Values>): configValue is OAuthAccessTokenCredentials =>
  configValue.authType === 'oauth' &&
  'refreshToken' in configValue &&
  'clientId' in configValue &&
  'clientSecret' in configValue

const credentialsFromConfig = (config: Readonly<InstanceElement>): Credentials => {
  const { value } = config
  const { baseUrl } = value
  validateOktaBaseUrl(baseUrl)
  return isOAuthConfigCredentials(value)
    ? {
        baseUrl,
        clientId: value.clientId,
        clientSecret: value.clientSecret,
        refreshToken: value.refreshToken,
      }
    : { baseUrl, token: config.value.token }
}

const createAdminClient = (
  credentials: Credentials,
  config: OktaUserConfig,
  isOAuthLogin: boolean,
): OktaClient | undefined => {
  // we use admin client for private api calls only
  if (!shouldAccessPrivateAPIs(isOAuthLogin, config)) {
    return undefined
  }
  const adminUrl = getAdminUrl(credentials.baseUrl)
  return adminUrl !== undefined
    ? new OktaClient({
        credentials: { ...credentials, baseUrl: adminUrl },
        config: config[CLIENT_CONFIG],
      })
    : undefined
}

export const adapter: Adapter = {
  operations: context => {
    const config = adapterConfigFromConfig<never, OktaUserConfig>(context.config, DEFAULT_CONFIG)
    const credentials = credentialsFromConfig(context.credentials)
    const isOAuthLogin = isOAuthAccessTokenCredentials(credentials)
    const adapterOperations = new OktaAdapter({
      client: new OktaClient({
        credentials,
        config: config.client,
      }),
      userConfig: config,
      configInstance: context.config,
      getElemIdFunc: context.getElemIdFunc,
      elementsSource: context.elementsSource,
      isOAuthLogin,
      adminClient: createAdminClient(credentials, config, isOAuthLogin),
      accountName: context.accountName,
    })

    return {
      deploy: adapterOperations.deploy.bind(adapterOperations),
      fetch: async args => adapterOperations.fetch(args),
      deployModifiers: adapterOperations.deployModifiers,
      fixElements: adapterOperations.fixElements.bind(adapterOperations),
    }
  },
  validateCredentials: async config =>
    validateCredentials(credentialsFromConfig(config), {
      createConnection,
    }),
  authenticationMethods: () => ({
    basic: {
      credentialsType: accessTokenCredentialsType,
    },
  }),
  configType,
  getCustomReferences: combineCustomReferenceGetters(
    _.mapValues(weakReferenceHandlers, handler => handler.findWeakReferences),
  ),
}
