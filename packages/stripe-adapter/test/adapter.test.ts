/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'
import { ElemID, InstanceElement, isInstanceElement, ObjectType, ProgressReporter } from '@salto-io/adapter-api'
import { definitions } from '@salto-io/adapter-components'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { adapter } from '../src/adapter_creator'
import { credentialsType } from '../src/auth'
import { DEFAULT_CONFIG } from '../src/config'
import fetchMockReplies from './mock_replies.json'
import { ADAPTER_NAME } from '../src/constants'

type MockReply = {
  url: string
  method: definitions.HTTPMethod
  params?: Record<string, string>
  response: unknown
}

const getMockFunction = (method: definitions.HTTPMethod, mockAxiosAdapter: MockAdapter): MockAdapter['onAny'] => {
  switch (method.toLowerCase()) {
    case 'get':
      return mockAxiosAdapter.onGet
    case 'put':
      return mockAxiosAdapter.onPut
    case 'post':
      return mockAxiosAdapter.onPost
    case 'patch':
      return mockAxiosAdapter.onPatch
    case 'delete':
      return mockAxiosAdapter.onDelete
    case 'head':
      return mockAxiosAdapter.onHead
    case 'options':
      return mockAxiosAdapter.onOptions
    default:
      return mockAxiosAdapter.onGet
  }
}

describe('adapter', () => {
  jest.setTimeout(10 * 1000)
  let mockAxiosAdapter: MockAdapter

  beforeEach(async () => {
    mockAxiosAdapter = new MockAdapter(axios, { delayResponse: 1, onNoMatch: 'throwException' })
    mockAxiosAdapter.onGet('/v1/products').replyOnce(200) // used in validateCredentials
    ;(fetchMockReplies as MockReply[]).forEach(({ url, method, params, response }) => {
      const mock = getMockFunction(method, mockAxiosAdapter).bind(mockAxiosAdapter)
      const handler = mock(url, !_.isEmpty(params) ? { params } : undefined)
      handler.replyOnce(200, response)
    })
  })

  afterEach(() => {
    mockAxiosAdapter.restore()
    jest.clearAllMocks()
  })

  describe('fetch', () => {
    describe('full', () => {
      it('should generate the right elements on fetch', async () => {
        expect(adapter.configType).toBeDefined()
        const { elements } = await adapter
          .operations({
            credentials: new InstanceElement('config', credentialsType, { token: 'testToken' }),
            config: new InstanceElement('config', adapter.configType as ObjectType, DEFAULT_CONFIG),
            elementsSource: buildElementsSourceFromElements([]),
          })
          .fetch({ progressReporter: { reportProgress: () => null } })

        expect([...new Set(elements.filter(isInstanceElement).map(e => e.elemID.typeName))].sort()).toEqual([
          'country_spec',
          'coupon',
          'product',
          'reporting_report_type',
          'tax_rate',
          'webhook_endpoint',
        ])
        expect(
          elements
            .filter(isInstanceElement)
            .map(e => e.elemID.getFullName())
            .sort(),
        ).toEqual([
          'stripe.country_spec.instance.AR',
          'stripe.coupon.instance.testCoupon_forever_S8nceGxL',
          'stripe.product.instance.abc_prod_JMpOpTpdX5rDKy',
          'stripe.product.instance.sfdsfsf_prod_JMpOpTpdX5rDKx',
          'stripe.reporting_report_type.instance.balance_summary_1@v',
          'stripe.tax_rate.instance.Sales_tax_txr_1Jwt1JHipyrr1EYi3coTN5Y9_AL_3@suuuu',
          'stripe.webhook_endpoint.instance.we_1IcrkHHipyrr1EYiSGhlscV7',
        ])
      })
    })
  })

  describe('deploy', () => {
    it('throws Error on deploy', async () => {
      const adapterOperations = adapter.operations({
        credentials: new InstanceElement('config', credentialsType, { token: 'testToken' }),
        config: new InstanceElement('config', adapter.configType as ObjectType, DEFAULT_CONFIG),
        elementsSource: buildElementsSourceFromElements([]),
      })
      const nullProgressReporter: ProgressReporter = {
        reportProgress: () => {},
      }
      expect(
        await adapterOperations.deploy({
          changeGroup: {
            groupID: 'g',
            changes: [
              {
                action: 'add',
                data: {
                  after: new InstanceElement('aaa', new ObjectType({ elemID: new ElemID(ADAPTER_NAME, 'price') })),
                },
              },
            ],
          },
          progressReporter: nullProgressReporter,
        }),
      ).toEqual({
        appliedChanges: [],
        errors: [
          {
            message: 'no deploy definitions found, cannot deploy changes',
            severity: 'Error',
          },
        ],
      })
    })
  })
})
