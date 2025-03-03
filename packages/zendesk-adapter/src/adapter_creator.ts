/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import {
  InstanceElement,
  Adapter,
  Values,
  OAuthRequestParameters,
  OauthAccessTokenResponse,
} from '@salto-io/adapter-api'
import {
  client as clientUtils,
  combineCustomReferenceGetters,
  config as configUtils,
  definitions,
} from '@salto-io/adapter-components'
import { inspectValue } from '@salto-io/adapter-utils'
import ZendeskAdapter from './adapter'
import { basicCredentialsType, Credentials, oauthAccessTokenCredentialsType, oauthRequestParametersType } from './auth'
import {
  configType,
  ZendeskConfig,
  CLIENT_CONFIG,
  FETCH_CONFIG,
  validateFetchConfig,
  validateOmitInactiveConfig,
  API_DEFINITIONS_CONFIG,
  DEFAULT_CONFIG,
  GUIDE_SUPPORTED_TYPES,
  DEPLOY_CONFIG,
  validateFixElementsConfig,
} from './config'
import { ZendeskFetchConfig, ZendeskFixElementsConfig } from './user_config'
import ZendeskClient from './client/client'
import { createConnection, instanceUrl } from './client/connection'
import { configCreator } from './config_creator'
import { customReferenceHandlers } from './custom_references'

const log = logger(module)
const { validateCredentials } = clientUtils
const { validateClientConfig, mergeWithDefaultConfig, updateElemIDDefinitions } = definitions
const { validateDuckTypeApiDefinitionConfig } = configUtils
const { validateDefaultMissingUserFallbackConfig } = definitions

/*

Steps for OAuth authentication in zendesk:
1. add oauth client in https://{subdomain}.zendesk.com/admin/apps-integrations/apis/apis/oauth_clients/
  - specify "client name" and "redirect url" and click save

2. go to this page:
https://{subdomain}.zendesk.com/oauth/authorizations/new?response_type=token&redirect_uri={your_redirect_url}&client_id={your_unique_identifier}&scope=read%20write

  you'll be redirect to zendesk authorizing page.

3. click "Allow". you'll be redirected to your "redirect url" with "access_token" url parameter.

4. make API calls with your access token:
curl https://{subdomain}.zendesk.com/api/v2/tickets.json \
  -H "Authorization: Bearer {access_token}"

see https://support.zendesk.com/hc/en-us/articles/4408845965210 for more information

*/

const EMAIL_REGEX = /^[\w+]+([.-]?[\w+]+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/
const credentialsFromConfig = (config: Readonly<InstanceElement>): Credentials => {
  const domain = config.value.domain === undefined || config.value.domain === '' ? undefined : config.value.domain
  if (config.value.authType === 'oauth') {
    return {
      accessToken: config.value.accessToken,
      subdomain: config.value.subdomain,
      domain,
    }
  }
  return {
    username: config.value.username,
    password: config.value.password,
    token: config.value.token,
    subdomain: config.value.subdomain,
    domain,
  }
}

export const createUrlFromUserInput = (value: Values): string => {
  const { subdomain, domain, port, clientId } = value
  return `${instanceUrl(subdomain, domain)}/oauth/authorizations/new?response_type=token&redirect_uri=http://localhost:${port}&client_id=${clientId}&scope=read%20write`
}

const createOAuthRequest = (userInput: InstanceElement): OAuthRequestParameters => ({
  url: createUrlFromUserInput(userInput.value),
  oauthRequiredFields: ['access_token'],
})

const isValidUser = (user: string): boolean => EMAIL_REGEX.test(user)

const adapterConfigFromConfig = (config: Readonly<InstanceElement> | undefined): ZendeskConfig => {
  const configValue = config?.value ?? {}
  const isGuideDisabled = config?.value.fetch.guide === undefined
  DEFAULT_CONFIG.apiDefinitions.supportedTypes = isGuideDisabled
    ? DEFAULT_CONFIG.apiDefinitions.supportedTypes
    : { ...DEFAULT_CONFIG.apiDefinitions.supportedTypes, ...GUIDE_SUPPORTED_TYPES }
  const apiDefinitions = mergeWithDefaultConfig(
    DEFAULT_CONFIG.apiDefinitions,
    config?.value.apiDefinitions,
  ) as configUtils.AdapterDuckTypeApiConfig

  const fetch = mergeWithDefaultConfig(DEFAULT_CONFIG.fetch, config?.value.fetch) as ZendeskFetchConfig
  const useNewInfra = configValue.fetch?.useNewInfra
  if (useNewInfra !== false) {
    const configForNewInfra = config?.clone()
    const updatedElemIDs = updateElemIDDefinitions(configForNewInfra?.value?.apiDefinitions)
    if (updatedElemIDs?.elemID !== undefined) {
      if (fetch.elemID !== undefined) {
        log.debug('fetch.elemId is defined and is going to be merged with data from the api_definition')
      }
      const mergedElemIDConfig = _.merge(_.pick(fetch, 'elemID'), updatedElemIDs)
      fetch.elemID = mergedElemIDConfig.elemID
      log.debug(`elemId config has changes and equal to: ${inspectValue(fetch.elemID)}`)
    }
  }

  const adapterConfig: { [K in keyof Required<ZendeskConfig>]: ZendeskConfig[K] } = {
    client: configValue.client,
    fetch,
    deploy: configValue.deploy,
    apiDefinitions,
    fixElements: mergeWithDefaultConfig(
      DEFAULT_CONFIG.fixElements ?? {},
      configValue.fixElements,
    ) as ZendeskFixElementsConfig,
  }

  validateClientConfig(CLIENT_CONFIG, adapterConfig.client)
  validateFixElementsConfig(adapterConfig.fixElements)
  validateFetchConfig(FETCH_CONFIG, adapterConfig.fetch, apiDefinitions)
  validateDuckTypeApiDefinitionConfig(API_DEFINITIONS_CONFIG, apiDefinitions)
  validateOmitInactiveConfig(adapterConfig.fetch.omitInactive, apiDefinitions)
  if (adapterConfig.deploy !== undefined) {
    validateDefaultMissingUserFallbackConfig(DEPLOY_CONFIG, adapterConfig.deploy, isValidUser)
  }

  Object.keys(configValue)
    .filter(k => !Object.keys(adapterConfig).includes(k))
    .forEach(k => log.debug('Unknown config property was found: %s', k))
  return adapterConfig
}

export const adapter: Adapter = {
  operations: context => {
    const config = adapterConfigFromConfig(context.config)
    const credentials = credentialsFromConfig(context.credentials)
    const adapterOperations = new ZendeskAdapter({
      client: new ZendeskClient({
        credentials,
        config: config[CLIENT_CONFIG],
        allowOrganizationNames: config[FETCH_CONFIG].resolveOrganizationIDs,
      }),
      credentials,
      config,
      getElemIdFunc: context.getElemIdFunc,
      configInstance: context.config,
      elementsSource: context.elementsSource,
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
  authenticationMethods: {
    basic: {
      credentialsType: basicCredentialsType,
    },
    oauth: {
      createOAuthRequest,
      credentialsType: oauthAccessTokenCredentialsType,
      oauthRequestParameters: oauthRequestParametersType,
      createFromOauthResponse: async (inputConfig: Values, response: OauthAccessTokenResponse) => {
        const { subdomain, domain } = inputConfig
        const { accessToken } = response.fields
        return {
          subdomain,
          domain,
          accessToken,
        }
      },
    },
  },
  configType,
  configCreator,
  getCustomReferences: combineCustomReferenceGetters(
    _.mapValues(customReferenceHandlers, handler => handler.findWeakReferences),
  ),
}
