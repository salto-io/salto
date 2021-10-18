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
import { InstanceElement, isInstanceElement, ObjectType, ElemID, MapType, ListType, BuiltinTypes } from '@salto-io/adapter-api'
import { elements as elementUtils } from '@salto-io/adapter-components'
import * as adapterComponents from '@salto-io/adapter-components'
import { buildElementsSourceFromElements, naclCase } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { adapter } from '../src/adapter_creator'
import { oauthClientCredentialsType } from '../src/auth'
import { configType, FETCH_CONFIG, API_DEFINITIONS_CONFIG, DEFAULT_INCLUDE_TYPES, DEFAULT_API_DEFINITIONS, DEFAULT_SETTINGS_INCLUDE_TYPES } from '../src/config'
import mockReplies from './mock_replies.json'
import { ZUORA_BILLING, CUSTOM_OBJECT_DEFINITION_TYPE, CUSTOM_OBJECT, STANDARD_OBJECT, LIST_ALL_SETTINGS_TYPE } from '../src/constants'
import { isObjectDef } from '../src/element_utils'

const { awu } = collections.asynciterable

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
        refType: new MapType(customObjectDefType),
      },
    },
  })
  const customObjectType = new ObjectType({
    elemID: new ElemID(ZUORA_BILLING, CUSTOM_OBJECT),
    fields: {
      definitions: { refType: customObjectDefinitionsType },
    },
  })
  const standardObjectType = new ObjectType({
    elemID: new ElemID(ZUORA_BILLING, STANDARD_OBJECT),
    fields: {
      definitions: { refType: customObjectDefinitionsType },
    },
  })

  return _.keyBy(
    [customObjectDefType, customObjectDefinitionsType, customObjectType, standardObjectType],
    e => e.elemID.name,
  )
}

const generateMockTypes: typeof elementUtils.swagger.generateTypes = async (
  adapterName, config, schemasAndRefs
) => {
  if (schemasAndRefs !== undefined) {
    const res = await jest.requireActual('@salto-io/adapter-components').elements.swagger.generateTypes(adapterName, config, schemasAndRefs)
    return res
  }
  return {
    allTypes: {
      ...Object.fromEntries(DEFAULT_INCLUDE_TYPES.map(
        type => [naclCase(type), new ObjectType({ elemID: new ElemID(ZUORA_BILLING, type) })]
      )),
      ...getObjectDefTypes(),
      [LIST_ALL_SETTINGS_TYPE]: new ObjectType({
        elemID: new ElemID(ZUORA_BILLING, LIST_ALL_SETTINGS_TYPE),
        fields: {
          settings: { refType: new ListType(BuiltinTypes.UNKNOWN) },
        },
      }),
      Workflows: new ObjectType({
        elemID: new ElemID(ZUORA_BILLING, 'Workflows'),
        fields: {
          data: { refType: new ListType(new ObjectType({ elemID: new ElemID(ZUORA_BILLING, 'Workflow') })) },
          pagination: { refType: BuiltinTypes.UNKNOWN },
        },
      }),
      EventTriggers: new ObjectType({
        elemID: new ElemID(ZUORA_BILLING, 'EventTriggers'),
        fields: {
          data: { refType: new ListType(new ObjectType({ elemID: new ElemID(ZUORA_BILLING, 'EventTrigger') })) },
        },
      }),
      NotificationDefinitions: new ObjectType({
        elemID: new ElemID(ZUORA_BILLING, 'NotificationDefinitions'),
        fields: {
          data: { refType: new ListType(new ObjectType({ elemID: new ElemID(ZUORA_BILLING, 'PublicNotificationDefinition') })) },
        },
      }),
      NotificationEmailTemplates: new ObjectType({
        elemID: new ElemID(ZUORA_BILLING, 'NotificationEmailTemplates'),
        fields: {
          data: { refType: new ListType(new ObjectType({ elemID: new ElemID(ZUORA_BILLING, 'PublicEmailTemplate') })) },
        },
      }),
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
      ListAllSettings: {
        request: {
          url: '/settings/listing',
        },
      },
    },
  }
}

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
  jest.setTimeout(10 * 1000)
  let mockAxiosAdapter: MockAdapter

  beforeEach(async () => {
    mockAxiosAdapter = new MockAdapter(axios, { delayResponse: 1, onNoMatch: 'throwException' })
    mockAxiosAdapter.onPost('/oauth/token').reply(200, {
      // eslint-disable-next-line camelcase
      token_type: 'bearer', access_token: 'token123', expires_in: 10000,
    })
    mockAxiosAdapter.onPost('/v1/connections').reply(200, { success: true });
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
            { clientId: 'client', clientSecret: 'secret', subdomain: 'sandbox.na', production: false },
          ),
          config: new InstanceElement(
            'config',
            configType,
            {
              [FETCH_CONFIG]: {
                includeTypes: DEFAULT_INCLUDE_TYPES,
                settingsIncludeTypes: DEFAULT_SETTINGS_INCLUDE_TYPES,
              },
              [API_DEFINITIONS_CONFIG]: DEFAULT_API_DEFINITIONS,
            }
          ),
          elementsSource: buildElementsSourceFromElements([]),
        }).fetch({ progressReporter: { reportProgress: () => null } })

        expect(adapterComponents.elements.swagger.generateTypes).toHaveBeenCalledTimes(2)
        expect(adapterComponents.elements.swagger.generateTypes).toHaveBeenCalledWith(
          ZUORA_BILLING,
          DEFAULT_API_DEFINITIONS,
        )
        expect(
          [...new Set(elements.filter(isInstanceElement).map(e => e.elemID.typeName))].sort()
        ).toEqual([
          'AccountingCodes',
          'AccountingPeriods',
          'CatalogProduct',
          'HostedPages',
          'PaymentGateways',
          'SequenceSets',
          'Settings_ApplicationRules',
          'Settings_BillingCycleType',
          'Settings_BillingListPriceBase',
          'Settings_BillingPeriod',
          'Settings_BillingPeriodStart',
          'Settings_BillingRules',
          'Settings_ChargeModel',
          'Settings_ChargeType',
          'Settings_Codes',
          'Settings_CommunicationProfile',
          'Settings_Currency',
          'Settings_DocPrefix',
          'Settings_FxCurrency',
          'Settings_Gateway',
          'Settings_HostedPaymentPage',
          'Settings_NumberAndSku',
          'Settings_PaymentMethods',
          'Settings_PaymentRetryRules',
          'Settings_PaymentTerm',
          'Settings_ReasonCode',
          'Settings_RevenueRecognitionStatus',
          'Settings_RevenueStartDate',
          'Settings_SingleAlias',
          'Settings_SubscriptionSetting',
          'Settings_TaxCode',
          'Settings_TaxCompany',
          'Settings_UnitOfMeasure',
          'WorkflowExport',
        ])
        expect(elements.filter(isInstanceElement)).toHaveLength(141)
        expect(await awu(elements).filter(isObjectDef).toArray()).toHaveLength(2)
        expect([...new Set(
          await awu(elements).filter(isObjectDef).map(e => e.elemID.name).toArray()
        )].sort()).toEqual(['account', 'accountingcode'])
        // ensure pagination is working
        expect(elements.filter(isInstanceElement).filter(inst => inst.elemID.typeName === 'WorkflowExport')).toHaveLength(6)
      })
    })
    describe('without settings types', () => {
      it('should generate the right elements on fetch', async () => {
        const { elements } = await adapter.operations({
          credentials: new InstanceElement(
            'config',
            oauthClientCredentialsType,
            { clientId: 'client', clientSecret: 'secret', subdomain: 'sandbox.na', production: false },
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
        expect(
          [...new Set(elements.filter(isInstanceElement).map(e => e.elemID.typeName))].sort()
        ).toEqual([
          'AccountingCodes',
          'AccountingPeriods',
          'CatalogProduct',
          'HostedPages',
          'PaymentGateways',
          'SequenceSets',
          'WorkflowExport',
        ])
        expect(elements.filter(isInstanceElement)).toHaveLength(12)
        expect(await awu(elements).filter(isObjectDef).toArray()).toHaveLength(2)
        expect([...new Set(
          await awu(elements).filter(isObjectDef).map(e => e.elemID.name).toArray()
        )].sort()).toEqual(['account', 'accountingcode'])
      })
    })
    describe('without settings types and standard objects', () => {
      it('should generate the right elements on fetch', async () => {
        const { elements } = await adapter.operations({
          credentials: new InstanceElement(
            'config',
            oauthClientCredentialsType,
            { clientId: 'client', clientSecret: 'secret', subdomain: '', production: true },
          ),
          config: new InstanceElement(
            'config',
            configType,
            {
              [FETCH_CONFIG]: {
                includeTypes: DEFAULT_INCLUDE_TYPES.filter(t => t !== 'StandardObject'),
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
        expect(
          [...new Set(elements.filter(isInstanceElement).map(e => e.elemID.typeName))].sort()
        ).toEqual([
          'AccountingCodes',
          'AccountingPeriods',
          'CatalogProduct',
          'HostedPages',
          'PaymentGateways',
          'SequenceSets',
          'WorkflowExport',
        ])
        expect(elements.filter(isInstanceElement)).toHaveLength(12)
        expect(await awu(elements).filter(isObjectDef).toArray()).toHaveLength(0)
      })
    })
  })

  describe('deploy', () => {
    it('should throw not implemented', async () => {
      const operations = adapter.operations({
        credentials: new InstanceElement(
          'config',
          oauthClientCredentialsType,
          { clientId: 'client', clientSecret: 'secret', subdomain: 'sandbox.na', production: false },
        ),
        config: new InstanceElement(
          'config',
          configType,
          {
            [FETCH_CONFIG]: {
              includeTypes: DEFAULT_INCLUDE_TYPES,
              settingsIncludeTypes: DEFAULT_SETTINGS_INCLUDE_TYPES,
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
