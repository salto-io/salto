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
import {
  ElemID,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  Element,
  BuiltinTypes,
  isInstanceElement,
} from '@salto-io/adapter-api'
import { client as clientUtils, filterUtils, elements as elementUtils } from '@salto-io/adapter-components'
import filterCreator from '../../src/filters/field_references'
import ZuoraClient from '../../src/client/client'
import { paginate } from '../../src/client/pagination'
import { SETTINGS_TYPE_PREFIX, TASK_TYPE, WORKFLOW_DETAILED_TYPE, ZUORA_BILLING } from '../../src/constants'
import { SUPPORTED_TYPES } from '../../src/config'

describe('Field references filter', () => {
  let client: ZuoraClient
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType

  beforeAll(() => {
    client = new ZuoraClient({
      credentials: { baseURL: 'http://localhost', clientId: 'id', clientSecret: 'secret' },
    })
    filter = filterCreator({
      client,
      paginator: clientUtils.createPaginator({
        client,
        paginationFuncCreator: paginate,
      }),
      config: {
        fetch: {
          include: [],
          exclude: [],
        },
        apiDefinitions: {
          swagger: { url: 'ignore' },
          typeDefaults: {
            transformation: {
              idFields: ['name'],
            },
          },
          types: {},
          supportedTypes: SUPPORTED_TYPES,
        },
      },
      fetchQuery: elementUtils.query.createMockQuery(),
    }) as FilterType
  })

  const workflowType = new ObjectType({
    elemID: new ElemID(ZUORA_BILLING, WORKFLOW_DETAILED_TYPE),
    fields: {
      id: { refType: BuiltinTypes.NUMBER },
    },
  })
  const taskType = new ObjectType({
    elemID: new ElemID(ZUORA_BILLING, TASK_TYPE),
    fields: {
      id: { refType: BuiltinTypes.NUMBER },
    },
  })
  const settingsRevenueRecognitionRuleType = new ObjectType({
    elemID: new ElemID(ZUORA_BILLING, 'Settings_RevenueRecognitionRule'),
    fields: {
      name: { refType: BuiltinTypes.STRING },
    },
  })

  const linkageType = new ObjectType({
    elemID: new ElemID(ZUORA_BILLING, 'Linkage'),
    fields: {
      source_workflow_id: { refType: BuiltinTypes.NUMBER },
      source_task_id: { refType: BuiltinTypes.NUMBER },
      target_task_id: { refType: BuiltinTypes.NUMBER },
    },
  })
  const productRatePlanChargeType = new ObjectType({
    elemID: new ElemID(ZUORA_BILLING, 'GETProductRatePlanChargeType'),
    fields: {
      revenueRecognitionRuleName: { refType: BuiltinTypes.STRING },
    },
  })
  const someOtherType = new ObjectType({
    elemID: new ElemID(ZUORA_BILLING, 'OtherType'),
    fields: {
      revenueRecognitionRuleName: { refType: BuiltinTypes.STRING },
    },
  })
  const currencyType = new ObjectType({
    elemID: new ElemID(ZUORA_BILLING, `${SETTINGS_TYPE_PREFIX}Currency`),
    fields: {
      currencyCode: { refType: BuiltinTypes.STRING },
    },
  })
  const productRatePlanChargePricingType = new ObjectType({
    elemID: new ElemID(ZUORA_BILLING, 'GETProductRatePlanChargePricingType'),
    fields: {
      currency: { refType: BuiltinTypes.STRING },
    },
  })
  const segmentType = new ObjectType({
    elemID: new ElemID(ZUORA_BILLING, `${SETTINGS_TYPE_PREFIX}Segment`),
    fields: {
      segmentName: { refType: BuiltinTypes.STRING },
    },
  })
  const ruleDetailType = new ObjectType({
    elemID: new ElemID(ZUORA_BILLING, `${SETTINGS_TYPE_PREFIX}RuleDetail`),
    fields: {
      segmentName: { refType: BuiltinTypes.STRING },
    },
  })

  const generateElements = (): Element[] => [
    workflowType,
    new InstanceElement('workflow123', workflowType, { id: 123 }),
    new InstanceElement('workflow456', workflowType, { id: 456 }),
    taskType,
    new InstanceElement('task11', taskType, { id: 11 }),
    new InstanceElement('task22', taskType, { id: 22 }),
    settingsRevenueRecognitionRuleType,
    new InstanceElement('rule5', settingsRevenueRecognitionRuleType, { name: 'rule5 name' }),
    linkageType,
    new InstanceElement('workflow_linkage1', linkageType, {
      source_workflow_id: 123,
      source_task_id: 0,
      target_task_id: 22,
    }),
    productRatePlanChargeType,
    new InstanceElement('chargeType55', productRatePlanChargeType, { revenueRecognitionRuleName: 'rule5 name' }),
    new InstanceElement('chargeType66', productRatePlanChargeType, { revenueRecognitionRuleName: 'unknown rule' }),
    someOtherType,
    new InstanceElement('otherType55', someOtherType, { revenueRecognitionRuleName: 'rule5 name' }),
    currencyType,
    new InstanceElement('USD', currencyType, { currencyCode: 'USD' }),
    productRatePlanChargePricingType,
    new InstanceElement('pricing', productRatePlanChargePricingType, { currency: 'USD' }),
    segmentType,
    new InstanceElement('segment', segmentType, { segmentName: 'segment' }),
    ruleDetailType,
    new InstanceElement('rule', ruleDetailType, { segmentName: 'segment' }),
  ]

  describe('on fetch', () => {
    let elements: Element[]

    beforeAll(async () => {
      elements = generateElements()
      await filter.onFetch(elements)
    })

    it('should resolve field values when referenced element exists', () => {
      const link = elements.filter(
        e => isInstanceElement(e) && e.refType.elemID.name === 'Linkage',
      )[0] as InstanceElement
      expect(link.value.source_workflow_id).toBeInstanceOf(ReferenceExpression)
      expect(link.value.source_workflow_id?.elemID.getFullName()).toEqual(
        `zuora_billing.${WORKFLOW_DETAILED_TYPE}.instance.workflow123`,
      )
      expect(link.value.target_task_id).toBeInstanceOf(ReferenceExpression)
      expect(link.value.target_task_id?.elemID.getFullName()).toEqual(`zuora_billing.${TASK_TYPE}.instance.task22`)

      const chargeTypes = elements.filter(
        e =>
          isInstanceElement(e) &&
          e.refType.elemID.name === 'GETProductRatePlanChargeType' &&
          e.elemID.name === 'chargeType55',
      ) as InstanceElement[]
      expect(chargeTypes[0].value.revenueRecognitionRuleName).toBeInstanceOf(ReferenceExpression)
      expect(chargeTypes[0].value.revenueRecognitionRuleName.elemID.getFullName()).toEqual(
        'zuora_billing.Settings_RevenueRecognitionRule.instance.rule5',
      )

      const pricingInstance = elements.find(
        e =>
          isInstanceElement(e) &&
          e.refType.elemID.name === 'GETProductRatePlanChargePricingType' &&
          e.elemID.name === 'pricing',
      ) as InstanceElement
      expect(pricingInstance.value.currency).toBeInstanceOf(ReferenceExpression)
      expect(pricingInstance.value.currency.elemID.getFullName()).toEqual(
        `zuora_billing.${SETTINGS_TYPE_PREFIX}Currency.instance.USD`,
      )

      const ruleDetailInstance = elements.find(
        e =>
          isInstanceElement(e) &&
          e.refType.elemID.name === `${SETTINGS_TYPE_PREFIX}RuleDetail` &&
          e.elemID.name === 'rule',
      ) as InstanceElement
      expect(ruleDetailInstance.value.segmentName).toBeInstanceOf(ReferenceExpression)
      expect(ruleDetailInstance.value.segmentName.elemID.getFullName()).toEqual(
        `zuora_billing.${SETTINGS_TYPE_PREFIX}Segment.instance.segment`,
      )
    })

    it('should not resolve fields in unexpected types even if field name matches', () => {
      const others = elements.filter(
        e => isInstanceElement(e) && e.refType.elemID.name === 'OtherType',
      ) as InstanceElement[]
      expect(others[0].value.revenueRecognitionRuleName).not.toBeInstanceOf(ReferenceExpression)
      expect(others[0].value.revenueRecognitionRuleName).toEqual('rule5 name')
    })

    it('should not resolve if referenced element does not exist', () => {
      const link = elements.filter(
        e => isInstanceElement(e) && e.refType.elemID.name === 'Linkage',
      )[0] as InstanceElement
      expect(link.value.source_task_id).not.toBeInstanceOf(ReferenceExpression)
      expect(link.value.source_task_id).toEqual(0)

      const chargeTypes = elements.filter(
        e =>
          isInstanceElement(e) &&
          e.refType.elemID.name === 'GETProductRatePlanChargeType' &&
          e.elemID.name === 'chargeType66',
      ) as InstanceElement[]
      expect(chargeTypes[0].value.revenueRecognitionRuleName).not.toBeInstanceOf(ReferenceExpression)
      expect(chargeTypes[0].value.revenueRecognitionRuleName).toEqual('unknown rule')
    })
  })
})
