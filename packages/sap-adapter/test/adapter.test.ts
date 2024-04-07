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
import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'
import {
  ElemID,
  InstanceElement,
  isInstanceElement,
  ListType,
  ObjectType,
  ProgressReporter,
} from '@salto-io/adapter-api'
import * as adapterComponents from '@salto-io/adapter-components'
import { openapi } from '@salto-io/adapter-components'
import { buildElementsSourceFromElements, naclCase } from '@salto-io/adapter-utils'
import { adapter } from '../src/adapter_creator'
import { oauthClientCredentialsType } from '../src/auth'
import { SAP } from '../src/constants'
import { configType, DEFAULT_API_DEFINITIONS, DEFAULT_CONFIG, SUPPORTED_TYPES } from '../src/config'
import mockReplies from './mock_replies.json'

type MockReply = {
  url: string
  params?: Record<string, string>
  response: unknown
}

jest.mock('@salto-io/adapter-components', () => {
  const actual = jest.requireActual('@salto-io/adapter-components')
  const generateMockTypes: typeof openapi.generateTypes = async (adapterName, config, schemasAndRefs) => {
    if (schemasAndRefs !== undefined) {
      return actual.openapi.generateTypes(adapterName, config, schemasAndRefs)
    }
    return {
      allTypes: {
        ...Object.fromEntries(
          Object.values(SUPPORTED_TYPES)
            .flat()
            .map(type => [
              naclCase(type),
              new ObjectType({
                elemID: new ElemID(SAP, type),
                fields: {
                  value: {
                    refType: new ListType(new ObjectType({ elemID: new ElemID(SAP, naclCase(`MCMService_${type}`)) })),
                  },
                },
              }),
            ]),
        ),
      },
      parsedConfigs: {
        EnergySourceTypes: {
          request: {
            url: '/EnergySourceTypes',
          },
        },
        MeasuringTypes: {
          request: {
            url: '/MeasuringTypes',
          },
        },
        MCIRateTypes: {
          request: {
            url: '/MCIRateTypes',
          },
        },
        PowerRangeTypes: {
          request: {
            url: '/PowerRangeTypes',
          },
        },
        MCMFormulas: {
          request: {
            url: '/MCMFormulas',
          },
        },
        GridTypes: {
          request: {
            url: '/GridTypes',
          },
        },
        OrdererTypes: {
          request: {
            url: '/OrdererTypes',
          },
        },
      },
    }
  }
  return {
    ...actual,
    openapi: {
      ...actual.openapi,
      generateTypes: jest.fn().mockImplementation(generateMockTypes),
    },
  }
})
jest.mock('../src/config', () => {
  const actual = jest.requireActual('../src/config')
  return {
    ...actual,
    getUpdatedConfig: jest.fn().mockImplementation(actual.getUpdatedConfig),
  }
})

describe('adapter', () => {
  jest.setTimeout(10 * 1000)
  let mockAxiosAdapter: MockAdapter

  beforeEach(async () => {
    mockAxiosAdapter = new MockAdapter(axios, { delayResponse: 1, onNoMatch: 'throwException' })
    mockAxiosAdapter.onPost('/oauth/token').reply(200, {
      // eslint-disable-next-line camelcase
      token_type: 'bearer',
      access_token: 'token123',
      expires_in: 10000,
    })
    mockAxiosAdapter.onGet('/').reply(200, { success: true })
    ;(mockReplies as MockReply[]).forEach(({ url, params, response }) => {
      mockAxiosAdapter.onGet(url, !_.isEmpty(params) ? { params } : undefined).replyOnce(200, response)
    })
  })

  afterEach(() => {
    mockAxiosAdapter.restore()
    jest.clearAllMocks()
  })

  describe('fetch', () => {
    describe('full', () => {
      it('should generate the right elements on fetch', async () => {
        const { elements } = await adapter
          .operations({
            credentials: new InstanceElement('config', oauthClientCredentialsType, {
              clientId: 'client',
              clientSecret: 'secret',
              authorizationUrl: 'auth.na',
              baseUrl: 'base.na',
            }),
            config: new InstanceElement('config', configType, DEFAULT_CONFIG),
            elementsSource: buildElementsSourceFromElements([]),
          })
          .fetch({ progressReporter: { reportProgress: () => null } })

        expect(adapterComponents.openapi.generateTypes).toHaveBeenCalledTimes(1)
        expect(adapterComponents.openapi.generateTypes).toHaveBeenCalledWith(SAP, {
          ...DEFAULT_API_DEFINITIONS,
          supportedTypes: {
            ...DEFAULT_API_DEFINITIONS.supportedTypes,
          },
        })
        expect([...new Set(elements.filter(isInstanceElement).map(e => e.elemID.typeName))].sort()).toEqual([
          'MCMService_EnergySourceTypes',
          'MCMService_MCIRateTypes',
          'MCMService_MCMFormulas',
          'MCMService_MeasuringTypes',
          'MCMService_OrdererTypes',
          'MCMService_PowerRangeTypes',
        ])
        expect(elements.filter(isInstanceElement)).toHaveLength(39)
      })
      describe('deploy', () => {
        it('should throw not implemented', async () => {
          const operations = adapter.operations({
            credentials: new InstanceElement('config', oauthClientCredentialsType, {
              clientId: 'client',
              clientSecret: 'secret',
              subdomain: 'sandbox.na',
              production: false,
            }),
            config: new InstanceElement('config', configType, DEFAULT_CONFIG),
            elementsSource: buildElementsSourceFromElements([]),
          })
          const nullProgressReporter: ProgressReporter = {
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            reportProgress: () => {},
          }
          await expect(
            operations.deploy({
              changeGroup: { groupID: '', changes: [] },
              progressReporter: nullProgressReporter,
            }),
          ).rejects.toThrow(new Error('Not implemented.'))
        })
      })
    })
  })
})
