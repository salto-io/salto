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


/*
assumes the mapping: v1__<plural-typeName> -> <plural-typeName>
is declared for all the supported types.
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
    fetchedSwaggerTypes = elements.filter(isObjectType).map(e => e.elemID.typeName)
  })

  afterAll(async () => {
    if (credLease.return) {
      await credLease.return()
    }
  })

  const TYPE_NAMES = [
    'stripe.country_specs',
    'stripe.coupons',
    'stripe.prices',
    'stripe.products',
    'stripe.reporting__report_types',
    'stripe.tax_rates',
    'stripe.webhook_endpoints',
    'stripe.price',
    'stripe.product',
    'stripe.reporting_report_type',
    'stripe.country_spec',
    'stripe.coupon',
    'stripe.tax_rate',
    'stripe.webhook_endpoint',
    'stripe.product_metadata',
    'stripe.package_dimensions',
    'stripe.recurring',
    'stripe.price_tier',
    'stripe.transform_quantity',
    'stripe.country_spec_supported_bank_account_currencies',
    'stripe.country_spec_verification_fields',
    'stripe.coupon_applies_to',
    'stripe.coupon_metadata',
    'stripe.transform_usage',
    'stripe.tax_rate_metadata',
    'stripe.webhook_endpoint_metadata',
  ]

  describe('fetches swagger types', () => {
    test.each(TYPE_NAMES)(
      '%s',
      async typeName => {
        expect(fetchedSwaggerTypes).toContain(typeName)
      }
    )
  })
})
