/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { elements as adapterElements, config as configUtils, client as clientUtils } from '@salto-io/adapter-components'
import { AdditionChange, Change, ChangeDataType, CORE_ANNOTATIONS, Element, getChangeData, InstanceElement, isAdditionChange, isAdditionOrModificationChange, isInstanceChange, isInstanceElement, isModificationChange, isReferenceExpression, ModificationChange, ReadOnlyElementsSource, ReferenceExpression } from '@salto-io/adapter-api'
import { v4 as uuidv4 } from 'uuid'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../../filter'
import { defaultDeployChange, deployChanges } from '../../deployment/standard_deployment'
import JiraClient from '../../client/client'
import { addAnnotationRecursively, findObject, setTypeDeploymentAnnotations } from '../../utils'
import { JiraConfig } from '../../config/config'
import { CHUNK_SIZE, isStatusMappings, isTaskResponse, isWorkflowIdsResponse, isWorkflowResponse, JIRA_WORKFLOW_TYPE, STATUS_CATEGORY_ID_TO_KEY, StatusMapping, StatusMigration, TASK_STATUS, Transition, TransitionStatusData, WORKFLOW_ADDITION_FIELDS_TO_OMIT, WORKFLOW_FIELDS_TO_OMIT, WorkflowPayload, WorkflowStatus, WorkflowStatusLayout } from './types'
import { DEFAULT_API_DEFINITIONS } from '../../config/api_config'


const log = logger(module)
const { awu } = collections.asynciterable
const { makeArray } = collections.array
const { toBasicInstance } = adapterElements
const { getTransformationConfigByType } = configUtils

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
    log.error('Received an invalid status migration progress response')
    return false
  }
  switch (taskResponse.status) {
    case TASK_STATUS.COMPLETE:
      return true
    case TASK_STATUS.FAILED:
    case TASK_STATUS.CANCEL_REQUESTED:
    case TASK_STATUS.CANCELLED:
    case TASK_STATUS.DEAD:
      log.error(`Failed to run status migration for workflow bla - task status is ${taskResponse.status}`)
      return false
    default:
      if (retries === 0) {
        log.error('Failed to run status migration for workflow bla - did not received success response after await timeout')
        return false
      }
      return awaitSuccessfulMigration({
        client,
        taskId,
        retries: retries - 1,
        delay,
      })
  }
}

export const deployWorkflow = async ({
  change,
  client,
  config,
  elementsSource,
}: {
  change: AdditionChange<InstanceElement> | ModificationChange<InstanceElement>
  client: JiraClient
  config: JiraConfig
  elementsSource?: ReadOnlyElementsSource
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
  const workflowInstance = getChangeData(change)
  const responseWorkflow = response.workflows[0]
  workflowInstance.value.workflows[0] = {
    ...workflowInstance.value.workflows[0],
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
      throw new Error('Failed to run status migration for workflow bla')
    }
  }
}

const getStatusUuid = (statusReference: ReferenceExpression | string, statusNameToUuid: Record<string, string>)
  : string => {
  if (isReferenceExpression(statusReference)) {
    return statusNameToUuid[statusReference.elemID.name]
  }
  return statusReference
}

const getStatusesWithUuid = (workflowInstance: InstanceElement, statusNameToUuid: Record<string, string>)
: WorkflowStatusLayout[] => workflowInstance.value.statuses.map((status: WorkflowStatusLayout) => ({
  ...status,
  statusReference: statusNameToUuid[status.statusReference.elemID.name],
}))

const getTransitionsWithUuid = (workflowInstance: InstanceElement, statusNameToUuid: Record<string, string>)
  : Transition[] => workflowInstance.value.transitions.map((transition: Transition) => ({
  ...transition,
  to: transition.to
    ? {
      ...transition.to,
      statusReference: getStatusUuid(transition.to.statusReference, statusNameToUuid),
    } : undefined,
  from: transition.from
    ? transition.from.map((from: TransitionStatusData) => ({
      ...from,
      statusReference: getStatusUuid(from.statusReference, statusNameToUuid),
    }))
    : undefined,
}))

const getStatusesWithReference = (
  workflowInstance: InstanceElement,
  statusUuidToReference: Record<string, ReferenceExpression>
): WorkflowStatus[] =>
  workflowInstance.value.workflows[0].statuses.map((status: WorkflowStatus) => ({
    ...status,
    statusReference: statusUuidToReference[status.statusReference],
  }))

const getTransitionsWithReference = (
  workflowInstance: InstanceElement,
  statusUuidToReference: Record<string, ReferenceExpression>
): Transition[] => workflowInstance.value.workflows[0].transitions.map((transition: Transition) => ({
  ...transition,
  to: transition.to && !isReferenceExpression(transition.to.statusReference)
    ? {
      ...transition.to,
      statusReference: statusUuidToReference[transition.to.statusReference],
    } : undefined,
  from: transition.from
    ? transition.from.map((from: TransitionStatusData) => (
      isReferenceExpression(from.statusReference)
        ? from
        : {
          ...from,
          statusReference: statusUuidToReference[from.statusReference],
        }))
    : undefined,
}))

const fixStatusCategories = async (statuses: InstanceElement[], elementsSource: ReadOnlyElementsSource)
  : Promise<void> => {
  await Promise.all(statuses.map(async (statusInstance: InstanceElement) => {
    const statusCategory = await statusInstance.value.statusCategory.getResolvedValue(elementsSource)
    statusInstance.value.statusCategory = STATUS_CATEGORY_ID_TO_KEY[statusCategory.value.id]
  }))
}

const insertUuidMapsAndGetStatuses = async (
  change: AdditionChange<InstanceElement> | ModificationChange<InstanceElement>,
  statusNameToUuid: Record<string, string>,
  statusUuidToReference: Record<string, ReferenceExpression>,
  elementsSource: ReadOnlyElementsSource
): Promise<InstanceElement[]> => {
  const { after: afterInstance } = change.data
  const statusReferences = afterInstance.value.statuses
    .map((status:WorkflowStatusLayout) => status.statusReference)
    .filter(isReferenceExpression)
  const statusByName = _.keyBy(statusReferences, statusReference => statusReference.elemID.name)
  if (isModificationChange(change)) {
    const { before: beforeInstance } = change.data
    statusReferences.push(...beforeInstance.value.statuses
      .map((status:WorkflowStatusLayout) => status.statusReference)
      .filter(isReferenceExpression)
      .filter((statusReference: ReferenceExpression) => statusByName[statusReference.elemID.name] === undefined))
  }
  const statuses = (await Promise.all(statusReferences
    .map(async (statusReference: ReferenceExpression) => statusReference.getResolvedValue(elementsSource))))
    .filter(isInstanceElement)
  if (statuses.length !== statusReferences.length) { // fix error message
    throw new Error('Received an invalid status reference')
  }
  statuses.forEach((status: InstanceElement, index: number) => {
    if (statusNameToUuid[status.elemID.name] === undefined) {
      const uuid = uuidv4()
      statusNameToUuid[status.elemID.name] = uuid
      statusUuidToReference[uuid] = statusReferences[index]
      status.value.statusReference = uuid
    }
  })
  return statuses
}

const getReferenceId = async (reference: ReferenceExpression, elementsSource: ReadOnlyElementsSource)
: Promise<string> =>
  ((await reference.getResolvedValue(elementsSource)).value.id)


const validateStatusMappingsAndInsertUuids = (
  workflowInstance: InstanceElement,
  statusNameToUuid: Record<string, string>,
  elementsSource: ReadOnlyElementsSource
): void => {
  if (workflowInstance.value.statusMappings) {
    if (!isStatusMappings(workflowInstance.value.statusMappings)) {
      throw new Error('Received an invalid statusMappings')
    }
    workflowInstance.value.statusMappings.forEach(async (statusMapping: StatusMapping) => {
      statusMapping.statusMigrations.forEach((statusMigration: StatusMigration) => {
        const { newStatusReference, oldStatusReference } = statusMigration
        if (isReferenceExpression(newStatusReference) && isReferenceExpression(oldStatusReference)) {
          statusMigration.newStatusReference = statusNameToUuid[newStatusReference.elemID.name]
          statusMigration.oldStatusReference = statusNameToUuid[oldStatusReference.elemID.name]
        } else {
          throw new Error('Received an invalid statusMappings')
        }
      })
      if (isReferenceExpression(statusMapping.issueTypeId)) {
        statusMapping.issueTypeId = await getReferenceId(statusMapping.issueTypeId, elementsSource)
      }
      if (isReferenceExpression(statusMapping.projectId)) {
        statusMapping.projectId = await getReferenceId(statusMapping.projectId, elementsSource)
      }
    })
  }
}
const insertNewVersionFromService = async (workflowInstance: InstanceElement, client: JiraClient): Promise<void> => {
  const response = await client.post({
    url: '/rest/api/3/workflows',
    data: {
      workflowNames: [workflowInstance.value.workflows[0].name],
    },
  })
  if (!isWorkflowResponse(response.data)) {
    throw new Error('Received an invalid workflow response from service')
  }
  workflowInstance.value.workflows[0].version = response.data.workflows[0].version
}

const getWorkflowPayload = (
  change: Change<InstanceElement>,
  statuses: InstanceElement[],
  statusesWithUuids: WorkflowStatusLayout[],
  transitionsWithUuids: Transition[],
):WorkflowPayload => {
  const workflowInstance = getChangeData(change)
  const isAddition = isAdditionChange(change)
  const fieldsToOmit = isAddition
    ? [...WORKFLOW_FIELDS_TO_OMIT, ...WORKFLOW_ADDITION_FIELDS_TO_OMIT]
    : WORKFLOW_FIELDS_TO_OMIT
  const workflow = {
    ..._.omit(workflowInstance.value, fieldsToOmit),
    statuses: statusesWithUuids,
    transitions: transitionsWithUuids,
  }
  const basicPayload = {
    statuses: statuses.map(statusInstance => statusInstance.value),
    workflows: [workflow],
  }
  const workflowPayload = isAddition
    ? {
      scope: workflowInstance.value.scope,
      ...basicPayload,
    } : basicPayload
  return workflowPayload
}

const fetchWorkflowIds = async (paginator: clientUtils.Paginator): Promise<string[]> => {
  const paginationArgs = {
    url: '/rest/api/3/workflow/search',
    paginationField: 'startAt',
  }
  const workflowValues = await awu(paginator(
    paginationArgs,
    page => makeArray(page.values) as clientUtils.ResponseValue[]
  )).flat().toArray()
  if (!isWorkflowIdsResponse(workflowValues)) {
    throw new Error('Received an invalid workflow response from service')
  }
  return workflowValues.map(value => value.id.entityId)
}


// This filter transforms the workflow values structure so it will fit its deployment endpoint
const filter: FilterCreator = ({ elementsSource, config, client, paginator }) => {
  const statusNameToUuid: Record<string, string> = {} // not good, the name can be overridden
  const statusUuidToReference: Record<string, ReferenceExpression> = {}
  return ({
    name: 'jiraWorkflowDeployFilter',
    onFetch: async (elements: Element[]) => {
      if (!config.fetch.enableNewWorkflowAPI) {
        return
      }
      const jiraWorkflow = findObject(elements, JIRA_WORKFLOW_TYPE)
      if (jiraWorkflow === undefined) {
        throw new Error('JiraWorkflow type not found')
      }
      setTypeDeploymentAnnotations(jiraWorkflow)
      await addAnnotationRecursively(jiraWorkflow, CORE_ANNOTATIONS.CREATABLE)
      await addAnnotationRecursively(jiraWorkflow, CORE_ANNOTATIONS.UPDATABLE)
      await addAnnotationRecursively(jiraWorkflow, CORE_ANNOTATIONS.DELETABLE)

      const workflowIds = await fetchWorkflowIds(paginator)
      const workflowChunks = _.chunk(workflowIds, CHUNK_SIZE)
      workflowChunks.forEach(async chunk => {
        const response = await client.post({
          url: '/rest/api/3/workflows',
          data: {
            workflowIds: chunk,
          },
        })
        if (!isWorkflowResponse(response.data)) {
          throw new Error('Received an invalid workflow response from service')
        }
        elements.push(...await Promise.all(response.data.workflows.map(async workflow => (
          toBasicInstance({
            entry: workflow,
            type: jiraWorkflow,
            transformationConfigByType: getTransformationConfigByType(DEFAULT_API_DEFINITIONS.types),
            transformationDefaultConfig: DEFAULT_API_DEFINITIONS.typeDefaults.transformation,
            defaultName: workflow.name,
          })
        ))))
      })
    },
    preDeploy: async (changes: Change<ChangeDataType>[]) => {
      await awu(changes)
        .filter(isInstanceChange)
        .filter(isAdditionOrModificationChange)
        .filter(change => getChangeData(change).elemID.typeName === JIRA_WORKFLOW_TYPE)
        .forEach(async change => {
          const workflowInstance = getChangeData(change)
          const statuses = await insertUuidMapsAndGetStatuses(
            change,
            statusNameToUuid,
            statusUuidToReference,
            elementsSource
          )
          await fixStatusCategories(statuses, elementsSource)
          const statusesWithUuids = getStatusesWithUuid(workflowInstance, statusNameToUuid)
          const transitionsWithUuids = getTransitionsWithUuid(workflowInstance, statusNameToUuid)
          validateStatusMappingsAndInsertUuids(workflowInstance, statusNameToUuid, elementsSource)
          workflowInstance.value = getWorkflowPayload(
            change,
            statuses,
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
        .forEach(async change => {
          const workflowInstance = getChangeData(change)
          const statuses = getStatusesWithReference(workflowInstance, statusUuidToReference)
          const transitions = getTransitionsWithReference(workflowInstance, statusUuidToReference)
          if (workflowInstance.value.workflows[0].statusMappings) {
            await insertNewVersionFromService(workflowInstance, client)
            delete workflowInstance.value.workflows[0].statusMappings
          }
          workflowInstance.value = {
            ...workflowInstance.value.workflows[0],
            statuses,
            transitions,
          }
        })
    },
  })
}

export default filter
