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
import { Element, isObjectType } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import 'jest-extended'
import { CredsLease } from '@salto-io/e2e-credentials-store'
import { AccessTokenCredentials } from '../src/auth'
import { credsLease, realAdapter } from './adapter'

const log = logger(module)

/**
 * assumes the mapping: v1__<plural-typeName> -> <plural-typeName> is declared
 * for all the supported types in {@link DEFAULT_API_DEFINITIONS.swagger.typeNameOverrides}
 */
describe('Stripe adapter E2E with real swagger and mock replies', () => {
  let fetchedElementNames: string[]
  let fetchedSwaggerElements: Element[]
  let credLease: CredsLease<AccessTokenCredentials>

  beforeAll(async () => {
    log.resetLogCount()
    credLease = await credsLease()
    const adapterAttr = realAdapter({ credentials: credLease.value })
    const { elements } = await adapterAttr.adapter.fetch({
      progressReporter: { reportProgress: () => null },
    })
    fetchedSwaggerElements = elements
    fetchedElementNames = fetchedSwaggerElements.map(e => e.elemID.getFullName())
  })

  afterAll(async () => {
    if (credLease.return) {
      await credLease.return()
    }
    log.info('Stripe adapter E2E: Log counts = %o', log.getLogCount())
  })

  it('fetched elements are all objects', () => {
    expect(fetchedSwaggerElements).toSatisfyAll(isObjectType)
  })

  describe('fetches swagger types', () => {
    it.each([
      'stripe.country_specs',
      'stripe.coupons',
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
      'stripe.tax_rate_metadata',
      'stripe.webhook_endpoint_metadata',
    ])('%s', expectedType => {
      expect(fetchedElementNames).toContain(expectedType)
    })
  })

  describe('does not fetch unsupported types', () => {
    it.each(['stripe.plan', 'stripe.plan_metadata', 'stripe.plan_tier', 'stripe.transform_usage'])(
      '%s',
      unsupportedType => {
        expect(fetchedElementNames).not.toContain(unsupportedType)
      },
    )
  })
})
