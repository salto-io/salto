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
import { FieldDefinition, ObjectType, ElemID, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { createMatchingObjectType } from '@salto-io/adapter-utils'
import { createClientConfigType, ClientBaseConfig, ClientRateLimitConfig } from './client_config'
import { UserFetchConfig, createUserFetchConfigType } from './fetch_config'
import { UserDeployConfig, createChangeValidatorConfigType, createUserDeployConfigType } from './deploy_config'

export type UserConfig = {
  client: ClientBaseConfig<ClientRateLimitConfig>
  fetch: UserFetchConfig
  deploy?: UserDeployConfig
}

export type ConfigTypeCreator = (args: {
  adapterName: string
  defaultConfig?: Partial<UserConfig>
  additionalFields?: Record<string, FieldDefinition>
  additionalFetchFields?: Record<string, FieldDefinition>
  additionalDeployFields?: Record<string, FieldDefinition>
  additionalClientFields?: Record<string, FieldDefinition>
  changeValidatorNames?: string[]
  omitElemID?: boolean
}) => ObjectType

export const createUserConfigType: ConfigTypeCreator = ({
  adapterName,
  defaultConfig,
  changeValidatorNames = [],
  additionalFields,
  additionalFetchFields,
  additionalDeployFields,
  additionalClientFields,
  omitElemID,
}) =>
  createMatchingObjectType<Partial<UserConfig>>({
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
