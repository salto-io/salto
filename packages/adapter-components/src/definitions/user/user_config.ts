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
import { FieldDefinition, ObjectType, ElemID, CORE_ANNOTATIONS, InstanceElement } from '@salto-io/adapter-api'
import { createMatchingObjectType } from '@salto-io/adapter-utils'
import { createClientConfigType, ClientBaseConfig, ClientRateLimitConfig, validateClientConfig } from './client_config'
import { DefaultFetchCriteria, UserFetchConfig, createUserFetchConfigType } from './fetch_config'
import { UserDeployConfig, createChangeValidatorConfigType, createUserDeployConfigType } from './deploy_config'

export type UserConfig<
  TCustomNameMappingOptions extends string = never,
  TClient extends ClientBaseConfig<ClientRateLimitConfig> = ClientBaseConfig<ClientRateLimitConfig>,
  TFetch extends UserFetchConfig<{
    customNameMappingOptions: TCustomNameMappingOptions
    fetchCriteria: DefaultFetchCriteria
  }> = UserFetchConfig<{
    customNameMappingOptions: TCustomNameMappingOptions
    fetchCriteria: DefaultFetchCriteria
  }>,
  TDeploy extends UserDeployConfig = UserDeployConfig,
> = {
  client: TClient
  fetch: TFetch
  deploy?: TDeploy
}

type ConfigTypeCreatorParams<TCustomNameMappingOptions extends string = never> = {
  adapterName: string
  defaultConfig?: Partial<UserConfig<TCustomNameMappingOptions>>
  additionalFields?: Record<string, FieldDefinition>
  additionalFetchFields?: Record<string, FieldDefinition>
  additionalDeployFields?: Record<string, FieldDefinition>
  additionalClientFields?: Record<string, FieldDefinition>
  changeValidatorNames?: string[]
  omitElemID?: boolean
}

export type ConfigTypeCreator<TCustomNameMappingOptions extends string = never> = (
  args: ConfigTypeCreatorParams<TCustomNameMappingOptions>,
) => ObjectType

export const createUserConfigType = <TCustomNameMappingOptions extends string = never>({
  adapterName,
  defaultConfig,
  changeValidatorNames = [],
  additionalFields,
  additionalFetchFields,
  additionalDeployFields,
  additionalClientFields,
  omitElemID,
}: ConfigTypeCreatorParams<TCustomNameMappingOptions>): ObjectType =>
  createMatchingObjectType<Partial<UserConfig<TCustomNameMappingOptions>>>({
    elemID: new ElemID(adapterName),
    fields: {
      client: {
        refType: createClientConfigType(adapterName, undefined, additionalClientFields),
      },
      fetch: {
        refType: createUserFetchConfigType({
          adapterName,
          additionalFields: additionalFetchFields,
          omitElemID,
        }),
      },
      deploy: {
        refType: createUserDeployConfigType(
          adapterName,
          createChangeValidatorConfigType({ adapterName, changeValidatorNames }),
          additionalDeployFields,
        ),
      },
      ...additionalFields,
    },
    annotations: {
      [CORE_ANNOTATIONS.DEFAULT]: defaultConfig,
      [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
    },
  })

export const adapterConfigFromConfig = <
  TCustomNameMappingOptions extends string,
  Co extends UserConfig<TCustomNameMappingOptions>,
>(
  config: Readonly<InstanceElement> | undefined,
  defaultConfig: Co,
): Co & UserConfig<TCustomNameMappingOptions> => {
  // TODO extend validations SALTO-5584
  const adapterConfig = _.defaults({}, config?.value, defaultConfig)
  validateClientConfig('client', config?.value?.client)
  return adapterConfig
}
