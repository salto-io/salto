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
import { FieldDefinition, ObjectType, ElemID, CORE_ANNOTATIONS, InstanceElement, Values } from '@salto-io/adapter-api'
import { createMatchingObjectType, safeJsonStringify } from '@salto-io/adapter-utils'
import { objects } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { createClientConfigType, ClientBaseConfig, ClientRateLimitConfig, validateClientConfig } from './client_config'
import { DefaultFetchCriteria, ElemIDCustomization, UserFetchConfig, createUserFetchConfigType } from './fetch_config'
import { UserDeployConfig, createChangeValidatorConfigType, createUserDeployConfigType } from './deploy_config'
import { AdapterApiConfig, dereferenceFieldName, isReferencedIdField } from '../../config_deprecated'

const log = logger(module)

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
  client?: TClient
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

export const mergeWithDefaultConfig = (defaultConfig: Values, config?: Values): Values =>
  _.mergeWith(_.cloneDeep(defaultConfig), config ?? {}, (_firstVal, secondValue) =>
    Array.isArray(secondValue) ? secondValue : undefined,
  )

export const adapterConfigFromConfig = <
  TCustomNameMappingOptions extends string,
  Co extends UserConfig<TCustomNameMappingOptions>,
>(
  config: Readonly<InstanceElement> | undefined,
  defaultConfig: Co,
): Co & UserConfig<TCustomNameMappingOptions> => {
  // TODO extend validations SALTO-5584
  validateClientConfig('client', config?.value?.client)
  const client = mergeWithDefaultConfig(defaultConfig.client ?? {}, config?.value?.client)

  const fetch = _.defaults({}, config?.value?.fetch, defaultConfig.fetch)

  const deploy = mergeWithDefaultConfig(defaultConfig.deploy ?? {}, config?.value?.deploy)

  const additionalConfigProps = mergeWithDefaultConfig(
    _.omit(defaultConfig, ['client', 'fetch', 'deploy']),
    _.omit(config?.value, ['client', 'fetch', 'deploy']),
  )

  const adapterConfig = {
    fetch,
    deploy,
    client,
    ...additionalConfigProps,
  }

  return adapterConfig as Co & UserConfig<TCustomNameMappingOptions>
}

/**
 * Convert elemID definitions from deprecated apiDefinitions to the new format
 * Note: 
 * 1. config is changed in place
 * 2. only elemID related definitions are converted
 */
const updateElemIDDefinitions = <TCustomNameMappingOptions extends string>(
  apiDefinitions: AdapterApiConfig,
): Record<string, ElemIDCustomization<TCustomNameMappingOptions>> => {
  const { types } = apiDefinitions
  if (_.isEmpty(types)) {
    return {}
  }

  const convertedIds = _.mapValues(types, (defs, typeName) => {
    const transformationConfig = defs.transformation
    if (!transformationConfig) {
      return undefined
    }
    const updatedElemIDConfig: ElemIDCustomization<TCustomNameMappingOptions> = {}
    const { idFields, extendsParentId, nameMapping } = transformationConfig
    if (extendsParentId !== undefined) {
      updatedElemIDConfig.extendsParent = extendsParentId
      delete transformationConfig.extendsParentId
    }
    if (idFields !== undefined) {
      const updatedIdFields = idFields.map(fieldName =>
        isReferencedIdField(fieldName)
          ? { fieldName: dereferenceFieldName(fieldName), isReference: true }
          : { fieldName },
      )
      updatedElemIDConfig.parts = updatedIdFields
      delete transformationConfig.idFields
    }
    if (nameMapping !== undefined) {
      if (updatedElemIDConfig.parts) {
        updatedElemIDConfig.parts.forEach(part => _.set(part, 'mapping', nameMapping))
        delete transformationConfig.nameMapping
      } else {
        // handaling the case of when mappings exists but idFields are missing is not trivial, because we don't know which parts should be updated
        log.warn('found nameMapping without idFields for type %s', typeName)
      }
    }

    log.debug(
      'converted elemIDs definitions for type %s from %o to %o',
      typeName,
      _.pick(transformationConfig, ['idFields', 'extendsParentId', 'nameMapping']),
      updatedElemIDConfig,
    )
    return updatedElemIDConfig
  })

  const typesWithIds = _.omitBy(convertedIds, _.isEmpty)

  return _.isEmpty(typesWithIds) ? {} : { elemID: typesWithIds }
}

export const updateDeprecatedConfig = (
  config: InstanceElement,
): { config: InstanceElement; message: string } | undefined => {
  const apiDefs = config.value?.fetch?.apiDefinitions
  if (!apiDefs) {
    return undefined
  }

  log.warn('adapter config contains deprecated api definitions: %s', safeJsonStringify(apiDefs))
  const updatedConfig = config.clone()
  const updatedElemIDs = updateElemIDDefinitions(updatedConfig.value.fetch.apiDefinitions)
  if (_.isEmpty(updatedElemIDs)) {
    log.debug('found no elemID definitions to update in config')
    return undefined
  }
  
  const cleanedApiDefs = objects.cleanEmptyObjects(updatedConfig.value?.fetch?.apiDefinitions)
  updatedConfig.value = {
    ...updatedConfig.value,
    fetch: {
      ...updatedConfig.value.fetch,
      ...updatedElemIDs,
      apiDefinitions: cleanedApiDefs ? { ...cleanedApiDefs } : undefined,
    },
  }

  if (updatedConfig.value.fetch.apiDefinitions) {
    log.error('some deprecated apiDefinitions remained in config: %s', safeJsonStringify(updatedConfig.value.fetch.apiDefinitions))
  }
  return {
    config: updatedConfig,
    message:
      'The configuration options "apiDefinitions" is deprecated. The following changes will update the deprecated options to the "fetch" configuration option.',
  }
}
