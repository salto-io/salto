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
import StripeAdapter from '../src/adapter'

describe('Stripe adapter E2E with real swagger and mock replies', () => {
  let adapter: StripeAdapter
  let credLease: CredsLease<AccessTokenCredentials>

  jest.setTimeout(10 * 1000)

  beforeAll(async () => {
    credLease = await credsLease()
    const adapterAttr = realAdapter({ credentials: credLease.value })
    adapter = adapterAttr.adapter
  })

  afterAll(async () => {
    if (credLease.return) {
      await credLease.return()
    }
  })

  describe('fetch', () => {
    describe('swagger types only', () => {
      it('should generate the right type elements on fetch', async () => {
        const { elements } = await adapter.fetch({ progressReporter:
          { reportProgress: () => null } })

        expect(elements.every(isObjectType)).toBeTruthy()
        expect(elements.map(e => e.elemID.getFullName())).toEqual(expect.arrayContaining([
          // assuming the mapping: v1__<plural-typeName> -> <plural-typeName>
          // is defined in typeNameOverrides:
          'stripe.country_specs',
          'stripe.coupons',
          'stripe.plans',
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
          'stripe.plan',
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
          'stripe.plan_metadata',
          'stripe.plan_tier',
          'stripe.transform_usage',
          'stripe.tax_rate_metadata',
          'stripe.webhook_endpoint_metadata',
        ]))
      })
    })
  })
})
