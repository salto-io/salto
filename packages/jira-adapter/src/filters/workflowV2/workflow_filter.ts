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
import { collections, values } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { WALK_NEXT_STEP, WalkOnFunc, isResolvedReferenceExpression, walkOnElement } from '@salto-io/adapter-utils'
import {
  elements as adapterElements,
  config as configUtils,
  client as clientUtils,
  resolveValues,
} from '@salto-io/adapter-components'
import {
  CORE_ANNOTATIONS,
  Element,
  InstanceElement,
  ObjectType,
  SaltoError,
  AdditionChange,
  Change,
  ChangeDataType,
  getChangeData,
  isAdditionChange,
  isInstanceElement,
  isModificationChange,
  ModificationChange,
  ReadOnlyElementsSource,
  ReferenceExpression,
  Values,
  ElemID,
  Field,
} from '@salto-io/adapter-api'
import { v4 as uuidv4 } from 'uuid'
import { FilterCreator } from '../../filter'
import {
  addAnnotationRecursively,
  convertPropertiesToList,
  convertPropertiesToMap,
  findObject,
  setTypeDeploymentAnnotations,
} from '../../utils'
import {
  CHUNK_SIZE,
  isWorkflowDataResponse,
  isWorkflowResponse,
  isTaskResponse,
  STATUS_CATEGORY_ID_TO_KEY,
  TASK_STATUS,
  WorkflowPayload,
  WorkflowVersion,
  CONDITION_LIST_FIELDS,
  VALIDATOR_LIST_FIELDS,
  ID_TO_UUID_PATH_NAME_TO_RECURSE,
  isAdditionOrModificationWorkflowChange,
  CONDITION_GROUPS_PATH_NAME_TO_RECURSE,
  WorkflowStatus,
} from './types'
import { DEFAULT_API_DEFINITIONS } from '../../config/api_config'
import { WORKFLOW_CONFIGURATION_TYPE } from '../../constants'
import JiraClient from '../../client/client'
import { defaultDeployChange, deployChanges } from '../../deployment/standard_deployment'
import { getLookUpName } from '../../reference_mapping'
import { JiraConfig } from '../../config/config'
import { transformTransitions } from '../workflow/transition_structure'
import { scriptRunnerObjectType } from '../workflow/post_functions_types'

const log = logger(module)
const { awu } = collections.asynciterable
const { makeArray } = collections.array
const { toBasicInstance } = adapterElements
const { getTransformationConfigByType } = configUtils

const workflowFetchError = (errorMessage?: string): SaltoError => ({
  message: errorMessage ? `Failed to fetch Workflows: ${errorMessage}.` : 'Failed to fetch Workflows.',
  severity: 'Error',
})

type WorkflowDataOrFilterResult = {
  workflowIdToStatuses: Record<string, WorkflowStatus[]>
  errors?: SaltoError[]
}

type WorkflowInstancesOrFilterResult = {
  workflowInstances?: InstanceElement[]
  errors?: SaltoError[]
}

const fetchWorkflowData = async (paginator: clientUtils.Paginator): Promise<WorkflowDataOrFilterResult> => {
  const paginationArgs = {
    url: '/rest/api/3/workflow/search',
    paginationField: 'startAt',
    queryParams: {
      expand: 'statuses',
    },
  }
  const workflowValues = await awu(
    paginator(paginationArgs, page => makeArray(page.values) as clientUtils.ResponseValue[]),
  )
    .flat()
    .toArray()
  if (!isWorkflowDataResponse(workflowValues)) {
    return {
      errors: [workflowFetchError()],
      workflowIdToStatuses: {},
    }
  }
  const workflowIdToStatuses: Record<string, WorkflowStatus[]> = Object.fromEntries(
    workflowValues.map(workflow => [workflow.id.entityId, workflow.statuses]),
  )
  return { workflowIdToStatuses }
}

const convertIdsStringToList = (ids: string): string[] => ids.split(',')

const convertTransitionParametersFields = (
  transitions: Values[],
  convertFunc: (parameters: Values, fieldSet: Set<string>) => void,
): void => {
  transitions?.forEach((transition: Values) => {
    transition.conditions?.conditions?.forEach((condition: Values) => {
      convertFunc(condition?.parameters, CONDITION_LIST_FIELDS)
    })
    transition.validators?.forEach((validator: Values) => {
      convertFunc(validator?.parameters, VALIDATOR_LIST_FIELDS)
    })
  })
}

export const convertParametersFieldsToList = (parameters: Values, listFields: Set<string>): void => {
  if (parameters === undefined) {
    return
  }
  Object.entries(parameters)
    .filter(([key, value]) => !_.isEmpty(value) && _.isString(value) && listFields.has(key))
    .forEach(([key, value]) => {
      parameters[key] = convertIdsStringToList(value)
    })
}

const createWorkflowInstances = async ({
  client,
  workflowIds,
  workflowConfigurationType,
  workflowIdToStatuses,
}: {
  client: JiraClient
  workflowIds: string[]
  workflowConfigurationType: ObjectType
  workflowIdToStatuses: Record<string, WorkflowStatus[]>
}): Promise<WorkflowInstancesOrFilterResult> => {
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
    const errors: SaltoError[] = []
    const workflowInstances = (
      await Promise.all(
        response.data.workflows.map(async workflow => {
          convertTransitionParametersFields(workflow.transitions, convertParametersFieldsToList)
          convertPropertiesToList([...(workflow.statuses ?? []), ...(workflow.transitions ?? [])])
          if (workflow.id === undefined) {
            // should never happen
            errors.push(workflowFetchError('Workflow id is missing'))
            return undefined
          }
          // convert transition list to map
          const [error] = transformTransitions(workflow, workflowIdToStatuses[workflow.id])
          if (error) {
            errors.push(error)
            return undefined
          }
          return toBasicInstance({
            entry: workflow,
            type: workflowConfigurationType,
            transformationConfigByType: getTransformationConfigByType(DEFAULT_API_DEFINITIONS.types),
            transformationDefaultConfig: DEFAULT_API_DEFINITIONS.typeDefaults.transformation,
            defaultName: workflow.name,
          })
        }),
      )
    ).filter(values.isDefined)
    return { workflowInstances, errors }
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
  workflowName,
}: {
  client: JiraClient
  taskId: string
  retries: number
  delay: number
  workflowName: string
}): Promise<void> => {
  const taskResponse = (
    await client.getPrivate({
      url: `/rest/api/3/task/${taskId}`,
    })
  ).data
  if (!isTaskResponse(taskResponse)) {
    return
  }
  switch (taskResponse.status) {
    case TASK_STATUS.COMPLETE:
      log.debug(`Status migration completed for workflow: ${workflowName}`)
      return
    case TASK_STATUS.CANCELLED:
    case TASK_STATUS.FAILED:
    case TASK_STATUS.CANCEL_REQUESTED:
    case TASK_STATUS.DEAD:
      log.error(`Status migration failed for workflow: ${workflowName}, with status ${taskResponse.status}`)
      return
    case TASK_STATUS.RUNNING:
    case TASK_STATUS.ENQUEUED:
      if (retries === 0) {
        log.error(
          `Failed to run status migration for workflow: ${workflowName} - did not receive success response after await timeout`,
        )
        return
      }
      log.debug(`Status migration did not complete for workflow: ${workflowName}, retrying`)
      // delay because we need to wait for the migration to complete
      // jira task documentation: https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-tasks/#api-rest-api-3-task-taskid-get
      await new Promise(resolve => setTimeout(resolve, delay))
      await awaitSuccessfulMigration({
        client,
        taskId,
        retries: retries - 1,
        delay,
        workflowName,
      })
      return
    default:
      log.error(`Status migration failed for workflow: ${workflowName}, with unknown status ${taskResponse.status}`)
  }
}

const getStatusesPayload = (statuses: InstanceElement[], statusIdToUuid: Record<string, string>): Values[] =>
  statuses
    .filter(instance => isResolvedReferenceExpression(instance.value?.statusCategory))
    .filter(instance => isInstanceElement(instance.value.statusCategory.value))
    .filter(instance => instance.value.statusCategory.value.value.id !== undefined)
    .map(statusInstance => {
      const statusCategoryId = statusInstance.value.statusCategory.value.value.id
      return {
        ...statusInstance.value,
        statusCategory: STATUS_CATEGORY_ID_TO_KEY[statusCategoryId],
        statusReference: statusIdToUuid[statusInstance.value.id],
      }
    })

const getStatusReferenceInstances = (instance: InstanceElement): InstanceElement[] => {
  if (!instance.value.statuses) {
    return []
  }
  return instance.value.statuses
    .map((status: Values) => status?.statusReference)
    .filter(isResolvedReferenceExpression)
    .map((statusReference: ReferenceExpression) => statusReference.value)
    .filter(isInstanceElement)
}

const getStatusInstances = (
  change: AdditionChange<InstanceElement> | ModificationChange<InstanceElement>,
): InstanceElement[] => {
  const { after: afterInstance } = change.data
  const afterStatusInstances = getStatusReferenceInstances(afterInstance)
  if (isModificationChange(change)) {
    const { before: beforeInstance } = change.data
    const beforeStatusInstances = getStatusReferenceInstances(beforeInstance)
    const statusInstances = _.uniqBy([...afterStatusInstances, ...beforeStatusInstances], statusInstance =>
      statusInstance.elemID.getFullName(),
    )
    return statusInstances
  }
  return afterStatusInstances
}

const getUuidMap = (statusesValues: InstanceElement[]): Record<string, string> => {
  const statusIdToUuid: Record<string, string> = {}
  statusesValues.forEach(status => {
    statusIdToUuid[status.value.id] = uuidv4()
  })
  return statusIdToUuid
}

const getNewVersionFromService = async (
  workflowName: string,
  client: JiraClient,
): Promise<WorkflowVersion | undefined> => {
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
): WorkflowPayload => {
  const basicPayload = {
    statuses: statusesPayload,
    workflows: [resolvedWorkflowInstance.value],
  }
  const workflowPayload = isAddition
    ? {
        scope: resolvedWorkflowInstance.value.scope,
        ...basicPayload,
      }
    : basicPayload
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
    if (path.nestingLevel === 3 && path.createParentID(2).name === 'workflows') {
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
    await awaitSuccessfulMigration({
      client,
      retries: config.deploy.taskMaxRetries,
      delay: config.deploy.taskRetryDelay,
      taskId: response.taskId,
      workflowName: instance.elemID.name,
    })
  }
}

const convertParametersFieldsToString = (parameters: Values, listFields: Set<string>): void => {
  if (parameters === undefined) {
    return
  }
  Object.entries(parameters)
    .filter(([key, value]) => _.isArray(value) && listFields.has(key))
    .forEach(([key, value]) => {
      parameters[key] = value.join(',')
    })
}

// Jira has a bug that causes conditionGroups to be required in the deployment requests
// We should remove this once the bug is fixed - https://jira.atlassian.com/browse/JRACLOUD-82794
const insertConditionGroups: WalkOnFunc = ({ value, path }): WALK_NEXT_STEP => {
  if (_.isPlainObject(value) && value.operation && value.conditionGroups === undefined) {
    value.conditionGroups = []
  }
  if (
    isInstanceElement(value) ||
    CONDITION_GROUPS_PATH_NAME_TO_RECURSE.has(path.name) ||
    (_.isPlainObject(value) && value.conditions)
  ) {
    return WALK_NEXT_STEP.RECURSE
  }
  return WALK_NEXT_STEP.SKIP
}

const replaceStatusIdWithUuid =
  (statusIdToUuid: Record<string, string>): WalkOnFunc =>
  ({ value, path }): WALK_NEXT_STEP => {
    const isValueToRecurse =
      (_.isPlainObject(value) && (value.to || value.from || value.statusMigrations)) || _.isArray(value)
    if (isInstanceElement(value) || ID_TO_UUID_PATH_NAME_TO_RECURSE.has(path.name) || isValueToRecurse) {
      return WALK_NEXT_STEP.RECURSE
    }
    if (!_.isPlainObject(value)) {
      return WALK_NEXT_STEP.SKIP
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

const getWorkflowForDeploy = async (
  workflowInstance: InstanceElement,
  statusIdToUuid: Record<string, string>,
): Promise<InstanceElement> => {
  const resolvedInstance = await resolveValues(workflowInstance, getLookUpName)
  resolvedInstance.value.transitions = Object.values(resolvedInstance.value.transitions ?? [])
  convertTransitionParametersFields(resolvedInstance.value.transitions, convertParametersFieldsToString)
  convertPropertiesToMap([...(resolvedInstance.value.statuses ?? []), ...(resolvedInstance.value.transitions ?? [])])
  walkOnElement({ element: resolvedInstance, func: replaceStatusIdWithUuid(statusIdToUuid) })
  walkOnElement({ element: resolvedInstance, func: insertConditionGroups })
  return resolvedInstance
}

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
  const originalInstances: Record<string, InstanceElement> = {}
  return {
    name: 'workflowFilter',
    onFetch: async (elements: Element[]) => {
      if (!config.fetch.enableNewWorkflowAPI || !fetchQuery.isTypeMatch(WORKFLOW_CONFIGURATION_TYPE)) {
        return { errors: [] }
      }
      const workflowConfiguration = findObject(elements, WORKFLOW_CONFIGURATION_TYPE)
      if (workflowConfiguration === undefined) {
        log.error('WorkflowConfiguration type was not found')
        return {
          errors: [workflowFetchError()],
        }
      }
      setTypeDeploymentAnnotations(workflowConfiguration)
      await addAnnotationRecursively(workflowConfiguration, CORE_ANNOTATIONS.CREATABLE)
      await addAnnotationRecursively(workflowConfiguration, CORE_ANNOTATIONS.UPDATABLE)
      await addAnnotationRecursively(workflowConfiguration, CORE_ANNOTATIONS.DELETABLE)

      const workflowRuleConfigurationParameters = findObject(elements, 'WorkflowRuleConfiguration_parameters')
      if (workflowRuleConfigurationParameters !== undefined) {
        workflowRuleConfigurationParameters.fields.scriptRunner = new Field(
          workflowRuleConfigurationParameters,
          'scriptRunner',
          scriptRunnerObjectType,
          { [CORE_ANNOTATIONS.CREATABLE]: true, [CORE_ANNOTATIONS.UPDATABLE]: true },
        )
      }
      const { workflowIdToStatuses, errors: fetchWorkflowDataErrors } = await fetchWorkflowData(paginator)
      if (!_.isEmpty(fetchWorkflowDataErrors)) {
        return { errors: fetchWorkflowDataErrors }
      }
      const workflowChunks = _.chunk(Object.keys(workflowIdToStatuses ?? []), CHUNK_SIZE)
      const errors: SaltoError[] = []
      await awu(workflowChunks).forEach(async chunk => {
        const { workflowInstances, errors: createWorkflowInstancesErrors } = await createWorkflowInstances({
          client,
          workflowIds: chunk,
          workflowConfigurationType: workflowConfiguration,
          workflowIdToStatuses,
        })
        errors.push(...(createWorkflowInstancesErrors ?? []))
        elements.push(...(workflowInstances ?? []))
      })
      return { errors }
    },
    preDeploy: async changes => {
      await awu(changes)
        .filter(isAdditionOrModificationWorkflowChange)
        .forEach(async change => {
          const workflowInstance = getChangeData(change)
          originalInstances[workflowInstance.elemID.getFullName()] = workflowInstance.clone()
          const statusInstances = getStatusInstances(change)
          const statusIdToUuid = getUuidMap(statusInstances)
          const statusesPayload = getStatusesPayload(statusInstances, statusIdToUuid)
          workflowInstance.value = getWorkflowPayload(
            isAdditionChange(change),
            await getWorkflowForDeploy(workflowInstance, statusIdToUuid),
            statusesPayload,
          )
        })
    },
    deploy: async changes => {
      const [relevantChanges, leftoverChanges] = _.partition(changes, isAdditionOrModificationWorkflowChange)
      const deployResult = await deployChanges(relevantChanges, async change =>
        deployWorkflow({
          change,
          client,
          config,
          elementsSource,
        }),
      )
      return {
        leftoverChanges,
        deployResult,
      }
    },
    onDeploy: async (changes: Change<ChangeDataType>[]) => {
      await awu(changes)
        .filter(isAdditionOrModificationWorkflowChange)
        .forEach(async change => {
          const instance = getChangeData(change)
          const originalInstance = originalInstances[instance.elemID.getFullName()]
          const workflow = getChangeData(change).value.workflows[0]
          const isMigrationDone = workflow.statusMappings !== undefined
          const version = isMigrationDone
            ? (await getNewVersionFromService(workflow.name, client)) ?? workflow.version
            : workflow.version
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
