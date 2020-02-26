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
  Change, Element, ElemID, InstanceElement, isInstanceElement, Value, isObjectType,
} from '@salto-io/adapter-api'
import { SaveResult, UpsertResult } from 'jsforce'
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import {
  API_NAME_SEPERATOR, INSTANCE_FULL_NAME_FIELD, SALESFORCE, WORKFLOW_METADATA_TYPE,
} from '../constants'
import { FilterCreator } from '../filter'
import { apiName, toMetadataInfo, metadataType } from '../transformers/transformer'

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
export const isWorkflowInstance = (instance: InstanceElement): boolean =>
  instance.type.elemID.isEqual(WORKFLOW_TYPE_ID)

const filterCreator: FilterCreator = ({ client }) => ({
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
            const instanceName = innerValue[INSTANCE_FULL_NAME_FIELD]
            const fullApiName = [apiName(workflowInstance), instanceName].join(API_NAME_SEPERATOR)
            innerValue[INSTANCE_FULL_NAME_FIELD] = fullApiName
            return new InstanceElement(instanceName, objType, innerValue)
          })
        delete workflowInstance.value[fieldName]
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

  /**
   * Upon update, create/update/delete each inner type of the workflow separately
   */
  onUpdate: async (before: Element, after: Element, _changes: ReadonlyArray<Change>):
    Promise<(SaveResult| UpsertResult)[]> => {
    if (!(isInstanceElement(before) && isInstanceElement(after) && isWorkflowInstance(after))) {
      return []
    }

    const handleWorkflowChanges = async (fieldName: string, typeName: string):
      Promise<(SaveResult | UpsertResult)[][]> => {
      const getFullNameToFieldValue = (inst: InstanceElement): Record<string, Value> =>
        _(makeArray(inst.value[fieldName]))
          .map(val => [val[INSTANCE_FULL_NAME_FIELD], val])
          .fromPairs()
          .value()

      const nameToBeforeVal = getFullNameToFieldValue(before)
      const nameToAfterVal = getFullNameToFieldValue(after)
      if (_.isEqual(nameToBeforeVal, nameToAfterVal)) {
        return Promise.resolve([])
      }
      return Promise.all([
        client.upsert(typeName,
          Object.entries(nameToAfterVal)
            .filter(([fullName, _val]) => _.isUndefined(nameToBeforeVal[fullName]))
            .map(([fullName, val]) => toMetadataInfo(fullName, val))),
        client.update(typeName,
          Object.entries(nameToAfterVal)
            .filter(([fullName, val]) => nameToBeforeVal[fullName]
              && !_.isEqual(val, nameToBeforeVal[fullName]))
            .map(([fullName, val]) => toMetadataInfo(fullName, val))),
        client.delete(typeName,
          Object.keys(nameToBeforeVal)
            .filter(fullName => _.isUndefined(nameToAfterVal[fullName]))),
      ])
    }

    return _.flatten(_.flatten((await Promise.all(
      Object.entries(WORKFLOW_FIELD_TO_TYPE)
        .map(([name, type]) => handleWorkflowChanges(name, type))
    ))))
  },

  /**
   * Upon add, create each inner type of the workflow separately
   */
  onAdd: async (after: Element): Promise<SaveResult[]> => {
    if (!(isInstanceElement(after) && isWorkflowInstance(after))) {
      return []
    }
    const afterWorkflowInstance = after as InstanceElement
    return _.flatten(await Promise.all(Object.entries(WORKFLOW_FIELD_TO_TYPE)
      .map(([name, type]) =>
        client.upsert(type,
          makeArray(afterWorkflowInstance.value[name])
            .map(val => toMetadataInfo(val[INSTANCE_FULL_NAME_FIELD], val))))))
  },

  /**
   * Upon remove, delete each inner type of the workflow separately
   */
  onRemove: async (before: Element): Promise<SaveResult[]> => {
    if (!(isInstanceElement(before) && isWorkflowInstance(before))) {
      return []
    }
    return _.flatten(await Promise.all(Object.entries(WORKFLOW_FIELD_TO_TYPE)
      .map(([name, type]) =>
        client.delete(type,
          makeArray(before.value[name])
            .map(val => val[INSTANCE_FULL_NAME_FIELD])))))
  },
})

export default filterCreator
