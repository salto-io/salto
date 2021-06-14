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
]

export const CLIENT_CONFIG = 'client'
export const FETCH_CONFIG = 'fetch'

export const API_DEFINITIONS_CONFIG = 'apiDefinitions'

export type StripeClientConfig = clientUtils.ClientBaseConfig<clientUtils.ClientRateLimitConfig>

export type StripeFetchConfig = configUtils.UserFetchConfig
export type StripeApiConfig = configUtils.AdapterSwaggerApiConfig

export type StripeConfig = {
  [CLIENT_CONFIG]?: StripeClientConfig
  [FETCH_CONFIG]: StripeFetchConfig
  [API_DEFINITIONS_CONFIG]: StripeApiConfig
}


const DEFAULT_SWAGGER_CONFIG: StripeApiConfig['swagger'] = {
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
  additionalTypes: [],
}


export const DEFAULT_INCLUDE_TYPES: string[] = [
  'country_specs',
  'coupons',
  'plans',
  'prices',
  'products',
  'reporting__report_types',
  'tax_rates',
  'webhook_endpoints',
]

export const DEFAULT_API_DEFINITIONS: StripeApiConfig = {
  swagger: DEFAULT_SWAGGER_CONFIG,
  typeDefaults: {
    transformation: {
      idFields: DEFAULT_ID_FIELDS,
      fieldsToOmit: FIELDS_TO_OMIT,
    },
  },
  types: {},
  supportedTypes: DEFAULT_INCLUDE_TYPES,
}


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
          includeTypes: DEFAULT_INCLUDE_TYPES,
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
