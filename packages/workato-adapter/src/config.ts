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
import { ElemID, ObjectType, CORE_ANNOTATIONS, BuiltinTypes, ListType, MapType } from '@salto-io/adapter-api'
import { config as configUtils, definitions, elements } from '@salto-io/adapter-components'
import { createMatchingObjectType } from '@salto-io/adapter-utils'
import {
  WORKATO,
  PROPERTY_TYPE,
  ROLE_TYPE,
  API_COLLECTION_TYPE,
  FOLDER_TYPE,
  RECIPE_TYPE,
  CONNECTION_TYPE,
  API_ENDPOINT_TYPE,
  API_CLIENT_TYPE,
  API_ACCESS_PROFILE_TYPE,
  RECIPE_CODE_TYPE,
} from './constants'

type UserDeployConfig = definitions.UserDeployConfig

const { createClientConfigType } = definitions
const { createDucktypeAdapterApiConfigType, validateDuckTypeFetchConfig } = configUtils

export const DEFAULT_SERVICE_ID_FIELD = 'id'
export const DEFAULT_ID_FIELDS = ['name']
export const DEFAULT_FIELDS_TO_OMIT: configUtils.FieldToOmitType[] = [
  { fieldName: 'created_at', fieldType: 'string' },
  { fieldName: 'updated_at', fieldType: 'string' },
  { fieldName: 'extended_input_schema' },
  { fieldName: 'extended_output_schema' },
]
export const FETCH_V2_FIELDS_TO_OMIT: configUtils.FieldToOmitType[] = [
  { fieldName: 'created_at', fieldType: 'string' },
  { fieldName: 'updated_at', fieldType: 'string' },
  { fieldName: 'dynamicPickListSelection' },
  { fieldName: 'visible_config_fields' },
]
export const RECIPE_FIELDS_TO_OMIT: configUtils.FieldToOmitType[] = [
  { fieldName: 'last_run_at' },
  { fieldName: 'job_succeeded_count' },
  { fieldName: 'job_failed_count' },
  { fieldName: 'copy_count' },
  { fieldName: 'lifetime_task_count' },
]
export const CONNECTION_FIELDS_TO_OMIT: configUtils.FieldToOmitType[] = [
  { fieldName: 'authorized_at', fieldType: 'string' },
  { fieldName: 'authorization_status', fieldType: 'string' },
]
export const FIELDS_TO_HIDE: configUtils.FieldToHideType[] = []

export const CLIENT_CONFIG = 'client'
export const FETCH_CONFIG = 'fetch'
export const DEPLOY_CONFIG = 'deploy'
export const API_DEFINITIONS_CONFIG = 'apiDefinitions'

export type WorkatoClientConfig = definitions.ClientBaseConfig<definitions.ClientRateLimitConfig>

export type WorkatoFetchConfig = definitions.UserFetchConfig & {
  serviceConnectionNames?: Record<string, string[]>
  enableFetchSturctureV2?: boolean
}
export type WorkatoApiConfig = configUtils.AdapterDuckTypeApiConfig

export type WorkatoConfig = {
  [CLIENT_CONFIG]?: WorkatoClientConfig
  [FETCH_CONFIG]: WorkatoFetchConfig
  [API_DEFINITIONS_CONFIG]: WorkatoApiConfig
  [DEPLOY_CONFIG]?: UserDeployConfig
}

export const SUPPORTED_TYPES = {
  [API_ACCESS_PROFILE_TYPE]: [API_ACCESS_PROFILE_TYPE],
  [API_CLIENT_TYPE]: [API_CLIENT_TYPE],
  [API_ENDPOINT_TYPE]: [API_ENDPOINT_TYPE],
  [API_COLLECTION_TYPE]: [API_COLLECTION_TYPE],
  [CONNECTION_TYPE]: [CONNECTION_TYPE],
  [FOLDER_TYPE]: [FOLDER_TYPE],
  [PROPERTY_TYPE]: [PROPERTY_TYPE],
  [RECIPE_TYPE]: [RECIPE_TYPE],
  [ROLE_TYPE]: [ROLE_TYPE],
}

export const DEFAULT_TYPES: Record<string, configUtils.TypeDuckTypeConfig> = {
  [CONNECTION_TYPE]: {
    request: {
      url: '/connections',
    },
    transformation: {
      fieldsToHide: [...FIELDS_TO_HIDE, { fieldName: 'id' }],
      fieldsToOmit: [...DEFAULT_FIELDS_TO_OMIT, ...CONNECTION_FIELDS_TO_OMIT],
    },
  },
  [RECIPE_TYPE]: {
    request: {
      url: '/recipes',
      paginationField: 'since_id',
    },
    transformation: {
      idFields: ['name', '&folder_id'],
      fieldsToHide: [...FIELDS_TO_HIDE, { fieldName: 'id' }, { fieldName: 'user_id' }],
      fieldsToOmit: [...DEFAULT_FIELDS_TO_OMIT, ...RECIPE_FIELDS_TO_OMIT],
      standaloneFields: [{ fieldName: 'code', parseJSON: true }],
    },
  },
  [RECIPE_CODE_TYPE]: {
    transformation: {
      idFields: [], // there is one code per recipe, so no need for additional details
      extendsParentId: true,
    },
  },
  [FOLDER_TYPE]: {
    request: {
      url: '/folders',
      recursiveQueryByResponseField: {
        // eslint-disable-next-line camelcase
        parent_id: 'id',
      },
      paginationField: 'page',
    },
    transformation: {
      idFields: ['name', '&parent_id'],
      fieldsToHide: [...FIELDS_TO_HIDE, { fieldName: 'id' }],
    },
  },
  [API_COLLECTION_TYPE]: {
    request: {
      url: '/api_collections',
      paginationField: 'page',
    },
    transformation: {
      fieldsToHide: [...FIELDS_TO_HIDE, { fieldName: 'id' }],
    },
  },
  [API_ENDPOINT_TYPE]: {
    request: {
      url: '/api_endpoints',
      paginationField: 'page',
    },
    transformation: {
      idFields: ['name', 'base_path'],
      fieldsToHide: [...FIELDS_TO_HIDE, { fieldName: 'id' }],
    },
  },
  [API_CLIENT_TYPE]: {
    request: {
      url: '/api_clients',
      paginationField: 'page',
    },
    transformation: {
      fieldsToHide: [...FIELDS_TO_HIDE, { fieldName: 'id' }],
    },
  },
  [API_ACCESS_PROFILE_TYPE]: {
    request: {
      url: '/api_access_profiles',
      paginationField: 'page',
    },
    transformation: {
      fieldsToHide: [...FIELDS_TO_HIDE, { fieldName: 'id' }],
    },
  },
  [ROLE_TYPE]: {
    request: {
      url: '/roles',
    },
    transformation: {
      fieldsToHide: [...FIELDS_TO_HIDE, { fieldName: 'id' }],
    },
  },
  [PROPERTY_TYPE]: {
    request: {
      url: '/properties',
      queryParams: {
        prefix: '',
      },
    },
    transformation: {
      hasDynamicFields: true,
      isSingleton: true,
    },
  },
}

export const getDefaultTypes = (
  fieldsToOmit: configUtils.FieldToOmitType[] = DEFAULT_FIELDS_TO_OMIT,
): Record<string, configUtils.TypeDuckTypeConfig> => {
  const defaultTypes = _.cloneDeep(DEFAULT_TYPES)
  const connectionTransformation = defaultTypes[CONNECTION_TYPE].transformation
  if (connectionTransformation !== undefined) {
    connectionTransformation.fieldsToOmit = [...fieldsToOmit, ...CONNECTION_FIELDS_TO_OMIT]
  }
  const recipeTransformation = defaultTypes[RECIPE_TYPE].transformation
  if (recipeTransformation !== undefined) {
    recipeTransformation.fieldsToOmit = [...fieldsToOmit, ...RECIPE_FIELDS_TO_OMIT]
  }
  return defaultTypes
}

export const DEFAULT_CONFIG: WorkatoConfig = {
  [FETCH_CONFIG]: {
    ...elements.query.INCLUDE_ALL_CONFIG,
    hideTypes: true,
  },
  [API_DEFINITIONS_CONFIG]: {
    typeDefaults: {
      transformation: {
        idFields: DEFAULT_ID_FIELDS,
        fieldsToOmit: DEFAULT_FIELDS_TO_OMIT,
        serviceIdField: DEFAULT_SERVICE_ID_FIELD,
        // TODO: change this to true for SALTO-3884.
        nestStandaloneInstances: false,
      },
    },
    types: DEFAULT_TYPES,
    supportedTypes: SUPPORTED_TYPES,
  },
}

export const getDefaultConfig = (DeploySupported = false): WorkatoConfig => {
  if (DeploySupported) {
    const defaultConfig = _.cloneDeep(DEFAULT_CONFIG)
    defaultConfig[FETCH_CONFIG].enableFetchSturctureV2 = true
    if (defaultConfig[API_DEFINITIONS_CONFIG].typeDefaults.transformation !== undefined) {
      defaultConfig[API_DEFINITIONS_CONFIG].typeDefaults.transformation.fieldsToOmit =
        FETCH_V2_FIELDS_TO_OMIT
    }
    if (defaultConfig[API_DEFINITIONS_CONFIG].types !== undefined) {
      defaultConfig[API_DEFINITIONS_CONFIG].types = getDefaultTypes(FETCH_V2_FIELDS_TO_OMIT)
    }
    return defaultConfig
  }
  return DEFAULT_CONFIG
}

export type ChangeValidatorName = 'deployNotSupported'

type ChangeValidatorConfig = Partial<Record<ChangeValidatorName, boolean>>

const changeValidatorConfigType = createMatchingObjectType<ChangeValidatorConfig>({
  elemID: new ElemID(WORKATO, 'changeValidatorConfig'),
  fields: {
    deployNotSupported: { refType: BuiltinTypes.BOOLEAN },
  },
  annotations: {
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

export const configType = new ObjectType({
  elemID: new ElemID(WORKATO),
  fields: {
    [CLIENT_CONFIG]: {
      refType: createClientConfigType(WORKATO),
    },
    [FETCH_CONFIG]: {
      refType: definitions.createUserFetchConfigType({
        adapterName: WORKATO,
        additionalFields: {
          serviceConnectionNames: {
            refType: new MapType(new ListType(BuiltinTypes.STRING)),
          },
          enableDeploySupport: { refType: BuiltinTypes.BOOLEAN },
        },
        omitElemID: true,
      }),
    },
    [API_DEFINITIONS_CONFIG]: {
      refType: createDucktypeAdapterApiConfigType({ adapter: WORKATO }),
    },
    [DEPLOY_CONFIG]: {
      refType: definitions.createUserDeployConfigType(WORKATO, changeValidatorConfigType),
    },
  },
  annotations: {
    [CORE_ANNOTATIONS.DEFAULT]: _.omit(getDefaultConfig(), API_DEFINITIONS_CONFIG, `${FETCH_CONFIG}.hideTypes`),
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

export type FilterContext = {
  [FETCH_CONFIG]: WorkatoFetchConfig
  [API_DEFINITIONS_CONFIG]: WorkatoApiConfig
}

export const validateFetchConfig = (
  fetchConfigPath: string,
  userFetchConfig: WorkatoFetchConfig,
  adapterApiConfig: configUtils.AdapterApiConfig,
): void => {
  validateDuckTypeFetchConfig(fetchConfigPath, userFetchConfig, adapterApiConfig)
}
