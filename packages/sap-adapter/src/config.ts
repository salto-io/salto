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
import _ from 'lodash'
import { ElemID, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { createMatchingObjectType } from '@salto-io/adapter-utils'
import { client as clientUtils, config as configUtils, elements } from '@salto-io/adapter-components'
import { SAP } from './constants'

const { createClientConfigType } = clientUtils
const {
  createUserFetchConfigType,
  createDucktypeAdapterApiConfigType,
  validateDuckTypeFetchConfig,
} = configUtils

export const DEFAULT_ID_FIELDS = ['name']
export const DEFAULT_FILENAME_FIELDS = [...DEFAULT_ID_FIELDS]
export const DEFAULT_SERVICE_ID_FIELD = 'id'
export const FIELDS_TO_OMIT: configUtils.FieldToOmitType[] = [
  // { fieldName: 'url', fieldType: 'string' },
]
export const FIELDS_TO_HIDE: configUtils.FieldToHideType[] = [
  // { fieldName: 'created_at', fieldType: 'string' },
  // { fieldName: 'updated_at', fieldType: 'string' },
  // { fieldName: 'created_by_id' },
  // { fieldName: 'updated_by_id' },
]
export const PAGE_SIZE = 100

export const CLIENT_CONFIG = 'client'
export const FETCH_CONFIG = 'fetch'
export const DEPLOY_CONFIG = 'deploy'

export const API_DEFINITIONS_CONFIG = 'apiDefinitions'

export type SAPClientConfig = clientUtils.ClientBaseConfig<clientUtils.ClientRateLimitConfig>

export type SAPFetchConfig = configUtils.UserFetchConfig
export type SAPApiConfig = configUtils.AdapterApiConfig<configUtils.DuckTypeTransformationConfig>

export type SAPConfig = {
  [CLIENT_CONFIG]?: SAPClientConfig
  [FETCH_CONFIG]: SAPFetchConfig
  [API_DEFINITIONS_CONFIG]: SAPApiConfig
}

export const DEFAULT_TYPES: SAPApiConfig['types'] = {
  groups: {
    request: {
      url: '/api/v2/groups',
    },
    transformation: {
      dataField: 'groups',
    },
  },
  group: {
    transformation: {
      sourceTypeName: 'groups__groups',
      // fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
      // serviceUrl: '/admin/people/team/groups',
      // fieldTypeOverrides: [{ fieldName: 'id', fieldType: 'number' }],
    },
    // deployRequests: {
    //   add: {
    //     url: '/api/v2/groups',
    //     deployAsField: 'group',
    //     method: 'post',
    //   },
    //   modify: {
    //     url: '/api/v2/groups/{groupId}',
    //     method: 'put',
    //     deployAsField: 'group',
    //     urlParamsToFields: {
    //       groupId: 'id',
    //     },
    //   },
    //   remove: {
    //     url: '/api/v2/groups/{groupId}',
    //     method: 'delete',
    //     deployAsField: 'group',
    //     urlParamsToFields: {
    //       groupId: 'id',
    //     },
    //   },
    // },
  },
}

export const SUPPORTED_TYPES = {
  group: ['groups'],
}

export const DEFAULT_CONFIG: SAPConfig = {
  [FETCH_CONFIG]: {
    include: [{
      type: elements.query.ALL_TYPES,
    }],
    exclude: [],
    hideTypes: true,
  },
  [API_DEFINITIONS_CONFIG]: {
    typeDefaults: {
      request: {
        paginationField: 'next_page',
      },
      transformation: {
        idFields: DEFAULT_ID_FIELDS,
        fileNameFields: DEFAULT_FILENAME_FIELDS,
        fieldsToOmit: FIELDS_TO_OMIT,
        fieldsToHide: FIELDS_TO_HIDE,
        serviceIdField: DEFAULT_SERVICE_ID_FIELD,
      },
    },
    types: DEFAULT_TYPES,
    supportedTypes: SUPPORTED_TYPES,
  },
}

export const configType = createMatchingObjectType<Partial<SAPConfig>>({
  elemID: new ElemID(SAP),
  fields: {
    [CLIENT_CONFIG]: {
      refType: createClientConfigType(SAP),
    },
    [FETCH_CONFIG]: {
      refType: createUserFetchConfigType(SAP),
    },
    [API_DEFINITIONS_CONFIG]: {
      refType: createDucktypeAdapterApiConfigType({ adapter: SAP }),
    },
  },
  annotations: {
    [CORE_ANNOTATIONS.DEFAULT]: _.omit(
      DEFAULT_CONFIG,
      API_DEFINITIONS_CONFIG,
      `${FETCH_CONFIG}.hideTypes`,
    ),
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

export type FilterContext = {
  [FETCH_CONFIG]: SAPFetchConfig
  [API_DEFINITIONS_CONFIG]: SAPApiConfig
}

export const validateFetchConfig = validateDuckTypeFetchConfig
