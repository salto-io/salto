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
import { logger } from '@salto-io/logging'
import { resolveValues } from '@salto-io/adapter-utils'
import { InstanceElement, AdditionChange, Change, ChangeDataType, getChangeData, isAdditionChange, isAdditionOrModificationChange, isInstanceChange, isInstanceElement, isModificationChange, isReferenceExpression, ModificationChange, ReadOnlyElementsSource, ReferenceExpression, Values } from '@salto-io/adapter-api'
import { v4 as uuidv4 } from 'uuid'
import { FilterCreator } from '../../filter'
import { JIRA_WORKFLOW_TYPE } from '../../constants'
import JiraClient from '../../client/client'
import { defaultDeployChange, deployChanges } from '../../deployment/standard_deployment'
import { isWorkflowResponse, isStatusMappings, isTaskResponse, STATUS_CATEGORY_ID_TO_KEY, StatusMapping, StatusMigration, TASK_STATUS, WORKFLOW_ADDITION_FIELDS_TO_OMIT, WORKFLOW_FIELDS_TO_OMIT, WorkflowPayload, WorkflowVersion } from './types'
import { getLookUpName } from '../../reference_mapping'
import { JiraConfig } from '../../config/config'


const log = logger(module)
const { awu } = collections.asynciterable

const awaitSuccessfulMigration = async ({
  client,
  taskId,
  retries,
  delay,
} : {
  client: JiraClient
  taskId: string
  retries: number
  delay: number
}): Promise<boolean> => {
  await new Promise(resolve => setTimeout(resolve, delay))
  const taskResponse = (await client.getPrivate({
    url: `/rest/api/3/task/${taskId}`,
  })).data
  if (!isTaskResponse(taskResponse)) {
    return false
  }
  switch (taskResponse.status) {
    case TASK_STATUS.COMPLETE:
      return true
    case TASK_STATUS.FAILED:
    case TASK_STATUS.CANCEL_REQUESTED:
    case TASK_STATUS.CANCELLED:
    case TASK_STATUS.DEAD:
      return false
    default:
      if (retries === 0) {
        log.error('Failed to run status migration - did not receive success response after await timeout')
        return false
      }
      log.info('Status migration did not complete, retrying')
      return awaitSuccessfulMigration({
        client,
        taskId,
        retries: retries - 1,
        delay,
      })
  }
}


const getStatusesWithUuid = (workflowInstance: InstanceElement, statusIdToUuid: Record<string, string>)
: Values[] => workflowInstance.value.statuses.map((status: Values) => ({
  ...status,
  statusReference: statusIdToUuid[status.statusReference],
}))

const getTransitionsWithUuid = (workflowInstance: InstanceElement, statusIdToUuid: Record<string, string>)
  : Values[] => workflowInstance.value.transitions.map((transition: Values) => ({
  ...transition,
  to: transition.to
    ? {
      ...transition.to,
      statusReference: statusIdToUuid[transition.to.statusReference],
    } : undefined,
  from: transition.from
    ? transition.from.map((from: Values) => ({
      ...from,
      statusReference: statusIdToUuid[from.statusReference],
    }))
    : undefined,
}))


const getStatusesPayload = async (
  statuses: InstanceElement[],
  elementsSource: ReadOnlyElementsSource,
  statusIdToUuid: Record<string, string>)
: Promise<Values[]> => Promise.all(statuses.map(async (statusInstance: InstanceElement) => {
  const statusCategory = await statusInstance.value.statusCategory.getResolvedValue(elementsSource)
  return {
    ...statusInstance.value,
    statusCategory: STATUS_CATEGORY_ID_TO_KEY[statusCategory.value.id],
    statusReference: statusIdToUuid[statusInstance.value.id],
  }
}))

const getStatusesValues = async (
  change: AdditionChange<InstanceElement> | ModificationChange<InstanceElement>,
  elementsSource: ReadOnlyElementsSource)
: Promise<InstanceElement[]> => {
  const { after: afterInstance } = change.data
  const statusReferences = afterInstance.value.statuses
    .map((status:Values) => status.statusReference)
    .filter(isReferenceExpression)
  const statusByName = _.keyBy(statusReferences, statusReference => statusReference.elemID.name)
  if (isModificationChange(change)) {
    const { before: beforeInstance } = change.data
    statusReferences.push(...beforeInstance.value.statuses
      .map((status:Values) => status.statusReference)
      .filter(isReferenceExpression)
      .filter((statusReference: ReferenceExpression) => statusByName[statusReference.elemID.name] === undefined))
  }
  return (await Promise.all(statusReferences
    .map(async (statusReference: ReferenceExpression) => statusReference.getResolvedValue(elementsSource))))
    .filter(isInstanceElement)
}

const insertUuidMap = (statusesValues: InstanceElement[], statusIdToUuid: Record<string, string>): void => {
  statusesValues.forEach((status: InstanceElement) => {
    if (statusIdToUuid[status.value.id] === undefined) {
      const uuid = uuidv4()
      statusIdToUuid[status.value.id] = uuid
      status.value.statusReference = uuid
    }
  })
}

const validateStatusMappingsAndInsertUuids = (
  workflowInstance: InstanceElement,
  statusIdToUuid: Record<string, string>,
): void => {
  if (workflowInstance.value.statusMappings) {
    if (!isStatusMappings(workflowInstance.value.statusMappings)) {
      throw new Error('Received an invalid statusMappings')
    }
    workflowInstance.value.statusMappings.forEach(async (statusMapping: StatusMapping) => {
      statusMapping.statusMigrations.forEach((statusMigration: StatusMigration) => {
        const { newStatusReference, oldStatusReference } = statusMigration
        statusMigration.newStatusReference = statusIdToUuid[newStatusReference]
        statusMigration.oldStatusReference = statusIdToUuid[oldStatusReference]
      })
    })
  }
}
const getNewVersionFromService = async (workflowName: string, client: JiraClient): Promise<WorkflowVersion> => {
  const response = await client.post({
    url: '/rest/api/3/workflows',
    data: {
      workflowNames: [workflowName],
    },
  })
  if (!isWorkflowResponse(response.data)) {
    throw new Error('Received an invalid workflow response from service')
  }
  return response.data.workflows[0].version
}

const getWorkflowPayload = (
  isAddition: boolean,
  resolvedWorkflowInstance: InstanceElement,
  statusesPayload: Values[],
  statusesWithUuids: Values[],
  transitionsWithUuids: Values[],
):WorkflowPayload => {
  const fieldsToOmit = isAddition
    ? [...WORKFLOW_FIELDS_TO_OMIT, ...WORKFLOW_ADDITION_FIELDS_TO_OMIT]
    : WORKFLOW_FIELDS_TO_OMIT
  const workflow = {
    ..._.omit(resolvedWorkflowInstance.value, fieldsToOmit),
    statuses: statusesWithUuids,
    transitions: transitionsWithUuids,
  }
  const basicPayload = {
    statuses: statusesPayload,
    workflows: [workflow],
  }
  const workflowPayload = isAddition
    ? {
      scope: resolvedWorkflowInstance.value.scope,
      ...basicPayload,
    } : basicPayload
  return workflowPayload
}

const deployWorkflow = async ({
  change,
  client,
  config,
  elementsSource,
}: {
  change: AdditionChange<InstanceElement> | ModificationChange<InstanceElement>
  client: JiraClient
  config: JiraConfig
  elementsSource: ReadOnlyElementsSource
}): Promise<void> => {
  const response = await defaultDeployChange({
    change,
    client,
    apiDefinitions: config.apiDefinitions,
    elementsSource,
  })
  if (!isWorkflowResponse(response)) {
    throw new Error('Received unexpected workflow response from service')
  }
  const instance = getChangeData(change)
  const responseWorkflow = response.workflows[0]
  instance.value.workflows[0] = {
    ...instance.value.workflows[0],
    id: responseWorkflow.id,
    version: responseWorkflow.version,
    scope: responseWorkflow.scope,
  }
  if (response.taskId) {
    const migrationResult = await awaitSuccessfulMigration({
      client,
      retries: config.deploy.taskMaxRetries,
      delay: config.deploy.taskRetryDelay,
      taskId: response.taskId,
    })
    if (!migrationResult) {
      log.error(`Failed to run status migration for workflow ${instance.elemID.name}`)
    }
  }
}

/*
* This filter uses the new workflow API to add and modify workflows
*/
const filter: FilterCreator = ({ elementsSource, config, client }) => {
  const statusIdToUuid: Record<string, string> = {}
  const originalChanges: Record<string, AdditionChange<InstanceElement> | ModificationChange<InstanceElement>> = {}
  return {
    name: 'jiraWorkflowDeployFilter',
    preDeploy: async (changes: Change<ChangeDataType>[]) => {
      await awu(changes)
        .filter(isInstanceChange)
        .filter(isAdditionOrModificationChange)
        .filter(change => getChangeData(change).elemID.typeName === JIRA_WORKFLOW_TYPE)
        .forEach(async change => {
          const workflowInstance = getChangeData(change)
          originalChanges[workflowInstance.elemID.getFullName()] = _.cloneDeep(change)
          const statusesValues = await getStatusesValues(change, elementsSource)
          insertUuidMap(statusesValues, statusIdToUuid)
          const resolvedWorkflowInstance = await resolveValues(workflowInstance, getLookUpName)
          const statusesPayload = await getStatusesPayload(statusesValues, elementsSource, statusIdToUuid)
          const statusesWithUuids = getStatusesWithUuid(resolvedWorkflowInstance, statusIdToUuid)
          const transitionsWithUuids = getTransitionsWithUuid(resolvedWorkflowInstance, statusIdToUuid)
          validateStatusMappingsAndInsertUuids(resolvedWorkflowInstance, statusIdToUuid)
          workflowInstance.value = getWorkflowPayload(
            isAdditionChange(change),
            resolvedWorkflowInstance,
            statusesPayload,
            statusesWithUuids,
            transitionsWithUuids,
          )
          return changes
        })
    },
    deploy: async changes => {
      const [relevantChanges, leftoverChanges] = _.partition(
        changes,
        change => isInstanceChange(change)
          && isAdditionOrModificationChange(change)
          && getChangeData(change).elemID.typeName === JIRA_WORKFLOW_TYPE
      )
      const deployResult = await deployChanges(
        relevantChanges
          .filter(isInstanceChange)
          .filter(isAdditionOrModificationChange),
        async change => deployWorkflow({
          change,
          client,
          config,
          elementsSource,
        })
      )
      return {
        leftoverChanges,
        deployResult,
      }
    },
    onDeploy: async (changes: Change<ChangeDataType>[]) => {
      await awu(changes)
        .filter(isInstanceChange)
        .filter(isAdditionOrModificationChange)
        .filter(change => getChangeData(change).elemID.typeName === JIRA_WORKFLOW_TYPE)
        .forEach(async change => {
          const instance = getChangeData(change)
          const originalInstance = getChangeData(originalChanges[instance.elemID.getFullName()])
          const workflow = getChangeData(change).value.workflows[0]
          const isMigrationDone = workflow.statusMappings !== undefined
          const version = isMigrationDone
            ? await getNewVersionFromService(workflow.name, client)
            : workflow.version
          if (isMigrationDone) {
            delete originalInstance.value.statusMappings
          }
          instance.value = {
            ...originalInstance.value,
            id: workflow.id,
            version,
          }
        })
    },
  }
}

export default filter
