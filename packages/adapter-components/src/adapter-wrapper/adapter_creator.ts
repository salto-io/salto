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
import { InstanceElement, Adapter, AdapterAuthentication, ChangeValidator } from '@salto-io/adapter-api'
import { FilterCreationArgs, createCommonFilters } from '../filters/common_filters'
import { createClient } from '../client/client_creator'
import { AdapterImplConstructor } from './adapter/types'
import { createAdapterImpl } from './adapter/creator'
import { HTTPReadClientInterface, HTTPWriteClientInterface, ConnectionCreator } from '../client'
import {
  UserConfig,
  ConfigTypeCreator,
  createUserConfigType,
  ClientRateLimitConfig,
  APIDefinitionsOptions,
  ResolveClientOptionsType,
  ResolveCustomNameMappingOptionsType,
} from '../definitions'
import { RequiredDefinitions } from '../definitions/system/types'
import { AdapterFilterCreator, FilterResult } from '../filter_utils'
import { defaultValidateCredentials } from '../credentials'
import { adapterConfigFromConfig } from '../definitions/user/user_config'
import { ClientDefaults } from '../client/http_client'
import { AdapterImpl } from './adapter/adapter'
import { getResolverCreator } from '../references/resolver_creator'
import { ConvertError } from '../deployment'

type ConfigCreator<Config> = (config?: Readonly<InstanceElement>) => Config
type ConnectionCreatorFromConfig<Credentials> = (config?: Readonly<InstanceElement>) => ConnectionCreator<Credentials>

export const createAdapter = <
  Credentials,
  Options extends APIDefinitionsOptions,
  Co extends UserConfig<ResolveCustomNameMappingOptionsType<Options>>,
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
  customConvertError,
}: {
  adapterName: string
  // helper for determining the names of all clients that should be created
  initialClients: Record<ResolveClientOptionsType<Options>, undefined | ConnectionCreator<Credentials>>
  authenticationMethods: AdapterAuthentication
  validateCredentials?: Adapter['validateCredentials']
  adapterImpl?: AdapterImplConstructor<Credentials, Options, Co>
  defaultConfig: Co
  definitionsCreator: (args: {
    clients: Record<string, HTTPReadClientInterface & HTTPWriteClientInterface>
    userConfig: Co
  }) => RequiredDefinitions<Options>
  configTypeCreator?: ConfigTypeCreator<ResolveCustomNameMappingOptionsType<Options>>
  operationsCustomizations: {
    adapterConfigCreator?: (config: Readonly<InstanceElement> | undefined) => Co
    credentialsFromConfig: (config: Readonly<InstanceElement>) => Credentials
    connectionCreatorFromConfig: (config: Co['client']) => ConnectionCreator<Credentials>
    customizeFilterCreators?: (
      args: FilterCreationArgs<Options, Co>,
    ) => Record<string, AdapterFilterCreator<Co, FilterResult, {}, Options>>
    additionalChangeValidators?: Record<string, ChangeValidator>
  }
  clientDefaults?: Partial<Omit<ClientDefaults<ClientRateLimitConfig>, 'pageSize'>>
  customConvertError?: ConvertError
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
      const clients = _.mapValues(initialClients, createConnection =>
        createClient<Credentials>({
          adapterName,
          createConnection: createConnection ?? connectionCreator(context.config),
          clientOpts: {
            credentials,
            config: config.client,
          },
          clientDefaults,
        }),
      )
      const definitions = definitionsCreator({ clients, userConfig: config })
      const resolverCreator = getResolverCreator(definitions)

      const adapterOperations = createAdapterImpl<Credentials, Options, Co>(
        {
          clients,
          config,
          getElemIdFunc: context.getElemIdFunc,
          definitions,
          elementSource: context.elementsSource,
          referenceResolver: resolverCreator,
          filterCreators: Object.values(
            (customizeFilterCreators ?? createCommonFilters)({
              config,
              definitions,
              fieldReferenceResolverCreator: resolverCreator,
              convertError: customConvertError,
            }),
          ),
          adapterName,
          configInstance: context.config,
          additionalChangeValidators: operationsCustomizations.additionalChangeValidators,
        },
        adapterImpl ?? AdapterImpl,
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
