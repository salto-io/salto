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
import { ElemID, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { createMatchingObjectType } from '@salto-io/adapter-utils'

import { client as clientUtils, config as configUtils } from '@salto-io/adapter-components'
import { STRIPE } from './constants'

const { createClientConfigType } = clientUtils
const { createUserFetchConfigType, createSwaggerAdapterApiConfigType } = configUtils

const DEFAULT_ID_FIELDS = ['id']
export const FIELDS_TO_OMIT: configUtils.FieldToOmitType[] = [
  { fieldName: 'object', fieldType: 'string' },
]

export const CLIENT_CONFIG = 'client'
export const FETCH_CONFIG = 'fetch'

export const API_DEFINITIONS_CONFIG = 'apiDefinitions'

export type StripeClientConfig = clientUtils.ClientBaseConfig<clientUtils.ClientRateLimitConfig>

export type StripeFetchConfig = configUtils.UserFetchConfig
export type StripeApiConfig = Omit<configUtils.AdapterSwaggerApiConfig, 'swagger'> & {
  swagger: configUtils.AdapterSwaggerApiConfig['swagger']
}

export type StripeConfig = {
  [CLIENT_CONFIG]?: StripeClientConfig
  [FETCH_CONFIG]: StripeFetchConfig
  [API_DEFINITIONS_CONFIG]: StripeApiConfig
}

const DEFAULT_TYPE_CUSTOMIZATIONS: StripeApiConfig['types'] = {
  coupon: {
    transformation: {
      idFields: ['name', 'id'],
      fileNameFields: ['name'],
    },
  },
  products: {
    request: {
      url: '/v1/products',
      recurseInto: [
        {
          type: 'prices',
          toField: 'product_prices',
          context: [{ name: 'productId', fromField: 'id' }],
        },
      ],
    },
    transformation: {
      dataField: 'data',
    },
  },
  product: {
    transformation: {
      idFields: ['name', 'id'],
      fileNameFields: ['name'],
      fieldTypeOverrides: [{ fieldName: 'product_prices', fieldType: 'list<price>' }],
    },
  },
  prices: {
    request: {
      url: '/v1/prices?product={productId}',
    },
    transformation: {
      dataField: 'data',
      fieldsToOmit: [
        { fieldName: 'product', fieldType: 'unknown' },
      ],
    },
  },
  list: {
    transformation: {
      dataField: 'data'
    },
  },
  tax_rate: {
    transformation: {
      idFields: ['display_name', 'id'],
      fileNameFields: ['display_name'],
    },
  },
  plan: {
    transformation: {
      idFields: ['nickname', 'id'],
      fileNameFields: ['nickname', 'id'],
    },
  },
}

export const DEFAULT_API_DEFINITIONS: StripeApiConfig = {
  swagger: {
    url: 'https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.yaml',
    typeNameOverrides: [
      { originalName: 'v1__country_specs', newName: 'country_specs' },
      { originalName: 'v1__coupons', newName: 'coupons' },
      { originalName: 'v1__plans', newName: 'plans' },
      { originalName: 'v1__prices', newName: 'prices' },
      { originalName: 'v1__products', newName: 'products' },
      { originalName: 'v1__reporting__report_types', newName: 'reporting__report_types' },
      { originalName: 'v1__tax_rates', newName: 'tax_rates' },
      { originalName: 'v1__webhook_endpoints', newName: 'webhook_endpoints' },
    ],
  },
  typeDefaults: {
    transformation: {
      idFields: DEFAULT_ID_FIELDS,
      fieldsToOmit: FIELDS_TO_OMIT,
    },
  },
  types: DEFAULT_TYPE_CUSTOMIZATIONS,
}

export const ALL_SUPPORTED_TYPES = [
  'country_specs',
  'coupons',
  'products',
  'reporting__report_types',
  'tax_rates',
  'webhook_endpoints',
]

export const configType = createMatchingObjectType<StripeConfig>({
  elemID: new ElemID(STRIPE),
  fields: {
    [CLIENT_CONFIG]: {
      refType: createClientConfigType(STRIPE),
    },
    [FETCH_CONFIG]: {
      refType: createUserFetchConfigType(STRIPE),
      annotations: {
        _required: true,
        [CORE_ANNOTATIONS.DEFAULT]: {
          includeTypes: ALL_SUPPORTED_TYPES,
        },
      },
    },
    [API_DEFINITIONS_CONFIG]: {
      refType: createSwaggerAdapterApiConfigType({
        adapter: STRIPE,
      }),
      annotations: {
        _required: true,
        [CORE_ANNOTATIONS.DEFAULT]: DEFAULT_API_DEFINITIONS,
      },
    },
  },
})

export type FilterContext = {
  [FETCH_CONFIG]: StripeFetchConfig
  [API_DEFINITIONS_CONFIG]: StripeApiConfig
}
