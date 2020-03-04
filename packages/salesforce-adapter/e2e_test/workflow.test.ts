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
  InstanceElement, Element,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { FilterWith } from 'src/filter'
import realAdapter from './adapter'
import SalesforceClient from '../src/client/client'
import workflowFilter, {
  WORKFLOW_ALERTS_FIELD, WORKFLOW_FIELD_UPDATES_FIELD, WORKFLOW_RULES_FIELD, WORKFLOW_TASKS_FIELD,
  WORKFLOW_FIELD_TO_TYPE,
} from '../src/filters/workflow'
import missingFieldsFilter from '../src/filters/missing_fields'
import { WORKFLOW_METADATA_TYPE, INSTANCE_FULL_NAME_FIELD } from '../src/constants'
import SalesforceAdapter from '../src/adapter'
import { findElements } from '../test/utils'
import { getInstance, getMetadata, removeIfAlreadyExists, createAndVerify, removeElementAndVerify } from './utils'

describe('workflow filter', () => {
  // Set long timeout as we communicate with salesforce API
  jest.setTimeout(1000000)

  let client: SalesforceClient
  let adapter: SalesforceAdapter
  let fetchResult: Element[]

  beforeAll(() => {
    ({ adapter, client } = realAdapter())
  })

  describe('should fetch Workflow instances', () => {
    let leadWorkflow: InstanceElement

    const verifySubInstance = (subField: string, _subName: string,
      _subDescription: string): void => {
      expect(leadWorkflow.value[subField]).toBeDefined()
      // TODO: should be deleted WIP
      // console.log(JSON.stringify(leadWorkflow)
      // console.log(JSON.stringify(leadWorkflow.value[subField]))
      // const subElemId = makeArray(leadWorkflow.value[subField])
      //  .find((alert: {elemId: ElemID}) => alert.elemId.name === subName)
      // const subInstance = wu(findElementsByID(result, subElemId)).toArray()[0] as InstanceElement
      // expect(subInstance.value.description).toEqual(subDescription)
    }

    beforeAll(async () => {
      const temp = await getInstance(client, WORKFLOW_METADATA_TYPE, 'Lead')
      expect(temp).toBeDefined()
      fetchResult = [temp as InstanceElement]
      const filters = [missingFieldsFilter({ client }), workflowFilter({ client })] as FilterWith<'onFetch'>[]
      filters[0].onFetch(fetchResult)
      filters[1].onFetch(fetchResult)
      leadWorkflow = findElements(fetchResult, WORKFLOW_METADATA_TYPE, 'Lead')[0] as InstanceElement
    })
    it('should fetch workflow', async () => {
      expect(leadWorkflow.value[INSTANCE_FULL_NAME_FIELD]).toBeDefined()
    })

    it('should fetch workflow alerts', async () => {
      verifySubInstance(WORKFLOW_ALERTS_FIELD, 'Lead.TestWorkflowAlert', 'E2E Fetch WorkflowAlert')
    })

    it('should fetch workflow field updates', async () => {
      verifySubInstance(WORKFLOW_FIELD_UPDATES_FIELD, 'Lead.TestWorkflowFieldUpdate',
        'E2E Fetch WorkflowFieldUpdate')
    })

    it('should fetch workflow task', async () => {
      verifySubInstance(WORKFLOW_TASKS_FIELD, 'Lead.TestWorkflowTask', 'E2E Fetch WorkflowTask')
    })

    it('should fetch workflow rule', async () => {
      verifySubInstance(WORKFLOW_RULES_FIELD, 'Lead.TestWorkflowRule', 'E2E Fetch WorkflowRule')
    })
  })

  describe('workflow instance manipulations', () => {
    describe('workflow alerts manipulations', () => {
      const alertType = WORKFLOW_FIELD_TO_TYPE[WORKFLOW_ALERTS_FIELD]
      const newInstanceName = 'Lead.MyWorkflowAlert'
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
      const newInstanceName = 'Lead.MyWorkflowFieldUpdate'
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
      const newInstanceName = 'Lead.MyWorkflowTask'
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
      const newInstanceName = 'Lead.MyWorkflowRule'
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
              field: 'Lead.Company',
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
