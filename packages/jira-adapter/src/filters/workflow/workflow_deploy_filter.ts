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
import { AdditionChange, ElemID, getChangeData, InstanceElement, isAdditionChange, isInstanceChange, RemovalChange } from '@salto-io/adapter-api'
import _ from 'lodash'
import { resolveChangeElement, safeJsonStringify, walkOnValue, WALK_NEXT_STEP, elementExpressionStringifyReplacer } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../../filter'
import { isPostFetchWorkflowInstance, WorkflowInstance } from './types'
import JiraClient from '../../client/client'
import { JiraConfig } from '../../config/config'
import { getLookUpName } from '../../reference_mapping'
import { defaultDeployChange, deployChanges } from '../../deployment/standard_deployment'
import { JIRA, WORKFLOW_TYPE_NAME } from '../../constants'
import { deployTriggers } from './triggers_deployment'
import { deploySteps } from './steps_deployment'
import { fixGroupNames } from './groups_filter'

const log = logger(module)

export const INITIAL_VALIDATOR = {
  type: 'PermissionValidator',
  configuration: {
    permissionKey: 'CREATE_ISSUES',
  },
}

/**
 * When creating a workflow, the initial transition is always created
 * with an extra PermissionValidator with CREATE_ISSUES permission key.
 * Currently the API does not allow us to remove it but we can at least make sure to
 * not create an additional one if one validator like that already appears in the nacl.
 */
const removeCreateIssuePermissionValidator = (instance: WorkflowInstance): void => {
  instance.value.transitions
    ?.filter(transition => transition.type === 'initial')
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

export const deployWorkflow = async (
  change: AdditionChange<InstanceElement> | RemovalChange<InstanceElement>,
  client: JiraClient,
  config: JiraConfig,
): Promise<void> => {
  const resolvedChange = await resolveChangeElement(change, getLookUpName)
  const instance = getChangeData(resolvedChange)
  if (!isPostFetchWorkflowInstance(instance)) {
    log.error(`values ${safeJsonStringify(instance.value, elementExpressionStringifyReplacer)} of instance ${instance.elemID.getFullName} are invalid`)
    throw new Error(`instance ${instance.elemID.getFullName()} is not valid for deployment`)
  }
  removeCreateIssuePermissionValidator(instance)
  instance.value.transitions?.forEach(transition => {
    changeIdsToString(transition.rules?.conditions ?? {})
  })

  fixGroupNames(instance)

  await defaultDeployChange({
    change: resolvedChange,
    client,
    apiDefinitions: config.apiDefinitions,
    fieldsToIgnore: path => path.name === 'triggers'
      // Matching here the 'name' of status inside the statuses array
      // In DC we support passing the step name as part of the request
      || (!client.isDataCenter && path.name === 'name' && path.getFullNameParts().includes('statuses')),
  })

  if (isAdditionChange(resolvedChange)) {
    getChangeData(change).value.entityId = instance.value.entityId
    // If we created the workflow we can edit it
    getChangeData(change).value.operations = { canEdit: true }

    if (config.client.usePrivateAPI) {
      await deployTriggers(resolvedChange, client)
      // No need to run in DC since the main deployment requests already supports deploying steps
      if (!client.isDataCenter) {
        await deploySteps(getChangeData(change), client)
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
