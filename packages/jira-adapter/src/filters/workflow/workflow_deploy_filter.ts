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
import { AdditionChange, Change, ElemID, getChangeData, InstanceElement, isAdditionChange, isInstanceChange, isRemovalChange, RemovalChange } from '@salto-io/adapter-api'
import Joi from 'joi'
import { resolveChangeElement, walkOnValue, WALK_NEXT_STEP, inspectValue } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../../filter'
import { isPostFetchWorkflowChange, PostFetchWorkflowInstance, Transition, WORKFLOW_RESPONSE_SCHEMA, WorkflowInstance, WorkflowResponse } from './types'
import JiraClient from '../../client/client'
import { JiraConfig } from '../../config/config'
import { getLookUpName } from '../../reference_mapping'
import { defaultDeployChange, deployChanges } from '../../deployment/standard_deployment'
import { JIRA, WORKFLOW_TYPE_NAME } from '../../constants'
import { deployTriggers } from './triggers_deployment'
import { deploySteps } from './steps_deployment'
import { fixGroupNames } from './groups_filter'
import { deployWorkflowDiagram, hasDiagramFields, removeWorkflowDiagramFields } from './workflow_diagrams'
import { expectedToActualTransitionIds, createStatusMap, transitionKeysToExpectedIds, walkOverTransitionIds, getTransitionKey } from './transition_structure'
import { decodeCloudFields, encodeCloudFields } from '../script_runner/workflow/workflow_cloud'

const log = logger(module)

export const INITIAL_VALIDATOR = {
  type: 'PermissionValidator',
  configuration: {
    permissionKey: 'CREATE_ISSUES',
  },
}

const isValidTransitionResponse = (response: unknown): response is { values: [WorkflowResponse] } => {
  const { error } = Joi.object({
    values: Joi.array().min(1).max(1).items(WORKFLOW_RESPONSE_SCHEMA),
  }).unknown(true).required().validate(response)

  if (error !== undefined) {
    log.warn(`Unexpected workflows response from Jira: ${error}. ${inspectValue(response)}`)
    return false
  }
  return true
}

// needed for transitionIds
const getTransitionsFromService = async (
  client: JiraClient,
  workflowName: string,
): Promise<Transition[]> => {
  const response = await client.getSinglePage({
    url: '/rest/api/3/workflow/search',
    queryParams: {
      expand: 'transitions',
      workflowName,
    },
  })

  if (!isValidTransitionResponse(response.data)) {
    return []
  }

  const workflowValues = response.data.values[0]
  return workflowValues.transitions ?? []
}

const sameTransitionIds = (
  transitions: Transition[],
  otherTransitions: Transition[],
  statusesMap: Map<string, string>
): boolean => {
  const transitionIds = Object.fromEntries(transitions.map(
    transition => [transition.id, getTransitionKey(transition, statusesMap)]
  ))
  const otherTransitionIds = Object.fromEntries(otherTransitions.map(
    transition => [transition.id, getTransitionKey(transition, statusesMap)]
  ))
  return _.isEqual(transitionIds, otherTransitionIds)
}

/**
 * When creating a workflow, the initial transition is always created
 * with an extra PermissionValidator with CREATE_ISSUES permission key.
 * Currently the API does not allow us to remove it but we can at least make sure to
 * not create an additional one if one validator like that already appears in the nacl.
 */
const removeCreateIssuePermissionValidator = (instance: WorkflowInstance): void => {
  Object.values(instance.value.transitions)
    .filter(transition => transition.type === 'initial')
    .forEach(transition => {
      const createIssuePermissionValidatorIndex = _.findLastIndex(
        transition.rules?.validators ?? [],
        validator => _.isEqual(
          validator,
          INITIAL_VALIDATOR,
        ),
      )

      _.remove(
        transition.rules?.validators ?? [],
        (_validator, index) => index === createIssuePermissionValidatorIndex,
      )
    })
}

const changeIdsToString = (
  values: Record<string | number, unknown>,
): void => {
  walkOnValue({
    elemId: new ElemID(JIRA, WORKFLOW_TYPE_NAME, 'instance', 'workflow'),
    value: values,
    func: ({ value }) => {
      if (typeof value.id === 'number') {
        value.id = value.id.toString()
      }
      return WALK_NEXT_STEP.RECURSE
    },
  })
}

const workflowTransitionsToList = (workflowInstance: InstanceElement): void => {
  workflowInstance.value.transitions = Object.values(workflowInstance.value.transitions)
}

const addTransitionIdsToInstance = (
  workflowInstance: WorkflowInstance,
  transitions: Transition[],
  statusesMap: Map<string, string>
): void => {
  const transitionIds = Object.fromEntries(transitions.map(
    transition => [getTransitionKey(transition, statusesMap), transition.id]
  ))
  Object.entries(workflowInstance.value.transitions).forEach(([key, transition]) => {
    transition.id = transitionIds[key]
  })
}

const deployWithClone = async (
  resolvedChange: Change<PostFetchWorkflowInstance>,
  client: JiraClient,
  config: JiraConfig
): Promise<void> => {
  const resolvedChangeForDeployment = _.cloneDeep(resolvedChange)
  const deployInstance = getChangeData(resolvedChangeForDeployment)
  if (!isRemovalChange(resolvedChange)) {
    removeWorkflowDiagramFields(deployInstance)
    workflowTransitionsToList(deployInstance)
  }
  await defaultDeployChange({
    change: resolvedChangeForDeployment,
    client,
    apiDefinitions: config.apiDefinitions,
    fieldsToIgnore: path => path.name === 'triggers'
      // Matching here the 'name' of status inside the statuses array
      // In DC we support passing the step name as part of the request
      || (!client.isDataCenter && path.name === 'name' && path.getFullNameParts().includes('statuses')),
  })
  getChangeData(resolvedChange).value.entityId = deployInstance.value.entityId
}

const verifyAndFixTransitionReferences = async ({
  transitions,
  expectedTransitionIds,
  statusesMap,
  client,
  config,
  resolvedChange,
} : {
  transitions: Transition[]
  expectedTransitionIds: Map<string, string>
  statusesMap: Map<string, string>
  client: JiraClient
  config: JiraConfig
  resolvedChange: Change<PostFetchWorkflowInstance>
}): Promise<Transition[]> => {
  const transitionIdsMap = expectedToActualTransitionIds({
    transitions,
    expectedTransitionIds,
    statusesMap,
  })
  if (Object.keys(transitionIdsMap).length === 0) {
    return transitions
  }
  const originalInstance = getChangeData(resolvedChange)
  walkOnValue({ elemId: originalInstance.elemID.createNestedID('transitions'),
    value: originalInstance.value.transitions,
    func: decodeCloudFields })

  // a function as the transitions changed type to an array
  const updateTransitionReferenceIds = (
    transitionsArray: Record<string, Transition>,
  ): void => {
    Object.values(transitionsArray).forEach((transition: Transition) => {
      walkOverTransitionIds(transition, scriptRunner => {
        scriptRunner.transitionId = transitionIdsMap[scriptRunner.transitionId] ?? scriptRunner.transitionId
      })
    })
  }

  updateTransitionReferenceIds(originalInstance.value.transitions)
  walkOnValue({ elemId: originalInstance.elemID.createNestedID('transitions'),
    value: originalInstance.value.transitions,
    func: encodeCloudFields })

  await deployWithClone(resolvedChange, client, config)

  const newTransitions = await getTransitionsFromService(client, originalInstance.value.name)
  if (!sameTransitionIds(transitions, newTransitions, statusesMap)) {
    throw new Error('Failed to deploy workflow, transition ids changed')
  }
  return newTransitions
}

export const deployWorkflow = async (
  change: AdditionChange<InstanceElement> | RemovalChange<InstanceElement>,
  client: JiraClient,
  config: JiraConfig,
): Promise<void> => {
  const resolvedChange = await resolveChangeElement(change, getLookUpName)

  if (!isPostFetchWorkflowChange(resolvedChange)
    || !isPostFetchWorkflowChange(change)) {
    const instance = getChangeData(resolvedChange)
    log.error(`values ${inspectValue(instance.value)} of instance ${instance.elemID.getFullName} are invalid`)
    throw new Error(`instance ${instance.elemID.getFullName()} is not valid for deployment`)
  }
  const instance = getChangeData(resolvedChange)
  removeCreateIssuePermissionValidator(instance)
  Object.values(instance.value.transitions).forEach(transition => {
    changeIdsToString(transition.rules?.conditions ?? {})
  })

  fixGroupNames(instance)
  const expectedTransitionIds = transitionKeysToExpectedIds(instance)
  await deployWithClone(resolvedChange, client, config)

  if (isRemovalChange(resolvedChange)) {
    return
  }
  let transitions = await getTransitionsFromService(client, instance.value.name)
  const statusesMap = createStatusMap(instance.value.statuses ?? [])
  if (config.fetch.enableScriptRunnerAddon
    && !client.isDataCenter) {
    transitions = await verifyAndFixTransitionReferences({
      transitions,
      expectedTransitionIds,
      statusesMap,
      client,
      config,
      resolvedChange,
    })
  }
  // ids are added for trigger deployment and onDeploy filters, will be removed in the ids filter
  [getChangeData(change), instance].forEach(instanceToChange => {
    addTransitionIdsToInstance(instanceToChange, transitions, statusesMap)
  })
  if (hasDiagramFields(instance)) {
    try {
      await deployWorkflowDiagram({ instance, client })
    } catch (e) {
      log.error(`Fail to deploy Workflow ${instance.value.name} diagram with the error: ${e.message}`)
    }
  }

  if (isAdditionChange(resolvedChange)) {
    getChangeData(change).value.entityId = instance.value.entityId
    // If we created the workflow we can edit it
    getChangeData(change).value.operations = { canEdit: true }

    if (config.client.usePrivateAPI) {
      await deployTriggers(resolvedChange, client)
      // No need to run in DC since the main deployment requests already supports deploying steps
      if (!client.isDataCenter) {
        // as is done since it was already verified on the resolved change
        await deploySteps(getChangeData(change) as WorkflowInstance, client)
      }
    }
  }
}

// This filter transforms the workflow values structure so it will fit its deployment endpoint
const filter: FilterCreator = ({ config, client }) => ({
  name: 'workflowDeployFilter',
  deploy: async changes => {
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change)
        && isAdditionChange(change)
        && getChangeData(change).elemID.typeName === WORKFLOW_TYPE_NAME
    )

    const deployResult = await deployChanges(
      relevantChanges
        .filter(isInstanceChange)
        .filter(isAdditionChange),
      async change => deployWorkflow(change, client, config)
    )

    return {
      leftoverChanges,
      deployResult,
    }
  },
})

export default filter
