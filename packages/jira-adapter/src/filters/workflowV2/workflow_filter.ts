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
import { WALK_NEXT_STEP, WalkOnFunc, isResolvedReferenceExpression, resolveValues, walkOnElement } from '@salto-io/adapter-utils'
import { elements as adapterElements, config as configUtils, client as clientUtils } from '@salto-io/adapter-components'
import { CORE_ANNOTATIONS, Element, InstanceElement, ObjectType, SaltoError, AdditionChange, Change, ChangeDataType, getChangeData, isAdditionChange, isAdditionOrModificationChange, isInstanceChange, isInstanceElement, isModificationChange, ModificationChange, ReadOnlyElementsSource, ReferenceExpression, Values, ElemID } from '@salto-io/adapter-api'
import { v4 as uuidv4 } from 'uuid'
import { FilterCreator } from '../../filter'
import { addAnnotationRecursively, findObject, setTypeDeploymentAnnotations } from '../../utils'
import { CHUNK_SIZE, isWorkflowIdsResponse, isWorkflowResponse, isTaskResponse, STATUS_CATEGORY_ID_TO_KEY, TASK_STATUS, WorkflowPayload, WorkflowVersion } from './types'
import { DEFAULT_API_DEFINITIONS } from '../../config/api_config'
import { JIRA_WORKFLOW_TYPE } from '../../constants'
import JiraClient from '../../client/client'
import { defaultDeployChange, deployChanges } from '../../deployment/standard_deployment'
import { getLookUpName } from '../../reference_mapping'
import { JiraConfig } from '../../config/config'
import { convertTransitionParametersFields } from './transition_parameters_filter'


const log = logger(module)
const { awu } = collections.asynciterable
const { makeArray } = collections.array
const { toBasicInstance } = adapterElements
const { getTransformationConfigByType } = configUtils

const workflowFetchError = (errorMessage?: string): SaltoError => ({
  message: errorMessage
    ? `Failed to fetch Workflows: ${errorMessage}.`
    : 'Failed to fetch Workflows.',
  severity: 'Error',
})

type WorkflowIdsOrFilterResult = {
  workflowIds?: string[]
  errors?: SaltoError[]
}

type WorkflowInstancesOrFilterResult = {
  workflowInstances?: InstanceElement[]
  errors?: SaltoError[]
}

const fetchWorkflowIds = async (paginator: clientUtils.Paginator): Promise<WorkflowIdsOrFilterResult> => {
  const paginationArgs = {
    url: '/rest/api/3/workflow/search',
    paginationField: 'startAt',
  }
  const workflowValues = await awu(paginator(
    paginationArgs,
    page => makeArray(page.values) as clientUtils.ResponseValue[]
  )).flat().toArray()
  if (!isWorkflowIdsResponse(workflowValues)) {
    return {
      errors: [workflowFetchError()],
    }
  }
  return { workflowIds: workflowValues.map(value => value.id.entityId) }
}

const createWorkflowInstances = async (
  client: JiraClient,
  workflowIds: string[],
  jiraWorkflowType: ObjectType,
): Promise<WorkflowInstancesOrFilterResult> => {
  try {
    // The GET response content is limited, we are using a POST request to obtain the necessary additional information.
    const response = await client.post({
      url: '/rest/api/3/workflows',
      data: {
        workflowIds,
      },
    })
    if (!isWorkflowResponse(response.data)) {
      return {
        errors: [workflowFetchError()],
      }
    }
    const workflowInstances = await Promise.all(response.data.workflows.map(workflow => (
      toBasicInstance({
        entry: workflow,
        type: jiraWorkflowType,
        transformationConfigByType: getTransformationConfigByType(DEFAULT_API_DEFINITIONS.types),
        transformationDefaultConfig: DEFAULT_API_DEFINITIONS.typeDefaults.transformation,
        defaultName: workflow.name,
      })
    )))
    return { workflowInstances }
  } catch (error) {
    return {
      errors: [workflowFetchError(error.message)],
    }
  }
}

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
  const taskResponse = (await client.getPrivate({
    url: `/rest/api/3/task/${taskId}`,
  })).data
  if (!isTaskResponse(taskResponse)) {
    return false
  }
  switch (taskResponse.status) {
    case TASK_STATUS.COMPLETE:
      return true
    case TASK_STATUS.CANCELLED:
    case TASK_STATUS.FAILED:
    case TASK_STATUS.CANCEL_REQUESTED:
    case TASK_STATUS.DEAD:
      log.error(`Status migration failed with status ${taskResponse.status}`)
      return false
    case TASK_STATUS.RUNNING:
    case TASK_STATUS.ENQUEUED:
      if (retries === 0) {
        log.error('Failed to run status migration - did not receive success response after await timeout')
        return false
      }
      log.debug('Status migration did not complete, retrying')
      // delay because we need to wait for the migration to complete
      // jira task documentation: https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-tasks/#api-rest-api-3-task-taskid-get
      await new Promise(resolve => setTimeout(resolve, delay))
      return awaitSuccessfulMigration({
        client,
        taskId,
        retries: retries - 1,
        delay,
      })
    default:
      log.error(`Status migration failed with unknown status ${taskResponse.status}`)
      return false
  }
}

const getStatusesPayload = (
  statuses: InstanceElement[],
  statusIdToUuid: Record<string, string>
): Values[] => statuses
  .filter(instance => isResolvedReferenceExpression(instance.value?.statusCategory))
  .map((statusInstance: InstanceElement) => {
    const statusCategoryId = statusInstance.value.statusCategory.value.value.id
    return {
      ...statusInstance.value,
      statusCategory: STATUS_CATEGORY_ID_TO_KEY[statusCategoryId],
      statusReference: statusIdToUuid[statusInstance.value.id],
    }
  })

const getStatusReferenceInstances = (instance: InstanceElement): InstanceElement[] => (
  instance.value.statuses
    ?.map((status: Values) => status?.statusReference)
    .filter(isResolvedReferenceExpression)
    .map((statusReference: ReferenceExpression) => statusReference.value)
    .filter(isInstanceElement)
)


const getStatusInstances = (
  change: AdditionChange<InstanceElement> | ModificationChange<InstanceElement>,
): InstanceElement[] => {
  const { after: afterInstance } = change.data
  const afterStatusInstances = getStatusReferenceInstances(afterInstance)
  if (isModificationChange(change)) {
    const { before: beforeInstance } = change.data
    const beforeStatusInstances = getStatusReferenceInstances(beforeInstance)
    const statusInstances = _.uniqBy(
      [...afterStatusInstances, ...beforeStatusInstances],
      statusInstance => statusInstance.elemID.getFullName()
    )
    return statusInstances
  }
  return afterStatusInstances
}

const insertUuidMap = (statusesValues: InstanceElement[], statusIdToUuid: Record<string, string>): void => {
  statusesValues.forEach(status => {
    if (statusIdToUuid[status.value.id] === undefined) {
      const uuid = uuidv4()
      statusIdToUuid[status.value.id] = uuid
      status.value.statusReference = uuid
    }
  })
}

const insertUuidsToStatusMappings = (
  workflowInstance: InstanceElement,
  statusIdToUuid: Record<string, string>,
): void => {
  if (workflowInstance.value.statusMappings) {
    // TODO: validate statusMappings in a change validator
    workflowInstance.value.statusMappings.forEach((statusMapping: Values) => {
      statusMapping.statusMigrations.forEach((statusMigration: Values) => {
        const { newStatusReference, oldStatusReference } = statusMigration
        statusMigration.newStatusReference = statusIdToUuid[newStatusReference]
        statusMigration.oldStatusReference = statusIdToUuid[oldStatusReference]
      })
    })
  }
}

const getNewVersionFromService = async (workflowName: string, client: JiraClient)
: Promise<WorkflowVersion | undefined> => {
  const response = await client.post({
    url: '/rest/api/3/workflows',
    data: {
      workflowNames: [workflowName],
    },
  })
  if (!isWorkflowResponse(response.data)) {
    log.warn('Received unexpected workflow response from service when fetching new version')
    return undefined
  }
  return response.data.workflows[0].version
}

const getWorkflowPayload = (
  isAddition: boolean,
  resolvedWorkflowInstance: InstanceElement,
  statusesPayload: Values[],
):WorkflowPayload => {
  const basicPayload = {
    statuses: statusesPayload,
    workflows: [resolvedWorkflowInstance.value],
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
  const isAddition = isAdditionChange(change)
  const fieldsToIgnoreFunc = (path: ElemID): boolean => {
    const fullNameParts = path.getFullNameParts()
    const pathLength = path.getFullNameParts().length
    if (fullNameParts[pathLength - 3] === 'workflows') {
      if (isAddition && (path.name === 'id' || path.name === 'version')) {
        return true
      }
      if (path.name === 'isEditable' || path.name === 'scope') {
        return true
      }
    }
    return false
  }
  const response = await defaultDeployChange({
    change,
    client,
    apiDefinitions: config.apiDefinitions,
    elementsSource,
    fieldsToIgnore: fieldsToIgnoreFunc,
  })
  if (!isWorkflowResponse(response)) {
    log.warn('Received unexpected workflow response from service')
    return
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

const convertParametersFieldsToString = (
  parameters: Values,
  listFields: Set<string>
): void => {
  if (parameters === undefined) {
    return
  }
  Object.entries(parameters)
    .filter(([key, value]) => _.isArray(value) && listFields.has(key))
    .forEach(([key, value]) => {
      parameters[key] = value.join(',')
    })
}

const PATH_NAME_TO_RECURSE = new Set(['statuses', 'transitions', 'statusMappings', 'statusMigrations'])

/*
* This filter uses the new workflow API to fetch and deploy workflows
* deploy steps: the documentation is described in: https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-workflows/#api-rest-api-3-workflows-create-post
* the basic payload has this structure:
* {
*  statuses: [statusList from the workflow],
*  workflows: [instance.value],
* }
* each status from the list has a unique uuid, which is used to refer the status in the workflow
* if there is a modification that removes a status from an active workflow we need status mappings to migrate the issues
*/
const filter: FilterCreator = ({ config, client, paginator, fetchQuery, elementsSource }) => {
  const statusIdToUuid: Record<string, string> = {}
  const originalChanges: Record<string, AdditionChange<InstanceElement> | ModificationChange<InstanceElement>> = {}
  const replaceStatusIdWithUuid: WalkOnFunc = ({ value, path }) => {
    const isValueToRecurse = value.to || value.from || _.isArray(value)
    if (isInstanceElement(value)
      || PATH_NAME_TO_RECURSE.has(path.name)
      || isValueToRecurse) {
      return WALK_NEXT_STEP.RECURSE
    }
    if (value.statusReference) {
      value.statusReference = statusIdToUuid[value.statusReference]
    }
    if (value.oldStatusReference) {
      value.oldStatusReference = statusIdToUuid[value.oldStatusReference]
    }
    if (value.newStatusReference) {
      value.newStatusReference = statusIdToUuid[value.newStatusReference]
    }
    return WALK_NEXT_STEP.SKIP
  }
  return {
    name: 'workflowFilter',
    onFetch: async (elements: Element[]) => {
      if (!config.fetch.enableNewWorkflowAPI || !fetchQuery.isTypeMatch(JIRA_WORKFLOW_TYPE)) {
        return { errors: [] }
      }
      const jiraWorkflow = findObject(elements, JIRA_WORKFLOW_TYPE)
      if (jiraWorkflow === undefined) {
        log.error('JiraWorkflow type was not found')
        return {
          errors: [workflowFetchError()],
        }
      }
      setTypeDeploymentAnnotations(jiraWorkflow)
      await addAnnotationRecursively(jiraWorkflow, CORE_ANNOTATIONS.CREATABLE)
      await addAnnotationRecursively(jiraWorkflow, CORE_ANNOTATIONS.UPDATABLE)
      await addAnnotationRecursively(jiraWorkflow, CORE_ANNOTATIONS.DELETABLE)
      const { workflowIds, errors: fetchWorkflowIdsErrors } = await fetchWorkflowIds(paginator)
      if (!_.isEmpty(fetchWorkflowIdsErrors)) {
        return { errors: fetchWorkflowIdsErrors }
      }
      const workflowChunks = _.chunk(workflowIds, CHUNK_SIZE)
      const errors: SaltoError[] = []
      await awu(workflowChunks).forEach(async chunk => {
        const { workflowInstances, errors: createWorkflowInstancesErrors } = await createWorkflowInstances(
          client, chunk, jiraWorkflow
        )
        errors.push(...(createWorkflowInstancesErrors ?? []))
        elements.push(...(workflowInstances ?? []))
      })
      return { errors }
    },
    preDeploy: async changes => {
      await awu(changes)
        .filter(isInstanceChange)
        .filter(isAdditionOrModificationChange)
        .filter(change => getChangeData(change).elemID.typeName === JIRA_WORKFLOW_TYPE)
        .forEach(async change => {
          const workflowInstance = getChangeData(change)
          originalChanges[workflowInstance.elemID.getFullName()] = _.cloneDeep(change)
          const statusInstances = getStatusInstances(change)
          insertUuidMap(statusInstances, statusIdToUuid)
          const resolvedWorkflowInstance = await resolveValues(workflowInstance, getLookUpName)
          convertTransitionParametersFields(resolvedWorkflowInstance.value.transitions, convertParametersFieldsToString)
          walkOnElement({ element: resolvedWorkflowInstance, func: replaceStatusIdWithUuid })
          const statusesPayload = getStatusesPayload(statusInstances, statusIdToUuid)
          insertUuidsToStatusMappings(resolvedWorkflowInstance, statusIdToUuid)
          workflowInstance.value = getWorkflowPayload(
            isAdditionChange(change),
            resolvedWorkflowInstance,
            statusesPayload,
          )
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
            ? await getNewVersionFromService(workflow.name, client) ?? workflow.version
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
