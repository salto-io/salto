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
import { InstanceElement, Adapter, Values, OAuthRequestParameters, OauthAccessTokenResponse } from '@salto-io/adapter-api'
import { client as clientUtils, config as configUtils } from '@salto-io/adapter-components'
import ZendeskAdapter from './adapter'
import { Credentials, oauthAccessTokenCredentialsType, oauthRequestParametersType, usernamePasswordCredentialsType } from './auth'
import {
  configType, ZendeskConfig, CLIENT_CONFIG, FETCH_CONFIG, DEFAULT_TYPES, DEFAULT_ID_FIELDS,
  FIELDS_TO_OMIT,
  validateFetchConfig,
  API_DEFINITIONS_CONFIG,
} from './config'
import ZendeskClient from './client/client'
import { createConnection } from './client/connection'

const log = logger(module)
const { validateCredentials, validateClientConfig } = clientUtils
const { validateDuckTypeApiDefinitionConfig } = configUtils

/*

Steps for OAuth authentication in zendesk:
1. add oauth client in https://{subdomain}.zendesk.com/admin/apps-integrations/apis/apis/oauth_clients/
  - specify "client name" and "redirect url" and click save
  - keep the generated oauth token - it's your salto client's secret

2. go to this page:
https://{subdomain}.zendesk.com/oauth/authorizations/new?response_type=token&redirect_uri={your_redirect_url}&client_id={your_unique_identifier}&scope=read%20write

  you'll be redirect to zendesk authorizing page.

3. click "Allow". you'll be redirected to your "redirect url" with "access_token" url parameter.

4. make API calls with your access token:
curl https://{subdomain}.zendesk.com/api/v2/tickets.json \
  -H "Authorization: Bearer {access_token}"

*/

const credentialsFromConfig = (config: Readonly<InstanceElement>): Credentials => {
  if (config.value.authType === 'oauth') {
    return {
      accessToken: config.value.accessToken,
      subdomain: config.value.subdomain,
    }
  }
  return {
    username: config.value.username,
    password: config.value.password,
    subdomain: config.value.subdomain,
  }
}

export const createUrlFromUserInput = (value: Values): string => {
  const { subdomain, port, clientId } = value
  return `https://${subdomain}.zendesk.com/oauth/authorizations/new?response_type=token&redirect_uri=http://localhost:${port}&client_id=${clientId}&scope=read%20write`
}

const createOAuthRequest = (userInput: InstanceElement): OAuthRequestParameters => ({
  url: createUrlFromUserInput(userInput.value),
  oauthRequiredFields: ['access_token'],
})

const adapterConfigFromConfig = (config: Readonly<InstanceElement> | undefined): ZendeskConfig => {
  const configValue = config?.value ?? {}
  const apiDefinitions: configUtils.AdapterDuckTypeApiConfig = _.defaults(
    {}, configValue.apiDefinitions, {
      typeDefaults: {
        transformation: {
          idFields: DEFAULT_ID_FIELDS,
          fieldsToOmit: FIELDS_TO_OMIT,
        },
      },
      types: DEFAULT_TYPES,
    }
  )

  const adapterConfig: { [K in keyof Required<ZendeskConfig>]: ZendeskConfig[K] } = {
    client: configValue.client,
    fetch: configValue.fetch,
    apiDefinitions,
  }

  validateClientConfig(CLIENT_CONFIG, adapterConfig.client)
  validateFetchConfig(FETCH_CONFIG, adapterConfig.fetch, apiDefinitions)
  validateDuckTypeApiDefinitionConfig(API_DEFINITIONS_CONFIG, apiDefinitions)

  Object.keys(configValue)
    .filter(k => !Object.keys(adapterConfig).includes(k))
    .forEach(k => log.debug('Unknown config property was found: %s', k))
  return adapterConfig
}

export const adapter: Adapter = {
  operations: context => {
    const config = adapterConfigFromConfig(context.config)
    const credentials = credentialsFromConfig(context.credentials)
    return new ZendeskAdapter({
      client: new ZendeskClient({
        credentials,
        config: config[CLIENT_CONFIG],
      }),
      config,
    })
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
        const { subdomain } = inputConfig
        const { accessToken } = response.fields
        return {
          subdomain,
          accessToken,
        }
      },
    },
  },
  configType,
}
