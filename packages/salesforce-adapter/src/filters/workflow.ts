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
  ObjectType, Values,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import {
  API_NAME_SEPERATOR, INSTANCE_FULL_NAME_FIELD, SALESFORCE, WORKFLOW_METADATA_TYPE,
} from '../constants'
import { FilterCreator } from '../filter'
import {
  apiName, metadataType, createInstanceElementFromValues,
} from '../transformers/transformer'

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
const fullApiName = (workflow: string, relative: string): string =>
  ([workflow, relative].join(API_NAME_SEPERATOR))

type Tranformer = (workflowApiName: string, value: Values) => Values
const transformers: Record<string, Tranformer> = {
  [WORKFLOW_RULES_FIELD]: (workflowApiName: string, rule: Values): Values => {
    makeArray(rule.actions).forEach(action => {
      if (action.name) {
        action.name = fullApiName(workflowApiName, action.name)
      }
    })
    return rule
  },
}

const filterCreator: FilterCreator = () => ({
  /**
   * Upon fetch, modify the full_names of the inner types of the workflow to contain
   * the workflow full_name (e.g. MyWorkflowAlert -> Lead.MyWorkflowAlert)
   */
  onFetch: async (elements: Element[]) => {
    const splitWorkflow = (workflowInstance: InstanceElement): InstanceElement[] => _.flatten(
      Object.keys(WORKFLOW_FIELD_TO_TYPE).map(fieldName => {
        const objType = elements.filter(isObjectType)
          .find(e => metadataType(e) === WORKFLOW_FIELD_TO_TYPE[fieldName])
        if (_.isUndefined(objType)) {
          log.warn('failed to find object type for %s', WORKFLOW_FIELD_TO_TYPE[fieldName])
          return []
        }
        const splitted = makeArray(workflowInstance.value[fieldName])
          .map(innerValue => {
            innerValue[INSTANCE_FULL_NAME_FIELD] = fullApiName(apiName(workflowInstance),
              innerValue[INSTANCE_FULL_NAME_FIELD])
            const transformer = transformers[fieldName]
            return createInstanceElementFromValues(
              _.isUndefined(transformer)
                ? innerValue
                : transformer(apiName(workflowInstance), innerValue),
              objType
            )
          })
        workflowInstance.value[fieldName] = splitted.map(s => new ReferenceExpression(s.elemID))
        return splitted
      })
    )

    const newInstances: InstanceElement[] = []
    elements
      .filter(isInstanceElement)
      .filter(isWorkflowInstance)
      .forEach(wfInst => {
        // we use here "forEach" and not for as we are modifying the wsInstance and create
        // new instances
        newInstances.push(...splitWorkflow(wfInst))
      })
    elements.push(...newInstances)
  },
})

export default filterCreator
