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
  InstanceElement,
  Element,
  ElemID,
  ObjectType,
} from '@salto-io/adapter-api'
import {
  findElements as findElementsByID,
  findElement,
} from '@salto-io/adapter-utils'
import _ from 'lodash'
import { MetadataInfo } from '@salto-io/jsforce-types'
import { CredsLease } from '@salto-io/e2e-credentials-store'
import realAdapter from './adapter'
import SalesforceClient from '../src/client/client'
import { UsernamePasswordCredentials } from '../src/types'
import {
  WORKFLOW_ALERTS_FIELD,
  WORKFLOW_FIELD_UPDATES_FIELD,
  WORKFLOW_RULES_FIELD,
  WORKFLOW_TASKS_FIELD,
  WORKFLOW_FIELD_TO_TYPE,
} from '../src/filters/workflow'
import {
  SALESFORCE,
  INSTANCE_FULL_NAME_FIELD,
  WORKFLOW_METADATA_TYPE,
  WORKFLOW_FIELD_UPDATE_METADATA_TYPE,
  WORKFLOW_RULE_METADATA_TYPE,
  WORKFLOW_TASK_METADATA_TYPE,
  WORKFLOW_ACTION_ALERT_METADATA_TYPE,
} from '../src/constants'
import SalesforceAdapter from '../src/adapter'
import { findElements } from '../test/utils'
import {
  getMetadataInstance,
  getMetadata,
  removeMetadataIfAlreadyExists,
  createAndVerify,
  removeElementAndVerify,
  fetchTypes,
  runFiltersOnFetch,
  nullProgressReporter,
} from './utils'
import { testHelpers } from './jest_environment'

describe('workflow filter', () => {
  // Set long timeout as we communicate with salesforce API
  jest.setTimeout(1000000)

  let client: SalesforceClient
  let adapter: SalesforceAdapter
  let fetchResult: Element[]
  let credLease: CredsLease<UsernamePasswordCredentials>
  beforeAll(async () => {
    credLease = await testHelpers().credentials()
    const adapterParams = realAdapter({
      credentials: new UsernamePasswordCredentials(credLease.value),
    })
    adapter = adapterParams.adapter
    client = adapterParams.client
  })

  afterAll(async () => {
    if (credLease.return) {
      await credLease.return()
    }
  })
  const baseCustomObject = 'Lead'

  describe('should fetch Workflow instances', () => {
    let workflows: Element[]

    const verifyHasWorkflowAlert = async (): Promise<void> => {
      await client.upsert(WORKFLOW_ACTION_ALERT_METADATA_TYPE, {
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
      await client.upsert(WORKFLOW_FIELD_UPDATE_METADATA_TYPE, {
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
      await client.upsert(WORKFLOW_TASK_METADATA_TYPE, {
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
      await client.upsert(WORKFLOW_RULE_METADATA_TYPE, {
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

    const verifySubInstance = (
      subTypeName: string,
      subName: string,
      subDescription: string,
    ): void => {
      const subElemId = new ElemID(
        'salesforce',
        subTypeName,
        'instance',
        subName,
      )
      const [subInstance] = findElementsByID(
        fetchResult,
        subElemId,
      ) as Iterable<InstanceElement>
      expect(subInstance.value.description).toEqual(subDescription)
    }

    beforeAll(async () => {
      await verifyWorkflowInnerTypesExist()
      const rawWorkflowTypes = await fetchTypes(client, [
        WORKFLOW_METADATA_TYPE,
        ...Object.values(WORKFLOW_FIELD_TO_TYPE),
      ])
      const rawWorkflowInstance = await getMetadataInstance(
        client,
        findElement(
          rawWorkflowTypes,
          new ElemID(SALESFORCE, WORKFLOW_METADATA_TYPE),
        ) as ObjectType,
        baseCustomObject,
      )
      expect(rawWorkflowInstance).toBeDefined()
      fetchResult = [
        ...rawWorkflowTypes,
        rawWorkflowInstance as InstanceElement,
      ]
      await runFiltersOnFetch(client, {}, fetchResult)
      workflows = findElements(
        fetchResult,
        WORKFLOW_METADATA_TYPE,
        baseCustomObject,
      )
    })
    describe('fetch workflow', () => {
      it('should remove workflow instance', async () => {
        expect(workflows).toHaveLength(0)
      })
    })
    describe('fetch workflow alerts', () => {
      it('should fetch workflow alerts', async () => {
        verifySubInstance(
          WORKFLOW_ACTION_ALERT_METADATA_TYPE,
          `${baseCustomObject}_TestWorkflowAlert@v`,
          'E2E Fetch WorkflowAlert',
        )
      })
    })
    describe('fetch workflow field updates', () => {
      it('should fetch workflow field updates', async () => {
        verifySubInstance(
          WORKFLOW_FIELD_UPDATE_METADATA_TYPE,
          `${baseCustomObject}_TestWorkflowFieldUpdate@v`,
          'E2E Fetch WorkflowFieldUpdate',
        )
      })
    })
    describe('fetch workflow task', () => {
      it('should fetch workflow task', async () => {
        verifySubInstance(
          WORKFLOW_TASK_METADATA_TYPE,
          `${baseCustomObject}_TestWorkflowTask@v`,
          'E2E Fetch WorkflowTask',
        )
      })
    })
    describe('fetch workflow rule', () => {
      it('should fetch workflow rule', async () => {
        verifySubInstance(
          WORKFLOW_RULE_METADATA_TYPE,
          `${baseCustomObject}_TestWorkflowRule@v`,
          'E2E Fetch WorkflowRule',
        )
      })
    })
  })

  describe('workflow instance manipulations', () => {
    describe('workflow alerts manipulations', () => {
      const alertType = WORKFLOW_FIELD_TO_TYPE[WORKFLOW_ALERTS_FIELD]
      const newInstanceName = `${baseCustomObject}.MyWorkflowAlert`
      let newAlert: InstanceElement
      beforeAll(async () => {
        await removeMetadataIfAlreadyExists(client, alertType, newInstanceName)
      })
      describe('create workflow alert', () => {
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

          newAlert = await createAndVerify(
            adapter,
            client,
            alertType,
            value,
            fetchResult,
          )
        })
      })
      describe('update workflow alert', () => {
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

          await adapter.deploy({
            changeGroup: {
              groupID: newAlert.elemID.getFullName(),
              changes: [
                {
                  action: 'modify',
                  data: { before: oldAlert, after: newAlert },
                },
              ],
            },
            progressReporter: nullProgressReporter,
          })

          const postUpdate = await getMetadata(
            client,
            alertType,
            newInstanceName,
          )
          expect(postUpdate).toBeDefined()
          expect(_.get(postUpdate, 'description')).toEqual(
            'My Updated Workflow Alert',
          )
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
          expect(_.get(postUpdate, 'template')).toEqual(
            'unfiled$public/SupportCaseResponse',
          )
        })
      })
      describe('delete workflow alert', () => {
        it('should delete workflow alert', async () => {
          await removeElementAndVerify(adapter, client, newAlert)
        })
      })
    })

    describe('workflow field updates manipulations', () => {
      const fieldUpdateType =
        WORKFLOW_FIELD_TO_TYPE[WORKFLOW_FIELD_UPDATES_FIELD]
      const newInstanceName = `${baseCustomObject}.MyWorkflowFieldUpdate`
      let newInstance: InstanceElement
      beforeAll(async () => {
        await removeMetadataIfAlreadyExists(
          client,
          fieldUpdateType,
          newInstanceName,
        )
      })
      describe('should create workflow field update', () => {
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
          newInstance = await createAndVerify(
            adapter,
            client,
            fieldUpdateType,
            value,
            fetchResult,
          )
        })
      })
      describe('should update workflow field update', () => {
        it('should update workflow field update', async () => {
          const old = newInstance.clone()
          newInstance.value.description = 'My Updated Workflow Field Update'
          newInstance.value.field = 'Rating'
          newInstance.value.operation = 'PreviousValue'
          newInstance.value.reevaluateOnChange = false

          await adapter.deploy({
            changeGroup: {
              groupID: newInstance.elemID.getFullName(),
              changes: [
                { action: 'modify', data: { before: old, after: newInstance } },
              ],
            },
            progressReporter: nullProgressReporter,
          })

          const workflowFieldUpdateInfo = await getMetadata(
            client,
            fieldUpdateType,
            newInstanceName,
          )
          expect(workflowFieldUpdateInfo).toBeDefined()
          expect(_.get(workflowFieldUpdateInfo, 'description')).toEqual(
            'My Updated Workflow Field Update',
          )
          expect(_.get(workflowFieldUpdateInfo, 'field')).toEqual('Rating')
          expect(_.get(workflowFieldUpdateInfo, 'operation')).toEqual(
            'PreviousValue',
          )
          expect(_.get(workflowFieldUpdateInfo, 'reevaluateOnChange')).toEqual(
            'false',
          )
        })
      })
      describe('should delete workflow field update', () => {
        it('should delete workflow field update', async () => {
          await removeElementAndVerify(adapter, client, newInstance)
        })
      })
    })

    describe('workflow tasks manipulations', () => {
      const taskType = WORKFLOW_FIELD_TO_TYPE[WORKFLOW_TASKS_FIELD]
      const newInstanceName = `${baseCustomObject}.MyWorkflowTask`
      let newInstance: InstanceElement
      beforeAll(async () => {
        await removeMetadataIfAlreadyExists(client, taskType, newInstanceName)
      })
      describe('create workflow task', () => {
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

          newInstance = await createAndVerify(
            adapter,
            client,
            taskType,
            value,
            fetchResult,
          )
        })
      })

      describe('update workflow task', () => {
        it('should update workflow task', async () => {
          const old = newInstance.clone()
          newInstance.value.description = 'My Updated Workflow Task'

          await adapter.deploy({
            changeGroup: {
              groupID: newInstance.elemID.getFullName(),
              changes: [
                { action: 'modify', data: { before: old, after: newInstance } },
              ],
            },
            progressReporter: nullProgressReporter,
          })

          const workflowTaskInfo = await getMetadata(
            client,
            taskType,
            newInstanceName,
          )
          expect(workflowTaskInfo).toBeDefined()
          expect(_.get(workflowTaskInfo, 'description')).toEqual(
            'My Updated Workflow Task',
          )
        })
      })
      describe('delete workflow task', () => {
        it('should delete workflow task', async () => {
          await removeElementAndVerify(adapter, client, newInstance)
        })
      })
    })

    describe('workflow rules manipulations', () => {
      const rulesType = WORKFLOW_FIELD_TO_TYPE[WORKFLOW_RULES_FIELD]
      const newInstanceName = `${baseCustomObject}.MyWorkflowRule`
      let newInstance: InstanceElement
      beforeAll(async () => {
        await removeMetadataIfAlreadyExists(client, rulesType, newInstanceName)
      })
      describe('create workflow rule', () => {
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

          newInstance = await createAndVerify(
            adapter,
            client,
            rulesType,
            value,
            fetchResult,
          )
        })
      })
      describe('update workflow rule', () => {
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

          await adapter.deploy({
            changeGroup: {
              groupID: newInstance.elemID.getFullName(),
              changes: [
                { action: 'modify', data: { before: old, after: newInstance } },
              ],
            },
            progressReporter: nullProgressReporter,
          })

          const workflowRuleInfo = await getMetadata(
            client,
            rulesType,
            newInstanceName,
          )
          expect(workflowRuleInfo).toBeDefined()
          expect(_.get(workflowRuleInfo, 'description')).toEqual(
            'My Updated Workflow Rule',
          )
          expect(_.get(workflowRuleInfo, 'criteriaItems')).toBeUndefined()
          expect(_.get(workflowRuleInfo, 'formula')).toEqual('true')
          expect(_.get(workflowRuleInfo, 'triggerType')).toEqual(
            'onCreateOrTriggeringUpdate',
          )
          const workflowTimeTrigger = _.get(
            workflowRuleInfo,
            'workflowTimeTriggers',
          )
          expect(workflowTimeTrigger.actions).toEqual({
            name: 'TestWorkflowFieldUpdate',
            type: 'FieldUpdate',
          })
          expect(workflowTimeTrigger.timeLength).toEqual('2')
          expect(workflowTimeTrigger.workflowTimeTriggerUnit).toEqual('Days')
        })
      })
      describe('delete workflow rule', () => {
        it('should delete workflow rule', async () => {
          await removeElementAndVerify(adapter, client, newInstance)
        })
      })
    })
  })
})
