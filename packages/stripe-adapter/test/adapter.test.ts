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
import _ from 'lodash'
import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'
import { elements as elementUtils } from '@salto-io/adapter-components'
import { InstanceElement, isInstanceElement, ElemID, ObjectType, ListType, BuiltinTypes } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements, naclCase } from '@salto-io/adapter-utils'
import mockReplies from './mock_replies.json'
import { adapter } from '../src/adapter_creator'
import { accessTokenCredentialsType } from '../src/auth'
import { configType, FETCH_CONFIG,
  DEFAULT_INCLUDE_TYPES,
  DEFAULT_API_DEFINITIONS,
  API_DEFINITIONS_CONFIG } from '../src/config'
import { STRIPE } from '../src/constants'

type MockReply = {
  url: string
  params: Record<string, string>
  response: unknown
}
const pluralToSingularTypes: Record<string, string> = _.zipObject(DEFAULT_INCLUDE_TYPES,
  ['country_spec', 'coupon', 'plan', 'price', 'product', 'reporting_report_type', 'tax_rate', 'webhook_endpoint'])

const singularTypes = Object.fromEntries(Object.values(pluralToSingularTypes).map(
  type => [naclCase(type), new ObjectType({ elemID: new ElemID(STRIPE, type),
    fields: { id: { refType: BuiltinTypes.STRING } } })]
))
const generateMockTypes: typeof elementUtils.swagger.generateTypes = async () => (
  {
    allTypes: {
      ...singularTypes,
      ...Object.fromEntries(DEFAULT_INCLUDE_TYPES.map(
        type => [naclCase(type), new ObjectType({ elemID: new ElemID(STRIPE, type),
          fields: { data: {
            refType: new ListType(singularTypes[pluralToSingularTypes[type]]),
          } } })]
      )),
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
  })

jest.mock('@salto-io/adapter-components', () => {
  const actual = jest.requireActual('@salto-io/adapter-components')
  return {
    ...actual,
    elements: {
      ...actual.elements,
      swagger: {
        ...actual.elements.swagger,
        generateTypes: jest.fn().mockImplementation(generateMockTypes),
      },
    },
  }
})

describe('adapter', () => {
  let mockAxiosAdapter: MockAdapter

  beforeEach(async () => {
    mockAxiosAdapter = new MockAdapter(axios, { delayResponse: 1, onNoMatch: 'throwException' });
    (mockReplies as MockReply[]).forEach(({ url, params, response }) => {
      mockAxiosAdapter.onGet(url, !_.isEmpty(params) ? { params } : undefined).reply(
        200, response
      )
    })
  })

  afterEach(() => {
    mockAxiosAdapter.restore()
  })

  describe('full fetch', () => {
    it('should generate the right elements on fetch', async () => {
      const { elements } = await adapter.operations({
        credentials: new InstanceElement(
          'config',
          accessTokenCredentialsType,
          { token: 'aaa' },
        ),
        config: new InstanceElement(
          'config',
          configType,
          {
            [FETCH_CONFIG]: {
              includeTypes: DEFAULT_INCLUDE_TYPES,
            },
            [API_DEFINITIONS_CONFIG]: DEFAULT_API_DEFINITIONS,
          }
        ),
        elementsSource: buildElementsSourceFromElements([]),
      }).fetch({ progressReporter: { reportProgress: () => null } })
      expect(elements.filter(isInstanceElement)).toHaveLength(17)

      const countrySpec = elements.filter(isInstanceElement).find(e => e.elemID.getFullName() === 'stripe.country_spec.instance.AT')
      expect(countrySpec).toBeDefined()
      expect(countrySpec?.value).toEqual(expect.objectContaining({ id: 'AT' }))


      const coupon = elements.filter(isInstanceElement).find(e => e.elemID.getFullName() === 'stripe.coupon.instance.2JI7xnRz')
      expect(coupon).toBeDefined()
      expect(coupon?.value).toEqual(expect.objectContaining({ id: '2JI7xnRz' }))


      const plan = elements.filter(isInstanceElement).find(e => e.elemID.getFullName() === 'stripe.plan.instance.price_1Ihz4cHipyrr1EYi5QfXJ8Y1')
      expect(plan).toBeDefined()
      expect(plan?.value).toEqual(expect.objectContaining({ id: 'price_1Ihz4cHipyrr1EYi5QfXJ8Y1' }))

      const price = elements.filter(isInstanceElement).find(e => e.elemID.getFullName() === 'stripe.price.instance.price_1Ik5jyHipyrr1EYiTX75FImK')
      expect(price).toBeDefined()
      expect(price?.value).toEqual(expect.objectContaining({ id: 'price_1Ik5jyHipyrr1EYiTX75FImK' }))


      const product = elements.filter(isInstanceElement).find(e => e.elemID.getFullName() === 'stripe.product.instance.prod_JMpOpTpdX5rDKx')
      expect(product).toBeDefined()
      expect(product?.value).toEqual(expect.objectContaining({ id: 'prod_JMpOpTpdX5rDKx' }))

      const reportType = elements.filter(isInstanceElement).find(e => e.elemID.getFullName() === 'stripe.reporting_report_type.instance.balance_summary_1')
      expect(reportType).toBeDefined()
      expect(reportType?.value).toEqual(expect.objectContaining({ id: 'balance_summary_1' }))


      const taxRate = elements.filter(isInstanceElement).find(e => e.elemID.getFullName() === 'stripe.tax_rate.instance.txr_1IcrqNHipyrr1EYiTpN0iuVj')
      expect(taxRate).toBeDefined()
      expect(taxRate?.value).toEqual(expect.objectContaining({ id: 'txr_1IcrqNHipyrr1EYiTpN0iuVj' }))


      const webhookEndpoint = elements.filter(isInstanceElement).find(e => e.elemID.getFullName() === 'stripe.webhook_endpoint.instance.we_1IcrkHHipyrr1EYiSGhlscV7')
      expect(webhookEndpoint).toBeDefined()
      expect(webhookEndpoint?.value).toEqual(expect.objectContaining({ id: 'we_1IcrkHHipyrr1EYiSGhlscV7' }))
    })
  })

  describe('type overrides', () => {
    it('should fetch only the relevant types', async () => {
      const { elements } = await adapter.operations({
        credentials: new InstanceElement(
          'config',
          accessTokenCredentialsType,
          { token: 'aaa' },
        ),
        config: new InstanceElement(
          'config',
          configType,
          {
            [FETCH_CONFIG]: {
              includeTypes: ['prices'],
            },
            [API_DEFINITIONS_CONFIG]: DEFAULT_API_DEFINITIONS,
          }
        ),
        elementsSource: buildElementsSourceFromElements([]),
      }).fetch({ progressReporter: { reportProgress: () => null } })
      expect(elements.filter(isInstanceElement)).toHaveLength(1)
      expect(elements.filter(isInstanceElement).map(e => e.elemID.getFullName())).toEqual(['stripe.price.instance.price_1Ik5jyHipyrr1EYiTX75FImK'])
    })
  })

  describe('modified types in config', async () => {
    const { elements } = await adapter.operations({
      credentials: new InstanceElement(
        'config',
        accessTokenCredentialsType,
        { token: 'aaa' },
      ),
      config: new InstanceElement(
        'config',
        configType,
        {
          [FETCH_CONFIG]: {
            includeTypes: DEFAULT_INCLUDE_TYPES,
          },
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
        }
      ),
      elementsSource: buildElementsSourceFromElements([]),
    }).fetch({ progressReporter: { reportProgress: () => null } })
    expect(elements.filter(isInstanceElement)).toHaveLength(17)
  })

  describe('deploy', () => {
    it('should throw not implemented', async () => {
      const operations = adapter.operations({
        credentials: new InstanceElement(
          'config',
          accessTokenCredentialsType,
          { token: 'aaa' },
        ),
        config: new InstanceElement(
          'config',
          configType,
          {
            [FETCH_CONFIG]: {
              includeTypes: DEFAULT_INCLUDE_TYPES,
            },
            [API_DEFINITIONS_CONFIG]: DEFAULT_API_DEFINITIONS,
          }
        ),
        elementsSource: buildElementsSourceFromElements([]),
      })
      await expect(operations.deploy({ changeGroup: { groupID: '', changes: [] } })).rejects.toThrow(new Error('Not implemented.'))
    })
  })
})
