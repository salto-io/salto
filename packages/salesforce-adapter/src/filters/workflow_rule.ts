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
import { logger } from '@salto-io/logging'
import {
  Element, ReferenceExpression, ElemID, Values, isReferenceExpression,
} from '@salto-io/adapter-api'
import {
  findInstances,
} from '@salto-io/adapter-utils'
import { FilterCreator } from '../filter'
import { parentApiName } from './utils'
import { groupByAPIName, ApiNameMapping } from './instance_references'
import {
  SALESFORCE, API_NAME_SEPARATOR,
  WORKFLOW_ACTION_ALERT_METADATA_TYPE,
  WORKFLOW_FIELD_UPDATE_METADATA_TYPE,
  WORKFLOW_FLOW_ACTION_METADATA_TYPE,
  WORKFLOW_OUTBOUND_MESSAGE_METADATA_TYPE,
  WORKFLOW_RULE_METADATA_TYPE,
  WORKFLOW_TASK_METADATA_TYPE,
} from '../constants'

const log = logger(module)
const { makeArray } = collections.array

export const WORKFLOW_RULE_TYPE_ID = new ElemID(
  SALESFORCE,
  WORKFLOW_RULE_METADATA_TYPE,
)

export type WorkflowActionType = 'Alert' | 'FieldUpdate' | 'FlowAction' | 'OutboundMessage' | 'Task'
export const WORKFLOW_ACTION_TYPE_MAPPING: Record<WorkflowActionType, string> = {
  Alert: WORKFLOW_ACTION_ALERT_METADATA_TYPE,
  FieldUpdate: WORKFLOW_FIELD_UPDATE_METADATA_TYPE,
  FlowAction: WORKFLOW_FLOW_ACTION_METADATA_TYPE,
  OutboundMessage: WORKFLOW_OUTBOUND_MESSAGE_METADATA_TYPE,
  Task: WORKFLOW_TASK_METADATA_TYPE,
}


export type WorkflowActionReference = {
  name: string | ReferenceExpression
  type: WorkflowActionType
}

type WorkflowRule = Values & {
  actions: WorkflowActionReference | WorkflowActionReference[]
}

const isWorkflowActionReference = (value: Values): value is WorkflowActionReference => (
  value !== undefined
  && (_.isString(value.name) || isReferenceExpression(value.name))
  && Object.keys(WORKFLOW_ACTION_TYPE_MAPPING).includes(value.type)
)

const isWorkflowRule = (value: Values): value is WorkflowRule => (
  value !== undefined && (
    (Array.isArray(value.actions) && value.actions.every(isWorkflowActionReference))
    || isWorkflowActionReference(value.actions)
  )
)


/**
 * Replace the action name with a reference, based on the parent and action type.
 *
 * @param action            The action to update
 * @param parentObjName     The name of the containing workflow rule's parent object
 * @param apiNameToElemIDs  Known element ids, mapped by API name and metadata type
 * @param workflowRuleName  The name of the rule being processed
 */
const convertActionToReference = (
  action: WorkflowActionReference,
  parentObjName: string,
  apiNameToElemIDs: ApiNameMapping,
  workflowRuleName: string,
): void => {
  if (action === undefined || !_.isString(action.name)) {
    return
  }

  const findReference = (name: string): ReferenceExpression | undefined => {
    const apiName = [parentObjName, name].join(API_NAME_SEPARATOR)

    const elemID = apiNameToElemIDs?.[apiName]?.[WORKFLOW_ACTION_TYPE_MAPPING[action.type]]
    return elemID !== undefined
      ? new ReferenceExpression(elemID)
      : undefined
  }

  const reference = findReference(action.name)
  if (reference === undefined) {
    log.debug(`Could not find instance ${action.name} of type ${action.type} for workflow rule ${workflowRuleName}`)
    return
  }

  action.name = reference
}

/**
* Declare the WorkflowRule filter, which converts action names to references based on their type.
*/
const filterCreator: FilterCreator = () => ({
  /**
   * Updates WorkflowRule action references.
   *
   * @param elements  The already fetched elements
   */
  onFetch: async (elements: Element[]): Promise<void> => {
    const apiNameToElemIDs = groupByAPIName(elements)
    const instances = [...findInstances(elements, WORKFLOW_RULE_TYPE_ID)]

    instances.forEach(instance => {
      const parentObjName = parentApiName(instance)
      const workflowRule = instance.value
      if (!isWorkflowRule(workflowRule)) {
        return
      }

      const ruleActions = makeArray(workflowRule.actions)

      ruleActions.forEach(action => {
        convertActionToReference(
          action,
          parentObjName,
          apiNameToElemIDs,
          instance.elemID.getFullName(),
        )
      })
    })
  },
})

export default filterCreator
