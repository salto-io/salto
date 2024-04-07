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
import 'jest-extended'
import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'
import {
  BuiltinTypes,
  ElemID,
  InstanceElement,
  isInstanceElement,
  ListType,
  ObjectType,
  ProgressReporter,
  Values,
} from '@salto-io/adapter-api'
import * as adapterComponents from '@salto-io/adapter-components'
import { buildElementsSourceFromElements, naclCase } from '@salto-io/adapter-utils'
import mockReplies from './mock_replies.json'
import { adapter } from '../src/adapter_creator'
import { accessTokenCredentialsType } from '../src/auth'
import {
  ALL_SUPPORTED_TYPES,
  API_DEFINITIONS_CONFIG,
  configType,
  DEFAULT_API_DEFINITIONS,
  DEFAULT_CONFIG,
  FETCH_CONFIG,
} from '../src/config'
import { STRIPE } from '../src/constants'

const TESTS_TIMEOUT_SECONDS = 30
jest.setTimeout(TESTS_TIMEOUT_SECONDS * 1000)

jest.mock('@salto-io/adapter-components', () => {
  const actual = jest.requireActual('@salto-io/adapter-components')
  return {
    ...actual,
    openapi: {
      ...actual.openapi,
      generateTypes: jest.fn(),
    },
  }
})

const mockedAdapterComponents = jest.mocked(adapterComponents, true)

describe('stripe swagger adapter', () => {
  type MockReply = {
    url: string
    params: Record<string, string>
    response: unknown
  }

  const CREDENTIALS = new InstanceElement('credentials', accessTokenCredentialsType, { token: 'testToken' })

  const DEFAULT_CONFIG_INSTANCE = new InstanceElement('config', configType, DEFAULT_CONFIG)

  const fetchInstances = async (config = DEFAULT_CONFIG_INSTANCE): Promise<InstanceElement[]> => {
    const { elements } = await adapter
      .operations({
        credentials: CREDENTIALS,
        config,
        elementsSource: buildElementsSourceFromElements([]),
      })
      .fetch({ progressReporter: { reportProgress: () => null } })

    return elements.filter(isInstanceElement)
  }
  beforeAll(() => {
    const priceType = new ObjectType({
      elemID: new ElemID(STRIPE, 'price'),
      fields: { id: { refType: BuiltinTypes.STRING } },
    })
    const pricesType = new ObjectType({
      elemID: new ElemID(STRIPE, 'prices'),
      fields: {
        data: {
          refType: new ListType(priceType),
        },
      },
    })
    const singularObjectTypesByName = Object.fromEntries(
      Object.keys(ALL_SUPPORTED_TYPES).map(type => [
        type,
        new ObjectType({
          elemID: new ElemID(STRIPE, type),
          fields: { id: { refType: BuiltinTypes.STRING } },
        }),
      ]),
    )
    const mockTypes = {
      allTypes: {
        ...singularObjectTypesByName,
        price: priceType,
        prices: pricesType,
        ...Object.fromEntries(
          Object.entries(ALL_SUPPORTED_TYPES).map(([singleType, pluralTypes]) => [
            naclCase(pluralTypes[0]),
            new ObjectType({
              elemID: new ElemID(STRIPE, pluralTypes[0]),
              fields: {
                data: {
                  refType: new ListType(singularObjectTypesByName[singleType]),
                },
              },
            }),
          ]),
        ),
      },
      parsedConfigs: {
        products: {
          request: {
            url: '/v1/products',
          },
        },
        coupons: {
          request: {
            url: '/v1/coupons',
          },
        },
        plans: {
          request: {
            url: '/v1/plans',
          },
        },
        prices: {
          request: {
            url: '/v1/prices',
          },
        },
        country_specs: {
          request: {
            url: '/v1/country_specs',
          },
        },
        reporting__report_types: {
          request: {
            url: '/v1/reporting/report_types',
          },
        },
        tax_rates: {
          request: {
            url: '/v1/tax_rates',
          },
        },
        webhook_endpoints: {
          request: {
            url: '/v1/webhook_endpoints',
          },
        },
      },
    }
    mockedAdapterComponents.openapi.generateTypes.mockResolvedValue(mockTypes)

    const mockAxiosAdapter = new MockAdapter(axios, { delayResponse: 1, onNoMatch: 'throwException' })
    ;(mockReplies as MockReply[]).forEach(({ url, params, response }) => {
      mockAxiosAdapter.onGet(url, !_.isEmpty(params) ? { params } : undefined).reply(200, response)
    })
  })

  describe('fetch', () => {
    let fetchedInstances: InstanceElement[]

    beforeAll(async () => {
      fetchedInstances = await fetchInstances()
    })

    it('fetches all instances', () => {
      const fetchedInstancesFullNames = fetchedInstances.map(instance => instance.elemID.getFullName())
      expect(fetchedInstancesFullNames).toIncludeSameMembers([
        'stripe.country_spec.instance.AR',
        'stripe.coupon.instance.testCoupon_forever_S8nceGxL',
        'stripe.product.instance.sfdsfsf_prod_JMpOpTpdX5rDKx',
        'stripe.product.instance.abc_prod_JMpOpTpdX5rDKx',
        'stripe.reporting_report_type.instance.balance_summary_1@v',
        'stripe.tax_rate.instance.Sales_tax_txr_1Jwt1JHipyrr1EYi3coTN5Y9_AL_3@suuuu',
        'stripe.webhook_endpoint.instance.we_1IcrkHHipyrr1EYiSGhlscV7',
      ])
    })

    describe('fetches all types', () => {
      let fetchedInstancesTypes: Set<string>

      beforeAll(() => {
        fetchedInstancesTypes = new Set(fetchedInstances.map(instance => instance.elemID.typeName))
      })

      it.each(Object.keys(ALL_SUPPORTED_TYPES))('%s', typeName => {
        expect(fetchedInstancesTypes).toContain(typeName)
      })
    })

    const PRODUCT_NAME = 'sfdsfsf_prod_JMpOpTpdX5rDKx'
    it(`fetches prices for product "${PRODUCT_NAME}"`, () => {
      const productInstance = <InstanceElement>fetchedInstances.find(e => e.elemID.name === PRODUCT_NAME)
      const expectedPriceIds = [
        'price_1JjN8THipyrr1EYirgGmnx9A',
        'price_1JjN8GHipyrr1EYi69M6nDJA',
        'price_1Ik5jyHipyrr1EYiTX75FImK',
        'price_1Ik5jyHipyrr1EYiZkn6nySi',
      ]
      const productPrices: Values[] = productInstance.value.product_prices
      const receivedPriceIds: string[] = productPrices.map(p => p.id)
      expect(receivedPriceIds).toIncludeSameMembers(expectedPriceIds)
    })

    describe('custom config', () => {
      describe('fetches included types', () => {
        const SINGULAR_INCLUDE_TYPES = ['coupon', 'tax_rate']

        let fetchedInstancesTypes: Set<string>

        beforeAll(async () => {
          const config = new InstanceElement('config', configType, {
            [FETCH_CONFIG]: {
              include: SINGULAR_INCLUDE_TYPES.map(type => ({ type })),
              exclude: [],
            },
            [API_DEFINITIONS_CONFIG]: DEFAULT_API_DEFINITIONS,
          })
          const instances = await fetchInstances(config)
          fetchedInstancesTypes = new Set(instances.map(e => e.elemID.typeName))
        })

        it.each(SINGULAR_INCLUDE_TYPES)('%s', includedType => {
          expect(fetchedInstancesTypes).toContain(includedType)
        })

        it("doesn't fetch additional types", () => {
          const notIncluded = (typeName: string): boolean => !SINGULAR_INCLUDE_TYPES.includes(typeName)
          const additionalTypes: string[] = Array.from(fetchedInstancesTypes).filter(notIncluded)
          expect(additionalTypes).toBeEmpty()
        })
      })

      it('fetches instances of modified type: "product"', async () => {
        const config = new InstanceElement('config', configType, {
          [FETCH_CONFIG]: DEFAULT_CONFIG[FETCH_CONFIG],
          [API_DEFINITIONS_CONFIG]: {
            ...DEFAULT_API_DEFINITIONS,
            types: {
              products: {
                request: {
                  url: '/v1/products',
                },
              },
            },
          },
        })
        const fetchedTypes = (await fetchInstances(config)).map(i => i.elemID.typeName)
        expect(fetchedTypes).toContain('product')
      })
      it('should filter elements by type+name on fetch', async () => {
        const config = new InstanceElement('config', configType, {
          ...DEFAULT_CONFIG,
          fetch: {
            ...DEFAULT_CONFIG.fetch,
            include: [{ type: 'coupon' }, { type: 'product', criteria: { name: 'a.*' } }],
          },
        })
        const instances = (await fetchInstances(config)).filter(isInstanceElement)
        expect(instances.map(e => e.elemID.getFullName()).sort()).toEqual([
          'stripe.coupon.instance.testCoupon_forever_S8nceGxL',
          'stripe.product.instance.abc_prod_JMpOpTpdX5rDKx',
        ])
      })
    })
  })

  describe('deploy', () => {
    it('throws Error on deploy', async () => {
      const adapterOperations = adapter.operations({
        credentials: CREDENTIALS,
        config: DEFAULT_CONFIG_INSTANCE,
        elementsSource: buildElementsSourceFromElements([]),
      })
      const nullProgressReporter: ProgressReporter = {
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        reportProgress: () => {},
      }
      const deployOptions = {
        changeGroup: { groupID: '', changes: [] },
        progressReporter: nullProgressReporter,
      }
      await expect(adapterOperations.deploy(deployOptions)).rejects.toThrow(new Error('Not implemented.'))
    })
  })
})
