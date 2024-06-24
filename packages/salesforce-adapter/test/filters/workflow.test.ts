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
import { collections } from '@salto-io/lowerdash'
import {
  ElemID,
  InstanceElement,
  ObjectType,
  Element,
  isInstanceElement,
  Change,
  getChangeData,
  ModificationChange,
  isModificationChange,
  Value,
  isListType,
  ListType,
  createRefToElmWithValue,
} from '@salto-io/adapter-api'
import filterCreator, {
  WORKFLOW_ALERTS_FIELD,
  WORKFLOW_FIELD_UPDATES_FIELD,
  WORKFLOW_RULES_FIELD,
  WORKFLOW_TASKS_FIELD,
  WORKFLOW_FIELD_TO_TYPE,
} from '../../src/filters/workflow'
import {
  INSTANCE_FULL_NAME_FIELD,
  RECORDS_PATH,
  SALESFORCE,
  WORKFLOW_METADATA_TYPE,
} from '../../src/constants'
import { mockTypes } from '../mock_elements'
import {
  metadataType,
  apiName,
  createInstanceElement,
  MetadataValues,
  MetadataTypeAnnotations,
} from '../../src/transformers/transformer'
import { isInstanceOfTypeChange } from '../../src/filters/utils'
import { defaultFilterContext } from '../utils'
import { FilterWith } from './mocks'

const { awu, groupByAsync } = collections.asynciterable

describe('Workflow filter', () => {
  const filter = filterCreator({ config: defaultFilterContext }) as FilterWith<
    'onFetch' | 'preDeploy' | 'onDeploy'
  >
  const dummyElemID = new ElemID(SALESFORCE, 'dummy')
  const dummyObj = new ObjectType({ elemID: dummyElemID })
  const dummyRefToObj = createRefToElmWithValue(dummyObj)

  const workflowInstanceName = 'Account'
  const generateWorkFlowInstance = (): InstanceElement =>
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

  const generateInnerInstance = async (
    values: MetadataValues,
    fieldName: string,
  ): Promise<InstanceElement> =>
    createInstanceElement(
      values,
      (await (
        (await mockTypes.Workflow.fields[fieldName].getType()) as ListType
      ).getInnerType()) as ObjectType,
    )

  describe('on fetch', () => {
    let workflowType: ObjectType
    let workflowWithInnerTypes: InstanceElement
    let elements: Element[]

    describe('should modify workflow instance', () => {
      beforeAll(async () => {
        workflowWithInnerTypes = generateWorkFlowInstance()
        workflowType = await workflowWithInnerTypes.getType()
        const workflowSubTypes = await awu(Object.keys(WORKFLOW_FIELD_TO_TYPE))
          .map((fieldName) => workflowType.fields[fieldName].getType())
          .filter(isListType)
          .map((fieldType) => fieldType.getInnerType())
          .toArray()
        elements = [workflowType, workflowWithInnerTypes, ...workflowSubTypes]
        await filter.onFetch(elements)
      })

      it('should split workflow instance', () => {
        expect(elements).toHaveLength(13)
      })

      describe('inner instances', () => {
        let innerInstances: Record<string, InstanceElement[]>
        beforeAll(async () => {
          innerInstances = await groupByAsync(
            elements.filter(isInstanceElement),
            metadataType,
          )
        })

        it('should create inner instances with the correct types', () => {
          expect(innerInstances).toHaveProperty(
            WORKFLOW_FIELD_TO_TYPE[WORKFLOW_ALERTS_FIELD],
          )
          expect(innerInstances).toHaveProperty(
            WORKFLOW_FIELD_TO_TYPE[WORKFLOW_FIELD_UPDATES_FIELD],
          )
          expect(innerInstances).toHaveProperty(
            WORKFLOW_FIELD_TO_TYPE[WORKFLOW_TASKS_FIELD],
          )
          expect(innerInstances).toHaveProperty(
            WORKFLOW_FIELD_TO_TYPE[WORKFLOW_RULES_FIELD],
          )
        })

        it('should modify inner instance fullNames to contain the parent fullName', async () => {
          const verifyFullNames = async (
            instances: InstanceElement[],
            ...names: string[]
          ): Promise<void> =>
            expect(
              (
                await Promise.all(instances.map((inst) => apiName(inst)))
              ).sort(),
            ).toEqual(names)

          await verifyFullNames(
            innerInstances.WorkflowAlert,
            'Account.MyWorkflowAlert1',
            'Account.MyWorkflowAlert2',
          )
          await verifyFullNames(
            innerInstances.WorkflowFieldUpdate,
            'Account.MyWorkflowFieldUpdate',
          )
          await verifyFullNames(
            innerInstances.WorkflowTask,
            'Account.MyWorkflowTask',
          )
          await verifyFullNames(
            innerInstances.WorkflowRule,
            'Account.MyWorkflowRule',
          )
        })
      })
    })

    it('should not modify non workflow instances', async () => {
      const dummyInstance = generateWorkFlowInstance()
      dummyInstance.refType = dummyRefToObj
      await filter.onFetch([dummyInstance])
      expect(
        dummyInstance.value[WORKFLOW_ALERTS_FIELD][0][INSTANCE_FULL_NAME_FIELD],
      ).toEqual('MyWorkflowAlert1')
      expect(
        dummyInstance.value[WORKFLOW_ALERTS_FIELD][1][INSTANCE_FULL_NAME_FIELD],
      ).toEqual('MyWorkflowAlert2')
      expect(
        dummyInstance.value[WORKFLOW_FIELD_UPDATES_FIELD][
          INSTANCE_FULL_NAME_FIELD
        ],
      ).toEqual('MyWorkflowFieldUpdate')
      expect(
        dummyInstance.value[WORKFLOW_TASKS_FIELD][INSTANCE_FULL_NAME_FIELD],
      ).toEqual('MyWorkflowTask')
      expect(
        dummyInstance.value[WORKFLOW_RULES_FIELD][INSTANCE_FULL_NAME_FIELD],
      ).toEqual('MyWorkflowRule')
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
      beforeAll(async () => {
        innerInstance = await generateInnerInstance(
          { fullName: 'Account.MyRule', description: 'my inst' },
          WORKFLOW_RULES_FIELD,
        )
        changes = [{ action: 'add', data: { after: innerInstance } }]
        // Re-create the filter because it is stateful
        testFilter = filterCreator({
          config: defaultFilterContext,
        }) as typeof filter
      })

      describe('preDeploy', () => {
        beforeAll(async () => {
          // eslint-disable-next-line prefer-destructuring
          await testFilter.preDeploy(changes)
        })

        it('should create only one workflow change', () => {
          expect(changes).toHaveLength(1)
          const workflowChange = changes[0]
          expect(workflowChange.action).toEqual('modify')
        })

        it('should replace the field values with the inner instances with relative fullName', () => {
          const workflowChange = changes[0]
          const workflowInChange = getChangeData(
            workflowChange,
          ) as InstanceElement
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
          expect(changes).toHaveLength(1)
          const workflowChange = changes.find(
            isInstanceOfTypeChange(WORKFLOW_METADATA_TYPE),
          )
          expect(workflowChange).toBeDefined()
          workflowAfter = getChangeData(
            workflowChange as Change<InstanceElement>,
          )
        })
        it('should restore the workflow field value to the original value', async () => {
          expect(workflowAfter.value[INSTANCE_FULL_NAME_FIELD]).toEqual(
            await apiName(innerInstance),
          )
        })
      })
    })

    describe('when inner instances are modified', () => {
      beforeAll(async () => {
        const createInnerChange = async (
          idx: number,
        ): Promise<Change<InstanceElement>> => {
          const before = await generateInnerInstance(
            { fullName: `Account.MyRule${idx}`, description: 'before' },
            WORKFLOW_RULES_FIELD,
          )
          const after = await generateInnerInstance(
            { fullName: `Account.MyRule${idx}`, description: 'after' },
            WORKFLOW_RULES_FIELD,
          )
          return { action: 'modify', data: { before, after } }
        }

        changes = await Promise.all(_.times(5).map(createInnerChange))

        // Re-create the filter because it is stateful
        testFilter = filterCreator({
          config: defaultFilterContext,
        }) as typeof filter
      })
      describe('preDeploy', () => {
        beforeAll(async () => {
          await testFilter.preDeploy(changes)
        })
        it('should replace inner instance changes with a single workflow modification change', () => {
          expect(changes).toHaveLength(1)
          expect(isModificationChange(changes[0])).toBeTruthy()
        })
        it('should create workflow instance with a proper type', async () => {
          const workflowInst = getChangeData(changes[0])
          const workflowType = await workflowInst.getType()
          const typeAnnotations =
            workflowType.annotations as MetadataTypeAnnotations
          expect(typeAnnotations.metadataType).toEqual(WORKFLOW_METADATA_TYPE)
          expect(typeAnnotations.suffix).toEqual('workflow')
          expect(typeAnnotations.dirName).toEqual('workflows')
          expect(workflowType.fields).toHaveProperty(WORKFLOW_RULES_FIELD)
          const rulesFieldType =
            await workflowType.fields[WORKFLOW_RULES_FIELD].getType()
          expect(await metadataType(rulesFieldType)).toEqual(
            WORKFLOW_FIELD_TO_TYPE[WORKFLOW_RULES_FIELD],
          )
        })
        it('should create workflow instance with proper values', () => {
          const change = changes[0] as ModificationChange<InstanceElement>
          const { before, after } = change.data
          expect(before.value).toHaveProperty(WORKFLOW_RULES_FIELD)
          expect(
            before.value[WORKFLOW_RULES_FIELD].map(
              (val: Value) => val.description,
            ),
          ).toEqual(expect.arrayContaining(['before']))

          expect(after.value).toHaveProperty(WORKFLOW_RULES_FIELD)
          expect(
            after.value[WORKFLOW_RULES_FIELD].map(
              (val: Value) => val.description,
            ),
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
