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
import { collections } from '@salto-io/lowerdash'
import { ElemID, InstanceElement, ObjectType, Element, ReferenceExpression } from '@salto-io/adapter-api'
import {
  findElement,
} from '@salto-io/adapter-utils'
import { FilterWith } from '../../src/filter'
import filterCreator, {
  WORKFLOW_ALERTS_FIELD, WORKFLOW_FIELD_UPDATES_FIELD, WORKFLOW_RULES_FIELD,
  WORKFLOW_TASKS_FIELD, WORKFLOW_TYPE_ID, WORKFLOW_FIELD_TO_TYPE,
} from '../../src/filters/workflow'
import mockClient from '../client'
import {
  API_NAME_SEPERATOR, INSTANCE_FULL_NAME_FIELD, RECORDS_PATH, SALESFORCE, WORKFLOW_METADATA_TYPE,
  METADATA_TYPE,
} from '../../src/constants'

const { makeArray } = collections.array

describe('Workflow filter', () => {
  const { client } = mockClient()
  const filter = filterCreator({ client }) as FilterWith<'onFetch'> & FilterWith<'onAdd'>
    & FilterWith<'onUpdate'> & FilterWith<'onRemove'>

  const workflowInstanceName = 'Account'
  const workflowObjectType = new ObjectType({ elemID: WORKFLOW_TYPE_ID })
  const generateWorkFlowInstance = (beforeFetch = false): InstanceElement => {
    const fullNamePrefix = beforeFetch ? '' : `${workflowInstanceName}${API_NAME_SEPERATOR}`
    return new InstanceElement('Account',
      workflowObjectType,
      {
        [INSTANCE_FULL_NAME_FIELD]: workflowInstanceName,
        [WORKFLOW_ALERTS_FIELD]: [
          {
            [INSTANCE_FULL_NAME_FIELD]: `${fullNamePrefix}MyWorkflowAlert1`,
            description: 'description',
          },
          {
            [INSTANCE_FULL_NAME_FIELD]: `${fullNamePrefix}MyWorkflowAlert2`,
            description: 'description',
          },
        ],
        [WORKFLOW_FIELD_UPDATES_FIELD]: {
          [INSTANCE_FULL_NAME_FIELD]: `${fullNamePrefix}MyWorkflowFieldUpdate`,
        },
        [WORKFLOW_TASKS_FIELD]: {
          [INSTANCE_FULL_NAME_FIELD]: `${fullNamePrefix}MyWorkflowTask`,
        },
        [WORKFLOW_RULES_FIELD]: {
          [INSTANCE_FULL_NAME_FIELD]: `${fullNamePrefix}MyWorkflowRule`,
        },
      },
      beforeFetch ? [SALESFORCE, RECORDS_PATH, WORKFLOW_METADATA_TYPE, 'Account']
        : [SALESFORCE, RECORDS_PATH, 'WorkflowRules', 'AccountWorkflowRules'])
  }

  describe('on fetch', () => {
    const workflowWithInnerTypes = generateWorkFlowInstance(true)
    let elements: Element[]

    describe('should modify workflow instance', () => {
      beforeAll(async () => {
        const workflowSubTypes = Object.values(WORKFLOW_FIELD_TO_TYPE)
          .map(subType => new ObjectType({
            elemID: new ElemID(SALESFORCE, subType),
            annotations: { [METADATA_TYPE]: subType },
          }))
        elements = [workflowWithInnerTypes, ...workflowSubTypes]
        expect(elements).toHaveLength(8)
        await filter.onFetch(elements)
      })

      it('should split workflow instance', () => {
        expect(elements).toHaveLength(13)
      })

      it('should modify inner types full_names to contain the parent fullName', async () => {
        const verifyFullName = (e: Element, name: string): void =>
          expect((e as InstanceElement).value[INSTANCE_FULL_NAME_FIELD]).toEqual(name)

        verifyFullName(elements[8], 'Account.MyWorkflowAlert1')
        verifyFullName(elements[9], 'Account.MyWorkflowAlert2')
        verifyFullName(elements[10], 'Account.MyWorkflowFieldUpdate')
        verifyFullName(elements[11], 'Account.MyWorkflowTask')
        verifyFullName(elements[12], 'Account.MyWorkflowRule')
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
          const { elemId } = val as ReferenceExpression
          expect((findElement(elements, elemId) as InstanceElement).value.description).toBe('description')
        })
      })
    })

    it('should not modify non workflow instances', async () => {
      const dummyInstance = generateWorkFlowInstance(true)
      dummyInstance.type = new ObjectType({ elemID: new ElemID(SALESFORCE, 'dummy') })
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
      const dummyInstance = generateWorkFlowInstance(true)
      dummyInstance.type = new ObjectType({ elemID: new ElemID(SALESFORCE, 'dummy') })
      const beforeFilterPath = dummyInstance.path
      await filter.onFetch([dummyInstance])
      expect(dummyInstance.path).toEqual(beforeFilterPath)
    })
  })
})
