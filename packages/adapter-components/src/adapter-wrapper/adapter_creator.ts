/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import { InstanceElement, Adapter, AdapterAuthentication } from '@salto-io/adapter-api'
import { types } from '@salto-io/lowerdash'
import { createCommonFilters } from '../filters/common_filters'
import { createClient } from '../client/client_creator'
import { AdapterImplConstructor } from './adapter/types'
import { createAdapterImpl } from './adapter/creator'
import { HTTPReadClientInterface, HTTPWriteClientInterface, ConnectionCreator } from '../client'
import {
  UserConfig,
  ApiDefinitions,
  ConfigTypeCreator,
  createUserConfigType,
  ClientRateLimitConfig,
} from '../definitions'
import { AdapterFilterCreator, FilterResult } from '../filter_utils'
import { defaultValidateCredentials } from '../credentials'
import { adapterConfigFromConfig } from '../definitions/user/user_config'
import { ClientDefaults } from '../client/http_client'

type ConfigCreator<Config> = (config?: Readonly<InstanceElement>) => Config
type ConnectionCreatorFromConfig<Credentials> = (config?: Readonly<InstanceElement>) => ConnectionCreator<Credentials>

export const createAdapter = <
  Credentials,
  Co extends UserConfig = UserConfig,
  ClientOptions extends string = 'main',
  PaginationOptions extends string | 'none' = 'none',
  AdditionalAction extends string = never,
>({
  adapterName,
  initialClients,
  definitionsCreator,
  authenticationMethods,
  validateCredentials,
  adapterImpl,
  defaultConfig,
  configTypeCreator,
  operationsCustomizations,
  clientDefaults,
}: {
  adapterName: string
  // helper for determining the names of all clients that should be created
  initialClients: Record<ClientOptions, undefined>
  authenticationMethods: AdapterAuthentication
  validateCredentials?: Adapter['validateCredentials']
  adapterImpl?: AdapterImplConstructor<Credentials, Co, ClientOptions, PaginationOptions, AdditionalAction>
  defaultConfig: Co
  definitionsCreator: (args: {
    clients: Record<string, HTTPReadClientInterface & HTTPWriteClientInterface>
    userConfig: Co
  }) => types.PickyRequired<
    ApiDefinitions<ClientOptions, PaginationOptions, AdditionalAction>,
    'clients' | 'pagination' | 'fetch'
  >
  configTypeCreator?: ConfigTypeCreator
  operationsCustomizations: {
    adapterConfigCreator?: (config: Readonly<InstanceElement> | undefined) => Co
    credentialsFromConfig: (config: Readonly<InstanceElement>) => Credentials
    connectionCreatorFromConfig: (config: Co['client']) => ConnectionCreator<Credentials>
    customizeFilterCreators?: (
      config: Co,
    ) => AdapterFilterCreator<UserConfig, FilterResult, {}, ClientOptions, PaginationOptions, AdditionalAction>[]
  }
  clientDefaults?: Partial<Omit<ClientDefaults<ClientRateLimitConfig>, 'pageSize'>>
}): Adapter => {
  const { adapterConfigCreator, credentialsFromConfig, connectionCreatorFromConfig, customizeFilterCreators } =
    operationsCustomizations

  const configCreator: ConfigCreator<Co> = config =>
    (adapterConfigCreator ?? adapterConfigFromConfig)(config, defaultConfig)
  const connectionCreator: ConnectionCreatorFromConfig<Credentials> = config =>
    connectionCreatorFromConfig(configCreator(config).client)

  return {
    operations: context => {
      const config = configCreator(context.config)
      const credentials = credentialsFromConfig(context.credentials)
      const clients = _.mapValues(initialClients, () =>
        createClient<Credentials>({
          adapterName,
          createConnection: connectionCreator(context.config),
          clientOpts: {
            credentials,
            config: config.client,
          },
          clientDefaults,
        }),
      )
      const definitions = definitionsCreator({ clients, userConfig: config })
      const adapterOperations = createAdapterImpl<Credentials, Co, ClientOptions, PaginationOptions, AdditionalAction>(
        {
          clients,
          config,
          getElemIdFunc: context.getElemIdFunc,
          definitions,
          elementSource: context.elementsSource,
          filterCreators:
            customizeFilterCreators !== undefined
              ? customizeFilterCreators(config)
              : Object.values(
                  createCommonFilters<UserConfig, ClientOptions, PaginationOptions, AdditionalAction>({
                    config,
                    definitions,
                  }),
                ),
          adapterName,
          configInstance: context.config,
        },
        adapterImpl,
      )

      return {
        deploy: adapterOperations.deploy.bind(adapterOperations),
        fetch: async args => {
          const fetchRes = await adapterOperations.fetch(args)
          return {
            ...fetchRes,
            updatedConfig: fetchRes.updatedConfig,
          }
        },
        deployModifiers: adapterOperations.deployModifiers,
        // TODO SALTO-5578 extend to other operations
      }
    },
    validateCredentials:
      validateCredentials ??
      (config =>
        defaultValidateCredentials({ createConnection: connectionCreator(config), credentialsFromConfig })(config)),
    authenticationMethods,
    configType: (configTypeCreator ?? createUserConfigType)({ adapterName, defaultConfig }),
  }
}
