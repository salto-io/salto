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
import { logger } from '@salto-io/logging'
import { InstanceElement, Adapter, Values, OAuthRequestParameters, OauthAccessTokenResponse, ElemID } from '@salto-io/adapter-api'
import { client as clientUtils, config as configUtils } from '@salto-io/adapter-components'
import ZendeskAdapter from './adapter'
import { Credentials, oauthAccessTokenCredentialsType, oauthRequestParametersType, usernamePasswordCredentialsType } from './auth'
import {
  configType,
  ZendeskConfig,
  CLIENT_CONFIG,
  FETCH_CONFIG,
  validateFetchConfig,
  API_DEFINITIONS_CONFIG,
  DEFAULT_CONFIG,
  ZendeskFetchConfig,
  validateGuideTypesConfig,
  GUIDE_SUPPORTED_TYPES,
  DEPLOY_CONFIG,
} from './config'
import ZendeskClient from './client/client'
import { createConnection, instanceUrl } from './client/connection'
import { configCreator } from './config_creator'

const log = logger(module)
const { validateCredentials, validateClientConfig } = clientUtils
const { validateDuckTypeApiDefinitionConfig, validateDeployConfig } = configUtils

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
  const domain = config.value.domain === undefined || config.value.domain === ''
    ? undefined
    : config.value.domain
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

const isValidUser = (user: string): boolean => (EMAIL_REGEX.test(user))

const adapterConfigFromConfig = (config: Readonly<InstanceElement> | undefined): ZendeskConfig => {
  const configValue = config?.value ?? {}
  const isGuideDisabled = config?.value.fetch.guide === undefined
  DEFAULT_CONFIG.apiDefinitions.supportedTypes = isGuideDisabled
    ? DEFAULT_CONFIG.apiDefinitions.supportedTypes
    : { ...DEFAULT_CONFIG.apiDefinitions.supportedTypes, ...GUIDE_SUPPORTED_TYPES }
  const apiDefinitions = configUtils.mergeWithDefaultConfig(
    DEFAULT_CONFIG.apiDefinitions,
    config?.value.apiDefinitions
  ) as configUtils.AdapterDuckTypeApiConfig

  const fetch = configUtils.mergeWithDefaultConfig(
    DEFAULT_CONFIG.fetch,
    config?.value.fetch
  ) as ZendeskFetchConfig

  const adapterConfig: { [K in keyof Required<ZendeskConfig>]: ZendeskConfig[K] } = {
    client: configValue.client,
    fetch,
    deploy: configValue.deploy,
    apiDefinitions,
  }

  validateClientConfig(CLIENT_CONFIG, adapterConfig.client)
  validateFetchConfig(FETCH_CONFIG, adapterConfig.fetch, apiDefinitions)
  validateDuckTypeApiDefinitionConfig(API_DEFINITIONS_CONFIG, apiDefinitions)
  validateGuideTypesConfig(apiDefinitions)
  if (adapterConfig.deploy !== undefined) {
    validateDeployConfig(DEPLOY_CONFIG, adapterConfig.deploy, isValidUser)
  }

  Object.keys(configValue)
    .filter(k => !Object.keys(adapterConfig).includes(k))
    .forEach(k => log.debug('Unknown config property was found: %s', k))
  return adapterConfig
}

export const adapter: Adapter = {
  operations: context => {
    // This can be removed once all the workspaces configs were migrated
    const updatedConfig = configUtils.configMigrations.migrateDeprecatedIncludeList(
      // Creating new instance is required because the type is not resolved in context.config
      new InstanceElement(
        ElemID.CONFIG_NAME,
        configType,
        context.config?.value
      ),
      DEFAULT_CONFIG,
    )
    const config = adapterConfigFromConfig(updatedConfig?.config[0] ?? context.config)
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
  validateCredentials: async config => validateCredentials(
    credentialsFromConfig(config),
    {
      createConnection,
    },
  ),
  authenticationMethods: {
    basic: {
      credentialsType: usernamePasswordCredentialsType,
    },
    oauth: {
      createOAuthRequest,
      credentialsType: oauthAccessTokenCredentialsType,
      oauthRequestParameters: oauthRequestParametersType,
      createFromOauthResponse: (inputConfig: Values, response: OauthAccessTokenResponse) => {
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
}
