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
import { ElemID, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { createMatchingObjectType } from '@salto-io/adapter-utils'
import { client as clientUtils, config as configUtils, definitions, elements } from '@salto-io/adapter-components'
import { SAP } from './constants'

const { createClientConfigType } = clientUtils
const {
  createSwaggerAdapterApiConfigType,
} = configUtils

export const CLIENT_CONFIG = 'client'
export const FETCH_CONFIG = 'fetch'
export const API_DEFINITIONS_CONFIG = 'apiDefinitions'

export type SAPClientConfig = clientUtils.ClientBaseConfig<clientUtils.ClientRateLimitConfig>

export type SAPFetchConfig = definitions.UserFetchConfig

export type SAPApiConfig = configUtils.AdapterSwaggerApiConfig

export type SAPConfig = {
  [CLIENT_CONFIG]?: SAPClientConfig
  [FETCH_CONFIG]: SAPFetchConfig
  [API_DEFINITIONS_CONFIG]: SAPApiConfig
}

const DEFAULT_ID_FIELDS = ['name']
export const FIELDS_TO_OMIT: configUtils.FieldToOmitType[] = []

const DEFAULT_TYPE_CUSTOMIZATIONS: SAPApiConfig['types'] = {
  MCMService_MCMFormulas: {
    transformation: {
      idFields: ['idText'],
    },
  },
  EnergySourceTypes: {
    request: {
      url: '/EnergySourceTypes?$expand=texts,localized',
    },
  },
  GridTypes: {
    request: {
      url: '/GridTypes?$expand=texts,localized',
    },
  },
  OrdererTypes: {
    request: {
      url: '/OrdererTypes?$expand=texts,localized',
    },
  },
  MCMService_EnergySourceTypes: {
    transformation: {
      standaloneFields: [{ fieldName: 'texts' }],
    },
  },
  MCMService_GridTypes: {
    transformation: {
      standaloneFields: [{ fieldName: 'texts' }],
    },
  },
  MCMService_OrdererTypes: {
    transformation: {
      standaloneFields: [{ fieldName: 'texts' }],
    },
  },
  MCMService_EnergySourceTypes_texts: {
    transformation: {
      idFields: ['locale'],
    },
  },
  MCMService_GridTypes_texts: {
    transformation: {
      idFields: ['locale'],
    },
  },
  MCMService_OrdererTypes_texts: {
    transformation: {
      idFields: ['locale'],
    },
  },
}

const DEFAULT_SWAGGER_CONFIG: SAPApiConfig['swagger'] = {
  url: 'https://raw.githubusercontent.com/salto-io/adapter-swaggers/main/sap/swagger.json',
}

export const SUPPORTED_TYPES = {
  MCMService_EnergySourceTypes: ['EnergySourceTypes'],
  MCMService_MeasuringTypes: ['MeasuringTypes'],
  MCMService_MCIRateTypes: ['MCIRateTypes'],
  MCMService_PowerRangeTypes: ['PowerRangeTypes'],
  MCMService_MCMFormulas: ['MCMFormulas'],
  MCMService_GridTypes: ['GridTypes'],
  MCMService_OrdererTypes: ['OrdererTypes'],
}

export const DEFAULT_API_DEFINITIONS: SAPApiConfig = {
  swagger: DEFAULT_SWAGGER_CONFIG,
  typeDefaults: {
    transformation: {
      idFields: DEFAULT_ID_FIELDS,
      fieldsToOmit: FIELDS_TO_OMIT,
      nestStandaloneInstances: true,
    },
  },
  types: DEFAULT_TYPE_CUSTOMIZATIONS,
  supportedTypes: SUPPORTED_TYPES,
}

export const DEFAULT_CONFIG: SAPConfig = {
  [FETCH_CONFIG]: {
    ...elements.query.INCLUDE_ALL_CONFIG,
  },
  [API_DEFINITIONS_CONFIG]: DEFAULT_API_DEFINITIONS,
}

export const configType = createMatchingObjectType<Partial<SAPConfig>>({
  elemID: new ElemID(SAP),
  fields: {
    [CLIENT_CONFIG]: {
      refType: createClientConfigType(SAP),
    },
    [FETCH_CONFIG]: {
      refType: definitions.createUserFetchConfigType(
        SAP,
      ),
    },
    [API_DEFINITIONS_CONFIG]: {
      refType: createSwaggerAdapterApiConfigType({ adapter: SAP }),
    },
  },
  annotations: {
    [CORE_ANNOTATIONS.DEFAULT]: _.omit(DEFAULT_CONFIG, API_DEFINITIONS_CONFIG, `${FETCH_CONFIG}.hideTypes`),
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

export type FilterContext = {
  [FETCH_CONFIG]: SAPFetchConfig
  [API_DEFINITIONS_CONFIG]: SAPApiConfig
}
