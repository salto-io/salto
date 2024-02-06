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
import { ElemID, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { createMatchingObjectType } from '@salto-io/adapter-utils'
import { client as clientUtils, config as configUtils, definitions, elements } from '@salto-io/adapter-components'
import _ from 'lodash'
import { STRIPE } from './constants'

const { createClientConfigType } = clientUtils
const { createSwaggerAdapterApiConfigType } = configUtils

const DEFAULT_ID_FIELDS = ['id']
export const FIELDS_TO_OMIT: configUtils.FieldToOmitType[] = [
  { fieldName: 'object', fieldType: 'string' },
  { fieldName: 'created', fieldType: 'number' },
  { fieldName: 'updated', fieldType: 'number' },
]

export const CLIENT_CONFIG = 'client'
export const FETCH_CONFIG = 'fetch'

export const API_DEFINITIONS_CONFIG = 'apiDefinitions'

export type StripeClientConfig = clientUtils.ClientBaseConfig<clientUtils.ClientRateLimitConfig>

export type StripeFetchConfig = definitions.UserFetchConfig
export type StripeApiConfig = configUtils.AdapterSwaggerApiConfig

export type StripeConfig = {
  [CLIENT_CONFIG]?: StripeClientConfig
  [FETCH_CONFIG]: StripeFetchConfig
  [API_DEFINITIONS_CONFIG]: StripeApiConfig
}

export const ALL_SUPPORTED_TYPES = {
  country_spec: ['country_specs'],
  coupon: ['coupons'],
  product: ['products'],
  reporting_report_type: ['reporting__report_types'],
  tax_rate: ['tax_rates'],
  webhook_endpoint: ['webhook_endpoints'],
}

const DEFAULT_TYPE_CUSTOMIZATIONS: StripeApiConfig['types'] = {
  coupon: {
    transformation: {
      idFields: ['name', 'duration', 'id'],
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
      fieldTypeOverrides: [{ fieldName: 'product_prices', fieldType: 'list<price>' }],
    },
  },
  prices: {
    request: {
      url: '/v1/prices?product={productId}',
    },
    transformation: {
      dataField: 'data',
    },
  },
  reporting_report_type: {
    transformation: {
      fieldsToHide: [
        { fieldName: 'data_available_end', fieldType: 'number' },
        { fieldName: 'data_available_start', fieldType: 'number' },
      ],
    },
  },
  tax_rate: {
    transformation: {
      idFields: ['display_name', 'id', 'country', 'percentage'],
    },
  },
}

export const DEFAULT_API_DEFINITIONS: StripeApiConfig = {
  swagger: {
    url: 'https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.yaml',
    typeNameOverrides: [
      { originalName: 'v1__country_specs', newName: 'country_specs' },
      { originalName: 'v1__coupons', newName: 'coupons' },
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
      // TODO: change this to true for SALTO-3885.
      nestStandaloneInstances: false,
    },
  },
  types: DEFAULT_TYPE_CUSTOMIZATIONS,
  supportedTypes: ALL_SUPPORTED_TYPES,
}

export const DEFAULT_CONFIG: StripeConfig = {
  [FETCH_CONFIG]: {
    ...elements.query.INCLUDE_ALL_CONFIG,
    hideTypes: true,
  },
  [API_DEFINITIONS_CONFIG]: DEFAULT_API_DEFINITIONS,
}

export const configType = createMatchingObjectType<Partial<StripeConfig>>({
  elemID: new ElemID(STRIPE),
  fields: {
    [CLIENT_CONFIG]: {
      refType: createClientConfigType(STRIPE),
    },
    [FETCH_CONFIG]: {
      refType: definitions.createUserFetchConfigType(STRIPE),
    },
    [API_DEFINITIONS_CONFIG]: {
      refType: createSwaggerAdapterApiConfigType({
        adapter: STRIPE,
      }),
    },
  },
  annotations: {
    [CORE_ANNOTATIONS.DEFAULT]: _.omit(DEFAULT_CONFIG, API_DEFINITIONS_CONFIG, `${FETCH_CONFIG}.hideTypes`),
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

export type FilterContext = {
  [FETCH_CONFIG]: StripeFetchConfig
  [API_DEFINITIONS_CONFIG]: StripeApiConfig
}
