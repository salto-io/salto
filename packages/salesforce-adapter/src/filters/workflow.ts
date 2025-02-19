/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  Element,
  InstanceElement,
  isInstanceElement,
  isObjectType,
  ObjectType,
  getChangeData,
  Change,
  BuiltinTypes,
  ElemID,
  toChange,
} from '@salto-io/adapter-api'
import { collections, promises, values } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { salesforceAdapterResolveValues } from '../adapter'
import {
  INSTANCE_FULL_NAME_FIELD,
  WORKFLOW_ACTION_ALERT_METADATA_TYPE,
  WORKFLOW_FIELD_UPDATE_METADATA_TYPE,
  WORKFLOW_FLOW_ACTION_METADATA_TYPE,
  WORKFLOW_KNOWLEDGE_PUBLISH_METADATA_TYPE,
  WORKFLOW_METADATA_TYPE,
  WORKFLOW_OUTBOUND_MESSAGE_METADATA_TYPE,
  WORKFLOW_RULE_METADATA_TYPE,
  WORKFLOW_TASK_METADATA_TYPE,
  SALESFORCE,
} from '../constants'
import { FilterCreator } from '../filter'
import {
  apiName,
  metadataType,
  createInstanceElement,
  metadataAnnotationTypes,
  MetadataTypeAnnotations,
  toMetadataInfo,
} from '../transformers/transformer'
import { getLookUpName } from '../transformers/reference_mapping'
import { fullApiName, parentApiName, getDataFromChanges, isInstanceOfTypeChange, isInstanceOfTypeSync } from './utils'
import { WorkflowField } from '../fetch_profile/metadata_types'

const { awu, groupByAsync } = collections.asynciterable
const { makeArray } = collections.array
const { mapValuesAsync } = promises.object
const { removeAsync } = promises.array
const { isDefined } = values
const log = logger(module)

export const WORKFLOW_ALERTS_FIELD = 'alerts'
export const WORKFLOW_FIELD_UPDATES_FIELD = 'fieldUpdates'
const WORKFLOW_FLOW_ACTIONS_FIELD = 'flowActions'
const WORKFLOW_OUTBOUND_MESSAGES_FIELD = 'outboundMessages'
const WORKFLOW_KNOWLEDGE_PUBLISHES_FIELD = 'knowledgePublishes'
export const WORKFLOW_TASKS_FIELD = 'tasks'
export const WORKFLOW_RULES_FIELD = 'rules'

export const WORKFLOW_DIR_NAME = 'WorkflowActions'

export const WORKFLOW_FIELD_TO_TYPE: Record<string, WorkflowField> = {
  [WORKFLOW_ALERTS_FIELD]: WORKFLOW_ACTION_ALERT_METADATA_TYPE,
  [WORKFLOW_FIELD_UPDATES_FIELD]: WORKFLOW_FIELD_UPDATE_METADATA_TYPE,
  [WORKFLOW_FLOW_ACTIONS_FIELD]: WORKFLOW_FLOW_ACTION_METADATA_TYPE,
  [WORKFLOW_OUTBOUND_MESSAGES_FIELD]: WORKFLOW_OUTBOUND_MESSAGE_METADATA_TYPE,
  [WORKFLOW_KNOWLEDGE_PUBLISHES_FIELD]: WORKFLOW_KNOWLEDGE_PUBLISH_METADATA_TYPE,
  [WORKFLOW_TASKS_FIELD]: WORKFLOW_TASK_METADATA_TYPE,
  [WORKFLOW_RULES_FIELD]: WORKFLOW_RULE_METADATA_TYPE,
}
const WORKFLOW_FIELDS = new Set<string>(Object.values(WORKFLOW_FIELD_TO_TYPE))

export const WORKFLOW_TYPE_TO_FIELD: Record<string, string> = _.invert(WORKFLOW_FIELD_TO_TYPE)

const isWorkflowInstance = isInstanceOfTypeSync(WORKFLOW_METADATA_TYPE)

const isWorkflowChildInstance = async (elem: Element): Promise<boolean> =>
  isInstanceElement(elem) && WORKFLOW_FIELDS.has(await metadataType(elem))

const isWorkflowRelatedInstance = async (elem: Element): Promise<boolean> =>
  isWorkflowInstance(elem) || isWorkflowChildInstance(elem)

const isWorkflowRelatedChange = async (change: Change): Promise<boolean> =>
  isWorkflowRelatedInstance(getChangeData(change))

const createPartialWorkflowInstance = async (
  fullInstance: InstanceElement,
  changes: ReadonlyArray<Change>,
  dataField: 'before' | 'after',
): Promise<InstanceElement> =>
  createInstanceElement(
    {
      [INSTANCE_FULL_NAME_FIELD]: fullInstance.value[INSTANCE_FULL_NAME_FIELD],
      ..._.omit(fullInstance.value, Object.keys(WORKFLOW_FIELD_TO_TYPE)),
      ...(await mapValuesAsync(WORKFLOW_FIELD_TO_TYPE, async fieldType =>
        Promise.all(
          getDataFromChanges(
            dataField,
            (await awu(changes).filter(isInstanceOfTypeChange(fieldType)).toArray()) as Change<InstanceElement>[],
          ).map(async nestedInstance => ({
            ...(await toMetadataInfo(nestedInstance)),
            [INSTANCE_FULL_NAME_FIELD]: await apiName(nestedInstance, true),
          })),
        ),
      )),
    },
    await fullInstance.getType(),
    undefined,
    fullInstance.annotations,
  )

const createDummyWorkflowInstance = async (
  changes: ReadonlyArray<Change<InstanceElement>>,
): Promise<InstanceElement> => {
  // Unfortunately we do not have access to the real workflow type here so we create it hard coded
  // using as much known information as possible
  const realFieldTypes = Object.fromEntries(
    await awu(changes)
      .map(change => getChangeData(change))
      .map(inst => inst.getType())
      .map(async instType => [await metadataType(instType), instType])
      .toArray(),
  )
  const dummyFieldType = (typeName: string): ObjectType =>
    new ObjectType({
      elemID: new ElemID(SALESFORCE, typeName),
      annotationRefsOrTypes: _.clone(metadataAnnotationTypes),
      annotations: { metadataType: typeName } as MetadataTypeAnnotations,
    })
  const workflowType = new ObjectType({
    elemID: new ElemID(SALESFORCE, WORKFLOW_METADATA_TYPE),
    fields: {
      [INSTANCE_FULL_NAME_FIELD]: { refType: BuiltinTypes.SERVICE_ID },
      ..._.mapValues(WORKFLOW_FIELD_TO_TYPE, typeName => ({
        refType: realFieldTypes[typeName] ?? dummyFieldType(typeName),
      })),
    },
    annotationRefsOrTypes: metadataAnnotationTypes,
    annotations: {
      metadataType: 'Workflow',
      dirName: 'workflows',
      suffix: 'workflow',
    } as MetadataTypeAnnotations,
  })

  return createInstanceElement({ fullName: await parentApiName(getChangeData(changes[0])) }, workflowType)
}

const createWorkflowChange = async (
  changes: ReadonlyArray<Change<InstanceElement>>,
): Promise<Change<InstanceElement>> => {
  const parent = await createDummyWorkflowInstance(changes)
  const after = await createPartialWorkflowInstance(parent, changes, 'after')
  const before = await createPartialWorkflowInstance(parent, changes, 'before')
  /*
   * we cannot know if the workflow instance change is add or modify
   * but it does not matter in this use case because changes
   * will be deployed with the upsert API anyway
   */
  return { action: 'modify', data: { before, after } }
}

const getWorkflowApiName = async (change: Change<InstanceElement>): Promise<string> => {
  const inst = getChangeData(change)
  return isWorkflowInstance(inst) ? apiName(inst) : parentApiName(inst)
}

const filterCreator: FilterCreator = ({ config, client }) => {
  let originalWorkflowChanges: Record<string, Change<InstanceElement>[]> = {}
  return {
    name: 'workflowFilter',
    /**
     * Upon fetch, modify the full_names of the inner types of the workflow to contain
     * the workflow full_name (e.g. MyWorkflowAlert -> Lead.MyWorkflowAlert)
     */
    onFetch: async (elements: Element[]) => {
      const workflows = elements.filter(isWorkflowInstance)
      if (workflows.length === 0) {
        return
      }

      const fieldTypes = Object.fromEntries(
        await awu(Object.entries(WORKFLOW_FIELD_TO_TYPE))
          .map(async ([fieldName, fieldType]): Promise<[string, ObjectType] | undefined> => {
            const objType = (await awu(elements).find(
              async e => isObjectType(e) && (await metadataType(e)) === fieldType,
            )) as ObjectType | undefined

            if (objType === undefined) {
              log.debug('failed to find object type for %s', fieldType)
              return undefined
            }

            return [fieldName, objType]
          })
          .filter(isDefined)
          .toArray(),
      )

      const splitWorkflow = async (workflowInst: InstanceElement): Promise<InstanceElement[]> => {
        const workflowApiName = await apiName(workflowInst)
        return (
          await Promise.all(
            Object.entries(fieldTypes).map(async ([fieldName, fieldType]) => {
              const innerInstances = await Promise.all(
                makeArray(workflowInst.value[fieldName]).map(async innerValue =>
                  createInstanceElement(
                    {
                      ...innerValue,
                      [INSTANCE_FULL_NAME_FIELD]: fullApiName(workflowApiName, innerValue[INSTANCE_FULL_NAME_FIELD]),
                    },
                    fieldType,
                  ),
                ),
              )

              return innerInstances
            }),
          )
        ).flat()
      }

      const additionalElements = await awu(workflows).flatMap(splitWorkflow).toArray()

      await removeAsync(elements, isWorkflowInstance)
      elements.push(...additionalElements)
    },

    preDeploy: async changes => {
      const allWorkflowRelatedChanges = awu(changes).filter(isWorkflowRelatedChange) as AsyncIterable<
        Change<InstanceElement>
      >

      originalWorkflowChanges = await groupByAsync(allWorkflowRelatedChanges, getWorkflowApiName)

      if (client === undefined) {
        // In the SFDX flow we need to get the entire workflow to avoid part of it being dropped.
        const workflowNames = new Set(Object.keys(originalWorkflowChanges))

        await awu(await config.elementsSource.list())
          .filter(elemID => WORKFLOW_FIELDS.has(elemID.typeName))
          .map(config.elementsSource.get)
          .filter(isWorkflowRelatedInstance)
          .map(async (elem): Promise<[string, InstanceElement]> => [await parentApiName(elem), elem as InstanceElement])
          .filter(([parent, _elem]) => workflowNames.has(parent))
          .filter(([parent, elem]) =>
            originalWorkflowChanges[parent].every(change => !elem.elemID.isEqual(getChangeData(change).elemID)),
          )
          .forEach(async ([parent, elem]) => {
            originalWorkflowChanges[parent].push(
              toChange({
                after: await salesforceAdapterResolveValues(
                  elem,
                  getLookUpName(config.fetchProfile),
                  config.elementsSource,
                ),
              }),
            )
          })
      }

      const deployableWorkflowChanges = await awu(Object.values(originalWorkflowChanges))
        .map(createWorkflowChange)
        .toArray()
      // Remove all the non-deployable workflow changes from the original list and replace them
      // with the deployable changes we created here
      await removeAsync(changes, isWorkflowRelatedChange)
      changes.push(...deployableWorkflowChanges)
    },

    onDeploy: async changes => {
      const appliedWorkflowApiNames = await awu(changes)
        .filter(isWorkflowRelatedChange)
        .map(change => getWorkflowApiName(change as Change<InstanceElement>))
        .toArray()

      const appliedOriginalChanges = appliedWorkflowApiNames.flatMap(
        workflowName => originalWorkflowChanges[workflowName] ?? [],
      )

      // Remove the changes we generated in preDeploy and replace them with the original changes
      await removeAsync(changes, isWorkflowRelatedChange)
      changes.push(...appliedOriginalChanges)
    },
  }
}

export default filterCreator
