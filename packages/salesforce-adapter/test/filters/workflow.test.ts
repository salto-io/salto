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
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import {
  ElemID, InstanceElement, ObjectType, Element, ReferenceExpression, isInstanceElement, Change,
  getChangeElement, ModificationChange, isModificationChange, Value, isListType, ListType,
} from '@salto-io/adapter-api'
import {
  findElement,
} from '@salto-io/adapter-utils'
import { FilterWith } from '../../src/filter'
import filterCreator, {
  WORKFLOW_ALERTS_FIELD, WORKFLOW_FIELD_UPDATES_FIELD, WORKFLOW_RULES_FIELD,
  WORKFLOW_TASKS_FIELD, WORKFLOW_FIELD_TO_TYPE,
} from '../../src/filters/workflow'
import mockClient from '../client'
import {
  INSTANCE_FULL_NAME_FIELD, RECORDS_PATH, SALESFORCE, WORKFLOW_METADATA_TYPE,
} from '../../src/constants'
import { mockTypes } from '../mock_elements'
import { metadataType, apiName, createInstanceElement, MetadataValues, MetadataTypeAnnotations } from '../../src/transformers/transformer'
import { isInstanceOfTypeChange } from '../../src/filters/utils'

const { makeArray } = collections.array

describe('Workflow filter', () => {
  const { client } = mockClient()
  const filter = filterCreator({ client, config: {} }) as FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  const dummyElemID = new ElemID(SALESFORCE, 'dummy')
  const dummyObj = new ObjectType({ elemID: dummyElemID })
  const dummyRefToObj = new ReferenceExpression(dummyElemID, dummyObj)

  const workflowInstanceName = 'Account'
  const generateWorkFlowInstance = (): InstanceElement => (
    new InstanceElement(
      workflowInstanceName,
      mockTypes.Workflow,
      {
        [INSTANCE_FULL_NAME_FIELD]: workflowInstanceName,
        [WORKFLOW_ALERTS_FIELD]: [
          {
            [INSTANCE_FULL_NAME_FIELD]: 'MyWorkflowAlert1',
            description: 'description',
          },
          {
            [INSTANCE_FULL_NAME_FIELD]: 'MyWorkflowAlert2',
            description: 'description',
          },
        ],
        [WORKFLOW_FIELD_UPDATES_FIELD]: {
          [INSTANCE_FULL_NAME_FIELD]: 'MyWorkflowFieldUpdate',
        },
        [WORKFLOW_TASKS_FIELD]: {
          [INSTANCE_FULL_NAME_FIELD]: 'MyWorkflowTask',
        },
        [WORKFLOW_RULES_FIELD]: {
          [INSTANCE_FULL_NAME_FIELD]: 'MyWorkflowRule',
        },
      },
      [SALESFORCE, RECORDS_PATH, WORKFLOW_METADATA_TYPE, 'Account'],
    )
  )

  const generateInnerInstance = (values: MetadataValues, fieldName: string): InstanceElement => (
    createInstanceElement(
      values,
      (mockTypes.Workflow.fields[fieldName].getType() as ListType).getInnerType() as ObjectType,
    )
  )

  describe('on fetch', () => {
    let workflowType: ObjectType
    let workflowWithInnerTypes: InstanceElement
    let elements: Element[]

    describe('should modify workflow instance', () => {
      beforeAll(async () => {
        workflowWithInnerTypes = generateWorkFlowInstance()
        workflowType = workflowWithInnerTypes.getType()
        const workflowSubTypes = Object.keys(WORKFLOW_FIELD_TO_TYPE)
          .map(fieldName => workflowType.fields[fieldName].getType())
          .filter(isListType)
          .map(fieldType => fieldType.getInnerType())
        elements = [workflowType, workflowWithInnerTypes, ...workflowSubTypes]
        await filter.onFetch(elements)
      })

      it('should split workflow instance', () => {
        expect(elements).toHaveLength(14)
      })

      describe('inner instances', () => {
        let innerInstances: Record<string, InstanceElement[]>
        beforeAll(() => {
          innerInstances = _.groupBy(
            elements.filter(isInstanceElement),
            metadataType
          )
        })

        it('should create inner instances with the correct types', () => {
          expect(innerInstances).toHaveProperty(WORKFLOW_FIELD_TO_TYPE[WORKFLOW_ALERTS_FIELD])
          expect(innerInstances).toHaveProperty(
            WORKFLOW_FIELD_TO_TYPE[WORKFLOW_FIELD_UPDATES_FIELD]
          )
          expect(innerInstances).toHaveProperty(WORKFLOW_FIELD_TO_TYPE[WORKFLOW_TASKS_FIELD])
          expect(innerInstances).toHaveProperty(WORKFLOW_FIELD_TO_TYPE[WORKFLOW_RULES_FIELD])
        })

        it('should modify inner instance fullNames to contain the parent fullName', () => {
          const verifyFullNames = (instances: InstanceElement[], ...names: string[]): void =>
            expect(instances.map(inst => apiName(inst)).sort()).toEqual(names)

          verifyFullNames(
            innerInstances.WorkflowAlert, 'Account.MyWorkflowAlert1', 'Account.MyWorkflowAlert2'
          )
          verifyFullNames(innerInstances.WorkflowFieldUpdate, 'Account.MyWorkflowFieldUpdate')
          verifyFullNames(innerInstances.WorkflowTask, 'Account.MyWorkflowTask')
          verifyFullNames(innerInstances.WorkflowRule, 'Account.MyWorkflowRule')
        })
      })

      it('should have reference from workflow instance', () => {
        Object.keys(WORKFLOW_FIELD_TO_TYPE).forEach(field => {
          makeArray(workflowWithInnerTypes.value[field]).forEach(val => {
            expect(val).toBeInstanceOf(ReferenceExpression)
          })
        })
      })

      it('should have list reference from workflow instance', () => {
        expect(workflowWithInnerTypes.value[WORKFLOW_ALERTS_FIELD]).toHaveLength(2)
        makeArray(workflowWithInnerTypes.value[WORKFLOW_ALERTS_FIELD]).forEach(val => {
          expect(val).toBeInstanceOf(ReferenceExpression)
          const { elemID } = val as ReferenceExpression
          expect((findElement(elements, elemID) as InstanceElement).value.description).toBe('description')
        })
      })
    })

    it('should not modify non workflow instances', async () => {
      const dummyInstance = generateWorkFlowInstance()
      dummyInstance.refType = dummyRefToObj
      await filter.onFetch([dummyInstance])
      expect(dummyInstance.value[WORKFLOW_ALERTS_FIELD][0][INSTANCE_FULL_NAME_FIELD])
        .toEqual('MyWorkflowAlert1')
      expect(dummyInstance.value[WORKFLOW_ALERTS_FIELD][1][INSTANCE_FULL_NAME_FIELD])
        .toEqual('MyWorkflowAlert2')
      expect(dummyInstance.value[WORKFLOW_FIELD_UPDATES_FIELD][INSTANCE_FULL_NAME_FIELD])
        .toEqual('MyWorkflowFieldUpdate')
      expect(dummyInstance.value[WORKFLOW_TASKS_FIELD][INSTANCE_FULL_NAME_FIELD])
        .toEqual('MyWorkflowTask')
      expect(dummyInstance.value[WORKFLOW_RULES_FIELD][INSTANCE_FULL_NAME_FIELD])
        .toEqual('MyWorkflowRule')
    })

    it('should set non workflow instances path correctly', async () => {
      const dummyInstance = generateWorkFlowInstance()
      dummyInstance.refType = dummyRefToObj
      const beforeFilterPath = dummyInstance.path
      await filter.onFetch([dummyInstance])
      expect(dummyInstance.path).toEqual(beforeFilterPath)
    })
  })

  describe('preDeploy and onDeploy', () => {
    let changes: Change<InstanceElement>[]
    let innerInstance: InstanceElement
    let testFilter: typeof filter
    describe('with a new workflow', () => {
      beforeAll(() => {
        innerInstance = generateInnerInstance(
          { fullName: 'Account.MyRule', description: 'my inst' },
          WORKFLOW_RULES_FIELD,
        )
        const workflow = createInstanceElement(
          {
            fullName: 'Account',
            [WORKFLOW_RULES_FIELD]: [apiName(innerInstance)],
          },
          mockTypes.Workflow,
        )
        changes = [
          { action: 'add', data: { after: workflow } },
          { action: 'add', data: { after: innerInstance } },
        ]
        // Re-create the filter because it is stateful
        testFilter = filterCreator({ client, config: {} }) as typeof filter
      })

      describe('preDeploy', () => {
        let workflowInChange: InstanceElement
        beforeAll(async () => {
          await testFilter.preDeploy(changes)
        })
        it('should create only one workflow change', () => {
          expect(changes).toHaveLength(1)
          const [workflowChange] = changes
          expect(workflowChange.action).toEqual('add')
          workflowInChange = getChangeElement(workflowChange)
        })
        it('should use the original type from the workflow', () => {
          expect(workflowInChange.getType()).toBe(mockTypes.Workflow)
        })
        it('should replace the field values with the inner instances with relative fullName', () => {
          expect(workflowInChange.value[WORKFLOW_RULES_FIELD]).toEqual([
            { ...innerInstance.value, fullName: 'MyRule' },
          ])
        })
      })

      describe('onDeploy', () => {
        let workflowAfter: InstanceElement
        beforeAll(async () => {
          await testFilter.onDeploy(changes)
        })
        it('should return the original changes', () => {
          expect(changes).toHaveLength(2)
          const workflowChange = changes.find(isInstanceOfTypeChange(WORKFLOW_METADATA_TYPE))
          expect(workflowChange).toBeDefined()
          workflowAfter = getChangeElement(workflowChange as Change<InstanceElement>)
        })
        it('should restore the workflow field value to the original value', () => {
          expect(workflowAfter.value[WORKFLOW_RULES_FIELD]).toEqual([apiName(innerInstance)])
        })
      })
    })

    describe('when inner instances are modified', () => {
      beforeAll(() => {
        const createInnerChange = (idx: number): Change<InstanceElement> => {
          const before = generateInnerInstance(
            { fullName: `Account.MyRule${idx}`, description: 'before' },
            WORKFLOW_RULES_FIELD,
          )
          const after = generateInnerInstance(
            { fullName: `Account.MyRule${idx}`, description: 'after' },
            WORKFLOW_RULES_FIELD,
          )
          return { action: 'modify', data: { before, after } }
        }

        changes = _.times(5).map(createInnerChange)

        // Re-create the filter because it is stateful
        testFilter = filterCreator({ client, config: {} }) as typeof filter
      })
      describe('preDeploy', () => {
        beforeAll(async () => {
          await testFilter.preDeploy(changes)
        })
        it('should replace inner instance changes with a single workflow modification change', () => {
          expect(changes).toHaveLength(1)
          expect(isModificationChange(changes[0])).toBeTruthy()
        })
        it('should create workflow instance with a proper type', () => {
          const workflowInst = getChangeElement(changes[0])
          const workflowType = workflowInst.getType()
          const typeAnnotations = workflowType.annotations as MetadataTypeAnnotations
          expect(typeAnnotations.metadataType).toEqual(WORKFLOW_METADATA_TYPE)
          expect(typeAnnotations.suffix).toEqual('workflow')
          expect(typeAnnotations.dirName).toEqual('workflows')
          expect(workflowType.fields).toHaveProperty(WORKFLOW_RULES_FIELD)
          const rulesFieldType = workflowType.fields[WORKFLOW_RULES_FIELD].getType()
          expect(metadataType(rulesFieldType)).toEqual(WORKFLOW_FIELD_TO_TYPE[WORKFLOW_RULES_FIELD])
        })
        it('should create workflow instance with proper values', () => {
          const change = changes[0] as ModificationChange<InstanceElement>
          const { before, after } = change.data
          expect(before.value).toHaveProperty(WORKFLOW_RULES_FIELD)
          expect(
            before.value[WORKFLOW_RULES_FIELD].map((val: Value) => val.description)
          ).toEqual(expect.arrayContaining(['before']))

          expect(after.value).toHaveProperty(WORKFLOW_RULES_FIELD)
          expect(
            after.value[WORKFLOW_RULES_FIELD].map((val: Value) => val.description)
          ).toEqual(expect.arrayContaining(['after']))
        })
      })

      describe('onDeploy', () => {
        beforeAll(async () => {
          await testFilter.onDeploy(changes)
        })
        it('should restore the original changes to inner instances', () => {
          expect(changes).toHaveLength(5)
        })
      })
    })
  })
})
