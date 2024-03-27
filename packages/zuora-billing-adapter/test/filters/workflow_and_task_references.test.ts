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
import {
  ObjectType,
  ElemID,
  InstanceElement,
  Element,
  ReferenceExpression,
  BuiltinTypes,
  isInstanceElement,
  isReferenceExpression,
  CORE_ANNOTATIONS,
} from '@salto-io/adapter-api'
import { client as clientUtils, filterUtils, elements as elementUtils } from '@salto-io/adapter-components'
import { DetailedDependency } from '@salto-io/adapter-utils'
import ZuoraClient from '../../src/client/client'
import { paginate } from '../../src/client/pagination'
import {
  ZUORA_BILLING,
  WORKFLOW_DETAILED_TYPE,
  TASK_TYPE,
  STANDARD_OBJECT,
  METADATA_TYPE,
  WORKFLOW_EXPORT_TYPE,
  OBJECT_TYPE,
} from '../../src/constants'
import filterCreator from '../../src/filters/workflow_and_task_references'
import { SUPPORTED_TYPES } from '../../src/config'

/* eslint-disable camelcase */

describe('Workflow and task references filter', () => {
  let client: ZuoraClient
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType

  const generateElements = (): Element[] => {
    const workflowTopType = new ObjectType({
      elemID: new ElemID(ZUORA_BILLING, WORKFLOW_EXPORT_TYPE),
    })
    const workflowType = new ObjectType({
      elemID: new ElemID(ZUORA_BILLING, WORKFLOW_DETAILED_TYPE),
    })
    const taskType = new ObjectType({
      elemID: new ElemID(ZUORA_BILLING, TASK_TYPE),
    })

    const wf1 = new InstanceElement('wf1', workflowType, {
      id: 111,
      name: 'workflow 1',
      description: 'do things',
      type: 'Workflow::Setup',
      parameters: {
        fields: [
          {
            index: '0',
            default: '',
            datatype: 'Text',
            required: true,
            callout_id: 'BillRunID',
            field_name: 'Id',
            object_name: 'Billingrun',
          },
          {
            index: '1',
            default: '',
            datatype: 'Text',
            required: true,
            callout_id: 'workflow_param',
            field_name: 'param',
            object_name: 'Workflow',
          },
        ],
      },
      ondemand_trigger: true,
      callout_trigger: true,
      scheduled_trigger: false,
      status: 'Active',
      css: {
        top: '40px',
        left: '35px',
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
    })
    const wf2 = new InstanceElement('wf2', workflowType, {
      id: 123,
      name: 'workflow 2',
      description: 'do other things',
      type: 'Workflow::Setup',
      ondemand_trigger: true,
      callout_trigger: true,
      scheduled_trigger: false,
      status: 'Active',
      css: {
        top: '40px',
        left: '35px',
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
    })
    const wf3 = new InstanceElement('wf3', workflowType, {
      id: 111,
      name: 'workflow 3',
      description: 'do things',
      type: 'Workflow::Setup',
      parameters: {
        fields: [
          {
            index: '0',
            default: '',
            datatype: 'Text',
            required: true,
            callout_id: 'BillRunID',
            field_name: 'Id',
            object_name: 'invalid',
          },
          {
            index: '1',
            default: '',
            datatype: 'Text',
            required: true,
            callout_id: '',
            field_name: '',
            not_object_name: '',
          },
          {
            index: '2',
            default: '',
            datatype: 'Text',
            required: true,
            callout_id: 'BillRunID',
            field_name: 'not_a_field',
            object_name: 'Billingrun',
          },
        ],
      },
      ondemand_trigger: true,
      callout_trigger: true,
      scheduled_trigger: false,
      status: 'Active',
      css: {
        top: '40px',
        left: '35px',
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
    })

    const w1 = new InstanceElement('w1', workflowTopType, {
      workflow: new ReferenceExpression(wf1.elemID),
    })

    const w2 = new InstanceElement('w2', workflowTopType, {
      workflow: new ReferenceExpression(wf2.elemID),
    })

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
            NotAPlainObject: 'false',
          },
          where_clause:
            "Refund.ReasonCode = 'Chargeback' and Invoice.Balance > 0 and Data.Workflow.param != 3 or Data.Workflow.not_a_param == 2",
        },
        action_type: 'Export',
        object: 'RefundInvoicePayment',
        call_type: 'SOAP',
      },
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(w1.elemID)],
      },
    )
    const task2 = new InstanceElement(
      'task2',
      taskType,
      {
        id: 23,
        name: 'do one more thing',
        parameters: {
          where_clause: 'Data.Workflow.param == 2',
        },
        object: 'Account',
        call_type: 'SOAP',
      },
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(w2.elemID)],
      },
    )

    const task3 = new InstanceElement('task3', taskType, {
      id: 24,
      name: 'do one more thing',
      parameters: {
        where_clause: 'Data.Workflow.param == 2',
      },
      object: 'Account',
      call_type: 'SOAP',
    })

    const standardObjects = [
      new ObjectType({
        elemID: new ElemID(ZUORA_BILLING, 'account'),
        fields: {
          Id: { refType: BuiltinTypes.STRING },
        },
        annotations: {
          [METADATA_TYPE]: STANDARD_OBJECT,
          [OBJECT_TYPE]: 'account',
        },
      }),
      new ObjectType({
        elemID: new ElemID(ZUORA_BILLING, 'RefundInvoicePayment'),
        annotations: {
          [METADATA_TYPE]: STANDARD_OBJECT,
          [OBJECT_TYPE]: 'RefundInvoicePayment',
        },
      }),
      new ObjectType({
        elemID: new ElemID(ZUORA_BILLING, 'Billingrun'),
        fields: {
          Id: { refType: BuiltinTypes.STRING },
        },
        annotations: {
          [METADATA_TYPE]: STANDARD_OBJECT,
          [OBJECT_TYPE]: 'Billingrun',
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
          [OBJECT_TYPE]: 'Refund',
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
          [OBJECT_TYPE]: 'Invoice',
        },
      }),
    ]

    return [workflowTopType, workflowType, taskType, w1, w2, wf1, wf2, wf3, task1, task2, task3, ...standardObjects]
  }

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
  describe('fail when there are no types or instances', () => {
    let origElements: Element[]
    let elements: Element[]
    it(`should return when ${WORKFLOW_EXPORT_TYPE} type doesn't exists`, async () => {
      origElements = generateElements().filter(
        e => e.elemID.typeName !== WORKFLOW_EXPORT_TYPE || e.elemID.idType !== 'type',
      )
      elements = generateElements().filter(
        e => e.elemID.typeName !== WORKFLOW_EXPORT_TYPE || e.elemID.idType !== 'type',
      )
      await filter.onFetch(elements)
      expect(elements).toEqual(origElements)
    })
    it(`should return when ${WORKFLOW_DETAILED_TYPE} type doesn't exists`, async () => {
      origElements = generateElements().filter(
        e => e.elemID.typeName !== WORKFLOW_DETAILED_TYPE || e.elemID.idType !== 'type',
      )
      elements = generateElements().filter(
        e => e.elemID.typeName !== WORKFLOW_DETAILED_TYPE || e.elemID.idType !== 'type',
      )
      await filter.onFetch(elements)
      expect(elements).toEqual(origElements)
    })
    it(`should return when ${TASK_TYPE} type doesn't exists`, async () => {
      origElements = generateElements().filter(e => e.elemID.typeName !== TASK_TYPE || e.elemID.idType !== 'type')
      elements = generateElements().filter(e => e.elemID.typeName !== TASK_TYPE || e.elemID.idType !== 'type')
      await filter.onFetch(elements)
      expect(elements).toEqual(origElements)
    })
    it(`should return when there aren't any instances of ${WORKFLOW_DETAILED_TYPE} and ${TASK_TYPE}`, async () => {
      origElements = generateElements().filter(
        e => ![WORKFLOW_DETAILED_TYPE, TASK_TYPE].includes(e.elemID.typeName) || e.elemID.idType !== 'instance',
      )
      elements = generateElements().filter(
        e => ![WORKFLOW_DETAILED_TYPE, TASK_TYPE].includes(e.elemID.typeName) || e.elemID.idType !== 'instance',
      )
      await filter.onFetch(elements)
      expect(elements).toEqual(origElements)
    })
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
      expect(elements).not.toEqual(origElements)
      expect(elements.length).toEqual(origElements.length)
      const workflows = elements.filter(isInstanceElement).filter(e => e.elemID.typeName === WORKFLOW_DETAILED_TYPE)
      expect(workflows).toHaveLength(3)

      const wf1Param0 = workflows[0].value.parameters.fields[0]
      expect(wf1Param0.object_name).toBeInstanceOf(ReferenceExpression)
      expect((wf1Param0.object_name as ReferenceExpression).elemID.getFullName()).toEqual('zuora_billing.Billingrun')
      expect(wf1Param0.field_name).toBeInstanceOf(ReferenceExpression)
      expect((wf1Param0.field_name as ReferenceExpression).elemID.getFullName()).toEqual(
        'zuora_billing.Billingrun.field.Id',
      )
      // eslint-disable-next-line no-underscore-dangle
      expect(workflows[0].annotations._generated_dependencies).toBeUndefined()
    })
    it('add references in tasks', () => {
      expect(elements.length).toEqual(origElements.length)
      const tasks = elements.filter(isInstanceElement).filter(e => e.elemID.typeName === TASK_TYPE)
      expect(tasks).toHaveLength(3)

      // eslint-disable-next-line no-underscore-dangle
      const task1Deps = tasks[0].annotations._generated_dependencies as DetailedDependency[]
      expect(task1Deps.map(e => e.reference).every(isReferenceExpression)).toBeTruthy()
      expect(
        task1Deps.every(
          e => !_.isEmpty(e.occurrences) && e.occurrences?.every(oc => isReferenceExpression(oc.location)),
        ),
      ).toBeTruthy()
      expect(task1Deps.map(e => e.reference.elemID.getFullName())).toEqual([
        'zuora_billing.Invoice.field.Id',
        // Invoice.Balance and InvoiceDate do not exist on the object so they are not referenced
        'zuora_billing.Invoice.field.InvoiceNumber',
        'zuora_billing.Refund.field.Id',
        'zuora_billing.Refund.field.ReasonCode',
        'zuora_billing.Refund.field.RefundDate',
        'zuora_billing.Workflow.instance.wf1.parameters.fields',
      ])

      // eslint-disable-next-line no-underscore-dangle
      expect(tasks[1].annotations._generated_dependencies).toBeUndefined()
      // eslint-disable-next-line no-underscore-dangle
      expect(tasks[2].annotations._generated_dependencies).toBeUndefined()
    })
    it('not add references in workflows when the referenced objects is missing', () => {
      expect(elements.length).toEqual(origElements.length)
      const wf3 = elements.filter(isInstanceElement).filter(e => e.elemID.name === 'wf3')[0]

      const wf3Param0 = wf3.value.parameters.fields[0]
      expect(wf3Param0.object_name).not.toBeInstanceOf(ReferenceExpression)
      expect(wf3Param0.object_name).toEqual('invalid')
    })
  })
})
