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
import 'jest-extended'
import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'
import { InstanceElement, isInstanceElement, Values } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import mockReplies from './mock_replies.json'
import { adapter } from '../src/adapter_creator'
import { accessTokenCredentialsType } from '../src/auth'
import {
  API_DEFINITIONS_CONFIG,
  configType,
  DEFAULT_API_DEFINITIONS,
  DEFAULT_INCLUDE_TYPES,
  FETCH_CONFIG,
} from '../src/config'
import { EXPECTED_INSTANCES_FULL_NAMES } from './instances_full_names'

describe('stripe swagger adapter', () => {
  type MockReply = {
    url: string
    params: Record<string, string>
    response: unknown
  }

  const TESTS_TIMEOUT_SECONDS = 30
  const SINGULAR_TYPES = ['country_spec', 'coupon', 'product', 'reporting_report_type', 'tax_rate', 'webhook_endpoint']
  const pluralToSingularTypes = _.zipObject(DEFAULT_INCLUDE_TYPES, SINGULAR_TYPES)

  const CREDENTIALS = new InstanceElement(
    'credentials',
    accessTokenCredentialsType,
    { token: 'testToken' }
  )

  const DEFAULT_CONFIG = new InstanceElement(
    'config',
    configType,
    {
      [FETCH_CONFIG]: {
        includeTypes: DEFAULT_INCLUDE_TYPES,
      },
      [API_DEFINITIONS_CONFIG]: DEFAULT_API_DEFINITIONS,
    }
  )

  const fetchInstances = async (config = DEFAULT_CONFIG): Promise<InstanceElement[]> => {
    const { elements } = await adapter.operations({
      credentials: CREDENTIALS,
      config,
      elementsSource: buildElementsSourceFromElements([]),
    }).fetch({ progressReporter: { reportProgress: () => null } })

    return elements.filter(isInstanceElement)
  }
  beforeAll(() => {
    jest.setTimeout(TESTS_TIMEOUT_SECONDS)
    jest.mock('@salto-io/adapter-components', () => {
      const actual = jest.requireActual('@salto-io/adapter-components')
      return {
        ...actual,
        elements: {
          ...actual.elements,
          swagger: {
            ...actual.elements.swagger,
            generateTypes: jest.fn().mockImplementation(actual.elements.swagger.generateTypes),
            getAllInstances:
              jest.fn().mockImplementation(actual.elements.swagger.getAllInstances),
          },
        },
      }
    })

    const mockAxiosAdapter = new MockAdapter(axios, { delayResponse: 1, onNoMatch: 'throwException' });
    (mockReplies as MockReply[]).forEach(({ url, params, response }) => {
      mockAxiosAdapter.onGet(url, !_.isEmpty(params) ? { params } : undefined).reply(
        200, response
      )
    })
  })

  describe('fetch', () => {
    let fetchedInstances: InstanceElement[]

    beforeAll(async () => {
      fetchedInstances = await fetchInstances()
    })

    it('fetches all instances', () => {
      const fetchedInstancesFullNames = fetchedInstances
        .map(instance => instance.elemID.getFullName())
      expect(fetchedInstancesFullNames).toIncludeSameMembers(EXPECTED_INSTANCES_FULL_NAMES)
    })

    describe('fetches all types', () => {
      let fetchedInstancesTypes: Set<string>

      beforeAll(() => {
        fetchedInstancesTypes = new Set(fetchedInstances.map(instance => instance.elemID.typeName))
      })

      it.each(SINGULAR_TYPES)(
        '%s',
        typeName => {
          expect(fetchedInstancesTypes).toContain(typeName)
        },
      )
    })

    const PRODUCT_NAME = 'sfdsfsf_prod_JMpOpTpdX5rDKx'
    it(`fetches prices for product "${PRODUCT_NAME}"`, () => {
      const productInstance = <InstanceElement>fetchedInstances
        .find(e => e.elemID.name === PRODUCT_NAME)
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
      describe('fetches include types', () => {
        const INCLUDE_TYPES = ['coupons', 'tax_rates']
        const SINGULAR_INCLUDE_TYPES = INCLUDE_TYPES.map(t => pluralToSingularTypes[t])

        const notIncluded = (typeName: string): boolean =>
          !SINGULAR_INCLUDE_TYPES.includes(typeName)

        let fetchedInstancesTypes: Set<string>

        beforeAll(async () => {
          const config = new InstanceElement(
            'config',
            configType,
            {
              [FETCH_CONFIG]: {
                includeTypes: INCLUDE_TYPES,
              },
              [API_DEFINITIONS_CONFIG]: DEFAULT_API_DEFINITIONS,
            }
          )
          const instances = await fetchInstances(config)
          fetchedInstancesTypes = new Set(instances.map(e => e.elemID.typeName))
        })

        it.each(SINGULAR_INCLUDE_TYPES)(
          '%s',
          includedType => {
            expect(fetchedInstancesTypes).toContain(includedType)
          }
        )

        it('doesn\'t fetch additional types', () => {
          const additionalTypes: string[] = Array.from(fetchedInstancesTypes).filter(notIncluded)
          expect(additionalTypes).toBeEmpty()
        })
      })

      it('fetches instances of modified type: "product"', async () => {
        const config = new InstanceElement(
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
        )
        const fetchedTypes = (await fetchInstances(config)).map(i => i.elemID.typeName)
        expect(fetchedTypes).toContain('product')
      })
    })
  })

  it('throws Error on deploy', async () => {
    const adapterOperations = adapter.operations({
      credentials: CREDENTIALS,
      config: DEFAULT_CONFIG,
      elementsSource: buildElementsSourceFromElements([]),
    })
    const deployOptions = { changeGroup: { groupID: '', changes: [] } }
    await expect(adapterOperations.deploy(deployOptions)).rejects.toThrow(new Error('Not implemented.'))
  })
})
