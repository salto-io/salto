/*
*                      Copyright 2021 Salto Labs Ltd.
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
  Element, InstanceElement, isInstanceElement, isObjectType, ReferenceExpression,
  ObjectType, getChangeElement, Change, isAdditionChange, BuiltinTypes, ElemID,
} from '@salto-io/adapter-api'
import { createRefToElmWithValue } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import {
  INSTANCE_FULL_NAME_FIELD,
  WORKFLOW_ACTION_ALERT_METADATA_TYPE, WORKFLOW_FIELD_UPDATE_METADATA_TYPE,
  WORKFLOW_FLOW_ACTION_METADATA_TYPE, WORKFLOW_KNOWLEDGE_PUBLISH_METADATA_TYPE,
  WORKFLOW_METADATA_TYPE, WORKFLOW_OUTBOUND_MESSAGE_METADATA_TYPE, WORKFLOW_RULE_METADATA_TYPE,
  WORKFLOW_TASK_METADATA_TYPE,
  SALESFORCE,
} from '../constants'
import { FilterCreator } from '../filter'
import {
  apiName, metadataType, createInstanceElement, metadataAnnotationTypes, MetadataTypeAnnotations,
  toMetadataInfo,
} from '../transformers/transformer'
import { fullApiName, parentApiName, getDataFromChanges, isInstanceOfTypeChange, isInstanceOfType } from './utils'

const { makeArray } = collections.array

const log = logger(module)

export const WORKFLOW_ALERTS_FIELD = 'alerts'
export const WORKFLOW_FIELD_UPDATES_FIELD = 'fieldUpdates'
export const WORKFLOW_FLOW_ACTIONS_FIELD = 'flowActions'
export const WORKFLOW_OUTBOUND_MESSAGES_FIELD = 'outboundMessages'
export const WORKFLOW_KNOWLEDGE_PUBLISHES_FIELD = 'knowledgePublishes'
export const WORKFLOW_TASKS_FIELD = 'tasks'
export const WORKFLOW_RULES_FIELD = 'rules'

export const WORKFLOW_DIR_NAME = 'WorkflowActions'

export const WORKFLOW_FIELD_TO_TYPE: Record<string, string> = {
  [WORKFLOW_ALERTS_FIELD]: WORKFLOW_ACTION_ALERT_METADATA_TYPE,
  [WORKFLOW_FIELD_UPDATES_FIELD]: WORKFLOW_FIELD_UPDATE_METADATA_TYPE,
  [WORKFLOW_FLOW_ACTIONS_FIELD]: WORKFLOW_FLOW_ACTION_METADATA_TYPE,
  [WORKFLOW_OUTBOUND_MESSAGES_FIELD]: WORKFLOW_OUTBOUND_MESSAGE_METADATA_TYPE,
  [WORKFLOW_KNOWLEDGE_PUBLISHES_FIELD]: WORKFLOW_KNOWLEDGE_PUBLISH_METADATA_TYPE,
  [WORKFLOW_TASKS_FIELD]: WORKFLOW_TASK_METADATA_TYPE,
  [WORKFLOW_RULES_FIELD]: WORKFLOW_RULE_METADATA_TYPE,
}

export const WORKFLOW_TYPE_TO_FIELD: Record<string, string> = _.invert(WORKFLOW_FIELD_TO_TYPE)

const isWorkflowInstance = isInstanceOfType(WORKFLOW_METADATA_TYPE)

const isWorkflowChildInstance = (elem: Element): elem is InstanceElement =>
  isInstanceElement(elem) && Object.values(WORKFLOW_FIELD_TO_TYPE).includes(metadataType(elem))

const isWorkflowRelatedChange = (change: Change): change is Change<InstanceElement> => {
  const elem = getChangeElement(change)
  return isWorkflowInstance(elem) || isWorkflowChildInstance(elem)
}

const createPartialWorkflowInstance = (
  fullInstance: InstanceElement,
  changes: ReadonlyArray<Change>,
  dataField: 'before' | 'after',
): InstanceElement => (
  createInstanceElement(
    {
      [INSTANCE_FULL_NAME_FIELD]: fullInstance.value[INSTANCE_FULL_NAME_FIELD],
      ..._.omit(fullInstance.value, Object.keys(WORKFLOW_FIELD_TO_TYPE)),
      ..._.mapValues(
        WORKFLOW_FIELD_TO_TYPE,
        fieldType => (
          getDataFromChanges(dataField, changes.filter(isInstanceOfTypeChange(fieldType)))
            .map(nestedInstance => ({
              ...toMetadataInfo(nestedInstance),
              [INSTANCE_FULL_NAME_FIELD]: apiName(nestedInstance, true),
            }))
        )
      ),
    },
    fullInstance.getType(),
    undefined,
    fullInstance.annotations,
  )
)

const createDummyWorkflowInstance = (
  changes: ReadonlyArray<Change<InstanceElement>>
): InstanceElement => {
  // Unfortunately we do not have access to the real workflow type here so we create it hard coded
  // using as much known information as possible
  const realFieldTypes = _.keyBy(
    changes.map(getChangeElement).map(inst => inst.getType()),
    metadataType,
  )
  const dummyFieldType = (typeName: string): ObjectType => new ObjectType({
    elemID: new ElemID(SALESFORCE, typeName),
    annotationRefsOrTypes: _.clone(metadataAnnotationTypes),
    annotations: { metadataType: typeName } as MetadataTypeAnnotations,
  })
  const workflowType = new ObjectType({
    elemID: new ElemID(SALESFORCE, WORKFLOW_METADATA_TYPE),
    fields: {
      [INSTANCE_FULL_NAME_FIELD]: { refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID) },
      ..._.mapValues(
        WORKFLOW_FIELD_TO_TYPE,
        typeName => (
          { refType: createRefToElmWithValue(realFieldTypes[typeName] ?? dummyFieldType(typeName)) }
        )
      ),
    },
    annotationRefsOrTypes: metadataAnnotationTypes,
    annotations: {
      metadataType: 'Workflow',
      dirName: 'workflows',
      suffix: 'workflow',
    } as MetadataTypeAnnotations,
  })

  return createInstanceElement(
    { fullName: parentApiName(getChangeElement(changes[0])) },
    workflowType,
  )
}

const createWorkflowChange = (
  changes: ReadonlyArray<Change<InstanceElement>>,
): Change<InstanceElement> => {
  const workflowChange = changes.find(isInstanceOfTypeChange(WORKFLOW_METADATA_TYPE))

  const parent = workflowChange === undefined
    ? createDummyWorkflowInstance(changes)
    : getChangeElement(workflowChange)

  const after = createPartialWorkflowInstance(parent, changes, 'after')
  if (workflowChange !== undefined && isAdditionChange(workflowChange)) {
    return { action: 'add', data: { after } }
  }
  // we assume the only possible changes are in nested instances and we omit the nested instance
  // fields from the parent when we create the partial instance. so we can use the same parent as
  // the after instance here
  const before = createPartialWorkflowInstance(parent, changes, 'before')
  return { action: 'modify', data: { before, after } }
}

const getWorkflowApiName = (change: Change<InstanceElement>): string => {
  const inst = getChangeElement(change)
  return isWorkflowInstance(inst) ? apiName(inst) : parentApiName(inst)
}

const filterCreator: FilterCreator = () => {
  let originalWorkflowChanges: Record<string, Change<InstanceElement>[]> = {}
  return {
    /**
     * Upon fetch, modify the full_names of the inner types of the workflow to contain
     * the workflow full_name (e.g. MyWorkflowAlert -> Lead.MyWorkflowAlert)
     */
    onFetch: async (elements: Element[]) => {
      const splitWorkflow = (workflowInst: InstanceElement): InstanceElement[] => _.flatten(
        Object.entries(WORKFLOW_FIELD_TO_TYPE).map(([fieldName, fieldType]) => {
          const objType = elements.filter(isObjectType)
            .find(e => metadataType(e) === fieldType)
          if (_.isUndefined(objType)) {
            log.debug('failed to find object type for %s', fieldType)
            return []
          }
          const innerInstances = makeArray(workflowInst.value[fieldName])
            .map(innerValue => {
              innerValue[INSTANCE_FULL_NAME_FIELD] = fullApiName(apiName(workflowInst),
                innerValue[INSTANCE_FULL_NAME_FIELD])
              return createInstanceElement(innerValue, objType)
            })
          if (!_.isEmpty(innerInstances)) {
            workflowInst.value[fieldName] = innerInstances
              .map(s => new ReferenceExpression(s.elemID))
          }

          return innerInstances
        })
      )

      elements.push(...elements
        .filter(isInstanceElement)
        .filter(isWorkflowInstance)
        .flatMap(wfInst => splitWorkflow(wfInst)))
    },

    preDeploy: async changes => {
      const allWorkflowRelatedChanges = changes.filter(isWorkflowRelatedChange)

      originalWorkflowChanges = _.groupBy(allWorkflowRelatedChanges, getWorkflowApiName)

      const deployableWorkflowChanges = Object.values(originalWorkflowChanges)
        .map(createWorkflowChange)

      // Remove all the non-deployable workflow changes from the original list and replace them
      // with the deployable changes we created here
      _.remove(changes, isWorkflowRelatedChange)
      changes.push(...deployableWorkflowChanges)
    },

    onDeploy: async changes => {
      const appliedWorkflowApiNames = changes
        .filter(isWorkflowRelatedChange)
        .map(getWorkflowApiName)

      const appliedOriginalChanges = appliedWorkflowApiNames.flatMap(
        workflowName => originalWorkflowChanges[workflowName] ?? []
      )

      // Remove the changes we generated in preDeploy and replace them with the original changes
      _.remove(changes, isWorkflowRelatedChange)
      changes.push(...appliedOriginalChanges)
      return []
    },
  }
}

export default filterCreator
