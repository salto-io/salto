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
import { ElemID, InstanceElement, ObjectType, ReferenceExpression, Element, BuiltinTypes, isInstanceElement } from '@salto-io/adapter-api'
import { client as clientUtils, filterUtils } from '@salto-io/adapter-components'
import filterCreator from '../../src/filters/field_references'
import ZuoraClient from '../../src/client/client'
import { ZUORA_BILLING } from '../../src/constants'


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
        paginationFunc: clientUtils.getWithCursorPagination,
      }),
      config: {
        fetch: {
          includeTypes: [],
        },
        apiDefinitions: {
          swagger: { url: 'ignore' },
          typeDefaults: {
            transformation: {
              idFields: ['name'],
            },
          },
          types: {},
        },
      },
    }) as FilterType
  })

  const workflowType = new ObjectType({
    elemID: new ElemID(ZUORA_BILLING, 'Workflow'),
    fields: {
      id: { type: BuiltinTypes.NUMBER },
    },
  })
  const taskType = new ObjectType({
    elemID: new ElemID(ZUORA_BILLING, 'Task'),
    fields: {
      id: { type: BuiltinTypes.NUMBER },
    },
  })
  const settingsRevenueRecognitionRuleType = new ObjectType({
    elemID: new ElemID(ZUORA_BILLING, 'Settings_RevenueRecognitionRule'),
    fields: {
      name: { type: BuiltinTypes.STRING },
    },
  })

  const linkageType = new ObjectType({
    elemID: new ElemID(ZUORA_BILLING, 'Linkage'),
    fields: {
      // eslint-disable-next-line @typescript-eslint/camelcase
      source_workflow_id: { type: BuiltinTypes.NUMBER },
      // eslint-disable-next-line @typescript-eslint/camelcase
      source_task_id: { type: BuiltinTypes.NUMBER },
      // eslint-disable-next-line @typescript-eslint/camelcase
      target_task_id: { type: BuiltinTypes.NUMBER },
    },
  })
  const productRatePlanChargeType = new ObjectType({
    elemID: new ElemID(ZUORA_BILLING, 'GETProductRatePlanChargeType'),
    fields: {
      revenueRecognitionRuleName: { type: BuiltinTypes.STRING },
    },
  })
  const someOtherType = new ObjectType({
    elemID: new ElemID(ZUORA_BILLING, 'OtherType'),
    fields: {
      revenueRecognitionRuleName: { type: BuiltinTypes.STRING },
    },
  })

  const generateElements = (
  ): Element[] => ([
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
      // eslint-disable-next-line @typescript-eslint/camelcase
      source_workflow_id: 123, source_task_id: 0, target_task_id: 22,
    }),
    productRatePlanChargeType,
    new InstanceElement('chargeType55', productRatePlanChargeType, { revenueRecognitionRuleName: 'rule5 name' }),
    new InstanceElement('chargeType66', productRatePlanChargeType, { revenueRecognitionRuleName: 'unknown rule' }),
    someOtherType,
    new InstanceElement('otherType55', someOtherType, { revenueRecognitionRuleName: 'rule5 name' }),
  ])

  describe('on fetch', () => {
    let elements: Element[]

    beforeAll(async () => {
      elements = generateElements()
      await filter.onFetch(elements)
    })

    it('should resolve field values when referenced element exists', () => {
      const link = elements.filter(
        e => isInstanceElement(e) && e.type.elemID.name === 'Linkage'
      )[0] as InstanceElement
      expect(link.value.source_workflow_id).toBeInstanceOf(ReferenceExpression)
      expect(link.value.source_workflow_id?.elemId.getFullName()).toEqual('zuora_billing.Workflow.instance.workflow123')
      expect(link.value.target_task_id).toBeInstanceOf(ReferenceExpression)
      expect(link.value.target_task_id?.elemId.getFullName()).toEqual('zuora_billing.Task.instance.task22')

      const chargeTypes = elements.filter(
        e => isInstanceElement(e)
        && e.type.elemID.name === 'GETProductRatePlanChargeType'
        && e.elemID.name === 'chargeType55'
      ) as InstanceElement[]
      expect(chargeTypes[0].value.revenueRecognitionRuleName).toBeInstanceOf(ReferenceExpression)
      expect(chargeTypes[0].value.revenueRecognitionRuleName.elemId.getFullName()).toEqual('zuora_billing.Settings_RevenueRecognitionRule.instance.rule5')
    })

    it('should not resolve fields in unexpected types even if field name matches', () => {
      const others = elements.filter(
        e => isInstanceElement(e) && e.type.elemID.name === 'OtherType'
      ) as InstanceElement[]
      expect(others[0].value.revenueRecognitionRuleName).not.toBeInstanceOf(ReferenceExpression)
      expect(others[0].value.revenueRecognitionRuleName).toEqual('rule5 name')
    })

    it('should not resolve if referenced element does not exist', () => {
      const link = elements.filter(
        e => isInstanceElement(e) && e.type.elemID.name === 'Linkage'
      )[0] as InstanceElement
      expect(link.value.source_task_id).not.toBeInstanceOf(ReferenceExpression)
      expect(link.value.source_task_id).toEqual(0)

      const chargeTypes = elements.filter(
        e => isInstanceElement(e)
        && e.type.elemID.name === 'GETProductRatePlanChargeType'
        && e.elemID.name === 'chargeType66'
      ) as InstanceElement[]
      expect(chargeTypes[0].value.revenueRecognitionRuleName).not.toBeInstanceOf(
        ReferenceExpression
      )
      expect(chargeTypes[0].value.revenueRecognitionRuleName).toEqual('unknown rule')
    })
  })
})
