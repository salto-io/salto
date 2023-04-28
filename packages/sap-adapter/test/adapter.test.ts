/*
*                      Copyright 2023 Salto Labs Ltd.
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
import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'
import {
  ElemID,
  InstanceElement,
  isInstanceElement,
  ObjectType,
} from '@salto-io/adapter-api'
import * as adapterComponents from '@salto-io/adapter-components'
import { elements as elementUtils } from '@salto-io/adapter-components'
import { buildElementsSourceFromElements, naclCase } from '@salto-io/adapter-utils'
import { adapter } from '../src/adapter_creator'
import { oauthClientCredentialsType } from '../src/auth'
import { SAP } from '../src/constants'
import {
  configType,
  DEFAULT_API_DEFINITIONS,
  DEFAULT_CONFIG,
  SUPPORTED_TYPES,
} from '../src/config'

jest.mock('@salto-io/adapter-components', () => {
  const actual = jest.requireActual('@salto-io/adapter-components')
  const generateMockTypes: typeof elementUtils.swagger.generateTypes = async (
    adapterName, config, schemasAndRefs
  ) => {
    if (schemasAndRefs !== undefined) {
      return actual.elements.swagger.generateTypes(adapterName, config, schemasAndRefs)
    }
    return {
      allTypes: {
        ...Object.fromEntries(Object.values(SUPPORTED_TYPES).flat().map(
          type => [naclCase(type), new ObjectType({ elemID: new ElemID(SAP, type) })]
        )),
        parsedConfigs: {
          MCMService_EnergySourceTypes: {
            request: {
              url: '/odata/v4/api/mcm/v1/EnergySourceTypes',
            },
          },
        },
      },
    }
  }
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
      token_type: 'bearer', access_token: 'token123', expires_in: 10000,
    })
    mockAxiosAdapter.onPost('/v1/connections').reply(200, { success: true })
  })

  afterEach(() => {
    mockAxiosAdapter.restore()
    jest.clearAllMocks()
  })

  describe('fetch', () => {
    describe('full', () => {
      it('should generate the right elements on fetch', async () => {
        const { elements } = await adapter.operations({
          credentials: new InstanceElement(
            'config',
            oauthClientCredentialsType,
            { clientId: 'client',
              clientSecret: 'secret',
              authorizationUrl: 'auth.na',
              baseUrl: 'base.na' },
          ),
          config: new InstanceElement(
            'config',
            configType,
            DEFAULT_CONFIG,
          ),
          elementsSource: buildElementsSourceFromElements([]),
        }).fetch({ progressReporter: { reportProgress: () => null } })

        expect(adapterComponents.elements.swagger.generateTypes).toHaveBeenCalledTimes(2)
        expect(adapterComponents.elements.swagger.generateTypes).toHaveBeenCalledWith(
          SAP,
          {
            ...DEFAULT_API_DEFINITIONS,
            supportedTypes: {
              ...DEFAULT_API_DEFINITIONS.supportedTypes,
            },
          },
        )
        expect(
          [...new Set(elements.filter(isInstanceElement).map(e => e.elemID.typeName))].sort()
        ).toEqual([
          'MCMService_EnergySourceTypes',
        ])
        expect(elements.filter(isInstanceElement)).toHaveLength(145)
      })
    })
  })
})
