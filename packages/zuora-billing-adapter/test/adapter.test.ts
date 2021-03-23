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
import { InstanceElement, isInstanceElement, TypeMap, ObjectType, ElemID, MapType } from '@salto-io/adapter-api'
import { config as configUtils } from '@salto-io/adapter-components'
import * as adapterComponents from '@salto-io/adapter-components'
import { buildElementsSourceFromElements, naclCase } from '@salto-io/adapter-utils'
import { adapter } from '../src/adapter_creator'
import { oauthClientCredentialsType } from '../src/auth'
import { configType, FETCH_CONFIG, API_DEFINITIONS_CONFIG, DEFAULT_INCLUDE_TYPES, DEFAULT_API_DEFINITIONS } from '../src/config'
import mockReplies from './mock_replies.json'
import { ZUORA_BILLING, CUSTOM_OBJECT_DEFINITION_TYPE, CUSTOM_OBJECT, STANDARD_OBJECT } from '../src/constants'
import { isObjectDef } from '../src/transformers/transformer'

type MockReply = {
  url: string
  params: Record<string, string>
  response: unknown
}

const getObjectDefTypes = (): Record<string, ObjectType> => {
  const customObjectDefType = new ObjectType({
    elemID: new ElemID(ZUORA_BILLING, CUSTOM_OBJECT_DEFINITION_TYPE),
  })
  const customObjectDefinitionsType = new ObjectType({
    elemID: new ElemID(ZUORA_BILLING, 'CustomObjectDefinitions'),
    fields: {
      additionalProperties: {
        type: new MapType(customObjectDefType),
      },
    },
  })
  const customObjectType = new ObjectType({
    elemID: new ElemID(ZUORA_BILLING, CUSTOM_OBJECT),
    fields: {
      definitions: { type: customObjectDefinitionsType },
    },
  })
  const standardObjectType = new ObjectType({
    elemID: new ElemID(ZUORA_BILLING, STANDARD_OBJECT),
    fields: {
      definitions: { type: customObjectDefinitionsType },
    },
  })

  return _.keyBy(
    [customObjectDefType, customObjectDefinitionsType, customObjectType, standardObjectType],
    e => e.elemID.name,
  )
}

const generateMockTypes = async (): Promise<{
  allTypes: TypeMap
  parsedConfigs: Record<string, configUtils.RequestableTypeSwaggerConfig>
}> => ({
  allTypes: {
    ...Object.fromEntries([...DEFAULT_INCLUDE_TYPES, 'Workflows'].map(
      type => [naclCase(type), new ObjectType({ elemID: new ElemID(ZUORA_BILLING, type) })]
    )),
    ...getObjectDefTypes(),
  },
  parsedConfigs: {
    CatalogProduct: {
      request: {
        url: '/v1/catalog/products',
      },
    },
    CustomObject: {
      request: {
        url: '/objects/definitions/default',
      },
    },
    AccountingCodes: {
      request: {
        url: '/v1/accounting-codes',
      },
    },
    AccountingPeriods: {
      request: {
        url: '/v1/accounting-periods',
      },
    },
    HostedPages: {
      request: {
        url: '/v1/hostedpages',
      },
    },
    NotificationDefinitions: {
      request: {
        url: '/notifications/notification-definitions',
      },
    },
    NotificationEmailTemplates: {
      request: {
        url: '/notifications/email-templates',
      },
    },
    PaymentGateways: {
      request: {
        url: '/v1/paymentgateways',
      },
    },
    SequenceSets: {
      request: {
        url: '/v1/sequence-sets',
      },
    },
    WorkflowExport: {
      request: {
        url: '/workflows/{workflow_id}/export',
      },
    },
    Workflows: {
      request: {
        url: '/workflows',
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
        generateTypes: jest.fn().mockImplementation(
          generateMockTypes
        ),
      },
    },
  }
})

describe('adapter', () => {
  jest.setTimeout(10 * 1000)
  let mockAxiosAdapter: MockAdapter

  beforeEach(async () => {
    mockAxiosAdapter = new MockAdapter(axios, { delayResponse: 1, onNoMatch: 'throwException' })
    mockAxiosAdapter.onGet(
      '/users/me', undefined, expect.objectContaining({ 'x-user-email': 'user123', 'x-user-token': 'token456' }),
    ).reply(200, {
      id: 'user123',
    });
    (mockReplies as MockReply[]).forEach(({ url, params, response }) => {
      mockAxiosAdapter.onGet(url, !_.isEmpty(params) ? { params } : undefined).replyOnce(
        200, response
      )
    })
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
            { clientId: 'client', clientSecret: 'secret', baseUrl: 'http://localhost:8080' },
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

        expect(adapterComponents.elements.swagger.generateTypes).toHaveBeenCalledTimes(1)
        expect(adapterComponents.elements.swagger.generateTypes).toHaveBeenCalledWith(
          ZUORA_BILLING,
          DEFAULT_API_DEFINITIONS,
        )
        expect(elements.filter(isInstanceElement)).toHaveLength(8)
        expect(
          _.sortedUniq(elements.filter(isInstanceElement).map(e => e.elemID.typeName))
        ).toEqual([
          'CatalogProduct',
          'AccountingCodes',
          'AccountingPeriods',
          'HostedPages',
          'NotificationDefinitions',
          'NotificationEmailTemplates',
          'PaymentGateways',
          'SequenceSets',
        ])
        expect(elements.filter(isObjectDef)).toHaveLength(2)
        expect(_.sortedUniq(elements.filter(isObjectDef).map(e => e.elemID.name))).toEqual(['account', 'accountingcode'])
      })
    })
  })

  describe('deploy', () => {
    it('should throw not implemented', async () => {
      const operations = await adapter.operations({
        credentials: new InstanceElement(
          'config',
          oauthClientCredentialsType,
          { token: 'token', baseUrl: 'http://localhost:8080' },
        ),
        config: new InstanceElement(
          'config',
          configType,
          {
            [FETCH_CONFIG]: {
              includeTypes: DEFAULT_INCLUDE_TYPES,
            },
            [API_DEFINITIONS_CONFIG]: {
              [API_DEFINITIONS_CONFIG]: DEFAULT_API_DEFINITIONS,
            },
          }
        ),
        elementsSource: buildElementsSourceFromElements([]),
      })
      await expect(operations.deploy({ changeGroup: { groupID: '', changes: [] } })).rejects.toThrow(new Error('Not implemented.'))
    })
  })
})
