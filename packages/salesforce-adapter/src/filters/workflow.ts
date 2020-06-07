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
  Element, ElemID, InstanceElement, isInstanceElement, isObjectType, ReferenceExpression,
  ObjectType, BuiltinTypes, ListType,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import {
  INSTANCE_FULL_NAME_FIELD, SALESFORCE, WORKFLOW_METADATA_TYPE,
} from '../constants'
import { FilterCreator } from '../filter'
import {
  apiName, metadataType, createInstanceElementFromValues,
} from '../transformers/transformer'
import { fullApiName } from './utils'

const { makeArray } = collections.array

const log = logger(module)

export const WORKFLOW_ALERTS_FIELD = 'alerts'
export const WORKFLOW_FIELD_UPDATES_FIELD = 'fieldUpdates'
export const WORKFLOW_FLOW_ACTIONS_FIELD = 'flowActions'
export const WORKFLOW_OUTBOUND_MESSAGES_FIELD = 'outboundMessages'
export const WORKFLOW_KNOWLEDGE_PUBLISHES_FIELD = 'knowledgePublishes'
export const WORKFLOW_TASKS_FIELD = 'tasks'
export const WORKFLOW_RULES_FIELD = 'rules'

export const WORKFLOW_FIELD_TO_TYPE: Record<string, string> = {
  [WORKFLOW_ALERTS_FIELD]: 'WorkflowAlert',
  [WORKFLOW_FIELD_UPDATES_FIELD]: 'WorkflowFieldUpdate',
  [WORKFLOW_FLOW_ACTIONS_FIELD]: 'WorkflowFlowAction',
  [WORKFLOW_OUTBOUND_MESSAGES_FIELD]: 'WorkflowOutboundMessage',
  [WORKFLOW_KNOWLEDGE_PUBLISHES_FIELD]: 'WorkflowKnowledgePublish',
  [WORKFLOW_TASKS_FIELD]: 'WorkflowTask',
  [WORKFLOW_RULES_FIELD]: 'WorkflowRule',
}

export const WORKFLOW_TYPE_ID = new ElemID(SALESFORCE, WORKFLOW_METADATA_TYPE)
export const isWorkflowType = (type: ObjectType): boolean => type.elemID.isEqual(WORKFLOW_TYPE_ID)
export const isWorkflowInstance = (instance: InstanceElement): boolean =>
  isWorkflowType(instance.type)

const filterCreator: FilterCreator = () => ({
  /**
   * Upon fetch, modify the full_names of the inner types of the workflow to contain
   * the workflow full_name (e.g. MyWorkflowAlert -> Lead.MyWorkflowAlert)
   */
  onFetch: async (elements: Element[]) => {
    const splitWorkflow = (workflowInstance: InstanceElement): InstanceElement[] => _.flatten(
      Object.entries(WORKFLOW_FIELD_TO_TYPE).map(([fieldName, fieldType]) => {
        const objType = elements.filter(isObjectType)
          .find(e => metadataType(e) === fieldType)
        if (_.isUndefined(objType)) {
          log.warn('failed to find object type for %s', fieldType)
          return []
        }
        const innerInstances = makeArray(workflowInstance.value[fieldName])
          .map(innerValue => {
            innerValue[INSTANCE_FULL_NAME_FIELD] = fullApiName(apiName(workflowInstance),
              innerValue[INSTANCE_FULL_NAME_FIELD])
            return createInstanceElementFromValues(innerValue, objType)
          })
        if (!_.isEmpty(innerInstances)) {
          workflowInstance.value[fieldName] = innerInstances
            .map(s => new ReferenceExpression(s.elemID))
        }

        return innerInstances
      })
    )

    // Fix fields to expect api names instead of full objects
    elements
      .filter(isObjectType)
      .filter(isWorkflowType)
      .forEach(wfType => {
        Object.keys(WORKFLOW_FIELD_TO_TYPE).forEach(fieldName => {
          wfType.fields[fieldName].type = new ListType(BuiltinTypes.STRING)
        })
      })

    elements.push(..._.flatten(elements
      .filter(isInstanceElement)
      .filter(isWorkflowInstance)
      .map(wfInst => splitWorkflow(wfInst))))
  },
})

export default filterCreator
