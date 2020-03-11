/*
*                      Copyright 2020 Salto Labs Ltd.
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
  InstanceElement, Element, ElemID, ObjectType,
} from '@salto-io/adapter-api'
import {
  findElements as findElementsByID, findElement,
} from '@salto-io/adapter-utils'
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import { MetadataInfo } from 'jsforce-types'
import realAdapter from './adapter'
import SalesforceClient from '../src/client/client'
import {
  WORKFLOW_ALERTS_FIELD, WORKFLOW_FIELD_UPDATES_FIELD, WORKFLOW_RULES_FIELD, WORKFLOW_TASKS_FIELD,
  WORKFLOW_FIELD_TO_TYPE,
} from '../src/filters/workflow'
import { WORKFLOW_METADATA_TYPE, INSTANCE_FULL_NAME_FIELD, SALESFORCE } from '../src/constants'
import SalesforceAdapter from '../src/adapter'
import { findElements } from '../test/utils'
import {
  getInstance, getMetadata, removeIfAlreadyExists, createAndVerify, removeElementAndVerify,
  fetchTypes, runFiltersOnFetch,
} from './utils'

const { makeArray } = collections.array

describe('workflow filter', () => {
  // Set long timeout as we communicate with salesforce API
  jest.setTimeout(1000000)

  let client: SalesforceClient
  let adapter: SalesforceAdapter
  let fetchResult: Element[]

  beforeAll(() => {
    ({ adapter, client } = realAdapter())
  })
  const baseCustomObject = 'Lead'

  describe('should fetch Workflow instances', () => {
    let workflow: InstanceElement

    const verifyHasWorkflowAlert = async (): Promise<void> => {
      await client.upsert('WorkflowAlert', {
        fullName: `${baseCustomObject}.TestWorkflowAlert`,
        description: 'E2E Fetch WorkflowAlert',
        protected: false,
        recipients: [
          {
            recipient: 'CEO',
            type: 'role',
          },
        ],
        senderType: 'CurrentUser',
        template: 'unfiled$public/SupportCaseResponse',
      } as MetadataInfo)
    }

    const verifyHasWorkflowFieldUpdate = async (): Promise<void> => {
      await client.upsert('WorkflowFieldUpdate', {
        fullName: `${baseCustomObject}.TestWorkflowFieldUpdate`,
        name: 'TestWorkflowFieldUpdate',
        description: 'E2E Fetch WorkflowFieldUpdate',
        field: 'Company',
        notifyAssignee: false,
        protected: false,
        operation: 'Null',
      } as MetadataInfo)
    }

    const verifyHasWorkflowTask = async (): Promise<void> => {
      await client.upsert('WorkflowTask', {
        fullName: `${baseCustomObject}.TestWorkflowTask`,
        assignedTo: 'CEO',
        assignedToType: 'role',
        description: 'E2E Fetch WorkflowTask',
        dueDateOffset: 1,
        notifyAssignee: false,
        priority: 'Normal',
        protected: false,
        status: 'Not Started',
        subject: 'TestWorkflowOutboundMessage',
      } as MetadataInfo)
    }

    const verifyHasWorkflowRule = async (): Promise<void> => {
      await client.upsert('WorkflowRule', {
        fullName: `${baseCustomObject}.TestWorkflowRule`,
        actions: [
          {
            name: 'TestWorkflowAlert',
            type: 'Alert',
          },
          {
            name: 'TestWorkflowFieldUpdate',
            type: 'FieldUpdate',
          },
          {
            name: 'TestWorkflowTask',
            type: 'Task',
          },
        ],
        active: false,
        criteriaItems: [
          {
            field: `${baseCustomObject}.Company`,
            operation: 'notEqual',
            value: 'BLA',
          },
        ],
        description: 'E2E Fetch WorkflowRule',
        triggerType: 'onCreateOnly',
        workflowTimeTriggers: [
          {
            actions: [
              {
                name: 'TestWorkflowAlert',
                type: 'Alert',
              },
            ],
            timeLength: '1',
            workflowTimeTriggerUnit: 'Hours',
          },
        ],
      } as MetadataInfo)
    }

    const verifyWorkflowInnerTypesExist = async (): Promise<void> => {
      await Promise.all([
        verifyHasWorkflowAlert(),
        verifyHasWorkflowFieldUpdate(),
        verifyHasWorkflowTask(),
      ])
      return verifyHasWorkflowRule() // WorkflowRule depends on Alert, FieldUpdate & Task
    }

    const verifySubInstance = (subField: string, subName: string,
      subDescription: string): void => {
      expect(workflow.value[subField]).toBeDefined()
      const subElemId = makeArray(workflow.value[subField])
        .find((ref: {elemId: ElemID}) => ref.elemId.name === subName)?.elemId
      const [subInstance] = findElementsByID(fetchResult, subElemId) as Iterable<InstanceElement>
      expect(subInstance.value.description).toEqual(subDescription)
    }

    beforeAll(async () => {
      await verifyWorkflowInnerTypesExist()
      const rawWorkflowTypes = await fetchTypes(client, [WORKFLOW_METADATA_TYPE,
        ...Object.values(WORKFLOW_FIELD_TO_TYPE)])
      const rawWorkflowInstance = await getInstance(client,
        findElement(rawWorkflowTypes, new ElemID(SALESFORCE, WORKFLOW_METADATA_TYPE)) as ObjectType,
        baseCustomObject)
      expect(rawWorkflowInstance).toBeDefined()
      fetchResult = [...rawWorkflowTypes, rawWorkflowInstance as InstanceElement]
      await runFiltersOnFetch(client, fetchResult)
      const workflows = findElements(fetchResult, WORKFLOW_METADATA_TYPE, baseCustomObject)
      workflow = workflows[0] as InstanceElement
    })
    it('should fetch workflow', async () => {
      expect(workflow.value[INSTANCE_FULL_NAME_FIELD]).toBe(baseCustomObject)
    })

    it('should fetch workflow alerts', async () => {
      verifySubInstance(WORKFLOW_ALERTS_FIELD, `${baseCustomObject}_TestWorkflowAlert`,
        'E2E Fetch WorkflowAlert')
    })

    it('should fetch workflow field updates', async () => {
      verifySubInstance(WORKFLOW_FIELD_UPDATES_FIELD,
        `${baseCustomObject}_TestWorkflowFieldUpdate`,
        'E2E Fetch WorkflowFieldUpdate')
    })

    it('should fetch workflow task', async () => {
      verifySubInstance(WORKFLOW_TASKS_FIELD, `${baseCustomObject}_TestWorkflowTask`,
        'E2E Fetch WorkflowTask')
    })

    it('should fetch workflow rule', async () => {
      verifySubInstance(WORKFLOW_RULES_FIELD, `${baseCustomObject}_TestWorkflowRule`,
        'E2E Fetch WorkflowRule')
    })
  })

  describe('workflow instance manipulations', () => {
    describe('workflow alerts manipulations', () => {
      const alertType = WORKFLOW_FIELD_TO_TYPE[WORKFLOW_ALERTS_FIELD]
      const newInstanceName = `${baseCustomObject}.MyWorkflowAlert`
      let newAlert: InstanceElement
      beforeAll(async () => {
        await removeIfAlreadyExists(client, alertType, newInstanceName)
      })

      it('should create workflow alert', async () => {
        const value = {
          [INSTANCE_FULL_NAME_FIELD]: newInstanceName,
          description: 'My Workflow Alert',
          protected: false,
          recipients: [
            {
              recipient: 'CEO',
              type: 'role',
            },
          ],
          senderType: 'CurrentUser',
          template: 'unfiled$public/SalesNewCustomerEmail',
        }

        newAlert = await createAndVerify(adapter, client, alertType, value)
      })

      it('should update workflow alert', async () => {
        const oldAlert = newAlert.clone()
        newAlert.value.description = 'My Updated Workflow Alert'
        newAlert.value.recipients = [
          {
            recipient: 'CEO',
            type: 'role',
          },
          {
            recipient: 'CFO',
            type: 'role',
          },
        ]
        newAlert.value.template = 'unfiled$public/SupportCaseResponse'

        await adapter.update(oldAlert, newAlert,
          [{ action: 'modify', data: { before: oldAlert, after: newAlert } }])

        const postUpdate = await getMetadata(client, alertType, newInstanceName)
        expect(postUpdate).toBeDefined()
        expect(_.get(postUpdate, 'description')).toEqual('My Updated Workflow Alert')
        expect(_.get(postUpdate, 'recipients')).toEqual([
          {
            recipient: 'CEO',
            type: 'role',
          },
          {
            recipient: 'CFO',
            type: 'role',
          },
        ])
        expect(_.get(postUpdate, 'template'))
          .toEqual('unfiled$public/SupportCaseResponse')
      })

      it('should delete workflow alert', async () => {
        await removeElementAndVerify(adapter, client, newAlert)
      })
    })

    describe('workflow field updates manipulations', () => {
      const fieldUpdateType = WORKFLOW_FIELD_TO_TYPE[WORKFLOW_FIELD_UPDATES_FIELD]
      const newInstanceName = `${baseCustomObject}.MyWorkflowFieldUpdate`
      let newInstance: InstanceElement
      beforeAll(async () => {
        await removeIfAlreadyExists(client, fieldUpdateType, newInstanceName)
      })

      it('should create workflow field update', async () => {
        const value = {
          [INSTANCE_FULL_NAME_FIELD]: newInstanceName,
          name: 'TestWorkflowFieldUpdate',
          description: 'My Workflow Field Update',
          field: 'Company',
          formula: 'LastName',
          notifyAssignee: false,
          reevaluateOnChange: true,
          protected: false,
          operation: 'Formula',
        }
        newInstance = await createAndVerify(adapter, client, fieldUpdateType, value)
      })

      it('should update workflow field update', async () => {
        const old = newInstance.clone()
        newInstance.value.description = 'My Updated Workflow Field Update'
        newInstance.value.field = 'Rating'
        newInstance.value.operation = 'PreviousValue'
        newInstance.value.reevaluateOnChange = false

        await adapter.update(old, newInstance,
          [{ action: 'modify', data: { before: old, after: newInstance } }])

        const workflowFieldUpdateInfo = await getMetadata(client, fieldUpdateType,
          newInstanceName)
        expect(workflowFieldUpdateInfo).toBeDefined()
        expect(_.get(workflowFieldUpdateInfo, 'description'))
          .toEqual('My Updated Workflow Field Update')
        expect(_.get(workflowFieldUpdateInfo, 'field')).toEqual('Rating')
        expect(_.get(workflowFieldUpdateInfo, 'operation')).toEqual('PreviousValue')
        expect(_.get(workflowFieldUpdateInfo, 'reevaluateOnChange')).toBeUndefined()
      })

      it('should delete workflow field update', async () => {
        await removeElementAndVerify(adapter, client, newInstance)
      })
    })

    describe('workflow tasks manipulations', () => {
      const taskType = WORKFLOW_FIELD_TO_TYPE[WORKFLOW_TASKS_FIELD]
      const newInstanceName = `${baseCustomObject}.MyWorkflowTask`
      let newInstance: InstanceElement
      beforeAll(async () => {
        await removeIfAlreadyExists(client, taskType, newInstanceName)
      })

      it('should create workflow task', async () => {
        const value = {
          [INSTANCE_FULL_NAME_FIELD]: newInstanceName,
          assignedTo: 'CEO',
          assignedToType: 'role',
          description: 'My Workflow Task',
          dueDateOffset: 1,
          notifyAssignee: false,
          priority: 'Normal',
          protected: false,
          status: 'Not Started',
          subject: 'TestWorkflowOutboundMessage',
        }

        newInstance = await createAndVerify(adapter, client, taskType, value)
      })


      it('should update workflow task', async () => {
        const old = newInstance.clone()
        newInstance.value.description = 'My Updated Workflow Task'

        await adapter.update(old, newInstance,
          [{ action: 'modify', data: { before: old, after: newInstance } }])

        const workflowTaskInfo = await getMetadata(client, taskType, newInstanceName)
        expect(workflowTaskInfo).toBeDefined()
        expect(_.get(workflowTaskInfo, 'description')).toEqual('My Updated Workflow Task')
      })

      it('should delete workflow task', async () => {
        await removeElementAndVerify(adapter, client, newInstance)
      })
    })

    describe('workflow rules manipulations', () => {
      const rulesType = WORKFLOW_FIELD_TO_TYPE[WORKFLOW_RULES_FIELD]
      const newInstanceName = `${baseCustomObject}.MyWorkflowRule`
      let newInstance: InstanceElement
      beforeAll(async () => {
        await removeIfAlreadyExists(client, rulesType, newInstanceName)
      })

      it('should create workflow rule', async () => {
        const value = {
          [INSTANCE_FULL_NAME_FIELD]: newInstanceName,
          actions: [
            {
              name: 'TestWorkflowAlert',
              type: 'Alert',
            },
            {
              name: 'TestWorkflowFieldUpdate',
              type: 'FieldUpdate',
            },
            {
              name: 'TestWorkflowTask',
              type: 'Task',
            },
          ],
          active: false,
          criteriaItems: [
            {
              field: `${baseCustomObject}.Company`,
              operation: 'notEqual',
              value: 'BLA',
            },
          ],
          description: 'My Workflow Rule',
          triggerType: 'onCreateOnly',
          workflowTimeTriggers: [
            {
              actions: [
                {
                  name: 'TestWorkflowAlert',
                  type: 'Alert',
                },
              ],
              timeLength: '1',
              workflowTimeTriggerUnit: 'Hours',
            },
          ],
        }

        newInstance = await createAndVerify(adapter, client, rulesType, value)
      })

      it('should update workflow rule', async () => {
        const old = newInstance.clone()
        newInstance.value.description = 'My Updated Workflow Rule'
        newInstance.value.criteriaItems = []
        newInstance.value.formula = 'true'
        newInstance.value.triggerType = 'onCreateOrTriggeringUpdate'
        newInstance.value.workflowTimeTriggers = [
          {
            actions: [
              {
                name: 'TestWorkflowFieldUpdate',
                type: 'FieldUpdate',
              },
            ],
            timeLength: '2',
            workflowTimeTriggerUnit: 'Days',
          },
        ]

        await adapter.update(old, newInstance,
          [{ action: 'modify', data: { before: old, after: newInstance } }])

        const workflowRuleInfo = await getMetadata(client, rulesType, newInstanceName)
        expect(workflowRuleInfo).toBeDefined()
        expect(_.get(workflowRuleInfo, 'description')).toEqual('My Updated Workflow Rule')
        expect(_.get(workflowRuleInfo, 'criteriaItems')).toBeUndefined()
        expect(_.get(workflowRuleInfo, 'formula')).toEqual('true')
        expect(_.get(workflowRuleInfo, 'triggerType')).toEqual('onCreateOrTriggeringUpdate')
        const workflowTimeTrigger = _.get(workflowRuleInfo, 'workflowTimeTriggers')
        expect(workflowTimeTrigger.actions).toEqual({ name: 'TestWorkflowFieldUpdate',
          type: 'FieldUpdate' })
        expect(workflowTimeTrigger.timeLength).toEqual('2')
        expect(workflowTimeTrigger.workflowTimeTriggerUnit).toEqual('Days')
      })

      it('should delete workflow rule', async () => {
        await removeElementAndVerify(adapter, client, newInstance)
      })
    })
  })
})
