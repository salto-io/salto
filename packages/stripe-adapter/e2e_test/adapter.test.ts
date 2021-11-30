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
import { isObjectType } from '@salto-io/adapter-api'
import { CredsLease } from '@salto-io/e2e-credentials-store'
import { AccessTokenCredentials } from '../src/auth'
import { credsLease, realAdapter } from './adapter'


/**
 * assumes the mapping: v1__<plural-typeName> -> <plural-typeName> is declared
 * for all the supported types in {@link DEFAULT_API_DEFINITIONS.swagger.typeNameOverrides}
 */
describe('Stripe adapter E2E with real swagger and mock replies', () => {
  let fetchedSwaggerTypes: string[]
  let credLease: CredsLease<AccessTokenCredentials>

  beforeAll(async () => {
    credLease = await credsLease()
    const adapterAttr = realAdapter({ credentials: credLease.value })
    const { elements } = await adapterAttr.adapter.fetch({
      progressReporter:
                { reportProgress: () => null },
    })
    fetchedSwaggerTypes = elements
      .filter(isObjectType)
      .map(e => e.elemID.typeName)
  })

  afterAll(async () => {
    if (credLease.return) {
      await credLease.return()
    }
  })

  const EXPECTED_TYPE_NAMES = [
    'country_specs',
    'coupons',
    'prices',
    'products',
    'reporting__report_types',
    'tax_rates',
    'webhook_endpoints',
    'price',
    'product',
    'reporting_report_type',
    'country_spec',
    'coupon',
    'tax_rate',
    'webhook_endpoint',
    'product_metadata',
    'package_dimensions',
    'recurring',
    'price_tier',
    'transform_quantity',
    'country_spec_supported_bank_account_currencies',
    'country_spec_verification_fields',
    'coupon_applies_to',
    'coupon_metadata',
    'transform_usage',
    'tax_rate_metadata',
    'webhook_endpoint_metadata',
  ]

  describe('fetches swagger types', () => {
    it.each(EXPECTED_TYPE_NAMES)(
      '%s',
      async expectedTypeName => {
        expect(fetchedSwaggerTypes).toContain(expectedTypeName)
      }
    )
  })
})
