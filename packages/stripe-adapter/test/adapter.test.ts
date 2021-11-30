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
import {
  InstanceElement,
  isInstanceElement,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import mockReplies from './mock_replies.json'
import { adapter } from '../src/adapter_creator'
import { accessTokenCredentialsType } from '../src/auth'
import {
  configType, FETCH_CONFIG,
  DEFAULT_INCLUDE_TYPES,
  DEFAULT_API_DEFINITIONS,
  API_DEFINITIONS_CONFIG,
} from '../src/config'

type MockReply = {
  url: string
  params: Record<string, string>
  response: unknown
}


const SINGULAR_TYPES = ['country_spec', 'coupon', 'product', 'reporting_report_type', 'tax_rate', 'webhook_endpoint']
const pluralToSingularTypes = _.zipObject(DEFAULT_INCLUDE_TYPES, SINGULAR_TYPES)


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
  const credentials = new InstanceElement(
    'credentials',
    accessTokenCredentialsType,
    { token: 'testToken' }
  )
  const { elements } = await adapter.operations({
    credentials,
    config,
    elementsSource: buildElementsSourceFromElements([]),
  }).fetch({ progressReporter: { reportProgress: () => null } })

  return elements.filter(isInstanceElement)
}

describe('stripe swagger adapter', () => {
  beforeAll(() => {
    jest.mock('@salto-io/adapter-components', () => {
      const actual = jest.requireActual('@salto-io/adapter-components')
      return {
        ...actual,
        elements: {
          ...actual.elements,
          swagger: {
            ...actual.elements.swagger,
            generateTypes: jest.fn().mockImplementationOnce(actual.elements.swagger.generateTypes),
            getAllInstances:
              jest.fn().mockImplementationOnce(actual.elements.swagger.getAllInstances),
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

  describe('fetches all types', () => {
    let fetchedInstancesTypes: string[]

    beforeAll(async () => {
      fetchedInstancesTypes = (await fetchInstances()).map(i => i.elemID.typeName)
    })

    it.each(SINGULAR_TYPES)(
      '%s',
      typeName => {
        expect(fetchedInstancesTypes).toContain(typeName)
      },
    )
  })

  describe('custom config', () => {
    describe('fetches include types', () => {
      const INCLUDE_TYPES = ['coupons', 'tax_rates']
      const SINGULAR_INCLUDE_TYPES = INCLUDE_TYPES.map(t => pluralToSingularTypes[t])

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
        const additionalTypes: string[] = Array.from(fetchedInstancesTypes)
          .filter(fetchedType => !SINGULAR_INCLUDE_TYPES.includes(fetchedType))
        expect(additionalTypes).toBeEmpty()
      })
    })

    it('fetches instances of modified type', async () => {
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
