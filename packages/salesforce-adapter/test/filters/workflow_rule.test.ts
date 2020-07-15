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
  InstanceElement, ObjectType, Element, ElemID, ReferenceExpression,
} from '@salto-io/adapter-api'
import { FilterWith } from '../../src/filter'
import filterCreator, {
  WORKFLOW_RULE_TYPE_ID, WorkflowActionReference, WORKFLOW_ACTION_TYPE_MAPPING, WorkflowActionType,
} from '../../src/filters/workflow_rule'
import mockClient from '../client'
import {
  API_NAME_SEPARATOR, INSTANCE_FULL_NAME_FIELD, OBJECTS_PATH, SALESFORCE,
  METADATA_TYPE,
  WORKFLOW_RULE_METADATA_TYPE,
} from '../../src/constants'

describe('WorklowFieldUpdate filter', () => {
  const { client } = mockClient()

  const filter = filterCreator({ client, config: {} }) as FilterWith<'onFetch'>

  const parentName = 'User'

  const generateWorkFlowRuleInstance = (
    workflowRuleInstanceName: string,
    actions: WorkflowActionReference | WorkflowActionReference[]
  ): InstanceElement => {
    const workflowRuleObjectType = new ObjectType({ elemID: WORKFLOW_RULE_TYPE_ID })
    const instanceName = `${parentName}_${workflowRuleInstanceName}`
    return new InstanceElement(
      instanceName,
      workflowRuleObjectType,
      {
        [INSTANCE_FULL_NAME_FIELD]: `${parentName}${API_NAME_SEPARATOR}${workflowRuleInstanceName}`,
        actions,
      },
      [SALESFORCE, OBJECTS_PATH, WORKFLOW_RULE_METADATA_TYPE, instanceName]
    )
  }

  describe('on fetch', () => {
    let instanceSingleAction: InstanceElement
    let instanceMultiAction: InstanceElement
    let instanceUnkownActionName: InstanceElement
    let instanceMissingActionForType: InstanceElement
    let instanceInvalidActionType: InstanceElement
    let elements: Element[]
    let actionInstances: InstanceElement[]

    beforeAll(async () => {
      const actionTypeObjects = ['Alert', 'FieldUpdate'].map(actionType => (
        new ObjectType({
          elemID: new ElemID(SALESFORCE, WORKFLOW_ACTION_TYPE_MAPPING[actionType as WorkflowActionType], 'instance'),
          annotations: {
            [METADATA_TYPE]: WORKFLOW_ACTION_TYPE_MAPPING[actionType as WorkflowActionType],
          },
        })
      ))
      const actionName = 'foo'
      const instanceName = `${parentName}_${actionName}`
      // creating two objects of different types with the same api name
      actionInstances = actionTypeObjects.map(actionTypeObj => (
        new InstanceElement(
          instanceName,
          actionTypeObj,
          {
            [INSTANCE_FULL_NAME_FIELD]: `${parentName}${API_NAME_SEPARATOR}${actionName}`,
          },
          [SALESFORCE, OBJECTS_PATH, actionTypeObj.elemID.typeName, instanceName]
        )
      ))

      const actionReferences = ['Alert', 'FieldUpdate'].map(actionType => ({
        name: actionName,
        type: actionType as WorkflowActionType,
      }))

      instanceSingleAction = generateWorkFlowRuleInstance('single', actionReferences[0])
      instanceMultiAction = generateWorkFlowRuleInstance('multi', actionReferences)
      instanceUnkownActionName = generateWorkFlowRuleInstance('unknownActionName', { name: 'unkown', type: 'Alert' })
      instanceMissingActionForType = generateWorkFlowRuleInstance('unknownActionType', { name: 'foo', type: 'Task' })
      instanceInvalidActionType = generateWorkFlowRuleInstance('unknownActionType', { name: 'foo', type: 'InvalidType' as WorkflowActionType })
      const workflowRuleType = instanceSingleAction.type

      elements = [
        workflowRuleType,
        instanceSingleAction, instanceMultiAction,
        instanceUnkownActionName, instanceMissingActionForType, instanceInvalidActionType,
        ...actionTypeObjects, ...actionInstances,
      ]
      await filter.onFetch(elements)
    })

    it('should have references to the right actions', () => {
      const getFullName = (action: WorkflowActionReference): string => {
        expect(action.name).toBeInstanceOf(ReferenceExpression)
        return (action.name as ReferenceExpression).elemId.getFullName()
      }
      expect(getFullName(instanceSingleAction.value.actions)).toEqual(
        actionInstances[0].elemID.getFullName()
      )
      expect(getFullName(instanceSingleAction.value.actions)).not.toEqual(
        actionInstances[1].elemID.getFullName()
      )
      expect(getFullName(instanceMultiAction.value.actions[0])).toEqual(
        actionInstances[0].elemID.getFullName()
      )
      expect(getFullName(instanceMultiAction.value.actions[1])).toEqual(
        actionInstances[1].elemID.getFullName()
      )
    })

    it('should not have references when lookup fails', () => {
      expect(instanceUnkownActionName.value.actions.name).toEqual('unkown')
      expect(instanceMissingActionForType.value.actions.name).toEqual('foo')
      expect(instanceInvalidActionType.value.actions.name).toEqual('foo')
    })
  })
})
