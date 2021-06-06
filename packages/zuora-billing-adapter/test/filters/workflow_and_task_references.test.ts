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
import {
  ObjectType, ElemID, InstanceElement, Element, ReferenceExpression, BuiltinTypes,
  isInstanceElement, isReferenceExpression,
} from '@salto-io/adapter-api'
import { client as clientUtils, filterUtils } from '@salto-io/adapter-components'
import { DetailedDependency } from '@salto-io/adapter-utils'
import ZuoraClient from '../../src/client/client'
import { ZUORA_BILLING, WORKFLOW_TYPE, TASK_TYPE, STANDARD_OBJECT, METADATA_TYPE } from '../../src/constants'
import filterCreator from '../../src/filters/workflow_and_task_references'

/* eslint-disable camelcase */

describe('Workflow and task references filter', () => {
  let client: ZuoraClient
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType

  const generateElements = (): Element[] => {
    const workflowType = new ObjectType({
      elemID: new ElemID(ZUORA_BILLING, WORKFLOW_TYPE),
    })
    const taskType = new ObjectType({
      elemID: new ElemID(ZUORA_BILLING, TASK_TYPE),
    })

    const wf1 = new InstanceElement(
      'wf1',
      workflowType,
      {
        id: 111,
        name: 'workflow 1',
        description: 'do things',
        type: 'Workflow::Setup',
        additionalProperties: {
          parameters: {
            fields: [{
              index: '0',
              default: '',
              datatype: 'Text',
              required: true,
              callout_id: 'BillRunID',
              field_name: 'Id',
              object_name: 'Billingrun',
            }],
          },
          ondemand_trigger: true,
          callout_trigger: true,
          scheduled_trigger: false,
          status: 'Active',
          css: {
            top: '40px',
            left: '35px',
          },
        },
        notifications: {
          emails: [],
          failure: false,
          pending: false,
          success: false,
        },
        call_type: 'ASYNC',
        priority: 'Medium',
        delete_ttl: 30,
      },
    )
    const wf2 = new InstanceElement(
      'wf2',
      workflowType,
      {
        id: 123,
        name: 'workflow 2',
        description: 'do other things',
        type: 'Workflow::Setup',
        additionalProperties: {
          ondemand_trigger: true,
          callout_trigger: true,
          scheduled_trigger: false,
          status: 'Active',
          css: {
            top: '40px',
            left: '35px',
          },
        },
        notifications: {
          emails: [],
          failure: false,
          pending: false,
          success: false,
        },
        call_type: 'ASYNC',
        priority: 'Medium',
        delete_ttl: 30,
      },
    )
    const wf3 = new InstanceElement(
      'wf3',
      workflowType,
      {
        id: 111,
        name: 'workflow 3',
        description: 'do things',
        type: 'Workflow::Setup',
        additionalProperties: {
          parameters: {
            fields: [{
              index: '0',
              default: '',
              datatype: 'Text',
              required: true,
              callout_id: 'BillRunID',
              field_name: 'Id',
              object_name: 'invalid',
            }],
          },
          ondemand_trigger: true,
          callout_trigger: true,
          scheduled_trigger: false,
          status: 'Active',
          css: {
            top: '40px',
            left: '35px',
          },
        },
        notifications: {
          emails: [],
          failure: false,
          pending: false,
          success: false,
        },
        call_type: 'ASYNC',
        priority: 'Medium',
        delete_ttl: 30,
      },
    )
    const task1 = new InstanceElement(
      'task1',
      taskType,
      {
        id: 13,
        name: 'do one thing',
        parameters: {
          fields: {
            Refund: {
              Id: 'true',
              ReasonCode: 'true',
              RefundDate: 'true',
            },
            Invoice: {
              Id: 'true',
              Balance: 'true',
              InvoiceDate: 'true',
              InvoiceNumber: 'true',
            },
          },
          where_clause: "Refund.ReasonCode = 'Chargeback' and Invoice.Balance > 0",
        },
        action_type: 'Export',
        object: 'RefundInvoicePayment',
        call_type: 'SOAP',
      },
    )
    const task2 = new InstanceElement(
      'task2',
      taskType,
      {
        id: 23,
        name: 'do one more thing',
        object: 'Account',
        call_type: 'SOAP',
      },
    )

    const standardObjects = [
      new ObjectType({
        elemID: new ElemID(ZUORA_BILLING, 'account'),
        fields: {
          Id: { refType: BuiltinTypes.STRING },
        },
        annotations: {
          [METADATA_TYPE]: STANDARD_OBJECT,
        },
      }),
      new ObjectType({
        elemID: new ElemID(ZUORA_BILLING, 'RefundInvoicePayment'),
        annotations: {
          [METADATA_TYPE]: STANDARD_OBJECT,
        },
      }),
      new ObjectType({
        elemID: new ElemID(ZUORA_BILLING, 'Billingrun'),
        fields: {
          Id: { refType: BuiltinTypes.STRING },
        },
        annotations: {
          [METADATA_TYPE]: STANDARD_OBJECT,
        },
      }),
      new ObjectType({
        elemID: new ElemID(ZUORA_BILLING, 'Refund'),
        fields: {
          Id: { refType: BuiltinTypes.STRING },
          ReasonCode: { refType: BuiltinTypes.STRING },
          RefundDate: { refType: BuiltinTypes.STRING },
        },
        annotations: {
          [METADATA_TYPE]: STANDARD_OBJECT,
        },
      }),
      new ObjectType({
        elemID: new ElemID(ZUORA_BILLING, 'Invoice'),
        fields: {
          Id: { refType: BuiltinTypes.STRING },
          InvoiceNumber: { refType: BuiltinTypes.NUMBER },
        },
        annotations: {
          [METADATA_TYPE]: STANDARD_OBJECT,
        },
      }),
    ]

    return [workflowType, taskType, wf1, wf2, wf3, task1, task2, ...standardObjects]
  }

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

  describe('workflow and task references', () => {
    let origElements: Element[]
    let elements: Element[]
    beforeAll(async () => {
      origElements = generateElements()
      elements = generateElements()
      await filter.onFetch(elements)
    })
    it('add references in workflows', () => {
      expect(elements.length).toEqual(origElements.length)
      const workflows = elements.filter(isInstanceElement).filter(e => e.elemID.typeName === 'Workflow')
      expect(workflows).toHaveLength(3)

      const wf1Param0 = workflows[0].value.additionalProperties.parameters.fields[0]
      expect(wf1Param0.object_name).toBeInstanceOf(ReferenceExpression)
      expect((wf1Param0.object_name as ReferenceExpression).elemID.getFullName()).toEqual('zuora_billing.Billingrun')
      expect(wf1Param0.field_name).toBeInstanceOf(ReferenceExpression)
      expect((wf1Param0.field_name as ReferenceExpression).elemID.getFullName()).toEqual('zuora_billing.Billingrun.field.Id')
      // eslint-disable-next-line no-underscore-dangle
      expect(workflows[0].annotations._generated_dependencies).toBeUndefined()
    })
    it('add references in tasks', () => {
      expect(elements.length).toEqual(origElements.length)
      const tasks = elements.filter(isInstanceElement).filter(e => e.elemID.typeName === 'Task')
      expect(tasks).toHaveLength(2)

      expect(tasks[0].value.object).toBeInstanceOf(ReferenceExpression)
      expect((tasks[0].value.object as ReferenceExpression).elemID.getFullName()).toEqual('zuora_billing.RefundInvoicePayment')
      // eslint-disable-next-line no-underscore-dangle
      const task1Deps = tasks[0].annotations._generated_dependencies as DetailedDependency[]
      expect(task1Deps.map(e => e.reference).every(isReferenceExpression)).toBeTruthy()
      expect(task1Deps.map(e => e.occurrences).every(oc => oc === undefined)).toBeTruthy()
      expect(task1Deps.map(e => e.reference.elemID.getFullName())).toEqual([
        'zuora_billing.Invoice.field.Id',
        // Invoice.Balance and InvoiceDate do not exist on the object so they are not referenced
        'zuora_billing.Invoice.field.InvoiceNumber',
        'zuora_billing.Refund.field.Id',
        'zuora_billing.Refund.field.ReasonCode',
        'zuora_billing.Refund.field.RefundDate',
      ])

      expect(tasks[1].value.object).toBeInstanceOf(ReferenceExpression)
      expect((tasks[1].value.object as ReferenceExpression).elemID.getFullName()).toEqual('zuora_billing.account')
      // eslint-disable-next-line no-underscore-dangle
      expect(tasks[1].annotations._generated_dependencies).toBeUndefined()
    })
    it('not add references in workflows when the referenced objects is missing', () => {
      expect(elements.length).toEqual(origElements.length)
      const wf3 = elements.filter(isInstanceElement).filter(e => e.elemID.name === 'wf3')[0]

      const wf3Param0 = wf3.value.additionalProperties.parameters.fields[0]
      expect(wf3Param0.object_name).not.toBeInstanceOf(ReferenceExpression)
      expect(wf3Param0.object_name).toEqual('invalid')
    })
  })
})
